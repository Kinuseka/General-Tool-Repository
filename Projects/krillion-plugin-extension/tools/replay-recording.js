// Replays a recording through the extension's real hook.js and party-data.js and reports what they extract.
// Usage: node tools/replay-recording.js <krillion-raw-....jsonl>   (exported from the extension's Learning tab)
// Replays the real recording through the extension's actual hook.js and party-data.js.
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const party = require(path.join(root, 'src/party-data.js'));
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function makeHook() {
  const posted = [];
  class WS { constructor(u) { this.url = u; this.l = {}; this.sent = []; } addEventListener(t, f) { (this.l[t] ||= []).push(f); } emit(t, e) { (this.l[t] || []).forEach((f) => f(e)); } send(d) { this.sent.push(d); } }
  const listeners = [];
  const win = { WebSocket: WS, location: { origin: 'https://krillion.io', href: 'https://krillion.io/party' }, postMessage: (m) => posted.push(m), addEventListener: (t, f) => t === 'message' && listeners.push(f), fetch: async () => ({ ok: true, clone: () => ({ json: async () => ({}) }) }) };
  win.window = win;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/hook.js'), 'utf8'), { window: win, URL, console });
  listeners.forEach((f) => f({ source: win, data: { __krillionExt: 1, kind: 'config', collect: true, raw: false } }));
  return { win, posted };
}

const sessions = {};
for (const r of rows) (sessions[r.session] ||= []).push(r);
const main = Object.entries(sessions).sort((a, b) => b[1].length - a[1].length)[0]; // the busiest recording
const [sid, frames] = main;
const { win, posted } = makeHook();
const room = frames[0].room;
const ws = new win.WebSocket(`wss://party.krillion.io/rooms/${room}/ws?key=K&token=T`);
for (const r of frames) {
  if (r.dir === 'in') ws.emit('message', { data: r.data });
  else if (r.dir === 'out') ws.send(r.data);
}
const data = posted.filter((m) => m.kind === 'party-data');
const questions = posted.filter((m) => m.kind === 'party-question');
console.log('hook posted: party-data', data.length, ' party-question', questions.length, ' total', posted.length);
const myAnswers = posted.filter((m) => m.kind === 'party-my-answer');
const meMsgs = posted.filter((m) => m.kind === 'party-me');
console.log('own answers paired with the game\'s reply (exact):', myAnswers.length, ' accepted:', myAnswers.filter((m) => m.accepted).length,
  ' recorded under a DIFFERENT term:', myAnswers.filter((m) => m.accepted && norm(m.answer) !== norm(m.typed)).length, ' own-id messages:', meMsgs.length);
for (const m of myAnswers.filter((m) => m.accepted && norm(m.answer) !== norm(m.typed))) console.log(`    ${JSON.stringify(m.typed).padEnd(16)} -> ${JSON.stringify(m.answer)} (${m.tier})`);
console.log('distinct categories relayed as questions:', [...new Set(questions.map((q) => q.category.text))].length);
for (const t of [...new Set(questions.map((q) => `#${q.category.index} ${q.category.text}`))]) console.log('   ', t);

// ground truth: my id from the cid trick, my submits and replies
const myCids = new Set(frames.filter((r) => r.dir === 'out').map((r) => { try { const j = JSON.parse(r.data); return j.t === 'act' ? j.cid : null; } catch (_) { return null; } }).filter(Boolean));
let myId = null;
for (const r of frames) if (r.dir === 'in') { try { const j = JSON.parse(r.data); if (j.t === 'patch' && myCids.has(j.patch.cid) && j.patch.players && j.patch.players[0]) { myId = j.patch.players[0].id; break; } } catch (_) {} }

const tr = new party.PartyTracker('salt');
tr.setMe(room, myId);
const Summary = require(path.join(root, 'src/summary.js'));
const all = { events: [], outcomes: [], categories: [] };
const ends = [];
const logs = new Map();
for (const m of data) {
  const { kind, ...msg } = m; delete msg.__krillionExt;
  const r = tr.ingest(msg); all.events.push(...r.events); all.outcomes.push(...r.outcomes); all.categories.push(...r.categories);
  // the same end-of-game logic the extension's bridge runs
  const log = logs.get(r.game.key) || new Summary.GameLog({ kind: 'party', key: r.game.key, room: r.game.code });
  logs.set(r.game.key, log);
  for (const o of r.outcomes) log.add(o);
  if (r.myPlace !== null) log.myPlace = r.myPlace;
  if (r.ended) { log.finish({ won: r.winnerMe, place: log.myPlace, reason: r.ended }); ends.push({ reason: r.ended, game: r.game.key, summary: Summary.summarize(log, () => []) }); logs.delete(r.game.key); }
}
console.log('\ngame ends detected:', ends.length);
for (const e of ends) console.log('  ', e.reason.padEnd(5), e.game.slice(0, 34), '\n     ', e.summary.brief);
console.log('\ntracker: events', all.events.length, ' outcomes', all.outcomes.length, ' categories', all.categories.length);
const by = (a, f) => a.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
console.log(' outcomes by kind:', JSON.stringify(by(all.outcomes, (o) => o.kind)));
console.log(' outcomes with unknown category (q null):', all.outcomes.filter((o) => o.q === null).length);
console.log(' flagged mine:', all.outcomes.filter((o) => o.mine).length, ' (ground truth: 25 submits)');
console.log(' flagged me in events:', all.events.filter((e) => e.me).length);
console.log(' hook-detected corrections (typed):');
for (const o of all.outcomes.filter((o) => o.typed)) console.log(`    ${o.mine ? 'MINE ' : 'other'} typed ${JSON.stringify(o.typed).padEnd(24)} -> ${JSON.stringify(o.answer)} (${o.tier})`);

// ground truth corrections from my acks
const subs = new Map();
for (const r of frames) if (r.dir === 'out') { try { const j = JSON.parse(r.data); if (j.t === 'act' && j.action.type === 'submit') subs.set(j.cid, j.action.text); } catch (_) {} }
const truth = [];
for (const r of frames) if (r.dir === 'in') { try { const j = JSON.parse(r.data); if (j.t === 'ack' && subs.has(j.cid) && j.submit && j.submit.accepted && norm(j.submit.answer) !== norm(subs.get(j.cid))) truth.push([subs.get(j.cid), j.submit.answer]); } catch (_) {} }
console.log('\n ground truth (from acks): my corrected answers:', truth.length);
const found = truth.filter(([t, a]) => all.outcomes.some((o) => o.mine && o.typed && norm(o.typed) === norm(t) && norm(o.answer) === norm(a)));
console.log(' of which the typing-based detector caught:', found.length);
for (const [t, a] of truth) console.log('    ', JSON.stringify(t).padEnd(14), '->', JSON.stringify(a), found.some(([ft]) => ft === t) ? 'caught' : 'MISSED');

// attribution check: for every pass/reject event, was the category right? compare with the category in force by index
const cats = {};
for (const e of all.events) if (e.kind === 'category') cats[e.index] = true;
const byCat = by(all.outcomes.filter((o) => o.q), (o) => o.q);
console.log('\n outcomes per category:'); for (const [q, n] of Object.entries(byCat)) console.log('   ', String(n).padStart(3), q);
