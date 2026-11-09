// Turns the events the game sends over its party websocket into (a) outcomes the AI can learn from and
// (b) pseudonymised records for an optional, exportable dataset. Pure: no DOM, no chrome.*.
//
// What the game sends (observed), inside snap.room.events / patch.events:
//   {kind:"pass",   from, to, answer, tier, seq, at}      an answer the game ACCEPTED, with its real rarity;
//                   `answer` is the game's canonical term, which can differ from what was typed (hook.js
//                   then adds `typed`: an alias or corrected spelling that counts as correct)
//   {kind:"reject", playerId, text, why:"miss"|"repeat"}  "miss": not a valid answer; "repeat": valid, already used
//   {kind:"category", why, index, holderId}               the category changed (text arrives in set.category)
//   {kind:"pop"|"out"|"win"|"join"|"leave"|"host"|"start"|"lobby"|"countdown", ...}
// Player names and chat never reach this module (hook.js drops them). Player ids are replaced by a
// salted hash: pseudonymous (stable for one install), not anonymous.
(function (root) {
  // Two salted FNV-1a style passes -> "p" + 12 hex chars.
  function pseudonym(salt, id) {
    const s = `${salt}|${id}`;
    let h1 = 0x811c9dc5;
    let h2 = 0x9e3779b9;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
    }
    return `p${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0').slice(0, 4)}`;
  }

  const MAX_ROOMS = 50;
  const num = (v) => (Number.isFinite(v) ? v : undefined);

  class PartyTracker {
    // saved = { CODE: { lastSeq } } from a previous page load, so a reload does not re-count the
    // 40-event backlog the game re-sends in every snapshot.
    constructor(salt, saved = {}) {
      this.salt = salt;
      this.rooms = new Map();
      for (const [code, v] of Object.entries(saved || {})) {
        this.rooms.set(code, { ...blank(), lastSeq: Number(v && v.lastSeq) || 0 });
      }
    }

    state(code) {
      let st = this.rooms.get(code);
      if (!st) {
        st = blank();
        this.rooms.set(code, st);
      }
      return st;
    }

    exportState() {
      const entries = [...this.rooms.entries()].slice(-MAX_ROOMS);
      return Object.fromEntries(entries.map(([code, st]) => [code, { lastSeq: st.lastSeq }]));
    }

    pid(id) {
      return pseudonym(this.salt, id);
    }

    // The player's own id in this room (the game keeps it in the page's session storage). Events
    // from that player are flagged `me` / `mine`, so their own answers can be told from everyone's.
    // Only compared here; it is never stored (events carry the salted hash like everyone else's).
    setMe(code, rawId) {
      if (typeof rawId === 'string' && rawId) this.state(code).me = rawId;
    }

    hasMe(code) {
      return !!this.state(code).me;
    }

    // Identifies the game in progress in a room (the game's own id, else room + game number).
    gameKey(code) {
      const st = this.state(code);
      return st.gameId || `${code}#${st.gameNumber ?? 0}`;
    }

    // The text of the category in force right now, or null if it isn't known (yet).
    currentCategory(code) {
      const st = this.rooms.get(code);
      return st && st.idx !== null && st.cats[st.idx] ? st.cats[st.idx].text : null;
    }

    // msg = { code, t:'snap'|'patch', room?:{gameId,gameNumber,phase,category}, set?:{...same}, events?:[] }
    ingest(msg) {
      // ended: why the game just ended ('win' | 'over' | 'lobby'), only ever from a LIVE patch: a snapshot's
      // 40-event backlog can contain the previous game's "win", which is history, not this game ending.
      // winnerMe / myPlace: how the player did, when their own id is known.
      const out = { game: null, categories: [], events: [], outcomes: [], ended: null, winnerMe: false, myPlace: null };
      if (!msg || typeof msg.code !== 'string') return out;
      const code = msg.code;
      const st = this.state(code);
      const src = (msg.t === 'snap' ? msg.room : msg.set) || {};

      // A new game restarts the category indexes (index 1 again), so the index -> text map resets.
      if (typeof src.gameId === 'string' && src.gameId !== st.gameId) {
        st.cats = {};
        st.idx = null;
        st.active = false;
      }
      if (typeof src.gameId === 'string') st.gameId = src.gameId;
      if (Number.isFinite(src.gameNumber)) st.gameNumber = src.gameNumber;
      if (typeof src.phase === 'string') st.phase = src.phase;

      const cat = src.category;
      const catOk = cat && typeof cat === 'object' && Number.isFinite(cat.index) && typeof cat.text === 'string' && cat.text.trim();
      if (catOk) {
        const text = cat.text.replace(/\s+/g, ' ').trim();
        if (!st.cats[cat.index] || st.cats[cat.index].text !== text) {
          st.cats[cat.index] = { text, threshold: num(cat.threshold) };
          out.categories.push({ index: cat.index, text, threshold: num(cat.threshold) });
        }
      }

      const events = (Array.isArray(msg.events) ? msg.events : [])
        .filter((e) => e && typeof e === 'object' && Number.isFinite(e.seq) && e.seq > st.lastSeq)
        .sort((a, b) => a.seq - b.seq);

      // A patch that names the category while we don't know the current one (a new game, or we joined
      // late): its events belong to that category unless a "category" event below says otherwise.
      if (msg.t === 'patch' && catOk && st.idx === null) st.idx = cat.index;

      // Which category is each event about? A snapshot's backlog without any "category" event
      // all belongs to the current category; otherwise events before the first one are unknown.
      if (msg.t === 'snap') {
        const hasCat = events.some((e) => e.kind === 'category');
        st.idx = hasCat ? null : catOk ? cat.index : st.idx;
      }

      for (const e of events) {
        if (e.kind === 'category' && Number.isFinite(e.index)) st.idx = e.index;
        const rec = { seq: e.seq, at: num(e.at), kind: String(e.kind || '') };
        for (const k of ['tier', 'why', 'livesLeft', 'place', 'endsAt']) if (e[k] !== undefined && e[k] !== null) rec[k] = e[k];
        if (Number.isFinite(e.index)) rec.index = e.index;
        if (e.playerId) rec.p = this.pid(e.playerId);
        if (e.from) rec.from = this.pid(e.from);
        if (e.to) rec.to = this.pid(e.to);
        if (e.holderId) rec.holder = this.pid(e.holderId);
        // an answer typed by the player themselves (pass: `from` answered; reject: `playerId` typed it)
        const mine = !!st.me && (e.kind === 'pass' ? e.from === st.me : e.kind === 'reject' ? e.playerId === st.me : false);
        if (st.me && (e.from === st.me || e.playerId === st.me)) rec.me = true;
        const answer = e.kind === 'pass' ? e.answer : e.kind === 'reject' ? e.text : null;
        if (typeof answer === 'string') rec.answer = answer.slice(0, 120);
        // What the player actually typed, when the game accepted it as a different (canonical) term.
        const typed = e.kind === 'pass' && typeof e.typed === 'string' && e.typed.trim() ? e.typed.trim().slice(0, 120) : null;
        if (typed) rec.typed = typed;
        const q = st.idx !== null && st.cats[st.idx] ? st.cats[st.idx].text : null;
        if (st.idx !== null) rec.ci = st.idx;
        if (q && (e.kind === 'pass' || e.kind === 'reject')) rec.cat = q;
        out.events.push(rec);

        // game flow: a game that has had play can end; the player's own elimination place; the win
        if (e.kind === 'pass' || e.kind === 'reject' || e.kind === 'category' || e.kind === 'pop') st.active = true;
        if (e.kind === 'out' && st.me && e.playerId === st.me && Number.isFinite(e.place)) out.myPlace = e.place;
        if (e.kind === 'win' && msg.t === 'patch' && st.active) {
          out.ended = 'win';
          out.winnerMe = !!st.me && e.playerId === st.me;
        }

        if (typeof answer === 'string' && answer.trim()) {
          const m = mine ? { mine: true } : {};
          if (e.kind === 'pass') out.outcomes.push({ q, answer, kind: 'accepted', tier: e.tier || null, seq: e.seq, ...(typed ? { typed } : {}), ...m });
          else if (e.why === 'miss') out.outcomes.push({ q, answer, kind: 'miss', tier: null, seq: e.seq, ...m });
          else if (e.why === 'repeat') out.outcomes.push({ q, answer, kind: 'taken', tier: null, seq: e.seq, ...m });
        }
        st.lastSeq = Math.max(st.lastSeq, e.seq);
      }

      // The category named by the frame itself is the current one once the events are applied.
      if (catOk && (msg.t === 'patch' || st.idx === null)) st.idx = cat.index;

      // The room going to "over" (or back to "lobby") after play also ends the game, if no win event said so.
      if (msg.t === 'patch' && st.active && !out.ended && (src.phase === 'over' || src.phase === 'lobby')) out.ended = src.phase;
      if (out.ended) st.active = false; // one end per game

      out.game = { key: this.gameKey(code), code, gameId: st.gameId, gameNumber: st.gameNumber };
      return out;
    }
  }

  function blank() {
    return { lastSeq: 0, gameId: null, gameNumber: null, phase: null, idx: null, cats: {}, me: null, active: false };
  }

  const api = { PartyTracker, pseudonym };
  root.KrillionParty = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
