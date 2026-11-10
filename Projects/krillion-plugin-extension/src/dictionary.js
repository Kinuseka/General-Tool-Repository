// A local English dictionary, used ONLY for prompts that ask for English words ("Name an English word
// starting with 'squ'"). It never touches other prompts (cities, animals, brands, people...), which a
// dictionary cannot answer.
//
// What it does for an English-word prompt:
//   - EXISTS / PARTLY EXISTS / NO: checks each suggested answer against the word list. "Partly" means it is
//     a form of a listed word (a missing inflection: "squabbled" when only "squabble" is listed) or the start
//     of one ("squabb"); the answer is kept but marked, so the player can judge it. "No" is dropped.
//   - WORD PATTERNS: a prompt like 'starting with "squ"' is a constraint the dictionary can check exactly, so
//     answers that break it are dropped, and real matching words are handed to the model as candidates.
//
// The word list is data/words.txt (one word per line). Without it this module is simply not used.
// Pure: no DOM, no chrome.*.
(function (root) {
  // Letters only, lowercase, accents and apostrophes removed: "Don't" -> "dont", "café" -> "cafe".
  const normWord = (s) =>
    String(s == null ? '' : s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/['’]/g, '')
      .replace(/[^a-z]/g, '');

  // Which prompts are about English words? Defined once, in ai-core.js (the prompt builder needs it too).
  const AI = root.KrillionAI || (typeof require === 'function' ? require('./ai-core.js') : null);
  const { isEnglishWordPrompt } = AI;

  const QUOTE = '["\\u201c\\u201d\'\\u2018\\u2019]?';
  const WITH = `(?:\\s+(?:the\\s+)?(?:letters?\\s+|sequence\\s+)?)`;
  const PATTERNS = {
    prefix: new RegExp(`\\b(?:start(?:s|ing)?|begin(?:s|ning)?)\\s+with${WITH}?${QUOTE}([a-z]{1,10})${QUOTE}`, 'i'),
    suffix: new RegExp(`\\b(?:end(?:s|ing)?)\\s+(?:with|in)${WITH}?${QUOTE}([a-z]{1,10})${QUOTE}`, 'i'),
    contains: new RegExp(`\\b(?:contain(?:s|ing)?|include(?:s|ing)?)${WITH}?${QUOTE}([a-z]{1,10})${QUOTE}`, 'i'),
  };

  // 'Name an English word starting with “squ”' -> {prefix:'squ'}. Empty object when there is no pattern.
  function parsePattern(question) {
    const out = {};
    const q = String(question || '');
    for (const [k, re] of Object.entries(PATTERNS)) {
      const m = re.exec(q);
      if (m) out[k] = normWord(m[1]);
    }
    return out;
  }

  const fits = (word, p) =>
    (!p.prefix || word.startsWith(p.prefix)) && (!p.suffix || word.endsWith(p.suffix)) && (!p.contains || word.includes(p.contains));

  // Plausible base forms of an inflected word, to see whether it is a form of something listed.
  function baseForms(w) {
    const out = [];
    const cut = (suffix, add = '') => {
      if (w.length > suffix.length + 2 && w.endsWith(suffix)) out.push(w.slice(0, -suffix.length) + add);
    };
    cut('s');
    cut('es');
    cut('ies', 'y');
    cut('ied', 'y');
    cut('ed');
    cut('d');
    cut('ing');
    cut('ing', 'e'); // making -> make
    cut('ly');
    cut('er');
    cut('est');
    cut('ers');
    for (const b of [...out]) if (b.length > 2 && b[b.length - 1] === b[b.length - 2]) out.push(b.slice(0, -1)); // stopping -> stopp -> stop
    return out;
  }

  class Dictionary {
    constructor(text) {
      const seen = new Set();
      for (const line of String(text || '').split(/\r?\n/)) {
        const w = normWord(line);
        if (w) seen.add(w);
      }
      this.set = seen;
      this.list = [...seen].sort();
    }

    get size() {
      return this.list.length;
    }

    has(w) {
      return this.set.has(normWord(w));
    }

    // Index of the first listed word >= p.
    lowerBound(p) {
      let lo = 0;
      let hi = this.list.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (this.list[mid] < p) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    hasPrefix(p) {
      const i = this.lowerBound(p);
      return i < this.list.length && this.list[i].startsWith(p);
    }

    partStatus(w) {
      if (!w) return 'none';
      if (this.set.has(w)) return 'word';
      if (baseForms(w).some((b) => this.set.has(b))) return 'partial'; // a form of a listed word
      if (w.length >= 3 && this.hasPrefix(w)) return 'partial'; // the start of a listed word
      return 'none';
    }

    // 'word' (every part is listed) | 'partial' (some of it is, or it is a form / the start of one) | 'none'.
    status(text) {
      const parts = String(text == null ? '' : text)
        .split(/[\s\-]+/)
        .map(normWord)
        .filter(Boolean);
      if (!parts.length) return 'none';
      const st = parts.map((p) => this.partStatus(p));
      if (st.every((s) => s === 'word')) return 'word';
      if (st.every((s) => s === 'none')) return 'none';
      return 'partial';
    }

    // Real words fitting a pattern, e.g. {prefix:'squ'}; `limit` caps how many are returned (a spread, not the
    // first N alphabetically, so the model is not only shown words from the start of the range).
    match(pattern, { limit = 60, minLength = 3, exclude = [] } = {}) {
      const skip = new Set(exclude.map(normWord));
      const pool = [];
      const scan = pattern.prefix ? this.list.slice(this.lowerBound(pattern.prefix)) : this.list;
      for (const w of scan) {
        if (pattern.prefix && !w.startsWith(pattern.prefix)) break;
        if (w.length >= minLength && fits(w, pattern) && !skip.has(w)) pool.push(w);
      }
      if (pool.length <= limit) return pool;
      const step = pool.length / limit;
      return Array.from({ length: limit }, (_, i) => pool[Math.floor(i * step)]);
    }
  }

  // What the dictionary contributes to ONE prompt: {validate, candidates}. Any prompt that is not about English
  // words, or no dictionary at all, contributes nothing: {validate:null, candidates:[]}.
  function grounding(dict, question, exclude = []) {
    if (!dict || !isEnglishWordPrompt(question)) return { validate: null, candidates: [] };
    const pattern = parsePattern(question);
    return {
      validate: (text) => (fits(normWord(text), pattern) ? dict.status(text) : 'none'),
      candidates: Object.keys(pattern).length ? dict.match(pattern, { limit: 60, exclude }) : [],
    };
  }

  const api = { Dictionary, parsePattern, isEnglishWordPrompt, normWord, fits, grounding };
  root.KrillionDict = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
