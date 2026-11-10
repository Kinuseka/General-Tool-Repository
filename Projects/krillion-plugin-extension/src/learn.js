// What the game itself has taught us, kept across sessions (unlike the 12 h session memory).
//
// The model can't be retrained from here, so "learning" means measuring where it is wrong and
// putting that in front of it every time (in-context learning):
//   - results: for each prompt, which answers the game accepted (with the rarity it gave them),
//     which it rejected as not valid, which were valid but already used;
//   - calibration: the tier the model predicted for an answer vs the tier the game gave it;
//   - answer shape: do rejected answers run longer than accepted ones? (long, vague answers are how
//     models fake "rare"). Measured from every result seen, not only the model's own.
// Pure and plain-data so it can live in chrome.storage and be tested in node.
(function (root) {
  const AI = root.KrillionAI || (typeof require === 'function' ? require('./ai-core.js') : null);
  const { TIERS, normKey, answerKey, isDuplicate } = AI;

  const MAX_QUESTIONS = 300;
  const MAX_ANSWERS = 80; // per question
  const RECENT = 30; // calibration examples kept
  const MAX_LIST = 12; // answers per prompt sent to the model

  const tierIdx = (t) => TIERS.indexOf(t);
  const wordCount = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;

  const MAX_GAMES = 30; // finished-game summaries kept
  const MAX_INSIGHTS = 8; // local conclusions drawn from them
  const MAX_REFLECTIONS = 8; // lessons the AI wrote after games
  const IN_PROMPT_INSIGHTS = 3; // sent with a request
  const IN_PROMPT_REFLECTIONS = 4;

  const newLearned = () => ({
    v: 1,
    entries: {},
    cal: { n: 0, sum: 0, recent: [] },
    words: { acc: { n: 0, sum: 0 }, miss: { n: 0, sum: 0 } },
    games: [], // [{...summary}] newest last
    insights: [], // [{t, at}]
    reflections: [], // [{t, at, key}]
  });

  function cleanLearned(x) {
    const base = newLearned();
    if (!x || typeof x !== 'object' || !x.entries || typeof x.entries !== 'object') return base;
    return {
      v: 1,
      games: Array.isArray(x.games) ? x.games : [],
      insights: Array.isArray(x.insights) ? x.insights : [],
      reflections: Array.isArray(x.reflections) ? x.reflections : [],
      entries: x.entries,
      cal: { ...base.cal, ...(x.cal || {}), recent: Array.isArray(x.cal && x.cal.recent) ? x.cal.recent : [] },
      words: { acc: { ...base.words.acc, ...((x.words || {}).acc || {}) }, miss: { ...base.words.miss, ...((x.words || {}).miss || {}) } },
    };
  }

  function prune(L) {
    const keys = Object.keys(L.entries).sort((a, b) => L.entries[b].at - L.entries[a].at);
    keys.slice(MAX_QUESTIONS).forEach((k) => delete L.entries[k]);
  }

  function entryFor(L, question, now) {
    const key = normKey(question);
    return (L.entries[key] ||= { q: String(question), at: now, a: {} });
  }

  // ---- prompts that are the same, or alike -----------------------------------------------------
  // "Name an animal with flippers" and "Name an animal that has flippers" are the same question. Compared by their
  // content words (no "name", "a", "that", "with"...), numbers kept so "over $100,000" and "over $200,000" differ.
  const STOP = new Set(['name', 'a', 'an', 'the', 'of', 'in', 'that', 'with', 'has', 'have', 'had', 'is', 'are', 'was', 'were', 'to', 'for', 'from', 'and', 'or',
    'at', 'on', 'by', 'least', 'one', 'more', 'than', 'most', 'any', 'some', 'type', 'kind', 'thing', 'something', 'someone', 'who', 'which', 'whose', 'can', 'be',
    'it', 'its', 'this', 'these', 'those', 'their', 'there', 'as', 'into']);
  function tokens(q) {
    return new Set(
      (String(q).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
        .filter((t) => !STOP.has(t))
        .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t))
    );
  }
  function jaccard(a, b) {
    if (!a.size || !b.size) return 0;
    let both = 0;
    for (const x of a) if (b.has(x)) both++;
    return both / (a.size + b.size - both);
  }
  const SAME_PROMPT = 0.85; // at or above: the same question, worded differently
  const SIMILAR_PROMPT = 0.5; // between the two: a related question, offered only as a reference

  // The record for this prompt, then those for the same prompt worded differently.
  function group(L, question) {
    const key = normKey(question);
    const qt = tokens(question);
    const out = [];
    if (L.entries[key]) out.push(L.entries[key]);
    for (const [k, e] of Object.entries(L.entries)) if (k !== key && jaccard(qt, tokens(e.q)) >= SAME_PROMPT) out.push(e);
    return out;
  }

  // The answer record for `answer` in one prompt's record (created if new), tolerant of old records.
  const sameRec = (v, s) => isDuplicate(v.t, s) || (v.aka || []).some((a) => isDuplicate(a, s));
  function ensureSlot(e, answer) {
    let slot = Object.entries(e.a).find(([, v]) => sameRec(v, answer));
    if (!slot) {
      slot = [answerKey(answer), { t: String(answer).trim(), n: 0, miss: 0, taken: 0 }];
      e.a[slot[0]] = slot[1];
    }
    return slot[1];
  }

  // kind: 'accepted' (tier = the game's rarity) | 'miss' (not a valid answer) | 'taken' (valid, already used)
  // `answer` is the game's own term. `typed` (optional) is what the player typed when the game accepted
  // it as a different term (an alias or a fixed spelling): both count as correct and are one record,
  // with the typed form kept in `aka`.
  function recordResult(L, question, answer, { kind, tier, typed }, now) {
    if (!question || !String(answer || '').trim()) return;
    const e = entryFor(L, question, now);
    e.at = now;
    const same = (v, s) => isDuplicate(v.t, s) || (v.aka || []).some((a) => isDuplicate(a, s));
    // Same answer under a near-identical spelling, or under a known alias, is one record.
    let slot = Object.entries(e.a).find(([, v]) => same(v, answer) || (typed && same(v, typed)));
    if (!slot) {
      slot = [answerKey(answer), { t: String(answer).trim(), n: 0, miss: 0, taken: 0 }];
      e.a[slot[0]] = slot[1];
    }
    const rec = slot[1];
    const w = wordCount(answer);
    if (kind === 'accepted') {
      rec.n++;
      if (TIERS.includes(tier)) rec.tier = tier; // the game's latest rating
      const t = typed && String(typed).trim();
      if (t && !isDuplicate(t, rec.t) && !(rec.aka || []).some((a) => isDuplicate(a, t))) {
        rec.aka = [...(rec.aka || []), t].slice(-5); // "sea donkey" is accepted as "Threebanded Sheephead"
      }
      L.words.acc.n++;
      L.words.acc.sum += w;
    } else if (kind === 'miss') {
      rec.miss++;
      L.words.miss.n++;
      L.words.miss.sum += w;
    } else if (kind === 'taken') {
      rec.taken++;
    }
    const slots = Object.entries(e.a);
    if (slots.length > MAX_ANSWERS) {
      const weight = (v) => (v.n || 0) + (v.miss || 0) + (v.taken || 0) + (v.sug || 0) + (v.mine || 0);
      slots.sort((a, b) => weight(b[1]) - weight(a[1]));
      slots.slice(MAX_ANSWERS).forEach(([k]) => delete e.a[k]);
    }
    prune(L);
  }

  // The game accepted `typed` as `answer` (its own term). Records only the alias: the accepted answer itself
  // is counted by the game's own event, so this must not count it a second time. Safe in either order.
  function recordAlias(L, question, answer, typed, now) {
    const t = String(typed || '').trim();
    if (!question || !String(answer || '').trim() || !t || isDuplicate(t, answer)) return;
    const e = entryFor(L, question, now);
    e.at = now;
    const same = (v, s) => isDuplicate(v.t, s) || (v.aka || []).some((a) => isDuplicate(a, s));
    let slot = Object.entries(e.a).find(([, v]) => same(v, answer) || same(v, t));
    if (!slot) {
      slot = [answerKey(answer), { t: String(answer).trim(), n: 0, miss: 0, taken: 0 }];
      e.a[slot[0]] = slot[1];
    }
    const rec = slot[1];
    if (!isDuplicate(t, rec.t) && !(rec.aka || []).some((a) => isDuplicate(a, t))) rec.aka = [...(rec.aka || []), t].slice(-5);
  }

  // A finished game: keep its summary, and the conclusions drawn from it (insights = lines of plain text).
  function recordGame(L, summary, insights, now) {
    if (!summary || typeof summary !== 'object') return;
    L.games.push({ ...summary, at: now });
    if (L.games.length > MAX_GAMES) L.games = L.games.slice(-MAX_GAMES);
    for (const t of insights || []) {
      if (typeof t !== 'string' || !t.trim()) continue;
      L.insights = L.insights.filter((x) => x.t !== t); // the same conclusion again moves to the front
      L.insights.push({ t: t.trim(), at: now });
    }
    if (L.insights.length > MAX_INSIGHTS) L.insights = L.insights.slice(-MAX_INSIGHTS);
  }

  // Lessons the AI wrote about a game (see runReflect). Plain text, a sentence each.
  function addReflection(L, key, lessons, now) {
    for (const t of lessons || []) {
      if (typeof t !== 'string' || !t.trim()) continue;
      L.reflections = L.reflections.filter((x) => x.t !== t.trim());
      L.reflections.push({ t: t.trim(), at: now, key: String(key || '') });
    }
    if (L.reflections.length > MAX_REFLECTIONS) L.reflections = L.reflections.slice(-MAX_REFLECTIONS);
  }

  // ---- the ledger: for every prompt, what was seen, suggested, answered and how the game ruled -------------
  // Kept across sessions, per prompt (and per answer within it), so a prompt that comes back is not met cold:
  //   seen        how many different games / days this prompt appeared in
  //   per answer  sug / sugOk / sugBad   the AI suggested it / and the game accepted it / rejected it
  //               mine / mineBad         the player answered it and the game accepted / rejected it
  //               n / miss / taken       the game accepted / rejected / ruled "already used" (anyone's answer)
  //               pred                   the tier the AI predicted; tier = the game's real rating
  function recordSeen(L, question, gameKey, now) {
    if (!question) return;
    const e = entryFor(L, question, now);
    e.at = now;
    e.keys ||= [];
    if (gameKey) {
      if (e.keys.includes(gameKey)) return; // the same game showing the same prompt again is not a repeat
      e.keys.push(gameKey);
      if (e.keys.length > 20) e.keys.shift();
    }
    e.seen = (e.seen || 0) + 1;
  }

  // The AI offered this answer for this prompt (`rawTier` = what the AI itself predicted).
  function recordSuggested(L, question, answer, rawTier, now) {
    if (!question || !String(answer || '').trim()) return;
    const e = entryFor(L, question, now);
    e.at = now;
    const rec = ensureSlot(e, answer);
    rec.sug = (rec.sug || 0) + 1;
    if (TIERS.includes(rawTier)) rec.pred = rawTier;
  }

  // The game ruled on an answer the AI had suggested: 'accepted' | 'miss'.
  function markSuggestion(L, question, answer, verdict) {
    if (!question || (verdict !== 'accepted' && verdict !== 'miss')) return;
    const rec = ensureSlot(entryFor(L, question, Date.now()), answer);
    if (verdict === 'accepted') rec.sugOk = (rec.sugOk || 0) + 1;
    else rec.sugBad = (rec.sugBad || 0) + 1;
  }

  // The player answered this and the game ruled on it.
  function recordMine(L, question, answer, kind) {
    if (!question || (kind !== 'accepted' && kind !== 'miss')) return;
    const rec = ensureSlot(entryFor(L, question, Date.now()), answer);
    if (kind === 'accepted') rec.mine = (rec.mine || 0) + 1;
    else rec.mineBad = (rec.mineBad || 0) + 1;
  }

  // The game's own rating of an answer to this prompt, if it was ever accepted: {tier, n}.
  function knownTier(L, question, text) {
    for (const e of group(L, question)) {
      const v = Object.values(e.a).find((x) => x.n > 0 && x.tier && sameRec(x, text));
      if (v) return { tier: v.tier, n: v.n };
    }
    return null;
  }

  // Answers the game rejected on this prompt, to be refused if the AI repeats them. Matched EXACTLY by the
  // caller (never fuzzily): a rejected typo ("platapus") must not block the correct word ("platypus").
  // The AI's own rejected suggestions and the player's lead; other players' typos are at the back.
  function rejectedFor(L, question, limit = 30) {
    const rows = [];
    for (const e of group(L, question)) {
      for (const v of Object.values(e.a)) if (v.miss > 0 && !(v.n > 0) && !(v.taken > 0)) rows.push(v);
    }
    rows.sort((a, b) => (b.sugBad || 0) + (b.mineBad || 0) - ((a.sugBad || 0) + (a.mineBad || 0)) || b.miss - a.miss);
    return rows.slice(0, limit).map((v) => v.t);
  }

  // LOCAL tier correction: if the AI's labels have measurably run too rare or too common, shift them the same way.
  // Needs 8 compared answers and a shift of at least one whole tier. Never creates a "krillion" (there is only one
  // per prompt, and nothing here can know which answer it is) and never touches an existing one.
  function calibrateTier(L, tier) {
    const { n, sum } = L.cal;
    const shift = n >= 8 ? Math.round(sum / n) : 0;
    const i = tierIdx(tier);
    if (!shift || i < 0 || tier === 'krillion') return tier;
    return TIERS[Math.max(0, Math.min(tierIdx('deepcut'), i + shift))];
  }

  // What the app knows about one suggestion, applied before it is shown: the game's own rating beats the AI's
  // guess (and the answer is marked known); otherwise the AI's tier is corrected by the measured bias.
  // `raw` keeps what the AI itself said, so its accuracy is always measured against its own words.
  function enrich(L, question, item) {
    const out = { ...item };
    const kt = knownTier(L, question, out.text);
    if (kt) {
      if (out.tier && out.tier !== kt.tier) out.raw = out.tier;
      out.tier = kt.tier;
      out.known = kt.n;
      return out;
    }
    const adj = calibrateTier(L, out.tier);
    if (adj !== out.tier) {
      out.raw = out.tier;
      out.tier = adj;
    }
    return out;
  }

  // Related (not the same) prompts the game has asked before, with answers it accepted. Offered to the AI as
  // reference only: they may not fit THIS prompt.
  function similar(L, question, { limit = 3, per = 6 } = {}) {
    const key = normKey(question);
    const qt = tokens(question);
    const out = [];
    for (const [k, e] of Object.entries(L.entries)) {
      if (k === key) continue;
      const j = jaccard(qt, tokens(e.q));
      if (j < SIMILAR_PROMPT || j >= SAME_PROMPT) continue; // same-prompt wordings are merged by group()
      const answers = Object.values(e.a)
        .filter((v) => v.n > 0)
        .sort((a, b) => b.n - a.n)
        .slice(0, per)
        .map((v) => ({ text: v.t, tier: v.tier || null }));
      if (answers.length) out.push({ q: e.q, j, answers });
    }
    return out.sort((a, b) => b.j - a.j).slice(0, limit).map(({ q, answers }) => ({ q, answers }));
  }

  // Prompts that have come back, most repeated first, with how everything on them went.
  function ledger(L, { min = 2, limit = 8 } = {}) {
    const sum = (recs, k) => recs.reduce((n, v) => n + (v[k] || 0), 0);
    return Object.values(L.entries)
      .filter((e) => (e.seen || 0) >= min)
      .sort((a, b) => b.seen - a.seen || b.at - a.at)
      .slice(0, limit)
      .map((e) => {
        const recs = Object.values(e.a);
        return {
          q: e.q,
          seen: e.seen,
          known: recs.filter((v) => v.n > 0).length,
          sug: sum(recs, 'sug'), sugOk: sum(recs, 'sugOk'), sugBad: sum(recs, 'sugBad'),
          mine: sum(recs, 'mine'), mineBad: sum(recs, 'mineBad'),
        };
      });
  }

  // The model said `predicted`, the game said `actual`, for the same answer.
  function recordCalibration(L, question, answer, predicted, actual, now) {
    if (tierIdx(predicted) < 0 || tierIdx(actual) < 0) return;
    L.cal.n++;
    L.cal.sum += tierIdx(actual) - tierIdx(predicted);
    L.cal.recent.unshift({ q: String(question), a: String(answer), p: predicted, r: actual, at: now });
    L.cal.recent.length = Math.min(L.cal.recent.length, RECENT);
  }

  // Results on this exact prompt from earlier games.
  // (Merged across wordings of the same prompt.)
  function knownFor(L, question) {
    const all = group(L, question).flatMap((e) => Object.values(e.a));
    const accepted = all
      .filter((v) => v.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, MAX_LIST)
      .map((v) => ({ text: v.t, tier: v.tier || null, ...(v.aka && v.aka.length ? { aka: v.aka } : {}) }));
    return { accepted, rejected: rejectedFor(L, question, MAX_LIST) };
  }

  const avg = (o) => (o.n ? o.sum / o.n : null);

  // Plain-language conclusions drawn from the numbers, sent with every request.
  function lessons(L) {
    const out = [];
    const { n, sum, recent } = L.cal;
    if (n >= 5) {
      const bias = sum / n;
      if (bias <= -0.5) {
        out.push(
          `Your rarity labels overstate rarity: the game rated your answers about ${Math.abs(bias).toFixed(1)} tiers MORE common than you labelled them (over ${n} answers). Label conservatively, and prefer answers few players would think of over ones that merely sound unusual.`
        );
      } else if (bias >= 0.5) {
        out.push(`Your rarity labels understate rarity: the game rated your answers about ${bias.toFixed(1)} tiers rarer than you labelled them (over ${n} answers).`);
      }
      const misses = recent.filter((r) => r.p !== r.r).slice(0, 5);
      if (misses.length) {
        out.push(`Recent label mistakes: ${misses.map((r) => `"${r.a}" you said ${r.p}, the game said ${r.r}`).join('; ')}.`);
      }
    }
    const a = avg(L.words.acc);
    const m = avg(L.words.miss);
    if (L.words.acc.n >= 6 && L.words.miss.n >= 6 && m - a >= 0.6) {
      out.push(
        `Rejected answers averaged ${m.toFixed(1)} words but accepted ones ${a.toFixed(1)}: prefer short, specific names over long or vague phrases.`
      );
    }
    // What finished games have taught: the newest conclusions, then the AI's own reflections on them.
    for (const x of L.insights.slice(-IN_PROMPT_INSIGHTS)) out.push(`From a recent game: ${x.t}`);
    for (const x of L.reflections.slice(-IN_PROMPT_REFLECTIONS)) out.push(`Your own review of earlier games: ${x.t}`);
    return out;
  }

  function promptHints(L, question) {
    return { known: knownFor(L, question), lessons: lessons(L), similar: similar(L, question) };
  }

  function stats(L) {
    const all = Object.values(L.entries).flatMap((e) => Object.values(e.a));
    return {
      questions: Object.keys(L.entries).length,
      answers: all.length,
      accepted: all.reduce((s, v) => s + v.n, 0),
      rejected: all.reduce((s, v) => s + v.miss, 0),
      aliases: all.reduce((s, v) => s + (v.aka ? v.aka.length : 0), 0), // typed forms the game accepted as another term
      games: L.games.length,
      // Is it improving? Of the suggestions the game actually ruled on in each finished game, the share it
      // accepted. Games where fewer than 3 were ruled on say too little and are left out.
      accuracy: L.games
        .map((g) => {
          const t = g && g.totals && g.totals.ai;
          const tried = t ? t.hit + t.miss : 0;
          return tried >= 3 ? { pct: Math.round((100 * t.hit) / tried), tried, key: g.key } : null;
        })
        .filter(Boolean)
        .slice(-10),
      lastGame: L.games.length ? L.games[L.games.length - 1] : null,
      reflections: L.reflections.slice(-3).reverse(), // newest first
      repeated: Object.values(L.entries).filter((e) => (e.seen || 0) >= 2).length, // prompts met in 2+ games
      suggested: all.reduce((s, v) => s + (v.sug || 0), 0),
      suggestedOk: all.reduce((s, v) => s + (v.sugOk || 0), 0),
      suggestedBad: all.reduce((s, v) => s + (v.sugBad || 0), 0),
      ledger: ledger(L),
      calibrated: L.cal.n,
      bias: L.cal.n ? L.cal.sum / L.cal.n : null,
      avgWordsAccepted: avg(L.words.acc),
      avgWordsRejected: avg(L.words.miss),
      recent: L.cal.recent.slice(0, 10),
    };
  }

  const api = { newLearned, cleanLearned, recordResult, recordAlias, recordGame, addReflection, recordCalibration, knownFor, lessons, promptHints, stats, wordCount,
    recordSeen, recordSuggested, markSuggestion, recordMine, knownTier, rejectedFor, calibrateTier, enrich, similar, ledger, tokens, jaccard };
  root.KrillionLearn = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
