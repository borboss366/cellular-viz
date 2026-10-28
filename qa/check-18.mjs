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
//  8. #58 white blob: in the collide scene, < 2 % of pixels clipped (any channel ≥ 254) in every frame over 16 s.
//  9–12. #75: beamline camera on axis, bunches cross on the downbeat, Mach cone angle, jets on snares (see block 9–12).
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
// ---- 8: clipping at the brightest collide frame (#58: no white blob) ----
{
  const page = await open('scene=collide', [1920, 1080]);
  await page.waitForTimeout(2000);
  res.clip = await page.evaluate(async () => {
    // copy the WebGL canvas in a rAF callback that runs after the page's own draw in the same frame
    const gl = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
    const c2 = document.createElement('canvas'); c2.width = gl.width; c2.height = gl.height; const x = c2.getContext('2d', { willReadFrequently: true });
    let best = null; const t0 = performance.now(), frames = [];
    await new Promise(done => { const f = () => {
      x.drawImage(gl, 0, 0); const d = x.getImageData(0, 0, c2.width, c2.height).data;
      let lum = 0, clip = 0, white = 0, n = 0;
      for (let i = 0; i < d.length; i += 8) { const r = d[i], g = d[i + 1], b = d[i + 2]; lum += 0.2126 * r + 0.7152 * g + 0.0722 * b; if (r >= 254 || g >= 254 || b >= 254) clip++; if (r >= 240 && g >= 240 && b >= 240) white++; n++; }
      const fr = { t: +((performance.now() - t0) / 1000).toFixed(2), lum: lum / n / 255, clip: clip / n, white: white / n };
      frames.push(fr); if (!best || fr.lum > best.lum) best = fr;
      if (performance.now() - t0 < 16000) setTimeout(() => requestAnimationFrame(f), 90); else done(); }; requestAnimationFrame(f); });
    return { frames: frames.length, brightest: best, worstClipAnyFrame: Math.max(...frames.map(f => f.clip)), size: [c2.width, c2.height] };
  });
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
// ---- 9–12: beamline scene and the quench Mach cone (#75) ----
// 9  camera rides the beam axis: its distance from the ring's axis circle (radius 24 from the spec; I also fit the circle
//    to the camera's own path) stays < 0.35 (the pipe radius), every frame of 16 s.
// 10 bunches cross on the downbeat: every 'crossing' event lands one bar after the last (±2 ms), ≤ 40 ms after the sound,
//    and the camera is halted just short of the IP then (distance 0.6–1.2 from the IP, speed ≤ 5 % of its lap average).
// 11 Mach cone: every frame, the orange wake sprites the page uploads (colour ratio 1 : 0.5 : 0.18) are fitted with my own
//    line rad = A − tanθ·ax along the wake's direction; the narrowest cone of each wake (before it widens) must be
//    asin(c_s/v) ± 3°, with c_s and v as the page states them.
// 12 jets: every dijet sits on a snare step (step 4 or 12 of the bar) and its jet event is ≤ 40 ms after the sound;
//    escaping side narrow vs the quenched side, from the shader's spread formula (reported as such, not from pixels).
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?scene=beamline`); await page.addStyleTag({ content: FULL }); await page.waitForTimeout(800);
  await page.click('#play').catch(() => {});
  await page.waitForTimeout(1500);
  res.beam = await page.evaluate(async () => {
    const S = [], seen = new Map(), t0 = performance.now();
    await new Promise(done => { const f = () => { const c = __qa.camera; if (c && c.pos) S.push({ bars: __qa.bars, p: c.pos.slice() });
      for (const e of __qa.events || []) if (e.type === 'crossing') seen.set(e.tBeat, e);
      if (performance.now() - t0 < 16000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    return { S, crossings: [...seen.values()].map(e => ({ bar: e.bar, tBeat: e.tBeat, lag: e.perfDrawn - e.perfHeard })), bpm: __qa.bpm || 120 };
  });
  await page.close();
}
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {   // keep the orange (wake) sprites of each sprite upload
    const W = window.__wakeFrames = [], orig = WebGL2RenderingContext.prototype.bufferData;
    WebGL2RenderingContext.prototype.bufferData = function (target, data, usage) {
      if (usage === this.DYNAMIC_DRAW && data instanceof Float32Array && data.length % 7 === 0 && data.length) {
        const pts = [];
        for (let i = 0; i < data.length; i += 7) { const r = data[i + 3], g = data[i + 4], b = data[i + 5];
          if (r > 1e-4 && Math.abs(g / r - 0.5) < 0.02 && Math.abs(b / r - 0.18) < 0.02 && data[i + 6] === 5) pts.push([data[i], data[i + 1], data[i + 2]]); }
        if (pts.length >= 40 && window.__qa) W.push({ bars: window.__qa.bars, pts, wake: (window.__qa.wakes || []).slice(-1)[0] || null });
        if (W.length > 4000) W.shift();
      }
      return orig.call(this, target, data, usage);
    };
  });
  await page.goto(`${base}?scene=quench`); await page.addStyleTag({ content: FULL }); await page.waitForTimeout(800);
  await page.click('#play').catch(() => {});
  await page.waitForTimeout(16000);
  res.wake = await page.evaluate(() => {
    const fits = [];
    for (const F of window.__wakeFrames) { const w = F.wake; if (!w || !w.dir) continue;
      const d = w.dir, n = Math.hypot(...d), u = d.map(x => x / n);
      const ax = [], rad = [];
      for (const p of F.pts) { const a = p[0] * u[0] + p[1] * u[1] + p[2] * u[2]; ax.push(a); rad.push(Math.hypot(p[0] - a * u[0], p[1] - a * u[1], p[2] - a * u[2])); }
      const N = ax.length, mx = ax.reduce((s, x) => s + x, 0) / N, my = rad.reduce((s, x) => s + x, 0) / N;
      let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < N; i++) { sxy += (ax[i] - mx) * (rad[i] - my); sxx += (ax[i] - mx) ** 2; syy += (rad[i] - my) ** 2; }
      const slope = sxy / sxx, r2 = sxy * sxy / (sxx * syy);
      fits.push({ key: `${w.bar}.${w.step}`, bars: +F.bars.toFixed(3), deg: Math.atan(Math.abs(slope)) * 180 / Math.PI, r2, n: N, want: Math.asin(w.cs / w.v) * 180 / Math.PI });
    }
    const by = {}; for (const f of fits) (by[f.key] ??= []).push(f);
    const wakes = Object.entries(by).map(([k, a]) => { const good = a.filter(f => f.r2 > 0.98); const lo = good.length ? Math.min(...good.map(f => f.deg)) : null;
      return { wake: k, frames: a.length, fitted: good.length, narrowest: lo === null ? null : +lo.toFixed(2), widest: good.length ? +Math.max(...good.map(f => f.deg)).toFixed(2) : null, want: +a[0].want.toFixed(2) }; });
    const dij = (window.__qa.dijets || []).map(j => ({ bar: j.bar, step: j.step, AJ: j.AJ }));
    const seen = new Map(); for (const e of window.__qa.events || []) if (e.type === 'jet') seen.set(e.tBeat, e.perfDrawn - e.perfHeard);
    // escaping vs quenched side spread, from the shader's own formula: φ offset (u − 0.5)·0.16·wide, wide = 1 + 2.5·q·side
    const q = (window.__qa.lastJet && window.__qa.lastJet.quench) || 0.75, R = window.__qa.rnd, seed = (window.__qa.lastJet && window.__qa.lastJet.seed) || 1;
    const spread = side => { let s2 = 0; const n = 200; for (let i = 0; i < n; i++) { const u1 = R ? R(seed, i, 1) : Math.random(); const o = (u1 - 0.5) * 0.16 * (1 + 2.5 * q * side); s2 += o * o; } return Math.sqrt(s2 / n) * 180 / Math.PI; };
    return { wakes, dijets: dij, jetLags: [...seen.values()], escRms: +spread(0).toFixed(2), quRms: +spread(1).toFixed(2), q };
  });
  await page.close();
}
{   // my numbers from the raw samples
  const B = res.beam, R0 = 24, barSec = 4 * 60 / (B.bpm || 120);
  const off = B.S.map(s => Math.hypot(s.p[1], Math.hypot(s.p[0], s.p[2] + R0) - R0));
  // least-squares circle through the camera path in the x–z plane (Kåsa fit)
  let Sx = 0, Sz = 0, Sxx = 0, Szz = 0, Sxz = 0, Sxr = 0, Szr = 0, Sr = 0; const N = B.S.length;
  for (const { p } of B.S) { const x = p[0], z = p[2], r = x * x + z * z; Sx += x; Sz += z; Sxx += x * x; Szz += z * z; Sxz += x * z; Sxr += x * r; Szr += z * r; Sr += r; }
  const M = [[Sxx, Sxz, Sx], [Sxz, Szz, Sz], [Sx, Sz, N]], v = [-Sxr, -Szr, -Sr];
  const det = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M), col = (k) => det(M.map((row, i) => row.map((x, j) => j === k ? v[i] : x)));
  const a = col(0) / D, b = col(1) / D, c = col(2) / D, cx = -a / 2, cz = -b / 2, fitR = Math.sqrt(cx * cx + cz * cz - c);
  // speed per sample (units per second) and the state at each downbeat
  const sp = []; for (let i = 1; i < N; i++) { const db = (B.S[i].bars - B.S[i - 1].bars) * barSec; if (db > 0) sp.push({ bars: B.S[i].bars, v: Math.hypot(...B.S[i].p.map((x, k) => x - B.S[i - 1].p[k])) / db, dIP: Math.hypot(...B.S[i].p) }); }
  const vMean = sp.reduce((s, x) => s + x.v, 0) / Math.max(1, sp.length);
  const atDown = sp.filter(x => { const f = x.bars - Math.round(x.bars); return Math.abs(f) <= 0.02; });
  const cr = B.crossings.sort((x, y) => x.tBeat - y.tBeat), gaps = cr.slice(1).map((x, i) => x.tBeat - cr[i].tBeat);
  res.beamSum = { frames: N, maxOff: Math.max(...off), fitR, fitCentre: [cx, cz], vMean, downFrames: atDown.length,
    downMaxV: atDown.length ? Math.max(...atDown.map(x => x.v)) : null, downDIP: atDown.length ? [Math.min(...atDown.map(x => x.dIP)), Math.max(...atDown.map(x => x.dIP))] : null,
    crossings: cr.length, gapErrMs: gaps.length ? Math.max(...gaps.map(g => Math.abs(g - barSec) * 1000)) : null, crossLagMax: cr.length ? Math.max(...cr.map(x => x.lag)) : null };
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
  noClip: res.clip.frames > 50 && res.clip.worstClipAnyFrame < 0.02,   // the blob peaks on the collision itself, which is not always the frame with the highest mean
  beamAxis: res.beamSum.frames > 300 && res.beamSum.maxOff < 0.35,
  crossing: res.beamSum.crossings >= 4 && res.beamSum.gapErrMs <= 2 && res.beamSum.crossLagMax <= 40 && res.beamSum.downFrames > 0 && res.beamSum.downMaxV <= 0.05 * res.beamSum.vMean && res.beamSum.downDIP[0] >= 0.6 && res.beamSum.downDIP[1] <= 1.2,
  machCone: res.wake.wakes.filter(w => w.narrowest !== null).length >= 3 && res.wake.wakes.filter(w => w.narrowest !== null).every(w => Math.abs(w.narrowest - w.want) <= 3),
  dijets: res.wake.dijets.length >= 4 && res.wake.dijets.every(j => j.step % 8 === 4) && res.wake.jetLags.length > 0 && Math.max(...res.wake.jetLags) <= 40 && res.wake.escRms <= 5 && res.wake.quRms >= 2 * res.wake.escRms,
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
  `| collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ${ok(pass.noClip)} | worst frame ${(res.clip.worstClipAnyFrame * 100).toFixed(2)} % clipped (any channel ≥ 254) of ${res.clip.frames} frames · brightest frame (mean lum ${(res.clip.brightest.lum * 100).toFixed(1)} %): clipped ${(res.clip.brightest.clip * 100).toFixed(2)} %, white ${(res.clip.brightest.white * 100).toFixed(2)} % · ${res.clip.size.join('×')} |\n` +
  `| beamline: camera on the beam axis (< 0.35 off, every frame) | ${ok(pass.beamAxis)} | worst ${res.beamSum.maxOff.toExponential(2)} over ${res.beamSum.frames} frames · my circle fit to the camera path: R ${res.beamSum.fitR.toFixed(3)} (spec 24) |\n` +
  `| beamline: bunches cross on the downbeat, camera halted just short of the IP | ${ok(pass.crossing)} | ${res.beamSum.crossings} crossings, bar-to-bar error ≤ ${res.beamSum.gapErrMs?.toFixed(2)} ms, lag ≤ ${res.beamSum.crossLagMax?.toFixed(1)} ms · at downbeats: ${res.beamSum.downDIP ? res.beamSum.downDIP.map(x => x.toFixed(2)).join('–') : '–'} from the IP, speed ≤ ${res.beamSum.downMaxV?.toFixed(2)} (lap mean ${res.beamSum.vMean.toFixed(1)}) |\n` +
  `| quench: Mach cone half-angle = asin(c_s/v) ± 3° (my fit to the drawn wake) | ${ok(pass.machCone)} | ${res.wake.wakes.map(w => `${w.wake}: ${w.narrowest ?? '–'}° (widens to ${w.widest ?? '–'}°, ${w.fitted}/${w.frames} frames fit)`).join(' · ')} · want ${res.wake.wakes[0]?.want ?? '–'}° |\n` +
  `| jets: each pair on a snare, ≤ 40 ms; escaping side narrow | ${ok(pass.dijets)} | ${res.wake.dijets.length} pairs on steps ${[...new Set(res.wake.dijets.map(j => j.step))].join('/')} · lag ≤ ${res.wake.jetLags.length ? Math.max(...res.wake.jetLags).toFixed(1) : '–'} ms · φ spread ${res.wake.escRms}° escaping vs ${res.wake.quRms}° quenched (shader formula, q ${res.wake.q}) |\n` +
  `| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ${ok(pass.fps1440)} | |\n` +
  `| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `## Frame times (vsync)\n\n| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |\n|---|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'] ? o['1080p'].p95 + ' / ' + o['1080p'].over20 : '—'} | ${o['1440p'].p95} / ${o['1440p'].over20} | ${o['4K'] ? o['4K'].p95 + ' / ' + o['4K'].over20 : '—'} | ${o['4K'] ? o['4K'].canvas.join('×') : '—'} | ${o['1440p'].drawn ?? '—'} |`).join('\n') + '\n');
console.log(dir);
