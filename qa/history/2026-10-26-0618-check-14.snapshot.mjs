// Gates for 14 Round Point (Poincaré: curve-shortening flow + neck pinch).   node qa/check-14.mjs [--experiments dir]
// Recomputed here from __qa.polygon (the live curve), not from the page's own area / iso / crossings:
//  1. Area law, kicks off: my shoelace area against the page's τ falls at 2π per unit τ (±3 %), and against
//     musical time it falls in a straight line to 0 on the section's last beat (the page times τ that way).
//  2. Roundness: my L²/(4πA) never rises between kicks (tolerance 1e-4) and ends near 1. Kicks off and on.
//  3. No self-crossings: my own O(n²) test of every pair of non-adjacent edges, every frame, kicks on and off.
//  4. Neck pinch: the piece count goes 1 → 2 on the drop bar (within 0.02 bar), exactly 2 pieces after, then
//     0 at the end; the neck radius in the precomputed history shrinks monotonically to the surgery threshold.
//  5. Sync from __qa.events (drums, seed, round, pinch ≤ 40 ms), 60 fps at 1080p/1440p/4K per scene, alive, errors.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const server = http.createServer((q, res) => { const p = path.join(expDir, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/14-round-point.html`;
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const errors = [];
async function open(q, size = [1920, 1080]) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?${q}`); await page.addStyleTag({ content: FULL }).catch(() => {}); await page.waitForTimeout(800);
  await page.click('#play').catch(() => {});
  return page;
}
const res = {};

// ---- 1–3: one full curve section, sampled every frame ----
const CURVE = async () => {
  const area = P => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const len = P => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const cross = P => { const n = P.length; let c = 0;   // proper intersections of non-adjacent edges
    for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n];
      for (let j = i + 2; j < n; j++) { if (i === 0 && j === n - 1) continue; const p = P[j], q = P[(j + 1) % n];
        if (Math.max(a[0], b[0]) < Math.min(p[0], q[0]) || Math.max(p[0], q[0]) < Math.min(a[0], b[0]) || Math.max(a[1], b[1]) < Math.min(p[1], q[1]) || Math.max(p[1], q[1]) < Math.min(a[1], b[1])) continue;
        const d1 = cr(a, b, p), d2 = cr(a, b, q), d3 = cr(p, q, a), d4 = cr(p, q, b);
        if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) c++; } }
    return c; };
  // wait for the start of a fresh curve section
  const k0 = __qa.section; await new Promise(r => { const f = () => (__qa.section !== k0 && __qa.scene === 'curve' && __qa.alive) ? r() : requestAnimationFrame(f); f(); });
  const k = __qa.section, s = [];
  await new Promise(done => { const f = () => {
    if (__qa.section !== k) return done();
    const P = __qa.polygon;
    if (P && __qa.alive) { const A = area(P), L = len(P); s.push({ bars: __qa.bars, tau: __qa.tau, A, iso: L * L / (4 * Math.PI * A), x: cross(P), n: P.length, pageA: __qa.area, pageX: __qa.crossings, bumps: __qa.bumps }); }
    else s.push({ bars: __qa.bars, dead: true });
    requestAnimationFrame(f); }; f(); });
  const live = s.filter(x => !x.dead), firstDead = s.find(x => x.dead);
  // area law vs τ, piecewise between bumps (a bump changes A)
  const segs = []; let cur = [];
  for (let i = 0; i < live.length; i++) { if (i && live[i].bumps !== live[i - 1].bumps) { if (cur.length > 10) segs.push(cur); cur = []; } cur.push(live[i]); }
  if (cur.length > 10) segs.push(cur);
  const fit = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; } return { slope: sxy / sxx, icpt: my - sxy / sxx * mx }; };
  const slopes = segs.filter(g => g.at(-1).tau - g[0].tau > 1e-3).map(g => fit(g.map(x => x.tau), g.map(x => x.A)).slope / (2 * Math.PI));
  // iso: rises between bumps
  let isoRise = 0, isoRiseAt = null;
  for (let i = 1; i < live.length; i++) if (live[i].bumps === live[i - 1].bumps) { const d = live[i].iso - live[i - 1].iso; if (d > isoRise) { isoRise = d; isoRiseAt = live[i].bars; } }
  // musical-time line: A(t) → 0 at the section end (k+1)·bars
  const endBar = (k + 1) * 8, last = live.at(-1);
  return { section: k, frames: s.length, live: live.length, vertices: [Math.min(...live.map(x => x.n)), Math.max(...live.map(x => x.n))], A0: live[0].A, Aend: last.A,
    slopes: slopes.map(x => +x.toFixed(4)), worstSlope: slopes.length ? +slopes.reduce((w, x) => Math.abs(x + 1) > Math.abs(w + 1) ? x : w, slopes[0]).toFixed(4) : null,
    isoStart: +live[0].iso.toFixed(4), isoEnd: +last.iso.toFixed(4), isoMaxRise: +isoRise.toExponential(2), isoRiseAt, bumps: last.bumps,
    myCrossings: live.reduce((a, x) => a + x.x, 0), pageCrossings: live.reduce((a, x) => a + x.pageX, 0), areaAgree: Math.max(...live.map(x => Math.abs(x.A - x.pageA))),
    roundAtBar: firstDead ? +firstDead.bars.toFixed(3) : null, endBar, roundEarlyBars: firstDead ? +(endBar - firstDead.bars).toFixed(3) : null,
    roundEvent: (__qa.events || []).filter(e => e.type === 'round').map(e => e.bar).slice(-1)[0] ?? null };
};
for (const [key, q] of [['curveNoKicks', 'scene=curve&kicks=0'], ['curveKicks', 'scene=curve']]) {
  const page = await open(q);
  res[key] = await page.evaluate(`(${CURVE.toString()})()`);
  await page.close();
}
// ---- 4: neck pinch ----
{
  const page = await open('scene=pinch');
  res.pinch = await page.evaluate(async () => {
    await new Promise(r => { const f = () => (__qa.pinch && __qa.pinch.tauPinch) ? r() : requestAnimationFrame(f); f(); });
    const k0 = __qa.section; await new Promise(r => { const f = () => __qa.section !== k0 ? r() : requestAnimationFrame(f); f(); });
    const k = __qa.section, h = [];
    await new Promise(done => { const f = () => { if (__qa.section !== k) return done(); h.push({ bars: __qa.bars, pieces: __qa.pinch.pieces }); requestAnimationFrame(f); }; f(); });
    const dropBar = k * 8 + 6, changes = [];
    for (let i = 1; i < h.length; i++) if (h[i].pieces !== h[i - 1].pieces) changes.push({ bars: +h[i].bars.toFixed(4), from: h[i - 1].pieces, to: h[i].pieces });
    const split = changes.find(c => c.from === 1 && c.to === 2);
    const afterSplit = split ? [...new Set(h.filter(x => x.bars >= split.bars && x.bars < (k + 1) * 8 - 0.3).map(x => x.pieces))] : [];
    // the precomputed history: neck radius (min interior r) per keyframe while one piece
    const S = pinch.sim, neck = S.frames.filter(fr => fr.pieces.length === 1).map(fr => { const Pr = fr.pieces[0]; let m = Infinity;   // resampled profile: [z, r, H] × M
      for (let i = 0; i < Pr.length; i += 3) if (Math.abs(Pr[i]) < 0.35) m = Math.min(m, Pr[i + 1]); return m; });
    let up = 0; for (let i = 1; i < neck.length; i++) up = Math.max(up, neck[i] - neck[i - 1]);
    const ev = (__qa.events || []).filter(e => e.type === 'pinch').map(e => ({ bar: e.bar, lag: e.perfDrawn - e.perfHeard }));
    return { section: k, dropBar, changes, splitOffBars: split ? +(split.bars - dropBar).toFixed(4) : null, piecesAfterSplit: afterSplit, endPieces: h.at(-1).pieces,
      neckStart: neck.length ? +neck[0].toFixed(4) : null, neckLast: neck.length ? +neck.at(-1).toFixed(4) : null, neckMaxRise: +up.toExponential(2), keyframes: S.frames.length, simNeck: S.neck, events: ev };
  });
  await page.close();
}
// ---- 5: sync and speed ----
{
  const page = await open('scene=auto');
  res.sync = await page.evaluate(async () => { const seen = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 36000) { for (const e of __qa.events || []) seen.set(`${e.type}|${e.tBeat}`, e); await new Promise(r => setTimeout(r, 250)); }
    const by = {}; for (const e of seen.values()) if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (by[e.type] ??= []).push(e.perfDrawn - e.perfHeard);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
    return Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9) }])); });
  await page.close();
}
const sizes = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160] };
res.speed = {};
for (const sc of ['curve', 'pinch']) {
  res.speed[sc] = {};
  for (const [sk, size] of Object.entries(sizes)) {
    const page = await open(`scene=${sc}`, size); await page.waitForTimeout(2500);
    res.speed[sc][sk] = await page.evaluate(async () => { const t = []; let on = true; const b0 = __qa.bars; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise(r => setTimeout(r, 10000)); on = false; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), over20: dt.filter(x => x > 20).length, alive: __qa.bars > b0 + 2,
        caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] }; });
    await page.close();
  }
}
await browser.close(); server.close();

const N = res.curveNoKicks, K = res.curveKicks, P = res.pinch;
const pass = {
  areaLaw: N.slopes.length > 0 && N.slopes.every(x => Math.abs(x + 1) <= 0.03) && N.roundEarlyBars !== null && Math.abs(N.roundEarlyBars) <= 0.3,
  areaLawWithKicks: K.slopes.length > 0 && K.slopes.every(x => Math.abs(x + 1) <= 0.03),
  roundness: N.isoMaxRise <= 1e-4 && N.isoEnd < 1.05,
  roundnessWithKicks: K.isoMaxRise <= 1e-4,
  noCrossings: N.myCrossings === 0 && K.myCrossings === 0,
  pinch: !!P.changes.find(c => c.from === 1 && c.to === 2) && Math.abs(P.splitOffBars) <= 0.02 && P.piecesAfterSplit.length === 1 && P.piecesAfterSplit[0] === 2 && P.endPieces === 0 && P.neckMaxRise <= 1e-6,
  sync: Object.keys(res.sync).length > 0 && Object.values(res.sync).every(v => v.median <= 40),
  alive: Object.values(res.speed).every(o => Object.values(o).every(v => v.alive)),
  fps: Object.values(res.speed).every(o => Object.values(o).every(v => v.p95 <= 16.8 && v.over20 <= 3)),
  noErrors: !errors.length && Object.values(res.speed).every(o => Object.values(o).every(v => !v.caught)),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '14-round-point', 'checks', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ res, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(dir, 'check.md'), `# 14 Round Point check · ${stamp}\n\nArea, L, L²/4πA and crossings recomputed from \`__qa.polygon\` every frame.\n\n| gate | result | detail |\n|---|---|---|\n` +
  `| 1 area falls at 2π per unit τ (±3 %), kicks off; round on the section's last beat | ${ok(pass.areaLaw)} | dA/dτ ÷ 2π: ${N.slopes.join(', ')} · A ${N.A0.toFixed(3)} → ${N.Aend.toExponential(1)} · round at bar ${N.roundAtBar} (section ends ${N.endBar}) |\n` +
  `| 1b same, kicks on (between kicks) | ${ok(pass.areaLawWithKicks)} | ${K.slopes.length} stretches, worst ${K.worstSlope} · ${K.bumps} bumps |\n` +
  `| 2 L²/4πA never rises between kicks, ends near 1 (kicks off) | ${ok(pass.roundness)} | ${N.isoStart} → ${N.isoEnd}, largest rise ${N.isoMaxRise}${N.isoRiseAt ? ' at bar ' + N.isoRiseAt.toFixed(2) : ''} |\n` +
  `| 2b same, kicks on | ${ok(pass.roundnessWithKicks)} | ${K.isoStart} → ${K.isoEnd}, largest rise between kicks ${K.isoMaxRise}${K.isoRiseAt ? ' at bar ' + K.isoRiseAt.toFixed(2) : ''} |\n` +
  `| 3 no self-crossings, every frame (my O(n²) test) | ${ok(pass.noCrossings)} | kicks off ${N.myCrossings} in ${N.live} frames · kicks on ${K.myCrossings} in ${K.live} frames (page counted ${N.pageCrossings} / ${K.pageCrossings}) · ${N.vertices.join('–')} vertices |\n` +
  `| 4 neck pinch on the drop → exactly 2 pieces, then round points | ${ok(pass.pinch)} | ${P.changes.map(c => `${c.from}→${c.to} at bar ${c.bars}`).join(', ')} (drop ${P.dropBar}, off by ${P.splitOffBars} bar) · after: ${P.piecesAfterSplit.join('/')} · neck ${P.neckStart} → ${P.neckLast}, largest rise ${P.neckMaxRise} |\n` +
  `| 5 sync from __qa.events (≤ 40 ms) | ${ok(pass.sync)} | ${Object.entries(res.sync).map(([k, v]) => `${k} ${v.median} ms (n ${v.n})`).join(' · ')} |\n` +
  `| 60 fps 1080p/1440p/4K | ${ok(pass.fps)} | |\n| page alive | ${ok(pass.alive)} | |\n| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `| scene | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |\n|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'].p95} / ${o['1080p'].over20} | ${o['1440p'].p95} / ${o['1440p'].over20} | ${o['4K'].p95} / ${o['4K'].over20} | ${o['4K'].canvas.join('×')} |`).join('\n') + '\n');
console.log(dir);
