// Pairwise ("swipe") grading for a run: two renders at once, pick the better one.
// Picks go to qa/<exp>/runs/<stamp>/comparisons.json as {a, b, winner, at};
// winner is a label or "tie". A Bradley–Terry fit turns them into a ranking,
// which is also written into report.md (the copy that goes to GitHub).
//
// Next pair: not full ASAP (gfxdisp/asap) but the same idea in a cheap form:
// prefer pairs whose outcome is most uncertain under the current fit
// (p·(1−p) high) and that have been compared least. A round is N−1 picks.
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'comparisons.json';
export const loadComparisons = dir => { try { return JSON.parse(fs.readFileSync(path.join(dir, FILE), 'utf8')); } catch { return []; } };

/** Bradley–Terry strengths by Hunter's MM updates; ties count half a win each.
 *  A weak prior (one virtual tie with a strength-1 dummy) keeps unbeaten / winless items finite. */
export function bradleyTerry(labels, comps, iters = 200) {
  const s = Object.fromEntries(labels.map(l => [l, 1]));
  const wins = Object.fromEntries(labels.map(l => [l, 0.5])); // prior half-win
  const games = [];
  for (const c of comps) {
    if (!(c.a in s) || !(c.b in s)) continue;
    if (c.winner === 'tie') { wins[c.a] += 0.5; wins[c.b] += 0.5; } else if (c.winner in wins) wins[c.winner] += 1; else continue;
    games.push([c.a, c.b]);
  }
  for (let k = 0; k < iters; k++) {
    const next = {};
    for (const l of labels) {
      let den = 1 / (s[l] + 1); // prior: one virtual tie with a strength-1 dummy
      for (const [a, b] of games) if (a === l || b === l) den += 1 / (s[a] + s[b]);
      next[l] = wins[l] / den;
    }
    const g = Math.exp(labels.reduce((t, l) => t + Math.log(next[l]), 0) / labels.length); // geometric mean → 1
    for (const l of labels) s[l] = next[l] / g;
  }
  return s;
}

export function ranking(labels, comps) {
  const s = bradleyTerry(labels, comps);
  const rec = Object.fromEntries(labels.map(l => [l, { w: 0, l: 0, t: 0 }]));
  for (const c of comps) {
    if (!(c.a in rec) || !(c.b in rec)) continue;
    if (c.winner === 'tie') { rec[c.a].t++; rec[c.b].t++; }
    else { const loser = c.winner === c.a ? c.b : c.a; if (rec[c.winner]) rec[c.winner].w++; rec[loser].l++; }
  }
  return labels.map(l => ({ label: l, strength: +s[l].toFixed(3), ...rec[l] })).sort((x, y) => y.strength - x.strength);
}

export function nextPair(labels, comps) {
  if (labels.length < 2) return null;
  const s = bradleyTerry(labels, comps);
  const n = {}, per = Object.fromEntries(labels.map(l => [l, 0]));
  for (const c of comps) { const k = [c.a, c.b].sort().join('\u0000'); n[k] = (n[k] || 0) + 1; per[c.a] = (per[c.a] || 0) + 1; per[c.b] = (per[c.b] || 0) + 1; }
  const last = comps.at(-1);
  let best = null, bestV = -1;
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
    const a = labels[i], b = labels[j], k = [a, b].sort().join('\u0000');
    if (last && [last.a, last.b].sort().join('\u0000') === k) continue; // never the same pair twice in a row
    const p = s[a] / (s[a] + s[b]);
    const v = (p * (1 - p)) / (1 + (n[k] || 0)) / (1 + 0.15 * (per[a] + per[b])) * (1 + Math.random() * 0.05);
    if (v > bestV) { bestV = v; best = [a, b]; }
  }
  return Math.random() < 0.5 ? best : [best[1], best[0]]; // random top/bottom against position bias
}

export function savePick(dir, labels, pick) {
  const comps = loadComparisons(dir);
  comps.push({ a: pick.a, b: pick.b, winner: pick.winner, at: new Date().toISOString() });
  fs.writeFileSync(path.join(dir, FILE), JSON.stringify(comps, null, 1));
  writeRankingToReport(dir, labels, comps);
  return comps;
}

export function undoPick(dir, labels) {
  const comps = loadComparisons(dir);
  comps.pop();
  fs.writeFileSync(path.join(dir, FILE), JSON.stringify(comps, null, 1));
  writeRankingToReport(dir, labels, comps);
  return comps;
}

function writeRankingToReport(dir, labels, comps) {
  const rp = path.join(dir, 'report.md');
  if (!fs.existsSync(rp)) return;
  const head = '## Pairwise ranking (user picks)';
  let md = fs.readFileSync(rp, 'utf8');
  const at = md.indexOf(head);
  if (at >= 0) md = md.slice(0, at).trimEnd() + '\n';
  if (comps.length) {
    md += `\n${head}\n\n${comps.length} picks, Bradley–Terry strength (1 = average).\n\n| # | variant | strength | won | lost | tie |\n|---|---|---|---|---|---|\n` +
      ranking(labels, comps).map((r, i) => `| ${i + 1} | ${r.label} | ${r.strength} | ${r.w} | ${r.l} | ${r.t} |`).join('\n') + '\n';
  }
  fs.writeFileSync(rp, md);
}

/** The query params that differ between variants (shared ones say nothing). */
export function setups(results) {
  const qs = results.map(r => Object.fromEntries(new URLSearchParams((r.url || '').split('?')[1] || '')));
  const keys = [...new Set(qs.flatMap(Object.keys))];
  const shared = keys.filter(k => qs.every(q => q[k] === qs[0][k]));
  return Object.fromEntries(results.map((r, i) => [r.label,
    Object.entries(qs[i]).filter(([k]) => !shared.includes(k)).map(([k, v]) => `${k}=${v}`).join(' ') || '(base setup)']));
}

export function comparePage(exp, stamp) {
  return `<style>
.pair{display:flex;flex-direction:column;gap:10px}
.side{position:relative;border:2px solid #2c3850;border-radius:12px;overflow:hidden;touch-action:pan-y;transition:transform .15s,opacity .15s,border-color .15s}
.side video{border-radius:0;max-height:38vh;object-fit:contain}
.side .cap{padding:6px 10px;background:#121724;font-size:13px}
.side .cap b{font-size:15px}
.side.win{border-color:#2bd96b}.side.lose{opacity:.35}
.bar{display:flex;gap:8px;margin-top:10px}.bar button{flex:1}
table{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}td,th{border-bottom:1px solid #2c3850;padding:5px;text-align:left}
</style>
<p class="m" id="info">loading…</p>
<div class="pair" id="pair"></div>
<div class="bar"><button id="tie">≈ same</button><button id="skip">skip</button><button id="undo">↶ undo</button></div>
<p class="m">Tap the better one, or swipe it right (swipe left = the other one wins). Setups show only what differs.</p>
<h3 style="font-size:15px;margin:18px 0 0">Ranking so far</h3><div id="rank"></div>
<script>
const base = location.pathname.replace(/\\/compare$/, '');
let cur = null, busy = false;
const $ = id => document.getElementById(id);
async function load() {
  const d = await (await fetch(base + '/compare/next')).json();
  cur = d.pair;
  $('info').textContent = d.count + ' picks · round ' + d.round + ' (' + d.inRound + '/' + d.perRound + ')';
  $('rank').innerHTML = '<table><tr><th>#</th><th>variant</th><th>strength</th><th>W–L–T</th></tr>' +
    d.ranking.map((r, i) => '<tr><td>' + (i + 1) + '</td><td>' + r.label + '</td><td>' + r.strength + '</td><td>' + r.w + '–' + r.l + '–' + r.t + '</td></tr>').join('') + '</table>';
  if (!cur) { $('pair').innerHTML = '<p>Need at least two variants with videos.</p>'; return; }
  $('pair').innerHTML = cur.map((v, i) => '<div class="side" data-i="' + i + '">' +
    '<video src="' + v.video + '" poster="' + (v.still || '') + '" autoplay loop muted playsinline></video>' +
    '<div class="cap"><b>' + v.label + '</b><br><span class="m">' + v.setup + '</span></div></div>').join('');
  const vids = [...document.querySelectorAll('.side video')];
  vids.forEach(v => v.addEventListener('loadeddata', () => { vids.forEach(x => { x.currentTime = 0; x.play().catch(() => {}); }); }, { once: true }));
  document.querySelectorAll('.side').forEach(el => {
    let x0 = null, y0 = null;
    el.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
    el.addEventListener('pointermove', e => { if (x0 !== null) el.style.transform = 'translateX(' + (e.clientX - x0) + 'px)'; });
    el.addEventListener('pointerup', e => {
      const dx = e.clientX - x0, dy = e.clientY - y0; el.style.transform = ''; x0 = null;
      const i = +el.dataset.i;
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) pick(dx > 0 ? i : 1 - i);
      else if (Math.abs(dx) < 10 && Math.abs(dy) < 10) pick(i);
    });
    el.addEventListener('pointercancel', () => { el.style.transform = ''; x0 = null; });
  });
}
async function send(winner) {
  if (busy || !cur) return; busy = true;
  try {
    const r = await fetch(base + '/compare/pick', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ a: cur[0].label, b: cur[1].label, winner }) });
    if (!r.ok) throw 0;
  } catch { alert('not saved'); }
  busy = false; load();
}
function pick(i) {
  document.querySelectorAll('.side').forEach(el => el.classList.add(+el.dataset.i === i ? 'win' : 'lose'));
  setTimeout(() => send(cur[i].label), 250);
}
$('tie').onclick = () => send('tie');
$('skip').onclick = () => load();
$('undo').onclick = async () => { await fetch(base + '/compare/undo', { method: 'POST' }); load(); };
load();
</script>`;
}
