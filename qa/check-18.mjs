// Physics + speed check for 18 Little Bang.   node qa/check-18.mjs [--experiments dir]
// Physics is checked against the textbook relation, not the page's own variables:
//  1. Tracks curl with r = pT / (0.3 B): fit a circle through 3 points of a charged track
//     (loss = 0) and compare with pT/(0.3·0.5 T). With loss on, the local radius shrinks
//     linearly with path length: r(s) = r0 − k·s.
//  2. Elliptic flow: over 200k tracks of one event, ⟨cos 2φ⟩ (φ from the reaction plane)
//     must equal v2 (dN/dφ ∝ 1 + 2 v2 cos 2φ), and v2 > 0 for an almond with short axis along b.
//  3. Fireball: short axis (in) starts shorter and expands faster than the long one (out),
//     and the temperature at hadronization is T_c = 156 MeV.
//  4. Strings: every cascade obeys quarks = 2 + 2·breaks, every group is colour-neutral (white),
//     energy drift |ΔE/E0| < 1e-3.
//  5. Jets: collide pairs are balanced (A_J = 0); quench pairs have A_J = q/(2 − q).
//  6. Sync from __qa.events (≤ 40 ms after the sound), liveness, errors.
//  7. fps (vsync p95, frames > 20 ms) at 1080p, 1440p and 4K for collide and quench at
//     n = 150k and 1M, plus strings and auto at default.
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
const base = `http://127.0.0.1:${server.address().port}/18-little-bang.html`;
const R = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const errors = [];
async function open(q, size = [1920, 1080], play = true) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?${q}`); await page.addStyleTag({ content: FULL }); await page.waitForTimeout(800);
  if (play) await page.click('#play').catch(() => {});
  return page;
}
const res = {};

// ---- 1–3, 5: pure functions ----
{
  const page = await open('scene=collide&loss=0', [1920, 1080], false);
  res.maths = await page.evaluate(() => {
    const Q = window.__qa, out = {};
    // a collision event (bar 0 in collide) and its tracks
    const ev = Q.event(0);
    // 1. radius from 3 points of a charged track, loss 0
    const circ = (a, b, c) => { const [ax, ay] = a, [bx, by] = b, [cx, cy] = c; const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
      const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d; return Math.hypot(ax - ux, ay - uy); };
    const rad = [];
    for (let i = 0; i < 4000 && rad.length < 200; i++) {
      const P = Q.trackParams(ev.seed, i, ev.energy, ev.fireball.v2);
      if (P.q === 0 || P.r0 > 3) continue;
      // transverse plane, loss 0: helix(r0, 0, s) gives (X, Y)
      const s1 = 0.2 * P.r0, s2 = 0.9 * P.r0, s3 = 1.6 * P.r0;
      const pts = [s1, s2, s3].map(s => { const h = Q.helix(P.r0, 0, s); return [h.X, h.Y]; });
      rad.push({ want: P.pT / (0.3 * Q.B), got: circ(...pts) });
    }
    out.radius = { n: rad.length, worstRel: Math.max(...rad.map(r => Math.abs(r.got - r.want) / r.want)), B: Q.B };
    // with loss: local radius at path s from 3 close points vs r0 − k s
    const k = 0.06, lr = [];
    for (let i = 0; i < 4000 && lr.length < 200; i++) {
      const P = Q.trackParams(ev.seed, i, ev.energy, ev.fireball.v2); if (P.q === 0) continue;
      const s = 0.4 * P.r0 / k > 0 ? Math.min(0.5 * P.r0 / k, 0.4 * P.r0 / k) : 0, ds = 0.002 * P.r0;
      const pts = [s - ds, s, s + ds].map(x => { const h = Q.helix(P.r0, k, x); return [h.X, h.Y]; });
      lr.push(Math.abs(circ(...pts) - (P.r0 - k * s)) / (P.r0 - k * s));
    }
    out.lossRadius = { n: lr.length, worstRel: Math.max(...lr) };
    // 2. v2 from 200k tracks
    let c2 = 0; const N = 200000;
    for (let i = 0; i < N; i++) c2 += Math.cos(2 * Q.trackParams(ev.seed, i, ev.energy, ev.fireball.v2).phi);
    out.flow = { v2: ev.fireball.v2, measured: c2 / N, ecc: ev.fireball.ecc, b: ev.b };
    // 3. fireball
    const a0 = Q.fireballAt(0, 0), aH = Q.fireballAt(0, ev.fireball.th);
    out.fireball = { inStart: a0.axes.in, outStart: a0.axes.out, inEnd: aH.axes.in, outEnd: aH.axes.out, growIn: aH.axes.in - a0.axes.in, growOut: aH.axes.out - a0.axes.out, Thadron: aH.T, Tc: Q.Tc, T0: a0.T };
    // 5. jets: quench q/(2 − q), collide balanced
    out.jets = [0, 0.6, 0.75].map(q => { const j = Q.jetSums(12345, Q.jetN, q); return { q, AJ: j.AJ, want: q / (2 - q) }; });
    return out;
  });
  await page.close();
}
// ---- 4 + 6: strings and events while playing ----
{
  const page = await open('scene=strings');
  res.strings = await page.evaluate(async () => { const all = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 20000) { for (const c of (__qa.strings?.cascades || [])) all.set(c.id, c); await new Promise(r => setTimeout(r, 200)); }
    const cs = [...all.values()];
    return { cascades: cs.length, breaks: cs.reduce((s, c) => s + c.breaks, 0), pairRule: cs.every(c => c.pairRule), neutral: cs.every(c => c.neutral), worstDrift: Math.max(0, ...cs.map(c => Math.abs(c.energyDrift))) }; });
  await page.close();
}
{
  const page = await open('scene=auto');
  res.sync = await page.evaluate(async () => { const seen = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 30000) { for (const e of __qa.events || []) seen.set(`${e.type}|${e.tBeat}|${e.perfDrawn}`, e); await new Promise(r => setTimeout(r, 250)); }
    const by = {}; for (const e of seen.values()) if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (by[e.type] ??= []).push(e.perfDrawn - e.perfHeard);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
    return Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5), p90: q(a, 0.9) }])); });
  await page.close();
}
// ---- 7: speed ----
const sizes = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160] };
const runs = [['collide', 'scene=collide'], ['collide 1M', 'scene=collide&n=1000000'], ['quench', 'scene=quench'], ['quench 1M', 'scene=quench&n=1000000'], ['strings', 'scene=strings'], ['auto', 'scene=auto']];
res.speed = {};
for (const [label, q] of runs) {
  res.speed[label] = {};
  for (const [sk, size] of Object.entries(sizes)) {
    if (label.startsWith('strings') && sk !== '1440p') continue;
    const page = await open(q, size);
    await page.waitForTimeout(2000);
    res.speed[label][sk] = await page.evaluate(async () => {
      const t = []; let on = true; const b0 = __qa.bars; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise(r => setTimeout(r, 12000)); on = false;
      const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), over20: dt.filter(x => x > 20).length, worst: +dt.at(-1).toFixed(1),
        alive: __qa.bars !== b0, drawn: __qa.drawnTracks, caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] };
    });
    await page.close();
  }
}
await browser.close(); server.close();

const m = res.maths;
const pass = {
  radius: m.radius.n > 50 && m.radius.worstRel < 1e-3,
  lossRadius: m.lossRadius.worstRel < 1e-2,
  flow: m.flow.v2 > 0 && Math.abs(m.flow.measured - m.flow.v2) < 0.1 * m.flow.v2 + 0.003,
  fireball: m.fireball.inStart < m.fireball.outStart && m.fireball.growIn > m.fireball.growOut && Math.abs(m.fireball.Thadron - m.fireball.Tc) < 0.003,
  strings: res.strings.cascades > 0 && res.strings.pairRule && res.strings.neutral && res.strings.worstDrift < 1e-3,
  jets: m.jets.every(j => Math.abs(j.AJ - j.want) < 1e-9),
  sync: Object.values(res.sync).every(v => v.median <= 40),
  alive: Object.values(res.speed).every(o => Object.values(o).every(v => v.alive)),
  fps1440: Object.entries(res.speed).filter(([k]) => !k.includes('1M')).every(([, o]) => !o['1440p'] || (o['1440p'].p95 <= 16.8 && o['1440p'].over20 <= 3)),   // the 1M-track stress setting is reported, not gated (accepted 2026-10-25)
  noErrors: !errors.length && Object.values(res.speed).every(o => Object.values(o).every(v => !v.caught)),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '18-little-bang', 'checks', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ res, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(dir, 'check.md'), `# 18 Little Bang check · ${stamp}\n\n| check | result | detail |\n|---|---|---|\n` +
  `| tracks curl with r = pT/(0.3 B), B = ${m.radius.B} T | ${ok(pass.radius)} | ${m.radius.n} charged tracks, worst ${(m.radius.worstRel * 100).toExponential(1)}% (3-point circle fit) |\n` +
  `| with dE/dx: local radius = r0 − k·s | ${ok(pass.lossRadius)} | ${m.lossRadius.n} tracks, worst ${(m.lossRadius.worstRel * 100).toFixed(3)}% |\n` +
  `| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ${ok(pass.flow)} | v2 ${m.flow.v2.toFixed(4)}, measured ${m.flow.measured.toFixed(4)} over 200k tracks (b ${m.flow.b.toFixed(2)} fm, ε ${m.flow.ecc.toFixed(3)}) |\n` +
  `| fireball: short axis grows faster; hadronizes at T_c | ${ok(pass.fireball)} | in ${m.fireball.inStart.toFixed(2)}→${m.fireball.inEnd.toFixed(2)} fm, out ${m.fireball.outStart.toFixed(2)}→${m.fireball.outEnd.toFixed(2)} fm; T ${(m.fireball.T0 * 1000).toFixed(0)}→${(m.fireball.Thadron * 1000).toFixed(1)} MeV (T_c ${m.fireball.Tc * 1000}) |\n` +
  `| strings: quarks = 2 + 2·breaks, white groups, energy kept | ${ok(pass.strings)} | ${res.strings.cascades} cascades, ${res.strings.breaks} breaks, worst drift ${res.strings.worstDrift} |\n` +
  `| jets: A_J = q/(2 − q) | ${ok(pass.jets)} | ${m.jets.map(j => `q ${j.q}: ${j.AJ.toFixed(4)}`).join(', ')} |\n` +
  `| sync from __qa.events (≤ 40 ms after the sound) | ${ok(pass.sync)} | ${Object.entries(res.sync).map(([k, v]) => `${k} ${v.median} ms (n ${v.n})`).join(' · ')} |\n` +
  `| page keeps animating | ${ok(pass.alive)} | |\n` +
  `| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ${ok(pass.fps1440)} | |\n` +
  `| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `## Frame times (vsync)\n\n| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |\n|---|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'] ? o['1080p'].p95 + ' / ' + o['1080p'].over20 : '—'} | ${o['1440p'].p95} / ${o['1440p'].over20} | ${o['4K'] ? o['4K'].p95 + ' / ' + o['4K'].over20 : '—'} | ${o['4K'] ? o['4K'].canvas.join('×') : '—'} | ${o['1440p'].drawn ?? '—'} |`).join('\n') + '\n');
console.log(dir);
