const $ = (s) => document.querySelector(s);
const { DEFAULTS, originPattern, TIERS } = KrillionAI;
const Learn = KrillionLearn;
const Raw = KrillionRaw;
const Profile = KrillionProfile;

let state = { daily: {}, party: { entries: [] }, settings: { ...DEFAULTS }, learned: Learn.newLearned(), profile: Profile.newProfile(), games: [], raw: [] };

// ---- helpers --------------------------------------------------------------
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

function download(name, mime, text) {
  // `text` may be an array of parts, so a large export is never built as one giant string
  const url = URL.createObjectURL(new Blob(Array.isArray(text) ? text : [text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(btn, text) {
  const old = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch (_) {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => (btn.textContent = old), 1200);
}

function ago(ms) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  return s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
}

// ---- toggles ----------------------------------------------------------------
async function patchSettings(patch) {
  const { settings } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
}

function renderToggles() {
  const s = state.settings;
  $('#overlayEnabled').checked = s.overlayEnabled;
  $('#enabled').checked = s.enabled;
  $('#learnFromGame').checked = s.learnFromGame;
  $('#collectParty').checked = s.collectParty;
  $('#recordRaw').checked = s.recordRaw;
  $('#adaptToMe').checked = s.adaptToMe;
  $('#reflectAtGameEnd').checked = s.reflectAtGameEnd;
  // Explain why nothing will happen yet, instead of failing silently in the page.
  const hint = $('#aiHint');
  if (s.enabled && s.overlayEnabled && !s.apiKey && /openai\.com/.test(s.baseUrl)) {
    hint.textContent = 'Add your API key in Settings to get suggestions.';
    hint.hidden = false;
  } else if (s.enabled && !s.overlayEnabled) {
    hint.textContent = 'AI only runs while the floating window is on.';
    hint.hidden = false;
  } else {
    hint.hidden = true;
  }
}

$('#overlayEnabled').addEventListener('change', (e) => patchSettings({ overlayEnabled: e.target.checked }));
$('#enabled').addEventListener('change', (e) => patchSettings({ enabled: e.target.checked }));
$('#learnFromGame').addEventListener('change', (e) => patchSettings({ learnFromGame: e.target.checked }));
$('#collectParty').addEventListener('change', (e) => patchSettings({ collectParty: e.target.checked }));
$('#recordRaw').addEventListener('change', (e) => patchSettings({ recordRaw: e.target.checked }));
$('#adaptToMe').addEventListener('change', (e) => patchSettings({ adaptToMe: e.target.checked }));
$('#reflectAtGameEnd').addEventListener('change', (e) => patchSettings({ reflectAtGameEnd: e.target.checked }));
$('#openSettings').addEventListener('click', () => chrome.runtime.openOptionsPage());

// ---- daily ----------------------------------------------------------------
const days = () => Object.keys(state.daily).sort().reverse();
const currentDay = () => state.daily[$('#dayPick').value];

function renderDaily() {
  const pick = $('#dayPick');
  const keep = pick.value;
  const list = days();
  pick.replaceChildren(
    ...list.map((d) => {
      const o = document.createElement('option');
      o.value = d;
      o.textContent = `${d} · #${state.daily[d].dayNumber ?? '?'}`;
      return o;
    })
  );
  if (list.includes(keep)) pick.value = keep;

  const day = currentDay();
  $('#dailyEmpty').hidden = !!day;
  $('#dailyList').hidden = !day;
  $('#dayMeta').textContent = day ? `${day.prompts.length} questions` : '';
  document.querySelectorAll('#daily .actions button').forEach((b) => (b.disabled = !day));
  $('#dailyList').replaceChildren(
    ...(day ? day.prompts : []).map((p) => {
      const li = document.createElement('li');
      li.textContent = p.text;
      return li;
    })
  );
}

$('#dayPick').addEventListener('change', renderDaily);
$('#dailyCopy').addEventListener('click', (e) =>
  copy(e.target, currentDay().prompts.map((p, i) => `${i + 1}. ${p.text}`).join('\n'))
);
$('#dailyJson').addEventListener('click', () => {
  const d = currentDay();
  download(`krillion-daily-${d.date}.json`, 'application/json', JSON.stringify(d, null, 2));
});
$('#dailyCsv').addEventListener('click', () => {
  const d = currentDay();
  download(
    `krillion-daily-${d.date}.csv`,
    'text/csv',
    toCsv([['date', 'dayNumber', 'id', 'question'], ...d.prompts.map((p) => [d.date, d.dayNumber, p.id, p.text])])
  );
});

// ---- party ----------------------------------------------------------------
const entries = () => state.party.entries || [];
const sorted = () => [...entries()].sort((a, b) => a.firstSeen - b.firstSeen);

function renderParty() {
  const all = entries();
  const latest = all.reduce((m, e) => (e.firstSeen > (m ? m.firstSeen : 0) ? e : m), null);
  $('#partyStatus').textContent = latest ? `Last category ${ago(latest.firstSeen)} · room ${latest.room}` : '';

  const byRoom = new Map();
  for (const e of all) {
    if (!byRoom.has(e.room)) byRoom.set(e.room, []);
    byRoom.get(e.room).push(e);
  }
  const ordered = [...byRoom.entries()].sort(
    (a, b) => Math.max(...b[1].map((e) => e.firstSeen)) - Math.max(...a[1].map((e) => e.firstSeen))
  );

  $('#partyEmpty').hidden = all.length > 0;
  document.querySelectorAll('#party .actions button').forEach((b) => (b.disabled = !all.length));
  $('#partyList').replaceChildren(
    ...ordered.map(([code, list]) => {
      const wrap = document.createElement('div');
      wrap.className = 'room';
      const h = document.createElement('h2');
      h.textContent = `Room ${code} · ${new Date(Math.min(...list.map((e) => e.firstSeen))).toLocaleString()}`;
      const ol = document.createElement('ol');
      list
        .sort((a, b) => a.firstSeen - b.firstSeen)
        .forEach((e) => {
          const li = document.createElement('li');
          if (e.index !== null) li.value = e.index + 1; // server index is 0-based
          li.textContent = e.text;
          ol.append(li);
        });
      wrap.append(h, ol);
      return wrap;
    })
  );
}

$('#partyCopy').addEventListener('click', (e) => copy(e.target, sorted().map((x) => x.text).join('\n')));
$('#partyJson').addEventListener('click', () =>
  download('krillion-party.json', 'application/json', JSON.stringify(sorted(), null, 2))
);
$('#partyCsv').addEventListener('click', () =>
  download(
    'krillion-party.csv',
    'text/csv',
    toCsv([
      ['room', 'index', 'category', 'threshold', 'capturedAt'],
      ...sorted().map((x) => [x.room, x.index, x.text, x.threshold, new Date(x.firstSeen).toISOString()]),
    ])
  )
);

let clearTimer = null;
$('#partyClear').addEventListener('click', async (e) => {
  const btn = e.target;
  if (!btn.classList.contains('armed')) {
    btn.classList.add('armed');
    btn.textContent = 'Confirm';
    clearTimer = setTimeout(() => {
      btn.classList.remove('armed');
      btn.textContent = 'Clear';
    }, 3000);
    return;
  }
  clearTimeout(clearTimer);
  btn.classList.remove('armed');
  btn.textContent = 'Clear';
  await chrome.storage.local.set({ party: { entries: [] } });
});

// ---- learning & party dataset ------------------------------------------------
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  n.textContent = text;
  if (cls) n.className = cls;
  return n;
};

// Sections the user has opened stay open: every storage change re-renders this tab.
const openFolds = new Set();
document.addEventListener(
  'toggle',
  (e) => {
    const d = e.target;
    if (d && d.tagName === 'DETAILS' && d.dataset.fold) (d.open ? openFolds.add(d.dataset.fold) : openFolds.delete(d.dataset.fold));
  },
  true // `toggle` does not bubble
);

function fold(id, title, count, children) {
  const d = document.createElement('details');
  d.className = 'fold';
  d.dataset.fold = id;
  d.open = openFolds.has(id);
  const sum = document.createElement('summary');
  sum.append(title);
  if (count !== '' && count != null) sum.append(el('span', String(count), 'badge'));
  const body = document.createElement('div');
  body.className = 'foldbody';
  body.append(...children);
  d.append(sum, body);
  return d;
}

// One summary line: a small label, then the value (with an optional dimmer tail).
function kv(label, text, { dim = '', warn = false } = {}) {
  const row = document.createElement('div');
  row.className = 'kv';
  const v = document.createElement('span');
  v.className = `v${warn ? ' warn' : ''}`;
  v.append(text);
  if (dim) v.append(el('span', dim, 'dim'));
  row.append(el('span', label, 'k'), v);
  return row;
}

// A list row: a marker, one clear line, and the prompt it was about in dim text underneath.
function listRow(mark, markClass, main, tag, sub) {
  const li = document.createElement('li');
  const m = el('span', mark, `mark${markClass ? ` ${markClass}` : ''}`);
  const body = document.createElement('span');
  body.className = 'main';
  const b = document.createElement('b');
  b.textContent = main;
  body.append(b);
  if (tag) body.append(' ', el('span', tag, 'tag'));
  if (sub) {
    body.append(el('span', sub, 'sub'));
    li.title = sub;
  }
  li.append(m, body);
  return li;
}

function renderData() {
  const s = Learn.stats(state.learned);
  const mine = Profile.stats(state.profile);
  const lessons = Learn.lessons(state.learned); // exactly what is sent to the AI as lessons

  // ---- the summary: a handful of short rows ----
  const rows = [];
  if (!s.questions && !mine.total && !mine.ignored && !s.games) {
    rows.push(el('p', 'Nothing learned yet. Play a party round or a daily game with "Learn from game results" on.', 'empty'));
  } else {
    if (s.questions) rows.push(kv('Answers', String(s.answers), { dim: ` · ${s.questions} prompts · ${s.accepted} accepted · ${s.rejected} rejected` }));
    if (s.calibrated) {
      const b = s.bias;
      const off = Math.abs(b) >= 0.5;
      const verdict = b <= -0.5 ? 'AI overstates rarity' : b >= 0.5 ? 'AI understates rarity' : 'well calibrated';
      rows.push(kv('Rarity', `${s.calibrated} compared`, { dim: ` · ${b > 0 ? '+' : ''}${b.toFixed(2)} tiers · ${verdict}`, warn: off }));
    } else if (s.questions) {
      rows.push(kv('Rarity', 'no suggestion rated yet'));
    }
    if (s.accuracy.length) {
      const last = s.accuracy[s.accuracy.length - 1];
      const before = s.accuracy.slice(0, -1);
      const avgBefore = before.length ? Math.round(before.reduce((n, a) => n + a.pct, 0) / before.length) : null;
      const delta = avgBefore === null ? 0 : last.pct - avgBefore;
      const trend = avgBefore === null ? 'first game measured' : `${delta >= 5 ? '↑' : delta <= -5 ? '↓' : '→'} vs ${avgBefore}% before`;
      rows.push(kv('Accuracy', `${last.pct}% last game`, { dim: ` · ${trend} · ${s.accuracy.length} game${s.accuracy.length === 1 ? '' : 's'}`, warn: last.pct < 40 }));
    }
    if (s.avgWordsAccepted !== null && s.avgWordsRejected !== null) {
      const longer = s.avgWordsRejected - s.avgWordsAccepted >= 0.6;
      rows.push(kv('Length', `accepted ${s.avgWordsAccepted.toFixed(1)} words`, { dim: ` · rejected ${s.avgWordsRejected.toFixed(1)}${longer ? ' (longer)' : ''}`, warn: longer }));
    }
    if (mine.total || mine.ignored) {
      rows.push(kv('You', `${mine.total} answers`, { dim: ` · ${mine.niche} the AI missed${mine.ignored ? ` · ${mine.ignored} older ignored` : ''}` }));
    }
    if (s.repeated) rows.push(kv('Repeats', `${s.repeated} prompt${s.repeated === 1 ? '' : 's'} seen again`, { dim: ` · AI suggestions: ${s.suggestedOk} accepted · ${s.suggestedBad} rejected` }));
    if (s.aliases) rows.push(kv('Typed forms', String(s.aliases), { dim: ' accepted as another term' }));
    if (s.games) rows.push(kv('Games', `${s.games} summarised`));
  }
  $('#learnStats').replaceChildren(...rows);

  // ---- the detail: what the AI sees and concludes, closed until opened ----
  const folds = [];
  if (s.recent.length) {
    const sorted = [...s.recent].sort((a, b) => (a.p === a.r) - (b.p === b.r)).slice(0, 8); // differences first
    const list = document.createElement('ul');
    list.className = 'rows';
    for (const r of sorted) {
      const same = r.p === r.r;
      list.append(listRow(same ? '✓' : '≠', same ? '' : 'diff', r.a, same ? `${r.r}, as the AI said` : `AI said ${r.p}, game said ${r.r}`, r.q));
    }
    const off = s.recent.filter((r) => r.p !== r.r).length;
    folds.push(fold('rarity', 'Rarity checks', off ? `${off} off` : `${s.recent.length}`, [list]));
  }
  if (mine.recentNiche.length) {
    const list = document.createElement('ul');
    list.className = 'rows';
    for (const m of mine.recentNiche) list.append(listRow('+', '', m.a, m.tier || '', m.q));
    folds.push(fold('missed', 'Answers the AI missed', mine.niche, [list]));
  }
  if (s.ledger && s.ledger.length) {
    const list = document.createElement('ul');
    list.className = 'rows';
    for (const l of s.ledger) {
      const bits = [`${l.known} known`];
      if (l.sug) bits.push(`AI ${l.sugOk}/${l.sug} ok`);
      if (l.mine || l.mineBad) bits.push(`you ${l.mine} ok, ${l.mineBad} rejected`);
      list.append(listRow(`${l.seen}×`, '', l.q, bits.join(' · '), ''));
    }
    folds.push(fold('ledger', 'Prompts seen again', s.repeated, [list]));
  }
  const told = document.createElement('ul');
  told.className = 'rows plain';
  lessons.forEach((l) => told.append(el('li', l)));
  if (state.settings.interests) told.append(el('li', `In your own words: ${state.settings.interests}`));
  if (told.children.length) folds.push(fold('told', 'What the AI is told', lessons.length + (state.settings.interests ? 1 : 0), [told]));
  if (s.games) {
    const body = [];
    if (s.lastGame && s.lastGame.brief) body.push(el('p', s.lastGame.brief, 'muted'));
    if (s.reflections.length) {
      body.push(el('p', 'What the AI concluded:', 'hint'));
      const list = document.createElement('ul');
      list.className = 'rows plain';
      s.reflections.forEach((r) => list.append(el('li', r.t)));
      body.push(list);
    }
    folds.push(fold('game', 'Last game', '', body));
  }
  $('#learnFolds').replaceChildren(...folds);

  // ---- party dataset ----
  const g = state.games;
  const events = g.reduce((n, x) => n + x.events.length, 0);
  const last = g.reduce((m, x) => Math.max(m, x.updatedAt || 0), 0);
  $('#pdCount').textContent = g.length ? `${g.length} games` : '';
  $('#pdStats').replaceChildren(
    g.length
      ? el('p', `${g.length} games · ${events} events · last ${ago(last)}`)
      : el('p', state.settings.collectParty ? 'Recording is on. Nothing captured yet.' : 'Off. Turn on "Record party game data" under Learning options.', 'muted')
  );
  document.querySelectorAll('#pdJson, #pdCsv, #pdClear').forEach((b) => (b.disabled = !g.length));
  $('#learnedJson').disabled = !(s.questions || mine.total || s.games);
  $('#learnedReset').disabled = !(s.questions || mine.total || mine.ignored || s.games);
}

const stamp = (t) => (t ? new Date(t) : new Date()).toISOString().replace(/[:.]/g, '-').slice(0, 19);
const NOTE = 'Player ids are salted hashes (pseudonymous, not anonymous). Names and chat are never stored.';

$('#pdJson').addEventListener('click', () =>
  download(`krillion-party-data-${stamp()}.json`, 'application/json', JSON.stringify({ format: 'krillion-party-v1', exportedAt: new Date().toISOString(), note: NOTE, games: state.games }, null, 2))
);
$('#pdCsv').addEventListener('click', () => {
  const rows = [['game', 'room', 'game_number', 'seq', 'time', 'kind', 'category_index', 'category', 'player', 'mine', 'from', 'to', 'answer', 'typed', 'tier', 'why', 'lives_left', 'place']];
  for (const g of state.games) {
    const catAt = (i) => (g.categories.find((c) => c.index === i) || {}).text || '';
    for (const e of g.events) {
      rows.push([g.key, g.code, g.gameNumber, e.seq, e.at ? new Date(e.at).toISOString() : '', e.kind, e.ci ?? e.index, e.cat || catAt(e.ci ?? e.index), e.p, e.me ? 1 : '', e.from, e.to, e.answer, e.typed, e.tier, e.why, e.livesLeft, e.place]);
    }
  }
  download(`krillion-party-events-${stamp()}.csv`, 'text/csv', toCsv(rows));
});
$('#learnedJson').addEventListener('click', () =>
  download(`krillion-learned-${stamp()}.json`, 'application/json', JSON.stringify({ format: 'krillion-learned-v1', exportedAt: new Date().toISOString(), stats: Learn.stats(state.learned), learned: state.learned }, null, 2))
);

// ---- raw websocket recordings ----------------------------------------------------
const kb = (chars) => (chars < 1e6 ? `${Math.max(1, Math.round(chars / 1000))} KB` : `${(chars / 1e6).toFixed(1)} MB`);

function renderRaw() {
  const list = [...state.raw].sort((a, b) => b.startedAt - a.startedAt);
  const frames = list.reduce((n, x) => n + x.frames, 0);
  const chars = list.reduce((n, x) => n + x.chars, 0);
  $('#rawCount').textContent = list.length ? `${list.length}` : state.settings.recordRaw ? 'on' : '';
  $('#rawStats').replaceChildren(
    list.length
      ? el('p', `${list.length} recordings · ${frames.toLocaleString()} frames · ${kb(chars)}`)
      : el('p', state.settings.recordRaw ? 'Recording is on. Join or host a party room.' : 'Recording is off.', 'muted')
  );
  document.querySelectorAll('#rawAll, #rawClear').forEach((b) => (b.disabled = !list.length));
  $('#rawList').replaceChildren(
    ...list.map((m) => {
      const li = document.createElement('li');
      const close = m.closed ? ` · closed ${m.closed.code}` : ' · open';
      li.append(el('span', `${m.code} · ${new Date(m.startedAt).toLocaleString()} · ${m.frames.toLocaleString()} frames · ${kb(m.chars)}${close}`, 'what'));
      const btns = document.createElement('span');
      btns.className = 'btns';
      const ex = el('button', 'Export', 'btn small');
      ex.addEventListener('click', async () => download(`krillion-raw-${m.code}-${stamp(m.startedAt)}.jsonl`, 'application/x-ndjson', await rawJsonl(m)));
      const del = el('button', 'Delete', 'btn small danger');
      del.addEventListener('click', async () => {
        await chrome.storage.local.remove(Raw.chunkKeys(m));
        await chrome.storage.local.set({ rawIndex: state.raw.filter((x) => x.id !== m.id) });
      });
      btns.append(ex, del);
      li.append(btns);
      return li;
    })
  );
}

// One session as JSON Lines. Chunks are read together; each is a bounded array of frames.
async function rawJsonl(meta) {
  const keys = Raw.chunkKeys(meta);
  const got = await chrome.storage.local.get(keys);
  return Raw.toJsonl(meta, keys.flatMap((k) => got[k] || []));
}

$('#rawAll').addEventListener('click', async () => {
  const parts = [];
  for (const m of [...state.raw].sort((a, b) => a.startedAt - b.startedAt)) parts.push(await rawJsonl(m), '\n');
  download(`krillion-raw-all-${stamp()}.jsonl`, 'application/x-ndjson', parts);
});

// two-step confirm for the destructive buttons
function confirmButton(btn, label, action) {
  let timer = null;
  btn.addEventListener('click', async () => {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed');
      btn.textContent = 'Confirm';
      timer = setTimeout(() => {
        btn.classList.remove('armed');
        btn.textContent = label;
      }, 3000);
      return;
    }
    clearTimeout(timer);
    btn.classList.remove('armed');
    btn.textContent = label;
    await action();
  });
}
confirmButton($('#pdClear'), 'Delete', async () => {
  const { pdIndex = [] } = await chrome.storage.local.get('pdIndex');
  await chrome.storage.local.remove([...pdIndex, 'pdIndex', 'partyState']);
});
confirmButton($('#rawClear'), 'Delete all', async () => {
  await chrome.storage.local.remove([...state.raw.flatMap((m) => Raw.chunkKeys(m)), 'rawIndex']);
});
confirmButton($('#learnedReset'), 'Reset', () => chrome.storage.local.remove(['learned', 'profile']));

// ---- tabs / boot ----------------------------------------------------------
document.querySelectorAll('.tab').forEach((t) =>
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    for (const id of ['daily', 'party', 'data']) $(`#${id}`).hidden = t.dataset.tab !== id;
  })
);

async function load() {
  // Named keys only. Never read all of storage: the raw recordings can be hundreds of MB.
  const { daily = {}, party, settings, learned, profile, pdIndex = [], rawIndex = [] } = await chrome.storage.local.get([
    'daily', 'party', 'settings', 'learned', 'profile', 'pdIndex', 'rawIndex',
  ]);
  const games = pdIndex.length ? await chrome.storage.local.get(pdIndex) : {}; // the party dataset: one record per game
  state = {
    daily,
    party: party && Array.isArray(party.entries) ? party : { entries: [] },
    settings: { ...DEFAULTS, ...settings },
    learned: Learn.cleanLearned(learned),
    profile: Profile.cleanProfile(profile),
    games: pdIndex.map((k) => games[k]).filter(Boolean).sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0)),
    raw: Array.isArray(rawIndex) ? rawIndex : [],
  };
  renderToggles();
  renderDaily();
  renderParty();
  renderData();
  renderRaw();
}

// Raw chunks are rewritten many times a second while recording: only the index matters to the popup.
chrome.storage.onChanged.addListener((changes) => {
  if (Object.keys(changes).every((k) => k.startsWith('raw:'))) return;
  load();
});
setInterval(renderParty, 5000); // keeps the "Ns ago" label fresh
load();
