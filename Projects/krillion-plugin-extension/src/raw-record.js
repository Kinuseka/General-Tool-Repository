// Raw websocket recording: every frame, in both directions, exactly as sent or received, plus the
// connection's open/close/error events. For analysis of the game's data. Pure: no DOM, no chrome.*.
//
// One recording ("session") per websocket connection. Frames are stored in bounded chunks
// (`raw:<session>:<n>`), and a small index lists the sessions, so a long game never means rewriting
// one huge value, and the popup can list recordings without loading any frames.
//
// "Raw" means unfiltered: player names, chat and typing are included, because the game sends them.
// The ONLY edits are (1) the websocket URL is stored without its query string (player key, guest
// token) and (2) a field named key / token / playerKey / guestToken / idToken / accessToken /
// authorization is replaced by "[redacted]" if one ever appears in a frame.
(function (root) {
  const MAX_CHUNK_FRAMES = 500;
  const MAX_CHUNK_CHARS = 250000;
  const MAX_TOTAL_CHARS = 200 * 1000 * 1000; // across all recordings; oldest are dropped first
  const MAX_SESSIONS = 300;

  const SECRET_FIELD = /^(?:playerkey|guesttoken|idtoken|accesstoken|token|key|authorization)$/i;
  const SECRET_HINT = /"(?:playerKey|guestToken|idToken|accessToken|token|key|authorization)"\s*:/i;

  // -> {text, redacted}. Frames without such a field come back byte-for-byte unchanged.
  function redact(str) {
    if (!SECRET_HINT.test(str)) return { text: str, redacted: false };
    try {
      const obj = JSON.parse(str);
      let changed = false;
      const walk = (n) => {
        if (Array.isArray(n)) n.forEach(walk);
        else if (n && typeof n === 'object') {
          for (const k of Object.keys(n)) {
            if (SECRET_FIELD.test(k) && typeof n[k] === 'string') {
              n[k] = '[redacted]';
              changed = true;
            } else walk(n[k]);
          }
        }
      };
      walk(obj);
      return changed ? { text: JSON.stringify(obj), redacted: true } : { text: str, redacted: false };
    } catch (_) {
      const text = str.replace(/("(?:playerKey|guestToken|idToken|accessToken|token|key|authorization)"\s*:\s*")[^"]*(")/gi, '$1[redacted]$2');
      return { text, redacted: text !== str };
    }
  }

  const chunkKey = (id, n) => `raw:${id}:${n}`;
  const chunkKeys = (meta) => Array.from({ length: meta.chunks }, (_, i) => chunkKey(meta.id, i));

  const metaOf = (s) => ({
    id: s.id,
    code: s.code,
    conn: s.conn,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    frames: s.frames,
    chars: s.chars,
    chunks: s.chunk + 1,
    closed: s.closed,
  });

  class RawRecorder {
    constructor({ maxFrames = MAX_CHUNK_FRAMES, maxChars = MAX_CHUNK_CHARS } = {}) {
      this.maxFrames = maxFrames;
      this.maxChars = maxChars;
      this.sessions = new Map(); // conn id -> session
      this.sealed = []; // finished chunks waiting to be written
    }

    // msg = { code, conn, dir:'in'|'out'|'meta', t, data:<the frame as a string>, truncatedFrom? }
    add(msg, now = Date.now()) {
      if (!msg || typeof msg.conn !== 'string' || typeof msg.code !== 'string' || typeof msg.data !== 'string') return;
      if (msg.dir !== 'in' && msg.dir !== 'out' && msg.dir !== 'meta') return;
      const t = Number.isFinite(msg.t) ? msg.t : now;
      let s = this.sessions.get(msg.conn);
      if (!s) {
        s = { id: `${msg.code}-${t.toString(36)}-${msg.conn}`, code: msg.code, conn: msg.conn, startedAt: t, endedAt: t, frames: 0, chars: 0, chunk: 0, cur: [], curChars: 0, dirty: true, closed: null };
        this.sessions.set(msg.conn, s);
      }
      const { text, redacted } = redact(msg.data);
      const frame = { t, d: msg.dir, x: text };
      if (redacted) frame.r = 1; // something was redacted in this frame
      if (Number.isFinite(msg.truncatedFrom)) frame.tr = msg.truncatedFrom; // original length, if cut
      if (s.cur.length >= this.maxFrames || s.curChars + text.length > this.maxChars) {
        this.sealed.push({ key: chunkKey(s.id, s.chunk), frames: s.cur });
        s.chunk++;
        s.cur = [];
        s.curChars = 0;
      }
      s.cur.push(frame);
      s.curChars += text.length;
      s.frames++;
      s.chars += text.length;
      s.endedAt = t;
      s.dirty = true;
      if (msg.dir === 'meta') {
        try {
          const o = JSON.parse(text);
          if (o && o.event === 'close') s.closed = { code: o.code, reason: o.reason };
        } catch (_) {
          /* not JSON: leave as is */
        }
      }
    }

    // What to persist now: chunk values to write, and index entries for sessions that changed.
    // The current (still-growing) chunk is written again each time; sealed chunks only once.
    flush() {
      const writes = this.sealed;
      this.sealed = [];
      const index = [];
      for (const s of this.sessions.values()) {
        if (!s.dirty) continue;
        writes.push({ key: chunkKey(s.id, s.chunk), frames: s.cur.slice() });
        index.push(metaOf(s));
        s.dirty = false;
      }
      return { writes, index };
    }
  }

  // Keep the newest recordings within the size budget. -> { keep: [meta], drop: [meta] }
  function planRetention(index, maxChars = MAX_TOTAL_CHARS, maxSessions = MAX_SESSIONS) {
    const newestFirst = [...index].sort((a, b) => b.startedAt - a.startedAt);
    const keep = [];
    const drop = [];
    let total = 0;
    for (const m of newestFirst) {
      if (keep.length < maxSessions && (total + m.chars <= maxChars || keep.length === 0)) {
        keep.push(m);
        total += m.chars;
      } else drop.push(m);
    }
    return { keep: keep.sort((a, b) => a.startedAt - b.startedAt), drop };
  }

  // JSON Lines, one frame per line. `data` is the frame's original text, unparsed, so nothing is lost
  // or reformatted; parse it yourself (JSON.parse(line.data)).
  function toJsonl(meta, frames) {
    return frames
      .map((f) => {
        const line = { session: meta.id, room: meta.code, t: f.t, dir: f.d === 'in' ? 'in' : f.d === 'out' ? 'out' : 'meta', data: f.x };
        if (f.r) line.redacted = true;
        if (f.tr) line.truncatedFrom = f.tr;
        return JSON.stringify(line);
      })
      .join('\n');
  }

  const api = { RawRecorder, redact, chunkKeys, chunkKey, planRetention, toJsonl, MAX_TOTAL_CHARS };
  root.KrillionRaw = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
