const $ = (s) => document.querySelector(s);
const { DEFAULTS, DEFAULT_SYSTEM_PROMPT, effectivePrompt, originPattern } = KrillionAI;
const store = chrome.storage.local;

const TEXT = ['baseUrl', 'apiKey', 'model', 'systemPrompt', 'interests'];
const BOOL = ['enabled', 'overlayEnabled', 'prefetchDaily', 'learnFromGame', 'collectParty', 'recordRaw', 'adaptToMe', 'copyOnClick', 'typeOnClick', 'dailySingleRequest', 'reflectAtGameEnd', 'debugMode', 'typeAdvanced'];

function say(text, kind) {
  const m = $('#msg');
  m.textContent = text;
  m.className = kind || '';
}

function fill(s) {
  TEXT.forEach((k) => ($(`#${k}`).value = s[k] ?? ''));
  $('#systemPrompt').value = effectivePrompt(s.systemPrompt); // an outdated saved default shows the current one
  BOOL.forEach((k) => ($(`#${k}`).checked = !!s[k]));
  $('#count').value = s.count;
  $('#typeWpmMin').value = s.typeWpmMin ?? DEFAULTS.typeWpmMin;
  $('#typeWpmMax').value = s.typeWpmMax ?? DEFAULTS.typeWpmMax;
  $('#typeRandomness').value = s.typeRandomness ?? DEFAULTS.typeRandomness;
  $('#typeBurstWpm').value = s.typeBurstWpm ?? DEFAULTS.typeBurstWpm;
  $('#typePausePct').value = s.typePausePct ?? DEFAULTS.typePausePct;
  $('#typeTypoPct').value = s.typeTypoPct ?? DEFAULTS.typeTypoPct;
  $('#typeLowerFirstPct').value = s.typeLowerFirstPct ?? DEFAULTS.typeLowerFirstPct;
  $('#typeAdvancedFields').hidden = !s.typeAdvanced;
  $('#temperature').value = s.temperature === null || s.temperature === undefined ? '' : s.temperature;
  $('#opacity').value = Math.round((s.opacity ?? DEFAULTS.opacity) * 100);
  $('#opacityVal').textContent = `${$('#opacity').value}%`;
}

function read() {
  const s = {};
  TEXT.forEach((k) => (s[k] = $(`#${k}`).value.trim()));
  // Store '' while it is the default, so future improvements to the default reach this user.
  const prompt = $('#systemPrompt').value.trim();
  s.systemPrompt = prompt === DEFAULT_SYSTEM_PROMPT.trim() ? '' : prompt;
  BOOL.forEach((k) => (s[k] = $(`#${k}`).checked));
  if (s.typeOnClick) s.copyOnClick = false; // mutually exclusive
  s.count = Math.min(15, Math.max(3, parseInt($('#count').value, 10) || DEFAULTS.count));
  // Speed bounds: 20–200 WPM, and max is never below min.
  const wpm = (id, fallback) => {
    const n = parseInt($(`#${id}`).value, 10);
    return Number.isFinite(n) ? Math.min(200, Math.max(20, n)) : fallback;
  };
  s.typeWpmMin = wpm('typeWpmMin', DEFAULTS.typeWpmMin);
  s.typeWpmMax = Math.max(s.typeWpmMin, wpm('typeWpmMax', DEFAULTS.typeWpmMax));
  const rand = parseInt($('#typeRandomness').value, 10);
  s.typeRandomness = Number.isFinite(rand) ? Math.min(100, Math.max(0, rand)) : DEFAULTS.typeRandomness;
  const field = (id, lo, hi, fallback) => {
    const n = parseInt($(`#${id}`).value, 10);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };
  s.typeBurstWpm = field('typeBurstWpm', 20, 200, DEFAULTS.typeBurstWpm);
  s.typePausePct = field('typePausePct', 0, 100, DEFAULTS.typePausePct);
  s.typeTypoPct = field('typeTypoPct', 0, 100, DEFAULTS.typeTypoPct);
  s.typeLowerFirstPct = field('typeLowerFirstPct', 0, 100, DEFAULTS.typeLowerFirstPct);
  const t = $('#temperature').value.trim();
  s.temperature = t === '' || !Number.isFinite(Number(t)) ? null : Math.min(2, Math.max(0, Number(t)));
  s.opacity = Math.min(1, Math.max(0.2, Number($('#opacity').value) / 100 || DEFAULTS.opacity));
  return s;
}

// Must run straight from the click handler: Chrome only shows the permission prompt for a user gesture.
async function requestAccess(baseUrl) {
  const pattern = originPattern(baseUrl);
  if (!pattern) {
    say('The base URL must be a valid http:// or https:// address.', 'err');
    return false;
  }
  const granted = await chrome.permissions.request({ origins: [pattern] });
  if (!granted) say(`Access to ${pattern} was not allowed, so suggestions can't reach this endpoint.`, 'err');
  return granted;
}

async function save() {
  const next = read();
  const granted = await requestAccess(next.baseUrl); // first await: keeps the user gesture
  const { settings } = await store.get('settings');
  await store.set({ settings: { ...settings, ...next } }); // keeps keys the page owns (e.g. collapsed)
  return { next, granted };
}

$('#save').addEventListener('click', async () => {
  say('');
  const { granted } = await save();
  if (granted) say('Saved.', 'ok');
});

$('#test').addEventListener('click', async () => {
  say('');
  const { next, granted } = await save();
  if (!granted) return;
  say('Testing…');
  const res = await chrome.runtime.sendMessage({ type: 'test', settings: next }).catch((e) => ({ ok: false, error: e.message }));
  if (res && res.ok) say(`Works. Sample answers: ${res.lines.map((l) => l.text).join(', ')}`, 'ok');
  else say(res && res.error ? res.error : 'No response from the extension worker.', 'err');
});

$('#resetLearned').addEventListener('click', async () => {
  await store.remove(['learned', 'profile']); // what the game taught us, and the player's own recorded answers
  say('Learned data and your recorded answers cleared.', 'ok');
});
$('#resetMemory').addEventListener('click', async () => {
  await store.remove('memory'); // open Krillion tabs notice the empty memory and drop their cache
  say('Session memory cleared.', 'ok');
});
$('#resetPrompt').addEventListener('click', () => ($('#systemPrompt').value = DEFAULT_SYSTEM_PROMPT));
// The advanced typing fields show only while their switch is on (the values are kept either way).
$('#typeAdvanced').addEventListener('change', () => ($('#typeAdvancedFields').hidden = !$('#typeAdvanced').checked));
// Copy and type are two answers to the same click: turning one on turns the other off.
$('#copyOnClick').addEventListener('change', () => { if ($('#copyOnClick').checked) $('#typeOnClick').checked = false; });
$('#typeOnClick').addEventListener('change', () => { if ($('#typeOnClick').checked) $('#copyOnClick').checked = false; });
$('#opacity').addEventListener('input', () => ($('#opacityVal').textContent = `${$('#opacity').value}%`));

store.get('settings').then(({ settings }) => fill({ ...DEFAULTS, ...settings }));

// Is the local word list installed? (data/words.txt, loaded by the background worker)
chrome.runtime
  .sendMessage({ type: 'dict-status' })
  .then((r) => {
    $('#dictStatus').textContent =
      r && r.loaded
        ? `Installed: ${r.words.toLocaleString()} words.`
        : 'Not installed: put a word list in data/words.txt (one word per line) and reload the extension. Until then English-word prompts are answered without a dictionary.';
  })
  .catch(() => {
    $('#dictStatus').textContent = 'Could not check the dictionary.';
  });
