// End-of-game summary: what happened in a finished game, boiled down so the AI can learn from it.
//
// Built from the game's own results (accepted answers with their real rarity, rejections) and the
// session memory of what the AI suggested. For every category it records:
//   - what the game accepted (with tiers), how many it rejected, how many were already used;
//   - how the AI's suggestions fared: accepted / rejected / never used, and which were rejected;
//   - BLIND SPOTS: answers the game accepted that the AI never suggested (only counted for categories
//     the AI actually made suggestions for);
//   - the player's own answers, with the game's term for them when it corrected them.
// Then it derives plain-language insights, and a compact text for an optional AI reflection.
//
// Untrusted text: other players type whatever they like, and a summary is later read by a model. So only
// answers the GAME ACCEPTED (they are in its answer set), the AI's own suggestions and the player's own
// answers are ever listed; other players' rejected text is only counted. Every string is JSON-quoted in
// the text built for the model, which is also told that quoted text is data, never instructions.
//
// Pure: no DOM, no chrome.*.
(function (root) {
  const AI = root.KrillionAI || (typeof require === 'function' ? require('./ai-core.js') : null);
  const { isDuplicate } = AI;

  const MAX_TOP = 6;
  const MAX_GAPS = 6;
  const MAX_WRONG = 5;
  const quote = (s) => JSON.stringify(String(s));
  const tierLabel = (t) => (t ? ` (${t})` : '');
  const list = (rows, f = (r) => `${quote(r.a)}${tierLabel(r.tier)}`) => rows.map(f).join(', ');
  const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : Math.min(n % 10, 4) % 4] || 'th'}`;

  // Collects a game's results as they arrive. Safe to feed the same answer twice (it is merged).
  class GameLog {
    constructor(meta) {
      this.meta = { kind: 'party', ...meta };
      this.cats = new Map(); // question -> {accepted:[], rejected:[], taken:[]}
      this.result = null;
    }

    cat(question) {
      if (!this.cats.has(question)) this.cats.set(question, { accepted: [], rejected: [], taken: [] });
      return this.cats.get(question);
    }

    // outcome: {q, answer, kind:'accepted'|'miss'|'taken', tier?, mine?, typed?}
    add(o) {
      if (!o || !o.q || !o.answer) return;
      const c = this.cat(o.q);
      if (o.kind === 'accepted') {
        const have = c.accepted.find((x) => isDuplicate(x.a, o.answer));
        if (have) {
          if (o.mine) have.mine = true; // the same answer seen again, e.g. from the game's reply to our own submit
          if (o.typed && !have.typed) have.typed = o.typed;
          if (o.tier && !have.tier) have.tier = o.tier;
        } else {
          c.accepted.push({ a: o.answer, tier: o.tier || null, mine: !!o.mine, ...(o.typed ? { typed: o.typed } : {}) });
        }
      } else if (o.kind === 'miss') {
        c.rejected.push({ a: o.answer, mine: !!o.mine });
      } else if (o.kind === 'taken') {
        c.taken.push({ a: o.answer, mine: !!o.mine });
      }
    }

    finish({ won, place, reason }) {
      this.result = { won: won === true, place: Number.isFinite(place) ? place : null, reason: reason || null };
    }
  }

  const count = (rows, f) => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});

  // shownFor(question) -> the AI's suggestions for it, as kept in the session memory
  // ([{text, tier, out?, as?}]); an empty list when the AI made none.
  function summarize(log, shownFor, now = Date.now()) {
    const totals = {
      accepted: 0, rejected: 0, taken: 0, tiers: {},
      mine: { accepted: 0, rejected: 0, taken: 0, corrected: 0 },
      ai: { shown: 0, hit: 0, miss: 0, unused: 0 },
      blindSpots: 0,
    };
    const categories = [];
    for (const [question, c] of log.cats) {
      const shown = (shownFor && shownFor(question)) || [];
      const gaps = shown.length
        ? c.accepted.filter((a) => !shown.some((s) => isDuplicate(s.text, a.a) || (s.as && isDuplicate(s.as, a.a))))
        : [];
      const ai = {
        shown: shown.length,
        hit: shown.filter((s) => s.out === 'accepted').length,
        miss: shown.filter((s) => s.out === 'miss').length,
        unused: shown.filter((s) => !s.out).length,
        wrong: shown.filter((s) => s.out === 'miss').map((s) => s.text).slice(0, MAX_WRONG),
      };
      const mineAcc = c.accepted.filter((a) => a.mine);
      const mine = {
        accepted: mineAcc.map((a) => ({ a: a.a, tier: a.tier, ...(a.typed ? { typed: a.typed } : {}) })),
        rejected: c.rejected.filter((r) => r.mine).map((r) => r.a),
        taken: c.taken.filter((r) => r.mine).map((r) => r.a),
      };
      categories.push({
        q: question,
        accepted: c.accepted.length,
        rejected: c.rejected.length, // only counted: other players' typing is never listed
        taken: c.taken.length,
        tiers: count(c.accepted, (a) => a.tier || '?'),
        top: c.accepted.slice(0, MAX_TOP).map((a) => ({ a: a.a, tier: a.tier })),
        mine,
        ai,
        gaps: gaps.slice(0, MAX_GAPS).map((a) => ({ a: a.a, tier: a.tier })),
      });
      totals.accepted += c.accepted.length;
      totals.rejected += c.rejected.length;
      totals.taken += c.taken.length;
      for (const a of c.accepted) totals.tiers[a.tier || '?'] = (totals.tiers[a.tier || '?'] || 0) + 1;
      totals.mine.accepted += mine.accepted.length;
      totals.mine.rejected += mine.rejected.length;
      totals.mine.taken += mine.taken.length;
      totals.mine.corrected += mine.accepted.filter((a) => a.typed).length;
      totals.ai.shown += ai.shown;
      totals.ai.hit += ai.hit;
      totals.ai.miss += ai.miss;
      totals.ai.unused += ai.unused;
      totals.blindSpots += gaps.length;
    }
    const summary = {
      v: 1,
      kind: log.meta.kind,
      key: log.meta.key,
      room: log.meta.room || null,
      date: log.meta.date || null,
      score: Number.isFinite(log.meta.score) ? log.meta.score : null,
      at: now,
      result: log.result,
      totals,
      categories,
    };
    summary.brief = brief(summary);
    return summary;
  }

  // One line for the popup.
  function brief(s) {
    const t = s.totals;
    const where = s.kind === 'daily' ? `Daily ${s.date || ''}`.trim() : `Party ${s.room || ''}`.trim();
    const parts = [`${where}: ${s.categories.length} prompt${s.categories.length === 1 ? '' : 's'}`];
    if (s.kind === 'party') parts.push(`${t.accepted} accepted, ${t.rejected} rejected`);
    const me = t.mine;
    if (me.accepted + me.rejected) parts.push(`you ${me.accepted} accepted${me.corrected ? ` (${me.corrected} corrected)` : ''}, ${me.rejected} rejected`);
    if (t.ai.shown) {
      parts.push(`AI ${t.ai.hit}/${t.ai.shown} suggestions accepted, ${t.ai.miss} rejected${t.blindSpots ? `, ${t.blindSpots} blind spot${t.blindSpots === 1 ? '' : 's'}` : ''}`);
    }
    if (s.result && s.result.won) parts.push('you won');
    else if (s.result && s.result.place) parts.push(`you placed ${ordinal(s.result.place)}`);
    if (s.score !== null) parts.push(`score ${s.score}`);
    return parts.join(' · ');
  }

  // Plain-language conclusions from one game, without any model call. Kept short; stored across sessions.
  function insights(s) {
    const out = [];
    for (const c of s.categories.filter((x) => x.gaps.length).slice(0, 3)) {
      out.push(`In ${quote(c.q)} the game accepted answers you never suggested, such as ${list(c.gaps.slice(0, 4))}: think of answers like these.`);
    }
    for (const c of s.categories.filter((x) => x.ai.wrong.length).slice(0, 3)) {
      out.push(`In ${quote(c.q)} the game rejected your suggestions ${c.ai.wrong.map(quote).join(', ')}: check that every answer truly belongs to the category.`);
    }
    if (s.totals.ai.shown >= 6) {
      const t = s.totals.ai;
      out.push(`In the last game ${t.hit} of your ${t.shown} suggestions were accepted and ${t.miss} rejected.`);
    }
    return out.map((l) => l.slice(0, 360));
  }

  // The summary as text for the reflection request. Every string from the game is JSON-quoted.
  function toText(s) {
    const t = s.totals;
    const L = [];
    L.push(`ROUND SUMMARY (${s.kind === 'daily' ? `daily dive ${s.date || ''}` : `party room ${s.room || ''}`})`);
    if (s.result) L.push(`Result: ${s.result.won ? 'the player won' : s.result.place ? `the player placed ${ordinal(s.result.place)}` : 'the player did not finish in a place'}.`);
    if (s.score !== null) L.push(`Score: ${s.score}.`);
    L.push(`Totals: the game accepted ${t.accepted} answers and rejected ${t.rejected}; the player had ${t.mine.accepted} accepted (${t.mine.corrected} recorded under a corrected term) and ${t.mine.rejected} rejected.`);
    L.push(`Your suggestions: ${t.ai.shown} shown, ${t.ai.hit} accepted, ${t.ai.miss} rejected, ${t.ai.unused} never used; ${t.blindSpots} accepted answers you never suggested.`);
    s.categories.forEach((c, i) => {
      L.push('');
      L.push(`${i + 1}. ${quote(c.q)}: accepted ${c.accepted} (${Object.entries(c.tiers).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}), rejected ${c.rejected}, already used ${c.taken}.`);
      if (c.top.length) L.push(`   Accepted include: ${list(c.top)}.`);
      if (c.ai.shown) L.push(`   Your suggestions: ${c.ai.shown} shown, ${c.ai.hit} accepted, ${c.ai.miss} rejected${c.ai.wrong.length ? ` (${c.ai.wrong.map(quote).join(', ')})` : ''}, ${c.ai.unused} unused.`);
      if (c.gaps.length) L.push(`   Accepted but never suggested by you: ${list(c.gaps)}.`);
      const m = c.mine;
      const bits = [];
      if (m.accepted.length) bits.push(`accepted ${list(m.accepted, (r) => `${quote(r.a)}${tierLabel(r.tier)}${r.typed ? ` [typed ${quote(r.typed)}]` : ''}`)}`);
      if (m.rejected.length) bits.push(`rejected ${m.rejected.map(quote).join(', ')}`);
      if (m.taken.length) bits.push(`already used ${m.taken.map(quote).join(', ')}`);
      if (bits.length) L.push(`   The player's own answers: ${bits.join('; ')}.`);
    });
    return L.join('\n');
  }

  const api = { GameLog, summarize, brief, insights, toText };
  root.KrillionSummary = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
