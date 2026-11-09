// The player's own accepted answers: what they know, and where the AI's suggestions miss it.
//
// Each answer the game accepted from THIS player is stored with the prompt, the game's rarity tier,
// and `niche`: true when it was NOT among the AI's suggestions for that prompt. Niche answers are the
// signal: a player who keeps answering "Tamiya", "Tokay gecko" or "Shinkansen" where the AI offered
// "Lego", "Gecko" and "Bullet train" has leanings the AI should pick up. They are sent back to the model
// as examples, together with an instruction to follow the same leanings WHEN THE PROMPT ALLOWS, and an
// optional free-text "my leanings" the player writes themselves. Nothing here classifies the player
// (no "East Asian" label is computed): the model infers the pattern from the examples.
//
// Plain data, kept across sessions, local to this browser. Pure: no DOM, no chrome.*.
(function (root) {
  const AI = root.KrillionAI || (typeof require === 'function' ? require('./ai-core.js') : null);
  const { normKey, isDuplicate } = AI;

  const MAX_ANSWERS = 400; // kept
  const IN_PROMPT = 24; // sent with a request
  const NICHE_FIRST = 16; // of those, up to this many niche answers come first

  const newProfile = () => ({ v: 1, mine: [] });

  function cleanProfile(x) {
    return x && typeof x === 'object' && Array.isArray(x.mine) ? { v: 1, mine: x.mine } : newProfile();
  }

  // Daily answers recorded by older versions have no date, and could be filed under the wrong question (another
  // day's answer matched to today's prompt by id). They cannot be checked, so they are ignored, not trusted.
  const verified = (m) => !(m.src === 'daily' && !m.d);

  // answer = the game's term; niche = it was not among the AI's suggestions for this prompt.
  // date: for a daily answer, the day it was played (proves which question it belongs to).
  function record(P, { q, answer, tier, niche, source, date }, now) {
    const text = String(answer || '').trim();
    if (!q || !text) return;
    const found = P.mine.find((m) => verified(m) && normKey(m.q) === normKey(q) && isDuplicate(m.a, text));
    if (found) {
      found.t = now;
      if (tier) found.tier = tier;
      found.niche = found.niche && !!niche; // once it matched a suggestion, it is not niche
      return;
    }
    P.mine.push({ q: String(q), a: text, tier: tier || null, niche: !!niche, src: source || 'party', ...(date ? { d: date } : {}), t: now });
    if (P.mine.length > MAX_ANSWERS) P.mine = P.mine.sort((a, b) => b.t - a.t).slice(0, MAX_ANSWERS);
  }

  // What goes into a request, or null when there is nothing to say.
  function promptHints(P, interests) {
    const note = String(interests || '').replace(/\s+/g, ' ').trim().slice(0, 400);
    const recent = P.mine.filter(verified).sort((a, b) => b.t - a.t);
    const niche = recent.filter((m) => m.niche);
    const others = recent.filter((m) => !m.niche);
    const pick = niche.slice(0, NICHE_FIRST);
    pick.push(...others.slice(0, IN_PROMPT - pick.length));
    if (!pick.length && !note) return null;
    return {
      answers: pick.map((m) => ({ q: m.q, a: m.a, tier: m.tier, niche: m.niche })),
      total: P.mine.length,
      niche: niche.length,
      interests: note,
    };
  }

  function stats(P) {
    const ok = P.mine.filter(verified);
    const niche = ok.filter((m) => m.niche);
    return {
      total: ok.length,
      niche: niche.length,
      ignored: P.mine.length - ok.length, // older daily answers that cannot be checked (see `verified`)
      recentNiche: niche.sort((a, b) => b.t - a.t).slice(0, 6),
    };
  }

  const api = { newProfile, cleanProfile, record, promptHints, stats };
  root.KrillionProfile = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
