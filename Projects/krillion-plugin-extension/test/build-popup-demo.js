// node test/build-popup-demo.js
// Writes test/popup-demo.standalone.html: the REAL popup (popup.html, theme.css, popup.css and every script it
// loads, inlined) with a tiny in-memory stand-in for chrome.storage, seeded with sample data, so the popup can be
// opened in any browser and looked at without installing the extension. Click through the tabs and sections.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const ai = require('../src/ai-core.js');
const learn = require('../src/learn.js');
const profileMod = require('../src/profile.js');
const summary = require('../src/summary.js');

// ---- sample data, built with the extension's own modules so the shapes are always right ----
const NOW = Date.now();
const L = learn.newLearned();
const Q = (n) => ['Name a military rank', 'Name an animal with flippers', 'Name a toy brand', 'Name a country with an active volcano'][n];
for (const [a, tier] of [['Colonel', 'schooler'], ['Captain', 'plankton'], ['Major', 'schooler'], ['Lieutenant', 'plankton']]) {
  learn.recordResult(L, Q(0), a, { kind: 'accepted', tier }, NOW);
  learn.recordCalibration(L, Q(0), a, tier, tier, NOW); // the AI got these right
}
learn.recordCalibration(L, Q(1), 'Harbor seal', 'schooler', 'rare', NOW);
learn.recordCalibration(L, Q(3), 'Peru', 'deepcut', 'rare', NOW);
for (let i = 0; i < 6; i++) learn.recordCalibration(L, Q(2), `Brand ${i}`, 'rare', 'rare', NOW);
for (let i = 0; i < 40; i++) learn.recordResult(L, Q(1), `Answer ${i}`, { kind: i % 4 ? 'accepted' : 'miss', tier: 'rare' }, NOW);
learn.recordResult(L, Q(1), 'Dugong', { kind: 'accepted', tier: 'rare', typed: 'dugon' }, NOW);
const log = new summary.GameLog({ kind: 'party', key: 'g1', room: 'FSCC' });
log.add({ q: Q(1), answer: 'Dugong', kind: 'accepted', tier: 'rare', mine: true });
log.add({ q: Q(1), answer: 'Walrus', kind: 'accepted', tier: 'schooler' });
log.finish({ won: false, place: 3 });
const sum = summary.summarize(log, () => [{ text: 'Walrus', tier: 'schooler', out: 'accepted' }, { text: 'Beaver', tier: 'rare', out: 'miss' }], NOW);
learn.recordGame(L, sum, summary.insights(sum), NOW);
learn.addReflection(L, 'g1', ['Check that each answer truly belongs to the category before suggesting it.', 'Think of the less obvious members of a category, not only the famous one.'], NOW);

const P = profileMod.newProfile();
const mine = [
  ['Tarsier', 'deepcut', 'Name an animal that eats bugs'],
  ['Tamiya', 'rare', 'Name a toy brand'],
  ['Shinkansen', 'rare', 'Name a means of transport'],
  ['Spain', 'schooler', 'Name a country that has won the men\'s soccer World Cup'],
];
mine.forEach(([a, tier, q], i) => profileMod.record(P, { q, answer: a, tier, niche: true, source: 'daily', date: '2026-11-09' }, NOW - i));
profileMod.record(P, { q: 'Name a toy brand', answer: 'Lego', tier: 'plankton', niche: false, source: 'party' }, NOW);
for (let i = 0; i < 12; i++) P.mine.push({ q: `Old prompt ${i}`, a: `Old answer ${i}`, tier: null, niche: i % 2 === 0, src: 'daily', t: NOW - 1e6 - i }); // recorded before dates existed

const seed = {
  settings: { ...ai.DEFAULTS, interests: 'I know Japanese and Korean pop culture and food.' },
  learned: L,
  profile: P,
  daily: { '2026-11-09': { date: '2026-11-09', dayNumber: 117, prompts: [{ id: 'p1', text: 'Name a podcast (1K+ ratings on Spotify)' }, { id: 'p2', text: 'Name a toy brand' }] } },
  party: { entries: [{ room: 'FSCC', index: 1, text: 'Name an ice cream flavor', threshold: 20, firstSeen: NOW - 60000 }, { room: 'FSCC', index: 2, text: 'Name a military rank', threshold: 12, firstSeen: NOW - 30000 }] },
  pdIndex: [], rawIndex: [],
};

const stub = `
(() => {
  const store = ${JSON.stringify(seed)};
  const listeners = [];
  const pick = (keys) => {
    if (keys == null) return { ...store };
    const list = Array.isArray(keys) ? keys : typeof keys === 'string' ? [keys] : Object.keys(keys);
    return Object.fromEntries(list.filter((k) => k in store).map((k) => [k, JSON.parse(JSON.stringify(store[k]))]));
  };
  const fire = (changes) => listeners.forEach((f) => f(changes, 'local'));
  window.chrome = {
    storage: {
      local: {
        get: async (k) => pick(k),
        set: async (o) => { const ch = {}; for (const [k, v] of Object.entries(o)) { ch[k] = { oldValue: store[k], newValue: v }; store[k] = v; } fire(ch); },
        remove: async (k) => { const ch = {}; for (const key of [].concat(k)) { ch[key] = { oldValue: store[key] }; delete store[key]; } fire(ch); },
      },
      onChanged: { addListener: (f) => listeners.push(f) },
    },
    runtime: { openOptionsPage() {} },
  };
})();`;

let html = read('popup/popup.html');
// Insert the stub FIRST, while the only "<body>" in the text is the real tag: the stylesheets inlined below may
// mention "<body>" in a comment, and a replace done afterwards would hit that instead.
if (!html.includes('<body>')) throw new Error('popup.html has no <body> tag');
html = html.replace('<body>', () => `<body>\n<script>${stub}</script>`);
html = html
  .replace('<link rel="stylesheet" href="../ui/theme.css">', () => `<style>\n${read('ui/theme.css')}\n</style>`)
  .replace('<link rel="stylesheet" href="popup.css">', () => `<style>\n${read('popup/popup.css')}\n</style>`);
for (const src of ['../src/ai-core.js', '../src/learn.js', '../src/profile.js', '../src/raw-record.js', 'popup.js']) {
  const tag = `<script src="${src}"></script>`;
  if (!html.includes(tag)) throw new Error(`popup.html no longer loads ${src}`);
  const file = src.startsWith('..') ? src.slice(3) : `popup/${src}`;
  html = html.replace(tag, () => `<script>\n${read(file)}\n</script>`);
}
html = html.replace('<!doctype html>', '<!doctype html>\n<!-- GENERATED by test/build-popup-demo.js (node test/build-popup-demo.js) - do not edit by hand. The real popup, with fake storage and sample data, to look at. -->');
fs.writeFileSync(path.join(__dirname, 'popup-demo.standalone.html'), html);
console.log('wrote test/popup-demo.standalone.html');
