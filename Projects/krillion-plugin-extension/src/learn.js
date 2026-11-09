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
      slots.sort((a, b) => b[1].n + b[1].miss + b[1].taken - (a[1].n + a[1].miss + a[1].taken));
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

  // The model said `predicted`, the game said `actual`, for the same answer.
  function recordCalibration(L, question, answer, predicted, actual, now) {
    if (tierIdx(predicted) < 0 || tierIdx(actual) < 0) return;
    L.cal.n++;
    L.cal.sum += tierIdx(actual) - tierIdx(predicted);
    L.cal.recent.unshift({ q: String(question), a: String(answer), p: predicted, r: actual, at: now });
    L.cal.recent.length = Math.min(L.cal.recent.length, RECENT);
  }

  // Results on this exact prompt from earlier games.
  function knownFor(L, question) {
    const e = L.entries[normKey(question)];
    if (!e) return { accepted: [], rejected: [] };
    const all = Object.values(e.a);
    const accepted = all
      .filter((v) => v.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, MAX_LIST)
      .map((v) => ({ text: v.t, tier: v.tier || null, ...(v.aka && v.aka.length ? { aka: v.aka } : {}) }));
    const rejected = all
      .filter((v) => v.miss > 0 && v.n === 0 && v.taken === 0)
      .sort((a, b) => b.miss - a.miss)
      .slice(0, MAX_LIST)
      .map((v) => v.t);
    return { accepted, rejected };
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
    return { known: knownFor(L, question), lessons: lessons(L) };
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
      lastGame: L.games.length ? L.games[L.games.length - 1] : null,
      reflections: L.reflections.slice(-3).reverse(), // newest first
      calibrated: L.cal.n,
      bias: L.cal.n ? L.cal.sum / L.cal.n : null,
      avgWordsAccepted: avg(L.words.acc),
      avgWordsRejected: avg(L.words.miss),
      recent: L.cal.recent.slice(0, 10),
    };
  }

  const api = { newLearned, cleanLearned, recordResult, recordAlias, recordGame, addReflection, recordCalibration, knownFor, lessons, promptHints, stats, wordCount };
  root.KrillionLearn = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
