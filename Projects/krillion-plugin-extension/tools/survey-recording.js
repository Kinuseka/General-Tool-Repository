// Shape survey of a raw websocket recording: sessions, frame types, action and ack shapes, event kinds.
// Usage: node tools/survey-recording.js <krillion-raw-....jsonl>   (exported from the extension's Learning tab)
// Survey of a raw websocket recording (JSONL from the extension). Prints shapes, not player names.
const fs = require('fs');
const file = process.argv[2];
const rows = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const by = (a, f) => a.reduce((m, x) => ((m[f(x)] = (m[f(x)] || 0) + 1), m), {});
const keys = (o) => (o && typeof o === 'object' ? Object.keys(o).sort().join(',') : typeof o);

console.log('lines', rows.length);
const sessions = {};
for (const r of rows) (sessions[r.session] ||= []).push(r);
console.log('sessions', Object.keys(sessions).length);
for (const [id, rs] of Object.entries(sessions)) {
  const d = by(rs, (r) => r.dir);
  const span = ((rs[rs.length - 1].t - rs[0].t) / 1000).toFixed(0);
  console.log(' ', id, 'room', rs[0].room, 'frames', rs.length, JSON.stringify(d), `${span}s`, 'start', new Date(rs[0].t).toISOString());
}

const parsed = rows.map((r) => {
  let j = null;
  if (r.dir !== 'meta') try { j = JSON.parse(r.data); } catch (_) {}
  return { ...r, j };
});

console.log('\nMETA frames:');
for (const r of parsed.filter((r) => r.dir === 'meta')) console.log(' ', r.session.slice(0, 20), r.data.slice(0, 200));

console.log('\nINBOUND t:', JSON.stringify(by(parsed.filter((r) => r.dir === 'in'), (r) => (r.j ? r.j.t : 'UNPARSEABLE'))));
console.log('OUTBOUND t:', JSON.stringify(by(parsed.filter((r) => r.dir === 'out'), (r) => (r.j ? r.j.t : 'UNPARSEABLE'))));

console.log('\nOUTBOUND act shapes:');
const acts = parsed.filter((r) => r.dir === 'out' && r.j && r.j.t === 'act');
const actTypes = by(acts, (r) => r.j.action && r.j.action.type);
console.log(' types', JSON.stringify(actTypes));
const seenShape = new Set();
for (const r of acts) {
  const s = r.j.action && `${r.j.action.type}:${keys(r.j.action)}`;
  if (!seenShape.has(s)) { seenShape.add(s); console.log('  ', JSON.stringify(r.j)); }
}
console.log(' other outbound:');
const seenOut = new Set();
for (const r of parsed.filter((r) => r.dir === 'out' && r.j && r.j.t !== 'act')) {
  const s = r.j.t + keys(r.j);
  if (!seenOut.has(s)) { seenOut.add(s); console.log('  ', r.data.slice(0, 200)); }
}

console.log('\nACK shapes:');
const acks = parsed.filter((r) => r.dir === 'in' && r.j && r.j.t === 'ack');
console.log(' count', acks.length, 'ok:', JSON.stringify(by(acks, (r) => r.j.ok)), 'status:', JSON.stringify(by(acks, (r) => r.j.status)));
const seenAck = new Set();
for (const r of acks) {
  const s = keys(r.j) + '|' + keys(r.j.submit);
  if (!seenAck.has(s)) { seenAck.add(s); console.log('  ', r.data.slice(0, 400)); }
}

console.log('\nOTHER inbound t (not snap/patch/ack/pong):');
const seenIn = new Set();
for (const r of parsed.filter((r) => r.dir === 'in' && r.j && !['snap', 'patch', 'ack', 'pong'].includes(r.j.t))) {
  const s = r.j.t;
  if (!seenIn.has(s)) { seenIn.add(s); console.log('  ', r.data.slice(0, 300)); }
}

console.log('\nSNAP room keys:');
const snaps = parsed.filter((r) => r.dir === 'in' && r.j && r.j.t === 'snap');
console.log(' count', snaps.length, 'sizes', snaps.map((r) => r.data.length).join(','));
if (snaps[0]) {
  const room = snaps[0].j.room;
  console.log(' room keys:', keys(room));
  console.log(' settings:', JSON.stringify(room.settings));
  console.log(' player keys:', keys(room.players && room.players[0]));
  console.log(' phase/queue/rated/gameNumber:', room.phase, room.queue, room.rated, room.gameNumber);
}

console.log('\nPATCH keys:');
const patches = parsed.filter((r) => r.dir === 'in' && r.j && r.j.t === 'patch');
console.log(' count', patches.length);
console.log(' patch keys seen:', JSON.stringify(by(patches.flatMap((r) => Object.keys(r.j.patch)), (k) => k)));
console.log(' set keys seen:', JSON.stringify(by(patches.flatMap((r) => Object.keys(r.j.patch.set || {})), (k) => k)));
console.log(' set.phase values:', JSON.stringify(by(patches.filter((r) => r.j.patch.set && r.j.patch.set.phase), (r) => r.j.patch.set.phase)));

console.log('\nEVENTS (snap backlog + patches):');
const evs = [];
for (const r of parsed.filter((r) => r.dir === 'in' && r.j)) {
  const list = r.j.t === 'snap' ? r.j.room.events : r.j.t === 'patch' ? r.j.patch.events : null;
  for (const e of list || []) evs.push({ ...e, _t: r.t, _src: r.j.t, _session: r.session });
}
const uniq = new Map();
for (const e of evs) uniq.set(e._session + ':' + e.seq, e);
console.log(' event rows', evs.length, 'unique (session,seq)', uniq.size);
const U = [...uniq.values()];
console.log(' kinds', JSON.stringify(by(U, (e) => e.kind)));
const seenK = new Set();
for (const e of U) {
  const s = e.kind + ':' + keys(e).replace(/_t,|_src,|_session,?/g, '');
  if (!seenK.has(s)) { seenK.add(s); const c = { ...e }; delete c._t; delete c._src; delete c._session; console.log('  ', JSON.stringify(c)); }
}
console.log(' reject why:', JSON.stringify(by(U.filter((e) => e.kind === 'reject'), (e) => e.why)));
console.log(' pass tiers:', JSON.stringify(by(U.filter((e) => e.kind === 'pass'), (e) => e.tier)));
console.log(' category why:', JSON.stringify(by(U.filter((e) => e.kind === 'category'), (e) => e.why)));

console.log('\nSECRET-ish frames:');
const sec = rows.filter((r) => /"(?:playerKey|guestToken|idToken|accessToken|token|key|authorization)"\s*:/i.test(r.data));
console.log(' frames matching a secret field name:', sec.length);
for (const r of sec.slice(0, 3)) console.log('  ', r.dir, r.data.slice(0, 200));
