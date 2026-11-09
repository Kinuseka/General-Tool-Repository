// Pairs your submits with the game's replies (cid), shows corrections, input telemetry and your own player id.
// Usage: node tools/pair-answers.js <krillion-raw-....jsonl>   (exported from the extension's Learning tab)
const fs = require('fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const P = rows.map((r) => { let j = null; if (r.dir !== 'meta') try { j = JSON.parse(r.data); } catch (_) {} return { ...r, j }; });
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const _s = {}; for (const r of P) (_s[r.session] ||= []).push(r);
const main = Object.values(_s).sort((a, b) => b.length - a.length)[0]; // the busiest recording

// ---- pair my submits with their acks --------------------------------------------------------
const submits = new Map(); // cid -> {text, input, t}
for (const r of main) if (r.dir === 'out' && r.j && r.j.t === 'act' && r.j.action.type === 'submit') submits.set(r.j.cid, { ...r.j.action, t: r.t });
console.log('MY SUBMITS', submits.size);
const acks = main.filter((r) => r.dir === 'in' && r.j && r.j.t === 'ack' && submits.has(r.j.cid));
console.log('paired acks', acks.length);
const ackVariants = {};
for (const a of acks) { const k = JSON.stringify({ accepted: a.j.submit && a.j.submit.accepted, why: a.j.submit && a.j.submit.why, hasAnswer: !!(a.j.submit && a.j.submit.answer), hasTier: !!(a.j.submit && a.j.submit.tier), keys: a.j.submit && Object.keys(a.j.submit).sort().join(',') }); ackVariants[k] = (ackVariants[k] || 0) + 1; }
console.log('ack.submit variants:'); for (const [k, v] of Object.entries(ackVariants)) console.log(' ', v, k);
console.log('\ntyped -> reply (latency ms from submit to ack):');
for (const a of acks) {
  const s = submits.get(a.j.cid); const sub = a.j.submit || {};
  const changed = sub.answer && norm(sub.answer) !== norm(s.text) ? '  <-- DIFFERENT TERM' : '';
  console.log(`  ${JSON.stringify(s.text).padEnd(22)} ${sub.accepted ? 'ACCEPTED ' + JSON.stringify(sub.answer) + ' ' + sub.tier : 'REJECTED ' + (sub.why || '')}  (${a.t - s.t}ms)${changed}`);
}
console.log('\ninput telemetry on submits:');
const inp = [...submits.values()].map((s) => s.input);
console.log(' keys of input:', [...new Set(inp.flatMap((i) => Object.keys(i || {})))].join(','));
console.log(' pastes>0:', inp.filter((i) => i && i.pastes > 0).length, ' synthetic>0:', inp.filter((i) => i && i.synthetic > 0).length, ' other>0:', inp.filter((i) => i && i.other > 0).length, ' of', inp.length);
const pasted = [...submits.values()].filter((s) => s.input && (s.input.pastes > 0 || s.input.synthetic > 0)).slice(0, 5);
for (const s of pasted) console.log('  ', JSON.stringify(s));

// ---- who am I? patches carry the cid of the act that caused them -------------------------------
const myCids = new Set(main.filter((r) => r.dir === 'out' && r.j && r.j.t === 'act').map((r) => r.j.cid));
const ids = {};
for (const r of main) if (r.dir === 'in' && r.j && r.j.t === 'patch' && myCids.has(r.j.patch.cid)) for (const p of r.j.patch.players || []) ids[p.id] = (ids[p.id] || 0) + 1;
console.log('\nplayer ids appearing in patches that answer MY cids:', JSON.stringify(ids));
const myId = Object.entries(ids).sort((a, b) => b[1] - a[1])[0] && Object.entries(ids).sort((a, b) => b[1] - a[1])[0][0];

// ---- compare ack.answer with the pass event the game then emits -------------------------------
const events = []; const seen = new Set();
for (const r of main) { if (r.dir !== 'in' || !r.j) continue; const list = r.j.t === 'snap' ? r.j.room.events : r.j.t === 'patch' ? r.j.patch.events : null; for (const e of list || []) { if (!seen.has(e.seq)) { seen.add(e.seq); events.push({ ...e, _t: r.t }); } } }
events.sort((a, b) => a.seq - b.seq);
const mine = events.filter((e) => (e.kind === 'pass' && e.from === myId) || (e.kind === 'reject' && e.playerId === myId));
console.log('\nmy events by id:', mine.length, ' (my submits:', submits.size + ')');
let match = 0, canonSame = 0;
for (const a of acks) {
  const s = a.j.submit || {};
  if (!s.accepted) continue;
  const pass = events.find((e) => e.kind === 'pass' && e.from === myId && Math.abs(e._t - a.t) < 1500 && norm(e.answer) === norm(s.answer));
  if (pass) { match++; if (pass.answer === s.answer && pass.tier === s.tier) canonSame++; }
}
console.log('accepted acks with a matching pass event (same answer):', match, 'identical answer+tier:', canonSame, 'of', acks.filter((a) => a.j.submit && a.j.submit.accepted).length);

// ---- typing indicator vs typed text -------------------------------------------------------------
const myTyping = main.filter((r) => r.dir === 'out' && r.j && r.j.t === 'act' && r.j.action.type === 'typing');
const patchesTyping = main.filter((r) => r.dir === 'in' && r.j && r.j.t === 'patch' && (r.j.patch.players || []).some((p) => p.id === myId && typeof p.typing === 'string'));
console.log('\nmy outbound typing frames:', myTyping.length, ' inbound patches showing MY typing:', patchesTyping.length);
const throttle = [];
for (let i = 1; i < myTyping.length; i++) throttle.push(myTyping[i].t - myTyping[i - 1].t);
console.log('gaps between my typing frames (ms): median', throttle.sort((a, b) => a - b)[Math.floor(throttle.length / 2)]);
