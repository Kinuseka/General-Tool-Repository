// Service worker. Holds the API key and makes the AI request, so the key never
// enters the krillion.io page and the request isn't subject to the page's CORS.
importScripts('ai-core.js');

const { DEFAULTS, runSuggest, runReflect, originPattern } = self.KrillionAI;

async function getSettings(override) {
  if (override) return { ...DEFAULTS, ...override };
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}

// Host access to the user's endpoint is requested from the settings page (a user gesture).
async function assertAccess(baseUrl) {
  const pattern = originPattern(baseUrl);
  if (!pattern) throw Object.assign(new Error('The API base URL is not a valid http(s) URL.'), { code: 'not-configured' });
  const ok = await chrome.permissions.contains({ origins: [pattern] });
  if (!ok) {
    throw Object.assign(new Error(`Allow access to ${pattern} in the extension settings.`), { code: 'no-permission' });
  }
}

// The page is untrusted input: everything it sends is clamped by the (tested) sanitiser in ai-core.js.
const { sanitizeFeedback } = self.KrillionAI;
const strs = (a, max) =>
  Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.slice(0, 80)).slice(-max) : [];

// One port per request; closing the port (content script navigated, or superseded) aborts the fetch.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'krillion-ai') return;
  const controller = new AbortController();
  let started = false;
  let disconnected = false;
  port.onDisconnect.addListener(() => {
    disconnected = true;
    controller.abort();
  });

  port.onMessage.addListener(async (msg) => {
    if (msg.type !== 'suggest' || started) return;
    started = true;
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const settings = await getSettings();
      await assertAccess(settings.baseUrl);
      await runSuggest({
        settings,
        question: String(msg.question || '').slice(0, 400),
        want: Math.min(15, Math.max(1, Math.round(Number(msg.want)) || 0)) || undefined,
        exclude: strs(msg.exclude, 60),
        feedback: sanitizeFeedback(msg.feedback),
        krillionTaken: msg.krillionTaken === true,
        single: msg.single === true,
        signal: controller.signal,
        onSuggestion: (s) => port.postMessage({ type: 'suggestion', suggestion: s }),
      });
      port.postMessage({ type: 'done' });
    } catch (e) {
      if (disconnected) return; // the page cancelled or moved on; nobody is listening
      const message = e.name === 'AbortError' ? 'The AI request timed out or was cancelled.' : e.message || String(e);
      try {
        port.postMessage({ type: 'error', code: e.code || 'error', message });
      } catch (_) {
        /* port already closed */
      }
    } finally {
      clearTimeout(timer);
    }
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'open-options') {
    chrome.runtime.openOptionsPage();
    return false;
  }
  // End of a game: one non-streamed request asking the model for lessons from the round summary.
  if (msg.type === 'reflect') {
    (async () => {
      const settings = await getSettings();
      await assertAccess(settings.baseUrl);
      const lessons = await runReflect({
        settings,
        summaryText: String(msg.summary || '').slice(0, 8000),
        signal: AbortSignal.timeout(45000),
      });
      sendResponse({ ok: true, lessons });
    })().catch((e) => sendResponse({ ok: false, error: e.message || String(e), code: e.code }));
    return true; // async response
  }
  if (msg.type === 'test') {
    (async () => {
      const settings = await getSettings(msg.settings);
      await assertAccess(settings.baseUrl);
      const lines = await runSuggest({
        settings: { ...settings, count: 3 },
        question: 'Name a fruit',
        signal: AbortSignal.timeout(30000),
      });
      sendResponse({ ok: true, lines });
    })().catch((e) => sendResponse({ ok: false, error: e.message || String(e), code: e.code }));
    return true; // async response
  }
  return false;
});
