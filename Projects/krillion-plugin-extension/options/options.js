const $ = (s) => document.querySelector(s);
const { DEFAULTS, DEFAULT_SYSTEM_PROMPT, effectivePrompt, originPattern } = KrillionAI;
const store = chrome.storage.local;

const TEXT = ['baseUrl', 'apiKey', 'model', 'systemPrompt', 'interests'];
const BOOL = ['enabled', 'overlayEnabled', 'prefetchDaily', 'learnFromGame', 'collectParty', 'recordRaw', 'adaptToMe', 'copyOnClick', 'dailySingleRequest', 'reflectAtGameEnd'];

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
  s.count = Math.min(15, Math.max(3, parseInt($('#count').value, 10) || DEFAULTS.count));
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
$('#opacity').addEventListener('input', () => ($('#opacityVal').textContent = `${$('#opacity').value}%`));

store.get('settings').then(({ settings }) => fill({ ...DEFAULTS, ...settings }));
