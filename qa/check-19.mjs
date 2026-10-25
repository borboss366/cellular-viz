// Maths + speed check for 19 Skate Park.   node qa/check-19.mjs [--experiments dir]
// Recomputed here, not taken from the page's own knotChecks:
//  1. Torus rails: every knot (2,3), (3,5), (5,8) lies on the torus (√(x²+y²) − R)² + z² = r²,
//     closes after one period, winds p times round the z-axis and q times round the tube,
//     and gcd(p, q) = 1 (a knot, not a link). Live: the knot steps (2,3) → (3,5) → (5,8) by section.
//  2. Morph: y² = x³ − 3x + b, Δ = −16(4a³ + 27b²) is 0 exactly at b = 2, where the curve has
//     its node at (1, 0) [(x − 1)²(x + 2)]. Live: on the first frame of every drop b = 2, Δ = 0,
//     and a merge event fires on that bar.
//  3. Tricks never overlap: schedule starts are ≥ the trick length apart (sections, bars, drops).
//  4. Sync from __qa.events (≤ 40 ms after the sound); fps (vsync p95, frames > 20 ms) at
//     1080p, 1440p, 4K per track; page alive; errors.
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
const base = `http://127.0.0.1:${server.address().port}/19-skate-park.html`;
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const errors = [];
async function open(q, size = [1920, 1080], play = true) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?${q}`); await page.addStyleTag({ content: FULL }); await page.waitForTimeout(800);
  if (play) await page.click('#play').catch(() => {});
  return page;
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const res = {};

// ---- 1–3 from pure functions ----
{
  const page = await open('track=torus', [1920, 1080], false);
  res.pure = await page.evaluate(() => {
    const Q = window.__qa, R = Q.R, r = Q.r, out = { knots: [] };
    for (const [p, q] of [[2, 3], [3, 5], [5, 8]]) {
      let err = 0, wz = 0, wt = 0, pa = null, pb = null; const N = 6000;
      for (let i = 0; i <= N; i++) {
        const P = Q.torusPoint(p, q, 2 * Math.PI * i / N), rho = Math.hypot(P[0], P[1]);
        err = Math.max(err, Math.abs(Math.hypot(rho - R, P[2]) - r));
        const A = Math.atan2(P[1], P[0]), B = Math.atan2(P[2], rho - R);
        if (pa !== null) { let d = A - pa; d -= 2 * Math.PI * Math.round(d / (2 * Math.PI)); wz += d; let e = B - pb; e -= 2 * Math.PI * Math.round(e / (2 * Math.PI)); wt += e; }
        pa = A; pb = B;
      }
      const a = Q.torusPoint(p, q, 0), b = Q.torusPoint(p, q, 2 * Math.PI);
      out.knots.push({ p, q, onTorus: err, closure: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), windZ: +(wz / (2 * Math.PI)).toFixed(4), windTube: +(wt / (2 * Math.PI)).toFixed(4) });
    }
    // morph: Δ(b) = −16(4a³ + 27b²) against the page's discOf, and the node
    const a = Q.a, disc = b => -16 * (4 * a ** 3 + 27 * b * b);
    const bs = [0, 0.5, 1, 1.5, 1.9, 2, 2.1, 2.5];
    out.morph = { a, rows: bs.map(b => ({ b, ours: disc(b), page: Q.discOf(b) })), at2: disc(2), node: [1 ** 3 - 3 * 1 + 2, 3 * 1 - 3],
      bAtDrop: Q.morphB(1, true, 0), bBuildEnd: Q.morphB(0.999), bStart: Q.morphB(0) };
    // trick schedule: starts never closer than the trick length
    out.tricks = ['sections', 'bars', 'drops'].map(on => {
      const o = { on, every: 16, section: 16, dropBars: 4, dur: 8 }, starts = new Set();
      for (let bar = 0; bar < 400; bar++) { const s = Q.trickSchedule(bar, o); if (s.prev !== null) starts.add(s.prev); }
      const st = [...starts].sort((x, y) => x - y), gaps = st.slice(1).map((x, i) => x - st[i]);
      return { on, n: st.length, minGap: Math.min(...gaps), first: st.slice(0, 5) };
    });
    return out;
  });
  await page.close();
}
// ---- live: knot sequence (torus), drop moment (morph), sync ----
{
  const page = await open('track=torus&bars=4');
  res.liveTorus = await page.evaluate(async () => { const seq = []; const t0 = performance.now();
    while (performance.now() - t0 < 26000) { const k = __qa.knot; if (k && __qa.section != null) { const s = `${__qa.section}:${k.p},${k.q}`; if (!seq.includes(s)) seq.push(s); } await new Promise(r => setTimeout(r, 100)); }
    return seq; });
  await page.close();
}
{
  const page = await open('track=morph&bars=4');
  res.liveMorph = await page.evaluate(async () => {
    const drops = []; let wasDrop = false; const t0 = performance.now();
    await new Promise(done => { const f = () => { const d = __qa.drop; if (d && !wasDrop) drops.push({ section: __qa.section, b: __qa.morph.b, disc: __qa.morph.disc, bars: __qa.bars });
      wasDrop = d; if (performance.now() - t0 < 26000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const merges = (__qa.events || []).filter(e => e.type === 'merge').map(e => ({ lag: e.perfDrawn - e.perfHeard }));
    return { drops, merges };
  });
  await page.close();
}
{
  const page = await open('track=auto');
  res.sync = await page.evaluate(async () => { const seen = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 40000) { for (const e of __qa.events || []) seen.set(`${e.type}|${e.tBeat}|${e.perfDrawn}`, e); await new Promise(r => setTimeout(r, 250)); }
    const by = {}; for (const e of seen.values()) if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (by[e.type] ??= []).push(e.perfDrawn - e.perfHeard);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
    return Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9) }])); });
  await page.close();
}
// ---- speed ----
const sizes = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160] };
res.speed = {};
for (const tr of ['torus', 'morph', 'free']) {
  res.speed[tr] = {};
  for (const [sk, size] of Object.entries(sizes)) {
    const page = await open(`track=${tr}`, size); await page.waitForTimeout(1500);
    res.speed[tr][sk] = await page.evaluate(async () => { const t = []; let on = true; const b0 = __qa.beats; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise(r => setTimeout(r, 10000)); on = false; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), over20: dt.filter(x => x > 20).length, alive: __qa.beats !== b0,
        caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] }; });
    await page.close();
  }
}
await browser.close(); server.close();

const P = res.pure;
const pass = {
  torus: P.knots.every(k => k.onTorus < 1e-9 && k.closure < 1e-9 && Math.abs(k.windZ - k.p) < 1e-3 && Math.abs(k.windTube - k.q) < 1e-3 && gcd(k.p, k.q) === 1),
  knotSequence: res.liveTorus.length >= 3 && res.liveTorus.map(s => s.split(':')[1]).join(' ').includes('2,3 3,5 5,8'),
  morphMaths: P.morph.at2 === 0 && P.morph.node[0] === 0 && P.morph.node[1] === 0 && P.morph.rows.every(r => Math.abs(r.ours - r.page) < 1e-9) && P.morph.bAtDrop === 2 && P.morph.bStart === 0,
  // the drop's first frame can be one frame past b = 2 (b grows 0.5/dropBars per bar): allow one frame
  morphLive: res.liveMorph.drops.length > 0 && res.liveMorph.drops.every(d => d.b >= 2 - 1e-9 && d.b - 2 < 0.006 && d.disc <= 1e-9) && res.liveMorph.merges.length > 0,
  tricksNoOverlap: P.tricks.every(t => t.minGap >= 8),
  sync: Object.values(res.sync).every(v => v.median <= 40),
  alive: Object.values(res.speed).every(o => Object.values(o).every(v => v.alive)),
  fps1440: Object.values(res.speed).every(o => o['1440p'].p95 <= 16.8 && o['1440p'].over20 <= 3),
  noErrors: !errors.length && Object.values(res.speed).every(o => Object.values(o).every(v => !v.caught)),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '19-skate-park', 'checks', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ res, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(dir, 'check.md'), `# 19 Skate Park check · ${stamp}\n\n| check | result | detail |\n|---|---|---|\n` +
  `| torus knots on the torus, closed, winding (p, q), gcd = 1 | ${ok(pass.torus)} | ${P.knots.map(k => `(${k.p},${k.q}): off-surface ${k.onTorus.toExponential(1)}, closure ${k.closure.toExponential(1)}, winds ${k.windZ}/${k.windTube}`).join(' · ')} |\n` +
  `| knot steps by section | ${ok(pass.knotSequence)} | ${res.liveTorus.join(' → ')} |\n` +
  `| morph: Δ = −16(4a³+27b²) = 0 at b = 2, node (1,0); b 0→2 over the build-up | ${ok(pass.morphMaths)} | a ${P.morph.a}, Δ(2) ${P.morph.at2}, page Δ matches at ${P.morph.rows.length} b values; b at drop ${P.morph.bAtDrop} |\n` +
  `| morph live: Δ crosses 0 on the drop's first frame (b ∈ [2, 2 + one frame)), merge event | ${ok(pass.morphLive)} | ${res.liveMorph.drops.length} drops: ${res.liveMorph.drops.map(d => `b ${d.b.toFixed(4)} Δ ${d.disc.toExponential(1)}`).join(', ')}; ${res.liveMorph.merges.length} merge events |\n` +
  `| tricks never overlap | ${ok(pass.tricksNoOverlap)} | ${P.tricks.map(t => `${t.on}: ${t.n} starts, min gap ${t.minGap} bars`).join(' · ')} |\n` +
  `| sync from __qa.events (≤ 40 ms) | ${ok(pass.sync)} | ${Object.entries(res.sync).map(([k, v]) => `${k} ${v.median} ms (n ${v.n})`).join(' · ')} |\n` +
  `| page alive | ${ok(pass.alive)} | |\n| 1440p p95 ≤ 16.8 ms | ${ok(pass.fps1440)} | |\n| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `| track | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |\n|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'].p95} / ${o['1080p'].over20} | ${o['1440p'].p95} / ${o['1440p'].over20} | ${o['4K'].p95} / ${o['4K'].over20} | ${o['4K'].canvas.join('×')} |`).join('\n') + '\n');
console.log(dir);
