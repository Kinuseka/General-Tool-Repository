// Debug mode. When Settings → Debug mode is on, the extension writes what it does to the browser console:
// the full AI requests and replies, the dictionary and the app's decisions, what the game ruled.
// Where to look: the krillion.io page console (F12) for the game side; the extension's service worker console
// (chrome://extensions → "service worker") for AI requests and replies. Off: nothing is logged.
// Never logs the API key (the request body holds none).
(function (root) {
  const TAG = '[krillion]';
  const hasChrome = typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
  let on = false;

  if (hasChrome) {
    chrome.storage.local
      .get('settings')
      .then((st) => {
        on = !!(st.settings && st.settings.debugMode);
      })
      .catch(() => {});
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings) on = !!(changes.settings.newValue && changes.settings.newValue.debugMode);
    });
  }

  function log(kind, data) {
    if (!on || typeof console === 'undefined') return;
    try {
      // The data stays an object, so the console shows it expandable and in full.
      console.log(`${TAG} ${kind}`, data === undefined ? '' : data);
    } catch (_) {
      /* a console that refuses the data is not an error for the app */
    }
  }

  const api = { log, TAG };
  root.KrillionDebug = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
