// Isolated-world content script. Orchestrates:
//   question arrives (from hook.js) -> AI request starts at once -> overlay shows it,
//   while the question text is saved to chrome.storage in parallel (never awaited first).
(() => {
  const TAG = '__krillionExt';
  const Core = globalThis.KrillionCore;
  const { parseDaily, parseCategory, findPrompt, isSameQuestion, addCategory, gateDailyRequest } = Core;
  // Daily dive, "one AI request per page load": the first question that needs a request takes the only
  // ticket. A page reload re-runs this script, so the gate starts fresh each load by construction.
  const dailyGate = { used: false };
  const { DEFAULTS, normKey, isDuplicate, memory: Mem } = globalThis.KrillionAI;
  const Learn = globalThis.KrillionLearn;
  const { PartyTracker } = globalThis.KrillionParty;
  const Profile = globalThis.KrillionProfile;
  const Summary = globalThis.KrillionSummary;
  const Raw = globalThis.KrillionRaw;
  const rawRec = new Raw.RawRecorder(); // every websocket frame, unfiltered (opt-in)
  const store = chrome.storage.local;

  let settings = { ...DEFAULTS };
  // What the game has taught us (accepted answers with the game's rarity, rejections, calibration).
  // Unlike the session memory it is kept across sessions.
  let learned = Learn.newLearned();
  // The player's own accepted answers, with the ones the AI never suggested flagged as "niche": the AI is
  // shown them so suggestions follow the player's leanings (profile.js). Kept across sessions.
  let profile = Profile.newProfile();
  let tracker = null; // PartyTracker: reads the game's result events (created once the salt is loaded)
  // Session memory: what was shown for each question and the player's ✓/✗ verdicts.
  // Persisted (12 h) so a reload restores lists without another API call.
  let memory = Mem.newMemory();
  let daily = null; // parsed /api/today
  let current = null; // question on screen: {text,label,source,index?}
  let lastParty = null; // {room,text,index} for replay detection
  let partyText = null; // text of the in-flight party request
  let unsub = null;
  let wasAi = false;
  const reqs = new Map(); // question text -> request state (also the cache)

  const aiOn = () => !!(settings.enabled && settings.overlayEnabled);
  // Pre-fetching all 7 daily questions is many requests, so it never runs while "one request per daily load" is on.
  const prefetchOn = () => !!(settings.prefetchDaily && !settings.dailySingleRequest);
  const isParty = () => location.pathname.startsWith('/party');
  const CONFIG_ERRORS = ['no-permission', 'not-configured', 'http'];

  // Serialise storage read-modify-write so rapid frames can't clobber each other.
  let chain = Promise.resolve();
  const queue = (fn) => {
    chain = chain.then(fn).catch((e) => console.debug('[krillion-reader]', e));
    return chain;
  };

  // ---- overlay -----------------------------------------------------------------
  const overlay = globalThis.KrillionOverlay.createOverlay({
    onRefresh: () => current && present(current, { mode: 'fresh' }), // new batch, replaces the list
    onMore: () => current && ensure(current.text, 'more'), // adds to the list, never repeating
    onVerdict: (item, verdict) => setVerdict(item, verdict),
    // The game measures how an answer was entered (keystrokes, pastes); clicking a row copies it to paste.
    canCopy: () => settings.copyOnClick !== false,
    onPower: (on) => patchSettings({ overlayEnabled: on }),
    onCollapse: (collapsed) => patchSettings({ collapsed }),
    onMove: (pos) => queue(() => store.set({ overlayPos: pos })),
    onSettings: () => chrome.runtime.sendMessage({ type: 'open-options' }).catch(() => {}),
  });

  function patchSettings(patch) {
    const before = configKey();
    settings = { ...settings, ...patch };
    applySettings();
    if (configKey() !== before) postConfig();
    queue(async () => {
      const { settings: s } = await store.get('settings');
      await store.set({ settings: { ...s, ...patch } });
    });
  }

  function refreshVisibility() {
    overlay.setVisible(!!(settings.overlayEnabled && (current || daily)));
  }

  function applySettings() {
    overlay.setOpacity(settings.opacity);
    overlay.setCollapsed(settings.collapsed);
    const now = aiOn();
    if (now !== wasAi) {
      wasAi = now;
      if (current) present(current);
      else if (now && daily && prefetchOn()) prefetch(daily.prompts.map((p) => p.text));
    }
    refreshVisibility();
  }

  // ---- AI requests (one port per request; the key stays in the background worker) -----
  let persistTimer = null;
  function persistMemory() {
    clearTimeout(persistTimer); // coalesce: suggestions arrive one by one
    persistTimer = setTimeout(() => {
      Mem.pruneMemory(memory, Date.now());
      queue(() => store.set({ memory }));
    }, 300);
  }

  let learnedTimer = null;
  function persistLearned() {
    clearTimeout(learnedTimer);
    learnedTimer = setTimeout(() => queue(() => store.set({ learned })), 500);
  }

  let profileTimer = null;
  function persistProfile() {
    clearTimeout(profileTimer);
    profileTimer = setTimeout(() => queue(() => store.set({ profile })), 500);
  }

  // The player's own id in a party room: the game keeps it in this page's session storage (the seat saved
  // when joining). Only `playerId` is read; the player key stored next to it is ignored.
  function readSeat(code) {
    for (const [area, key] of [[() => sessionStorage, `krillion-party-seat:${code}`], [() => localStorage, `krillion-party-seat-backup:${code}`]]) {
      try {
        const seat = JSON.parse(area().getItem(key) || 'null');
        if (seat && typeof seat.playerId === 'string' && seat.playerId && seat.playerId.length <= 64) {
          return { playerId: seat.playerId, name: seat.name };
        }
      } catch (_) {
        /* storage blocked or not JSON: try the next place */
      }
    }
    return null;
  }
  const readSeatId = (code) => (readSeat(code) || {}).playerId || null;

  // The player's username, shown (only) as a quiet "playing as <name>" in the floating window, so it is
  // clear the extension knows whose game this is. Read from the page's own storage: the name saved for the
  // room's seat, else the name saved for party play. Display only: never stored, recorded or sent to the AI.
  const cleanName = (v) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 24) : '');
  let shownName = null;
  function identify(code) {
    let name = cleanName((code && readSeat(code) || {}).name);
    if (!name) {
      try {
        name = cleanName(localStorage.getItem('krillion-party-name'));
      } catch (_) {
        /* storage blocked */
      }
    }
    if (name === shownName) return;
    shownName = name;
    overlay.setIdentity(name);
  }

  // ---- reading the game's results -------------------------------------------------------
  // Relayed only while "learn from game results" or "record party data" is on.
  const wantsResults = () => !!(settings.learnFromGame || settings.collectParty);
  // What the hook is told to relay. Compared before/after a settings change to know when to re-send it.
  const configKey = () => `${wantsResults()}|${!!settings.recordRaw}`;
  const postConfig = () =>
    window.postMessage({ [TAG]: 1, kind: 'config', collect: wantsResults(), raw: !!settings.recordRaw }, location.origin);

  // ---- raw websocket recording (opt-in): frames in chunks of <=500 / ~250 KB, newest recordings win ----
  let rawTimer = null;
  function onRaw(m) {
    if (!settings.recordRaw) return;
    rawRec.add(m);
    if (!rawTimer) rawTimer = setTimeout(flushRaw, 800); // throttle: at most ~0.8 s of frames can be lost
  }

  function flushRaw() {
    clearTimeout(rawTimer);
    rawTimer = null;
    const plan = rawRec.flush();
    if (!plan.writes.length && !plan.index.length) return;
    queue(async () => {
      const { rawIndex = [] } = await store.get('rawIndex');
      const byId = new Map(rawIndex.map((x) => [x.id, x]));
      for (const meta of plan.index) byId.set(meta.id, meta);
      const { keep, drop } = Raw.planRetention([...byId.values()]);
      const dropped = new Set(drop.map((x) => x.id));
      const write = {};
      for (const w of plan.writes) {
        if (![...dropped].some((id) => w.key.startsWith(`raw:${id}:`))) write[w.key] = w.frames;
      }
      await store.set({ ...write, rawIndex: keep });
      const stale = drop.flatMap((meta) => Raw.chunkKeys(meta));
      if (stale.length) await store.remove(stale); // over budget: the oldest recordings go first
    });
  }
  window.addEventListener('pagehide', flushRaw); // best effort: save what is buffered when the tab closes

  let statePending = false;
  function persistPartyState() {
    if (statePending || !tracker) return;
    statePending = true;
    setTimeout(() => {
      statePending = false;
      queue(() => store.set({ partyState: tracker.exportState() }));
    }, 1500);
  }

  // outcomes: [{q, answer, kind:'accepted'|'miss'|'taken', tier}] read from the game's own events.
  // Every one teaches the learning store (the game rated that answer, whoever typed it). Those that
  // match something we suggested also fill in the real tier on that row and auto-mark it ✓ / ✗, and
  // compare the model's predicted tier with the game's.
  // One result from the game, from the party websocket or the daily /api/submit reply:
  //   {q, answer, typed?, kind, tier, mine?}   mine = the player typed it themselves
  function processOutcome(o, now) {
    if (!o.q) return; // category unknown (joined mid-game): the raw event is still recorded
    // `typed` is set when the game accepted what a player typed but recorded a different term.
    // fromAck: this result came from our own submit's reply; the game's event for it is counted separately.
    if (settings.learnFromGame && !o.fromAck) Learn.recordResult(learned, o.q, o.answer, { kind: o.kind, tier: o.tier, typed: o.typed }, now);
    const hit = Mem.applyOutcome(memory, o.q, o.answer, { kind: o.kind, tier: o.tier, typed: o.typed }, now);
    // The player's own accepted answers are the profile. Niche = not among the AI's suggestions for this prompt.
    if (settings.learnFromGame && o.mine && o.kind === 'accepted') {
      Profile.record(profile, { q: o.q, answer: o.answer, tier: o.tier, niche: !hit, source: o.source, date: o.date }, now);
    }
    if (!hit) return;
    if (settings.learnFromGame && hit.first && o.kind === 'accepted' && hit.item.tier && o.tier) {
      Learn.recordCalibration(learned, o.q, hit.item.text, hit.item.tier, o.tier, now); // predicted vs actual
    }
    const r = reqs.get(o.q);
    const row = r && r.items.find((x) => isDuplicate(x.text, hit.item.text));
    if (row) {
      row.out = hit.item.out;
      if (hit.item.act) row.act = hit.item.act;
      if (hit.item.as) row.as = hit.item.as; // accepted, but under the game's own term
      if (hit.item.v) row.v = hit.item.v;
      notify(r);
    }
  }

  function applyOutcomes(outcomes) {
    const now = Date.now();
    for (const o of outcomes) processOutcome({ ...o, source: 'party' }, now);
    persistMemory();
    if (settings.learnFromGame) {
      persistLearned();
      persistProfile();
    }
  }

  // Party: the player's own submit paired with the game's reply (see hook.js). Exact: it says what was typed
  // and the game's own term, rarity or reason. The game's event for the same answer arrives separately (always
  // first, in the recording this was built from) and is what gets counted, so here only the alias is added.
  function onMyAnswer(m) {
    if (!settings.learnFromGame || !tracker) return;
    const q = tracker.currentCategory(m.code);
    const kind = m.accepted ? 'accepted' : m.why === 'repeat' ? 'taken' : m.why === 'miss' ? 'miss' : null;
    if (!q || !kind) return;
    const now = Date.now();
    if (kind === 'accepted' && m.answer) {
      Learn.recordAlias(learned, q, m.answer, m.typed, now);
      // fold what was typed into the game's summary (the game's own event adds the answer itself)
      logFor({ key: tracker.gameKey(m.code), code: m.code }).add({ q, answer: m.answer, kind: 'accepted', tier: m.tier, mine: true, typed: m.typed });
    }
    processOutcome(
      { q, mine: true, source: 'party', fromAck: true, kind, tier: m.tier, typed: m.typed, answer: kind === 'accepted' ? m.answer || m.typed : m.typed },
      now
    );
    persistMemory();
    persistLearned();
    persistProfile();
  }

  // Our own player id, worked out from the websocket itself (see hook.js).
  function onPartyMe(m) {
    if (tracker && typeof m.id === 'string') tracker.setMe(m.code, m.id);
    identify(m.code);
  }

  // Daily dive: the player's own answer and how the game replied (see hook.js). A reply that only
  // proposes a correction is not a result yet; the final reply to the corrected answer is.
  function onDailyAnswer(m) {
    if (!settings.learnFromGame || !daily) return;
    // Only an answer for today's date can be matched to today's questions (ids repeat every day and in the
    // archive); an answer from another day is skipped rather than filed under the wrong question.
    const prompt = Core.dailyAnswerPrompt(daily, m);
    if (!prompt || (m.correction && !m.accepted)) return;
    const now = Date.now();
    const base = { q: prompt.text, mine: true, source: 'daily', date: daily.date };
    const result = m.accepted && m.tier
      ? { ...base, answer: m.answer || m.typed, typed: m.typed, kind: 'accepted', tier: m.tier }
      : { ...base, answer: m.typed, kind: 'miss', tier: null };
    processOutcome(result, now);
    dailyResults.set(prompt.id, result); // the last final result per question: what the summary is built from
    persistMemory();
    persistLearned();
    persistProfile();
  }

  // ---- optional dataset: every party event, pseudonymised, one record per game ------------
  const pdPending = new Map();
  let pdTimer = null;
  const PD_MAX_GAMES = 400;
  const PD_MAX_EVENTS = 3000;

  function queuePartyRecords(res) {
    if (!res.game || (!res.events.length && !res.categories.length)) return;
    const slot = pdPending.get(res.game.key) || { game: res.game, categories: [], events: [] };
    slot.game = res.game;
    slot.categories.push(...res.categories);
    slot.events.push(...res.events);
    pdPending.set(res.game.key, slot);
    clearTimeout(pdTimer);
    pdTimer = setTimeout(flushPartyRecords, 800); // coalesce: events arrive in bursts
  }

  function flushPartyRecords() {
    const batch = [...pdPending.values()];
    pdPending.clear();
    if (!batch.length) return;
    queue(async () => {
      const { pdIndex = [] } = await store.get('pdIndex');
      const keys = batch.map((b) => `pd:${b.game.key}`);
      const existing = await store.get(keys);
      const now = Date.now();
      const index = [...pdIndex];
      const write = {};
      for (const b of batch) {
        const k = `pd:${b.game.key}`;
        const rec = existing[k] || { key: b.game.key, code: b.game.code, gameId: b.game.gameId, gameNumber: b.game.gameNumber, startedAt: now, categories: [], events: [] };
        for (const c of b.categories) {
          if (!rec.categories.some((x) => x.index === c.index && x.text === c.text)) rec.categories.push({ ...c, at: now });
        }
        const have = new Set(rec.events.map((e) => e.seq));
        for (const e of b.events) if (!have.has(e.seq)) rec.events.push(e);
        rec.events.sort((a, b2) => a.seq - b2.seq);
        rec.events = rec.events.slice(-PD_MAX_EVENTS);
        rec.updatedAt = now;
        write[k] = rec;
        if (!index.includes(k)) index.push(k);
      }
      const drop = index.length > PD_MAX_GAMES ? index.splice(0, index.length - PD_MAX_GAMES) : [];
      await store.set({ ...write, pdIndex: index });
      if (drop.length) await store.remove(drop);
    });
  }

  // ---- end of a game: summarise it so the AI can learn from it ---------------------------------------
  // Results are collected per game as they arrive. When the game ends (a live "win" event, or the room going
  // to "over"/"lobby" after play; for the daily dive, the site reporting the game complete) the collected results
  // become a summary (summary.js): kept, boiled down to insights, and, if enabled, handed to the AI for a
  // reflection whose lessons go into later requests.
  const gameLogs = new Map(); // game key -> GameLog
  const finishedGames = new Set();
  const dailyResults = new Map(); // promptId -> the player's final result for it, for today's daily game
  let dailyDone = false;

  // One-time clean-up. Earlier versions filed ANY daily /api/submit answer under today's question with the same
  // id, which is wrong for another day's game (the archive): answers ended up beside unrelated questions, in
  // the learning store and the player's profile, and were then sent to the model. Today's prompts are the ones
  // affected right now, so what was recorded for them is dropped, and profile answers that carry no date (so
  // cannot be checked) are dropped for them too. The rest of the undated ones are ignored, not deleted.
  let migrations = {};
  function purgeMisfiledDaily(d) {
    if (migrations.dailyAttribution) return;
    migrations = { ...migrations, dailyAttribution: 1 };
    queue(() => store.set({ migrations }));
    const keys = new Set(d.prompts.map((p) => normKey(p.text)));
    for (const k of keys) delete learned.entries[k];
    profile.mine = profile.mine.filter((m) => !(m.src === 'daily' && !m.d && keys.has(normKey(m.q))));
    persistLearned();
    persistProfile();
  }

  function logFor(game) {
    let log = gameLogs.get(game.key);
    if (!log) {
      log = new Summary.GameLog({ kind: 'party', key: game.key, room: game.code, gameNumber: game.gameNumber });
      gameLogs.set(game.key, log);
      if (gameLogs.size > 8) gameLogs.delete(gameLogs.keys().next().value); // bounded: a game we never saw end
    }
    return log;
  }

  const countResults = (s) => s.totals.accepted + s.totals.rejected + s.totals.mine.accepted + s.totals.mine.rejected;

  // Summarise, keep, and (optionally) reflect. Returns false when there was nothing worth summarising.
  function finishGame(log) {
    const now = Date.now();
    const summary = Summary.summarize(log, (q) => Mem.shownFor(memory, q, now), now);
    if (!countResults(summary)) return false;
    Learn.recordGame(learned, summary, Summary.insights(summary), now);
    persistLearned();
    const reflect = settings.reflectAtGameEnd && aiOn() && countResults(summary) >= 6;
    overlay.setFlash(`Game over · summary saved${reflect ? ' · learning from it…' : ''}`);
    if (reflect) reflectOn(summary);
    return true;
  }

  // One request: the model reads the summary and writes lessons. A failure only means no lessons this time.
  async function reflectOn(summary) {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'reflect', summary: Summary.toText(summary) });
      if (res && res.ok && res.lessons.length) {
        Learn.addReflection(learned, summary.key, res.lessons, Date.now());
        persistLearned();
        overlay.setFlash(`Game over · learned ${res.lessons.length} lesson${res.lessons.length === 1 ? '' : 's'} from it`);
      } else {
        overlay.setFlash('Game over · summary saved');
      }
    } catch (_) {
      overlay.setFlash('Game over · summary saved');
    }
  }

  function endParty(res) {
    const log = gameLogs.get(res.game.key);
    if (!log || finishedGames.has(res.game.key)) return;
    log.finish({ won: res.winnerMe, place: log.myPlace, reason: res.ended });
    if (finishGame(log)) {
      finishedGames.add(res.game.key);
      gameLogs.delete(res.game.key);
    }
  }

  function onDailyComplete(m) {
    if (!settings.learnFromGame || !daily || dailyDone || m.date !== daily.date) return; // another day's game is not today's
    const log = new Summary.GameLog({ kind: 'daily', key: `daily:${daily.date}`, date: daily.date, score: m.score });
    for (const r of dailyResults.values()) log.add({ q: r.q, answer: r.answer, kind: r.kind, tier: r.tier, typed: r.typed, mine: true });
    log.finish({});
    if (finishGame(log)) dailyDone = true;
  }

  function onPartyData(m) {
    if (!wantsResults() || !tracker) return;
    if (!tracker.hasMe(m.code)) {
      const me = readSeatId(m.code); // retried until the seat exists
      if (me) tracker.setMe(m.code, me);
    }
    const res = tracker.ingest(m);
    persistPartyState();
    if (res.outcomes.length) applyOutcomes(res.outcomes);
    if (settings.learnFromGame && res.game) {
      const log = logFor(res.game);
      for (const o of res.outcomes) log.add(o);
      if (res.myPlace !== null) log.myPlace = res.myPlace; // remembered: the "out" event comes before the game ends
      if (res.ended) endParty(res);
    }
    if (settings.collectParty) queuePartyRecords(res);
  }

  const notify = (r) => r.subs.forEach((f) => f(r));
  const newReq = (text) => ({ text, items: [], status: 'idle', error: null, code: null, subs: new Set(), port: null, gen: 0 });

  // One request for this question. Each request tells the model what is already on the list
  // (so nothing repeats) and which answers the game accepted/rejected (so it can adjust).
  //   replace=false  "+ more": new answers are appended
  //   replace=true   first load / new batch: the visible list starts empty (memory still excludes old ones)
  //   single=true    exactly one model request, no follow-ups for missing answers (the daily dive's one request)
  function startRequest(r, { replace, single = false }) {
    r.blocked = false;
    const gen = ++r.gen; // a newer request makes this one's late messages inert
    if (r.port) {
      try {
        r.port.disconnect();
      } catch (_) {
        /* already gone */
      }
      r.port = null;
    }
    if (replace) r.items = [];
    r.status = 'loading';
    r.error = null;
    r.code = null;

    let port;
    try {
      port = chrome.runtime.connect({ name: 'krillion-ai' });
    } catch (_) {
      r.status = 'error';
      r.code = 'context';
      r.error = 'The extension was reloaded. Refresh this page.';
      notify(r);
      return r;
    }
    r.port = port;
    const live = () => r.gen === gen;
    const end = () => {
      if (r.port === port) r.port = null;
      try {
        port.disconnect();
      } catch (_) {
        /* already gone */
      }
    };
    port.onMessage.addListener((m) => {
      if (!live()) return;
      if (m.type === 'suggestion') {
        const item = { ...m.suggestion };
        if (!r.items.some((x) => normKey(x.text) === normKey(item.text))) {
          r.items.push(item);
          Mem.recordShown(memory, r.text, item, Date.now());
          persistMemory();
        }
      } else if (m.type === 'done' || m.type === 'error') {
        r.status = m.type === 'done' ? 'done' : 'error';
        if (m.type === 'error') {
          r.error = m.message;
          r.code = m.code;
        }
        end();
      } else {
        return;
      }
      notify(r);
    });
    port.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (!live() || r.status !== 'loading') return;
      r.port = null;
      r.status = 'error';
      r.code = 'disconnect';
      r.error = 'The AI worker stopped unexpectedly. Press ↻ to retry.';
      notify(r);
    });
    const now = Date.now();
    try {
      port.postMessage({
        type: 'suggest',
        question: r.text,
        want: settings.count,
        exclude: Mem.excludeFor(memory, r.text, now),
        // session verdicts + (if learning is on) what the game itself has said about this prompt and
        // about the model's rarity labels in general
        feedback: {
          ...Mem.feedbackFor(memory, r.text, now),
          ...(settings.learnFromGame ? Learn.promptHints(learned, r.text) : {}),
          // the player's own leanings (answers the game accepted from them + what they wrote in Settings)
          ...(settings.adaptToMe ? { profile: Profile.promptHints(profile, settings.interests) } : {}),
        },
        krillionTaken: Mem.hasKrillion(memory, r.text, now), // the game has only one krillion answer per prompt
        single,
      });
    } catch (_) {
      /* onDisconnect reports it */
    }
    notify(r);
    return r;
  }

  // Stop a request. drop=true also forgets it (a party category that was superseded).
  function cancelReq(r, drop) {
    r.gen++;
    if (r.port) {
      try {
        r.port.disconnect();
      } catch (_) {
        /* already gone */
      }
      r.port = null;
    }
    if (drop && reqs.get(r.text) === r) reqs.delete(r.text);
    r.status = 'cancelled';
    notify(r);
  }

  // mode: 'initial' (use what we have, else ask) | 'more' (append new answers) | 'fresh' (new batch)
  //   daily: this is a daily-dive question, so the one-request-per-load rule applies to the automatic ask.
  //   The rule never touches ↻ / "+ more" (explicit clicks) and never blocks restoring a remembered list.
  function ensure(text, mode = 'initial', { daily = false } = {}) {
    let r = reqs.get(text);
    if (!r) {
      r = newReq(text);
      reqs.set(text, r);
    }
    if (mode === 'initial') {
      if (r.status === 'loading' || r.status === 'done') return r;
      // Seen earlier this session (e.g. before a page reload)? Restore it, no API call.
      const saved = Mem.shownFor(memory, text, Date.now());
      if (saved.length) {
        r.items = saved;
        r.status = 'done';
        r.blocked = false;
        return r;
      }
      const limited = daily && settings.dailySingleRequest;
      if (gateDailyRequest(dailyGate, limited) === 'blocked') {
        r.status = 'idle'; // the load's one request went to an earlier question: wait for ↻
        r.items = [];
        r.blocked = true;
        return r;
      }
      return startRequest(r, { replace: true, single: limited });
    }
    if (r.status === 'loading') return r; // already working on it
    return startRequest(r, { replace: mode === 'fresh' });
  }

  // ✓ / ✗ on a suggestion (verdict null clears it). Remembered and sent with every later request.
  function setVerdict(item, verdict) {
    const r = current && reqs.get(current.text);
    const it = r && r.items.find((x) => normKey(x.text) === normKey(item.text));
    if (!it) return;
    if (verdict) it.v = verdict;
    else delete it.v;
    Mem.setVerdict(memory, r.text, it.text, verdict, Date.now());
    persistMemory();
    notify(r);
  }

  function bind(r) {
    const render = () => {
      if (r.status === 'cancelled') return;
      if (r.status === 'idle' && r.blocked) {
        overlay.setSuggestions([]);
        overlay.setMore({ visible: false, busy: false });
        overlay.setStatus('info', 'Daily: one AI request per page load, already used on an earlier question. Press ↻ to ask for this one.');
        return;
      }
      overlay.setSuggestions(r.items);
      overlay.setMore({ visible: r.items.length > 0 || r.status === 'done', busy: r.status === 'loading' });
      if (r.status === 'loading') overlay.setStatus('loading', 'sounding the depths');
      else if (r.status === 'error') overlay.setStatus('error', r.error, { settings: CONFIG_ERRORS.includes(r.code) });
      else overlay.setStatus('ok', '');
    };
    r.subs.add(render);
    unsub = () => r.subs.delete(render);
    render();
  }

  // Warm the cache for every daily prompt (two at a time) so the current one is instant.
  async function prefetch(texts) {
    const pending = texts.filter((t) => {
      const r = reqs.get(t);
      return !r || r.status === 'error';
    });
    const worker = async () => {
      while (pending.length && aiOn()) {
        const r = ensure(pending.shift());
        if (r.status === 'loading') {
          await new Promise((resolve) => {
            const f = () => {
              if (r.status !== 'loading') {
                r.subs.delete(f);
                resolve();
              }
            };
            r.subs.add(f);
          });
        }
        // A config/network failure would repeat for every prompt: stop and let the user see it.
        if (r.status === 'error' && [...CONFIG_ERRORS, 'network'].includes(r.code)) pending.length = 0;
      }
    };
    await Promise.all([worker(), worker()]);
  }

  // ---- showing a question ----------------------------------------------------------
  function renderChips() {
    const showChips = daily && !isParty() && !(current && current.source === 'party');
    if (!showChips) return overlay.setChips(null);
    const n = daily.prompts.length;
    overlay.setChips(
      daily.prompts.map((p, i) => ({ label: String(i + 1), title: p.text })),
      current && current.source === 'daily' ? current.index : -1,
      (i) => present({ text: daily.prompts[i].text, label: `Daily · ${i + 1}/${n}`, source: 'daily', index: i })
    );
  }

  function present(q, { mode = 'initial' } = {}) {
    current = q;
    if (unsub) unsub();
    unsub = null;
    overlay.setQuestion(q);
    renderChips();
    if (!settings.overlayEnabled) {
      /* hidden: don't spend an API call */
    } else if (!settings.enabled) {
      overlay.setStatus('info', 'AI suggestions are off.');
    } else {
      bind(ensure(q.text, mode, { daily: q.source === 'daily' }));
    }
    refreshVisibility();
  }

  function idle() {
    if (!daily) return;
    overlay.setQuestion({ text: 'Daily dive loaded. The question shows here when a round starts, or pick a number.', label: `Daily · #${daily.dayNumber ?? '?'}` });
    renderChips();
    refreshVisibility();
  }

  // ---- questions in --------------------------------------------------------------
  function onParty(code, rawCategory) {
    const c = parseCategory(rawCategory);
    if (!c) return;
    const key = { room: code, text: c.text, index: c.index };
    if (isSameQuestion(lastParty, key)) return; // a snap replaying the current category
    lastParty = key;
    const prev = partyText && reqs.get(partyText);
    if (prev && prev.status === 'loading' && partyText !== c.text) cancelReq(prev, true); // superseded
    partyText = c.text;
    present({
      text: c.text,
      label: `Party ${code}${c.index !== null ? ` · #${c.index + 1}` : ''}`,
      source: 'party',
    });
    identify(code);
    queue(async () => {
      const { party } = await store.get('party');
      const p = party && Array.isArray(party.entries) ? party : { entries: [] };
      if (addCategory(p, code, c, Date.now())) await store.set({ party: p });
    });
  }

  function onDaily(data) {
    const d = parseDaily(data);
    if (!d) return;
    const isNewDay = !daily || daily.date !== d.date;
    daily = d;
    if (isNewDay) {
      dailyResults.clear(); // a new day is a new game
      dailyDone = false;
    }
    purgeMisfiledDaily(d);
    identify();
    if (isNewDay && current && current.source === 'daily') current = null;
    if (!current) idle();
    else renderChips();
    if (aiOn() && prefetchOn()) prefetch(d.prompts.map((p) => p.text));
    startObserver();
    detectDaily();
    queue(async () => {
      const { daily: all = {} } = await store.get('daily');
      if (all[d.date] && all[d.date].prompts.length === d.prompts.length) return;
      all[d.date] = { ...d, capturedAt: Date.now() };
      await store.set({ daily: all });
    });
  }

  // The daily game shows one prompt per round: find which one is on screen.
  let observer = null;
  let throttle = null;
  function detectDaily() {
    if (!daily || isParty()) return;
    const i = findPrompt(document.body ? document.body.textContent : '', daily.prompts);
    if (i < 0 || (current && current.source === 'daily' && current.index === i)) return;
    present({ text: daily.prompts[i].text, label: `Daily · ${i + 1}/${daily.prompts.length}`, source: 'daily', index: i });
  }
  function startObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      // throttle (not debounce): the game ticks constantly and would starve a debounce
      if (!throttle) {
        throttle = setTimeout(() => {
          throttle = null;
          detectDaily();
        }, 250);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  // ---- boot ----------------------------------------------------------------------
  // Messages can arrive before settings load: queue them behind `ready`, in order.
  const ready = store.get(['settings', 'overlayPos', 'memory', 'learned', 'profile', 'partyState', 'pseudoSalt', 'migrations']).then(async (st) => {
    migrations = st.migrations && typeof st.migrations === 'object' ? st.migrations : {};
    settings = { ...DEFAULTS, ...st.settings };
    memory = Mem.pruneMemory(Mem.cleanMemory(st.memory), Date.now());
    learned = Learn.cleanLearned(st.learned);
    profile = Profile.cleanProfile(st.profile);
    // Player ids are stored only as salted hashes. The salt is random, per install, and never exported.
    let salt = st.pseudoSalt;
    if (typeof salt !== 'string' || salt.length < 16) {
      salt = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
      await store.set({ pseudoSalt: salt });
    }
    tracker = new PartyTracker(salt, st.partyState);
    overlay.setPosition(st.overlayPos);
    applySettings();
    postConfig();
    identify();
  });

  window.addEventListener('message', (ev) => {
    if (ev.source !== window) return;
    const m = ev.data;
    if (!m || m[TAG] !== 1) return;
    ready.then(() => {
      if (m.kind === 'party-question' && typeof m.code === 'string') onParty(m.code, m.category);
      else if (m.kind === 'party-raw' && typeof m.code === 'string') onRaw(m);
      else if (m.kind === 'party-data' && typeof m.code === 'string') onPartyData(m);
      else if (m.kind === 'daily-answer') onDailyAnswer(m);
      else if (m.kind === 'daily-complete') onDailyComplete(m);
      else if (m.kind === 'party-my-answer' && typeof m.code === 'string') onMyAnswer(m);
      else if (m.kind === 'party-me' && typeof m.code === 'string') onPartyMe(m);
      else if (m.kind === 'daily') onDaily(m.data);
      else if (m.kind === 'hook-ready') postConfig(); // the hook loaded after our first config
    });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    // "Reset session memory" in Settings. Only an EMPTY memory is adopted from storage: our own
    // debounced writes also fire this event and must not overwrite newer in-page state.
    if (changes.memory && Object.keys(Mem.cleanMemory(changes.memory.newValue).entries).length === 0) {
      clearTimeout(persistTimer);
      memory = Mem.newMemory();
      for (const [text, r] of reqs) if (r.status !== 'loading') reqs.delete(text);
    }
    if (changes.learned && Object.keys(Learn.cleanLearned(changes.learned.newValue).entries).length === 0) {
      clearTimeout(learnedTimer); // "Reset learned data" in Settings
      learned = Learn.newLearned();
    }
    if (changes.profile && Profile.cleanProfile(changes.profile.newValue).mine.length === 0) {
      clearTimeout(profileTimer); // same reset also forgets the player's own answers
      profile = Profile.newProfile();
    }
    if (!changes.settings) return;
    const before = configKey();
    settings = { ...DEFAULTS, ...changes.settings.newValue };
    applySettings();
    if (configKey() !== before) postConfig(); // tell the hook to start / stop relaying
    if (!settings.recordRaw) flushRaw(); // recording was switched off: keep what was captured so far
  });

  // Alt+K toggles the floating window (same setting as the popup switch).
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.code === 'KeyK') {
        e.preventDefault();
        patchSettings({ overlayEnabled: !settings.overlayEnabled });
      }
    },
    true
  );
})();
