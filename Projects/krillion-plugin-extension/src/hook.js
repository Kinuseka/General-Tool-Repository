// Runs in the PAGE's own JS world (manifest "world": "MAIN") at document_start.
//
// Purely passive: it never opens a connection, never sends anything, never
// changes what the site sends or receives. It
//   1. adds a read-only "message" listener to the party WebSocket the site
//      itself opens, and
//   2. clones the response of the site's own GET /api/today fetch.
//
// By default it relays ONLY question text, the moment it arrives, via window.postMessage:
//   { kind:'party-question', code, category:{index,text,threshold,accepted} }
//   { kind:'daily', data:<the /api/today JSON, which is only prompts> }
//
// Only if the extension switches it on (settings: "learn from game results" or "record party
// data"; message {kind:'config', collect:true}) does it also relay the game's RESULT events:
//   { kind:'party-data', code, t:'snap'|'patch', room|set:{gameId,gameNumber,phase,category}, events:[...] }
// copied through a whitelist (see cleanEvent). Player names, chat, the player key and the guest
// token never leave this file: the websocket URL is reduced to its room code. Typing indicators are
// only used locally to spot corrections; the single thing relayed from them is `typed` on an accepted
// answer that the game recorded under a different term.
//
// With results on it also pairs the player's own submits with the game's replies by `cid`
// ({kind:'party-my-answer', typed, accepted, answer, tier, why}) and works out the player's own id the
// same way ({kind:'party-me', id}); the typed text is only what the player themselves submitted.
//
// With results on it also relays, for the daily dive, what the player typed and how the game answered
// ({kind:'daily-answer', typed, accepted, tier, answer, correction}) from the site's own /api/submit call,
// and {kind:'daily-complete', date, score} when the site reports the daily game finished.
//
// A third, separate opt-in ({kind:'config', raw:true}) relays EVERY frame in both directions, unfiltered,
// as {kind:'party-raw', code, conn, dir:'in'|'out'|'meta', t, data} for a full raw recording. That
// includes names, chat and typing, because that is what the game sends. The URL query is never relayed.
(() => {
  if (window.__krillionReaderHooked) return;
  window.__krillionReaderHooked = true;

  const TAG = '__krillionExt';
  const PARTY_WS = /^wss?:\/\/party\.krillion\.io\/rooms\/([^/?#]+)\/ws(?:[?#]|$)/i;
  const MAX_TEXT = 300;

  const post = (payload) => {
    try {
      window.postMessage({ [TAG]: 1, ...payload }, window.location.origin);
    } catch (_) {
      /* never let the reader break the page */
    }
  };

  const num = (v) => (Number.isFinite(v) ? v : null);
  const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);

  // Set by the extension (never on by default): relay the game's result events too, not just the
  // category. The extension turns this on only when "learn from game results" or "record party data"
  // is enabled in its settings.
  let collect = false;
  // Also opt-in and separate: relay EVERY websocket frame, both directions, unfiltered (player names,
  // chat and typing included: that is what the game sends), plus open/close/error. For a full raw
  // recording the user asked for. The URL's query string (player key, guest token) is never included.
  let raw = false;
  let connCounter = 0;
  const RAW_MAX = 400000; // longest single frame relayed, in characters

  function cleanCat(cat) {
    if (!cat || typeof cat !== 'object' || typeof cat.text !== 'string') return null;
    const text = cat.text.replace(/\s+/g, ' ').trim();
    if (!text || text.length > MAX_TEXT) return null;
    return { index: num(cat.index), text, threshold: num(cat.threshold), accepted: num(cat.accepted) };
  }

  // snap  -> frame.room.category   (only while phase is "round": a lobby snap can hold a stale one)
  // patch -> frame.patch.set.category   (sent when the category changes, and again, unchanged
  //          except for `accepted`, after every accepted answer: the bridge de-duplicates)
  function categoryOf(frame) {
    if (frame && frame.t === 'snap') {
      const room = frame.room;
      if (room && room.phase && room.phase !== 'round') return null;
      return cleanCat(room && room.category);
    }
    if (frame && frame.t === 'patch') return cleanCat(frame.patch && frame.patch.set && frame.patch.set.category);
    return null;
  }

  // ---- game results (opt-in) -------------------------------------------------------
  // The game reports what happened to every answer in snap.room.events / patch.events:
  //   pass   {from,to,answer,tier}  accepted, with its real rarity
  //   reject {playerId,text,why}    "miss" = not valid, "repeat" = valid but already used
  // Only these whitelisted fields are copied, so player NAMES, CHAT and typing indicators (all of
  // which sit in the same frames) cannot leak. Player ids are pseudonymised by the extension.
  //
  // One exception, for corrections: the game accepts what a player typed but may record a DIFFERENT
  // canonical term (an alias, a fixed spelling). `pass.answer` is the canonical one. The game also
  // streams each player's live typing, so we remember (in memory only, never relayed) the last thing
  // each player typed, and when their answer is accepted as something different we attach what they
  // typed as `typed`. Partial typing ("choc" -> "Chocolate") and case-only differences are not corrections.
  const key = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

  function cleanEvent(e, typing) {
    if (!e || typeof e !== 'object' || !Number.isFinite(e.seq)) return null;
    const out = { seq: e.seq };
    const kind = str(e.kind, 24);
    if (!kind) return null;
    out.kind = kind;
    for (const k of ['at', 'index', 'livesLeft', 'place', 'endsAt']) if (Number.isFinite(e[k])) out[k] = e[k];
    for (const k of ['tier', 'why']) if (str(e[k], 24)) out[k] = e[k];
    for (const k of ['playerId', 'from', 'to', 'holderId']) if (str(e[k], 64)) out[k] = e[k];
    for (const k of ['answer', 'text']) if (str(e[k], 120)) out[k] = e[k];
    if (typing) {
      if (kind === 'pass' && out.from) {
        const typed = typing.get(out.from);
        typing.delete(out.from); // consumed: the next turn starts fresh
        const t = typed ? key(typed) : '';
        const a = out.answer ? key(out.answer) : '';
        if (t.length >= 2 && a && t !== a && !a.startsWith(t)) out.typed = typed.trim().slice(0, 120);
      } else if (kind === 'reject' && out.playerId) {
        typing.delete(out.playerId);
      }
    }
    return out;
  }

  // Remember what each player is typing right now. Never relayed; only used by cleanEvent above.
  function rememberTyping(frame, typing) {
    const players = frame && (frame.t === 'snap' ? frame.room && frame.room.players : frame.patch && frame.patch.players);
    if (!Array.isArray(players)) return;
    for (const p of players) {
      if (p && typeof p.id === 'string' && typeof p.typing === 'string' && p.typing.trim()) typing.set(p.id, p.typing.slice(0, 120));
    }
    if (typing.size > 64) typing.delete(typing.keys().next().value); // bounded
  }

  function roomFields(src) {
    const out = {};
    if (str(src.gameId, 80)) out.gameId = src.gameId;
    if (Number.isFinite(src.gameNumber)) out.gameNumber = src.gameNumber;
    if (str(src.phase, 24)) out.phase = src.phase;
    const category = cleanCat(src.category);
    if (category) out.category = category;
    return out;
  }

  // -> {t, room|set, events} or null when the frame carries nothing worth keeping (e.g. typing).
  function partyDataOf(frame, typing) {
    const evs = (list) => (Array.isArray(list) ? list.map((e) => cleanEvent(e, typing)).filter(Boolean) : []);
    if (frame && frame.t === 'snap' && frame.room) {
      return { t: 'snap', room: roomFields(frame.room), events: evs(frame.room.events) };
    }
    if (frame && frame.t === 'patch' && frame.patch) {
      const set = roomFields(frame.patch.set || {});
      const events = evs(frame.patch.events);
      return events.length || Object.keys(set).length ? { t: 'patch', set, events } : null;
    }
    return null;
  }

  // The isolated-world script tells us whether to relay results. It also asks again if we load first.
  window.addEventListener('message', (ev) => {
    const m = ev.data;
    if (ev.source === window && m && m[TAG] === 1 && m.kind === 'config') {
      collect = m.collect === true;
      raw = m.raw === true;
    }
  });
  post({ kind: 'hook-ready' });

  // ---- Puffer Party websocket -------------------------------------------
  const NativeWS = window.WebSocket;
  if (typeof NativeWS === 'function') {
    const watch = (ws, url) => {
      const m = PARTY_WS.exec(String(url));
      if (!m) return;
      let code;
      try {
        code = decodeURIComponent(m[1]).toUpperCase();
      } catch (_) {
        return;
      }
      const typing = new Map(); // player id -> what they last typed (in memory only)

      // ---- raw recording (opt-in): one `conn` id per connection, so reconnects are separate sessions ----
      const conn = `${Date.now().toString(36)}${(++connCounter).toString(36)}`;
      const bareUrl = String(url).split(/[?#]/)[0]; // never the query: it holds the key and token
      const rawPost = (dir, data) => {
        if (!raw) return;
        const msg = { kind: 'party-raw', code, conn, dir, t: Date.now(), data };
        if (data.length > RAW_MAX) {
          msg.data = data.slice(0, RAW_MAX);
          msg.truncatedFrom = data.length;
        }
        post(msg);
      };
      const rawMeta = (obj) => rawPost('meta', JSON.stringify(obj));
      const size = (d) => (d && (d.size || d.byteLength)) || 0;
      ws.addEventListener('open', () => rawMeta({ event: 'open', url: bareUrl }));
      ws.addEventListener('close', (ev) => rawMeta({ event: 'close', code: ev.code, reason: String(ev.reason || '').slice(0, 200), wasClean: ev.wasClean }));
      ws.addEventListener('error', () => rawMeta({ event: 'error' }));
      // ---- the player's own answers, exactly (results mode) ----
      // The client sends {t:'act', cid, action:{type:'submit', text}} and the game replies with
      // {t:'ack', cid, submit:{accepted, answer, tier}} or {accepted:false, why:'miss'|'repeat'}.
      // `cid` pairs them: what the player typed, and exactly how the game scored it, including the
      // game's own term when it corrected the answer ("united state" -> "United States").
      // Every patch caused by one of this client's acts also carries that cid and lists the acting
      // player first, which tells us the player's own id without reading anything from the page.
      const mySubmits = new Map(); // cid -> text typed
      const myActs = new Set(); // cids of every act this client sent
      let meId = null;
      const remember = (data) => {
        const f = JSON.parse(data);
        if (!f || f.t !== 'act' || typeof f.cid !== 'string') return;
        myActs.add(f.cid);
        if (myActs.size > 400) myActs.delete(myActs.values().next().value);
        const text = f.action && f.action.type === 'submit' ? str(f.action.text, 120) : undefined;
        if (text) {
          mySubmits.set(f.cid, text);
          if (mySubmits.size > 100) mySubmits.delete(mySubmits.keys().next().value);
        }
      };

      const nativeSend = ws.send;
      if (typeof nativeSend === 'function') {
        ws.send = function (data) {
          try {
            if (raw) {
              if (typeof data === 'string') rawPost('out', data);
              else rawMeta({ event: 'binary-frame', dir: 'out', bytes: size(data) });
            }
          } catch (_) {
            /* recording must never get in the way of the game */
          }
          try {
            if (collect && typeof data === 'string' && data.indexOf('"act"') !== -1) remember(data);
          } catch (_) {
            /* not JSON: nothing to learn */
          }
          return nativeSend.apply(this, arguments);
        };
      }

      ws.addEventListener('message', (ev) => {
        if (raw) {
          if (typeof ev.data === 'string') rawPost('in', ev.data);
          else rawMeta({ event: 'binary-frame', dir: 'in', bytes: size(ev.data) });
        }
        if (typeof ev.data !== 'string') return;
        // Cheap pre-filter: with results off, only frames that mention a category matter.
        if (!collect && ev.data.indexOf('"category"') === -1) return;
        let frame;
        try {
          frame = JSON.parse(ev.data);
        } catch (_) {
          return;
        }
        const category = categoryOf(frame);
        if (category) post({ kind: 'party-question', code, category });
        if (collect) {
          // our own submit's reply: what we typed + how the game scored it (see above)
          if (frame.t === 'ack' && typeof frame.cid === 'string' && mySubmits.has(frame.cid)) {
            const typed = mySubmits.get(frame.cid);
            mySubmits.delete(frame.cid);
            const s = frame.submit;
            if (s && typeof s === 'object') {
              post({
                kind: 'party-my-answer',
                code,
                typed,
                accepted: s.accepted === true,
                answer: str(s.answer, 120), // the game's own term, which can differ from `typed`
                tier: str(s.tier, 24),
                why: str(s.why, 24), // 'miss' (not valid) or 'repeat' (valid, already used)
              });
            }
          }
          // our own player id: the player a patch lists first when the patch answers one of our acts
          if (!meId && frame.t === 'patch' && frame.patch && myActs.has(frame.patch.cid)) {
            const list = frame.patch.players;
            if (Array.isArray(list) && list.length === 1 && str(list[0] && list[0].id, 64)) {
              meId = list[0].id;
              post({ kind: 'party-me', code, id: meId });
            }
          }
          const data = partyDataOf(frame, typing); // uses typing from EARLIER frames...
          rememberTyping(frame, typing); // ...then learns this frame's
          if (data) post({ kind: 'party-data', code, ...data });
        }
      });
    };

    const HookedWS = function WebSocket(url, protocols) {
      const ws = protocols === undefined ? new NativeWS(url) : new NativeWS(url, protocols);
      try {
        watch(ws, url);
      } catch (_) {
        /* ignore */
      }
      return ws;
    };
    HookedWS.prototype = NativeWS.prototype; // keeps `instanceof WebSocket` working
    Object.setPrototypeOf(HookedWS, NativeWS); // keeps CONNECTING/OPEN/... statics
    window.WebSocket = HookedWS;
  }

  // ---- Daily dive: the site's own GET /api/today ---------------------------
  const nativeFetch = window.fetch;
  if (typeof nativeFetch === 'function') {
    window.fetch = function (...args) {
      const promise = nativeFetch.apply(this, args);
      try {
        const input = args[0];
        const raw = typeof input === 'string' ? input : (input && input.url) || String(input);
        const u = new URL(raw, window.location.href);
        // ?preview= is the site's unreleased-puzzle hook; deliberately ignored.
        if (u.origin === window.location.origin && u.pathname === '/api/today' && !u.searchParams.has('preview')) {
          promise
            .then((res) => {
              if (!res.ok) return;
              res
                .clone()
                .json()
                .then((data) => post({ kind: 'daily', data }))
                .catch(() => {});
            })
            .catch(() => {});
        } else if (collect && u.origin === window.location.origin && u.pathname === '/api/today/complete') {
          // The site reports a finished daily game with {date, playerId, score, record}. That is the "game over"
          // signal for the daily dive; only the date and the score are relayed.
          const init = args[1];
          let body = null;
          try {
            body = init && typeof init.body === 'string' ? JSON.parse(init.body) : null;
          } catch (_) {
            body = null;
          }
          if (body) post({ kind: 'daily-complete', date: str(body.date, 10), score: num(body.score) });
        } else if (collect && u.origin === window.location.origin && u.pathname === '/api/submit') {
          // The daily dive is single-player, so every answer here is the player's own. The request
          // carries what they typed; the reply says whether the game accepted it, under which term and
          // at which rarity (or proposes a correction). Only these fields are relayed: not the player id.
          const init = args[1];
          let body = null;
          try {
            body = init && typeof init.body === 'string' ? JSON.parse(init.body) : null;
          } catch (_) {
            body = null;
          }
          const typed = body && str(body.answer, 120);
          if (typed) {
            const promptId = str(body.promptId, 40);
            const date = str(body.date, 10);
            promise
              .then((res) => {
                if (!res.ok) return;
                res
                  .clone()
                  .json()
                  .then((r) => {
                    if (!r || typeof r !== 'object') return;
                    post({
                      kind: 'daily-answer',
                      date,
                      promptId,
                      typed,
                      accepted: r.accepted === true,
                      tier: str(r.tier, 24),
                      answer: str(r.answer, 120), // the game's own term for it, when it differs from `typed`
                      correction: str(r.correction, 120), // a fix the game proposes: not a final result
                    });
                  })
                  .catch(() => {});
              })
              .catch(() => {});
          }
        }
      } catch (_) {
        /* ignore */
      }
      return promise;
    };
  }
})();
