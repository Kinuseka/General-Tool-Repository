// Pure logic shared by the content script and the node tests (no DOM, no chrome.*).
(function (root) {
  const MAX_TEXT = 300;

  const cleanText = (v) => {
    if (typeof v !== 'string') return null;
    const s = v.replace(/\s+/g, ' ').trim();
    return s && s.length <= MAX_TEXT ? s : null;
  };

  const num = (v) => (Number.isFinite(v) ? v : null);

  // Lowercase, collapse whitespace/nbsp: used to find a prompt inside page text.
  const norm = (s) => String(s || '').replace(/[\s ]+/g, ' ').trim().toLowerCase();

  // GET /api/today -> { date, dayNumber, resetsAt, prompts:[{id,text}] }
  function parseDaily(data) {
    if (!data || typeof data !== 'object') return null;
    if (typeof data.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) return null;
    if (!Array.isArray(data.prompts)) return null;
    const prompts = [];
    for (const p of data.prompts) {
      const text = p && cleanText(p.text);
      if (!text || typeof p.id !== 'string') return null;
      prompts.push({ id: p.id, text });
    }
    if (!prompts.length) return null;
    return {
      date: data.date,
      dayNumber: num(data.dayNumber),
      resetsAt: typeof data.resetsAt === 'string' ? data.resetsAt : null,
      prompts,
    };
  }

  // Validates the category object relayed by hook.js.
  function parseCategory(c) {
    if (!c || typeof c !== 'object') return null;
    const text = cleanText(c.text);
    if (!text) return null;
    return { index: num(c.index), text, threshold: num(c.threshold), accepted: num(c.accepted) };
  }

  // Which daily prompt is on screen? Exactly one prompt must appear in the page text
  // (the results screen lists all of them, so >1 matches means "no current prompt").
  function findPrompt(pageText, prompts) {
    const body = norm(pageText);
    const hits = [];
    prompts.forEach((p, i) => {
      if (body.includes(norm(p.text))) hits.push(i);
    });
    return hits.length === 1 ? hits[0] : -1;
  }

  // Same room + same category (+ same index when known) is a replay, not a new question.
  function isSameQuestion(a, b) {
    return !!a && !!b && a.room === b.room && a.text === b.text && a.index === b.index;
  }

  // store = { entries: [{room,index,text,threshold,firstSeen}] }; returns true if new.
  function addCategory(store, room, cat, now) {
    const exists = store.entries.some((e) => isSameQuestion(e, { room, text: cat.text, index: cat.index }));
    if (exists) return false;
    store.entries.push({ room, index: cat.index, text: cat.text, threshold: cat.threshold, firstSeen: now });
    return true;
  }

  // Which of TODAY's daily prompts did a submitted answer belong to? The ids (p1..p7) repeat on every day, and in
  // the archive, so an id alone would file another day's answer under today's question of the same number.
  // Only an answer submitted for today's date can be matched; anything else returns null.
  function dailyAnswerPrompt(daily, msg) {
    if (!daily || !msg || !msg.date || msg.date !== daily.date) return null;
    return daily.prompts.find((p) => p.id === msg.promptId) || null;
  }

  // "One automatic AI request per daily page load": the first daily question that needs a request takes the
  // only ticket; every later one is blocked until the page is reloaded (a reload is a new gate). Not limited
  // (party, or the setting off) always passes. Restoring a list from memory is not a request and never calls this.
  function gateDailyRequest(gate, limited) {
    if (!limited) return 'ask';
    if (gate.used) return 'blocked';
    gate.used = true;
    return 'ask';
  }

  const api = { parseDaily, parseCategory, findPrompt, isSameQuestion, addCategory, norm, gateDailyRequest, dailyAnswerPrompt };
  root.KrillionCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
