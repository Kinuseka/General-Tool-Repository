// Tier vs answer length, rejected answers, per-category tier mix, ack/event ordering.
// Usage: node tools/recording-stats.js <krillion-raw-....jsonl>   (exported from the extension's Learning tab)
const fs = require('fs');
const rows = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const words = (s) => String(s).trim().split(/\s+/).filter(Boolean).length;
const _s = {}; for (const r of rows) (_s[r.session] ||= []).push(r);
const main = Object.values(_s).sort((a, b) => b.length - a.length)[0]; // the busiest recording
const ev = new Map();
let cat = {}, idx = null; const out = [];
for (const r of main) {
  if (r.dir !== 'in') continue; let j; try { j = JSON.parse(r.data); } catch (_) { continue; }
  const set = j.t === 'snap' ? j.room : j.t === 'patch' ? j.patch.set : null;
  if (set && set.category) cat[set.category.index] = set.category.text;
  const list = j.t === 'snap' ? j.room.events : j.t === 'patch' ? j.patch.events : null;
  for (const e of list || []) { if (ev.has(e.seq)) continue; ev.set(e.seq, 1); if (e.kind === 'category') idx = e.index; out.push({ ...e, cat: cat[idx] }); }
}
const avg = (a) => (a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : '-');
const pass = out.filter((e) => e.kind === 'pass');
console.log('accepted answers by tier: n / avg words / avg chars');
for (const t of ['plankton', 'schooler', 'rare', 'deepcut', 'krillion']) {
  const g = pass.filter((e) => e.tier === t);
  console.log(' ', t.padEnd(9), String(g.length).padStart(3), avg(g.map((e) => words(e.answer))).padStart(6), avg(g.map((e) => e.answer.length)).padStart(6));
}
const miss = out.filter((e) => e.kind === 'reject' && e.why === 'miss');
console.log('\nrejected as miss: n', miss.length, ' avg words', avg(miss.map((e) => words(e.text))), ' avg chars', avg(miss.map((e) => e.text.length)));
console.log('accepted overall: avg words', avg(pass.map((e) => words(e.answer))));
console.log('\nrare/deepcut answers:'); for (const e of pass.filter((e) => e.tier === 'rare' || e.tier === 'deepcut')) console.log('  ', e.tier.padEnd(8), JSON.stringify(e.answer).padEnd(26), (e.cat || '').slice(0, 44));
console.log('\nrejected misses (a sample):'); for (const e of miss.slice(0, 14)) console.log('  ', JSON.stringify(e.text).padEnd(26), (e.cat || '').slice(0, 44));
// per category: tier mix
console.log('\nper category tier mix:');
const cats = [...new Set(pass.map((e) => e.cat))];
for (const c of cats) { const g = pass.filter((e) => e.cat === c); const m = {}; g.forEach((e) => (m[e.tier] = (m[e.tier] || 0) + 1)); console.log('  ', (c || '?').slice(0, 44).padEnd(46), JSON.stringify(m)); }
// category thresholds from the set frames
const th = {}; for (const r of main) { if (r.dir !== 'in') continue; try { const j = JSON.parse(r.data); const c = j.t === 'patch' && j.patch.set && j.patch.set.category; if (c) th[c.index] = { threshold: c.threshold, accepted: c.accepted }; } catch (_) {} }
console.log('\ncategory thresholds / final accepted:', JSON.stringify(th));
// ack-after-event ordering for my own answers
const myCid = new Map(); for (const r of main) if (r.dir === 'out') { try { const j = JSON.parse(r.data); if (j.t === 'act' && j.action.type === 'submit') myCid.set(j.cid, r.t); } catch (_) {} }
let ackFirst = 0, patchFirst = 0;
for (const r of main) { if (r.dir !== 'in') continue; try { const j = JSON.parse(r.data); if (j.t === 'ack' && myCid.has(j.cid) && j.submit && j.submit.accepted) { const p = main.find((x) => x.dir === 'in' && x.t >= myCid.get(j.cid) && (() => { try { const k = JSON.parse(x.data); return k.t === 'patch' && (k.patch.events || []).some((e) => e.kind === 'pass' && e.answer === j.submit.answer); } catch (_) { return false; } })()); if (p) (p.t <= r.t ? patchFirst++ : ackFirst++); } } catch (_) {} }
console.log('\nfor my accepted answers: pass-event patch arrived first', patchFirst, ' ack arrived first', ackFirst);
