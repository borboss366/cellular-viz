// Gates for 25 Shape Shifter II.   node qa/check-25.mjs [--experiments dir] [--bars 96] [--n 128]
// Recomputed here from the page's signed distance (sdfJS / keyState / __qa.sdf) with my own code:
//  1. Every keyframe's hole count: my b0 + b2 − χ on an n³ grid (n = 192 around its centre ± 1.5) = its listed genus.
//  2. Live: every 1/8 bar over the whole genus walk (two cycles, ring then trefoil), my genus (n = --n) = __qa.genusExpected.
//  3. Slalom: for every fly-through window, the camera path (__qa.camera every 1/240 bar) crosses each closed hole's
//     disk (from __qa.handles) exactly once: signed sum ±1, ±2 for a trefoil (my own crossing test).
//  4. Camera ≥ 0.05 from the surface every frame (1/120 bar); view turn rate p99 ≤ 180°/s (fwd and up, per frame).
//  5. 60 fps 1080p/1440p/4K, sync from __qa.events ≤ 40 ms, alive, errors.
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
const base = `http://127.0.0.1:${server.address().port}/25-shape-shifter-2.html`;
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const errors = [];
async function open(q, size = [1920, 1080], play = true) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?${q}`); await page.addStyleTag({ content: FULL }).catch(() => {}); await page.waitForTimeout(800);
  if (play) await page.click('#play').catch(() => {});
  return page;
}

// ---- topology in Node, from an n³ occupancy grid ----
function topo(occ, n) {
  const at = (i, j, k) => i >= 0 && j >= 0 && k >= 0 && i < n && j < n && k < n && occ[(i * n + j) * n + k] === 1;
  // χ of the closed cubical complex: count each lattice cell once if any adjacent cube is solid
  let V = 0, E = 0, F = 0, C = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) C += occ[(i * n + j) * n + k];
  const anyCube = (i0, i1, j0, j1, k0, k1) => { for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) if (at(i, j, k)) return true; return false; };
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) for (let k = 0; k <= n; k++) {
    if (anyCube(i - 1, i, j - 1, j, k - 1, k)) V++;
    if (i < n && anyCube(i, i, j - 1, j, k - 1, k)) E++;
    if (j < n && anyCube(i - 1, i, j, j, k - 1, k)) E++;
    if (k < n && anyCube(i - 1, i, j - 1, j, k, k)) E++;
    if (j < n && k < n && anyCube(i - 1, i, j, j, k, k)) F++;
    if (i < n && k < n && anyCube(i, i, j - 1, j, k, k)) F++;
    if (i < n && j < n && anyCube(i, i, j, j, k - 1, k)) F++;
  }
  const chi = V - E + F - C;
  // b0: 26-connected solid components; outside: 6-connected components of the padded complement
  const seen = new Uint8Array(n * n * n); let b0 = 0; const st = [];
  for (let s = 0; s < n * n * n; s++) { if (!occ[s] || seen[s]) continue; b0++; seen[s] = 1; st.push(s);
    while (st.length) { const c = st.pop(), i = Math.floor(c / (n * n)), j = Math.floor(c / n) % n, k = c % n;
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let d = -1; d <= 1; d++) { const x = i + a, y = j + b, z = k + d; if (!at(x, y, z)) continue; const q = (x * n + y) * n + z; if (!seen[q]) { seen[q] = 1; st.push(q); } } } }
  const m = n + 2, out = new Uint8Array(m * m * m); let comps = 0;
  const empty = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < m && y < m && z < m && !at(x - 1, y - 1, z - 1);
  for (let s = 0; s < m * m * m; s++) { const x0 = Math.floor(s / (m * m)), y0 = Math.floor(s / m) % m, z0 = s % m; if (out[s] || !empty(x0, y0, z0)) continue; comps++; out[s] = 1; st.push(s);
    while (st.length) { const c = st.pop(), i = Math.floor(c / (m * m)), j = Math.floor(c / m) % m, k = c % m;
      for (const [a, b, d] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const x = i + a, y = j + b, z = k + d; if (!empty(x, y, z)) continue; const q = (x * m + y) * m + z; if (!out[q]) { out[q] = 1; st.push(q); } } } }
  const b2 = comps - 1;
  return { chi, b0, b2, g: b0 + b2 - chi, cubes: C };
}

const BARS = +arg('bars', 96), NL = +arg('n', 128);
const res = {};
const page = await open('', [1920, 1080], false);
const grid = async (n, b, key) => {
  const g = await page.evaluate(([n, b, key]) => {
    const st = key ? keyState(key) : __qa.state(b), c = st.center || [0, 0, 0], L = 1.5, h = 2 * L / n, occ = new Uint8Array(n * n * n);
    const f = (x, y, z) => sdfJS(st, x, y, z);   // one state per moment (__qa.sdf rebuilds it per call)
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) occ[(i * n + j) * n + k] = f(c[0] - L + (i + 0.5) * h, c[1] - L + (j + 0.5) * h, c[2] - L + (k + 0.5) * h) < 0 ? 1 : 0;
    let edge = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (occ[(0 * n + i) * n + j] || occ[((n - 1) * n + i) * n + j] || occ[(i * n) * n + j] || occ[(i * n + n - 1) * n + j] || occ[(i * n + j) * n] || occ[(i * n + j) * n + n - 1]) edge++;
    const out = new Uint8Array(Math.ceil(occ.length / 8)); for (let i = 0; i < occ.length; i++) if (occ[i]) out[i >> 3] |= 1 << (i & 7);
    let bin = ''; for (let i = 0; i < out.length; i += 8192) bin += String.fromCharCode.apply(null, out.subarray(i, i + 8192));
    return { occ: btoa(bin), edge, h };
  }, [n, b, key]);
  const bits = Buffer.from(g.occ, 'base64'), occ = new Uint8Array(n * n * n);
  for (let i = 0; i < occ.length; i++) occ[i] = (bits[i >> 3] >> (i & 7)) & 1;
  return { ...topo(occ, n), touchesBox: g.edge, h: g.h };
};
// 1. keyframes
const keys = await page.evaluate(() => __qa.keyframes);
res.keys = [];
for (const k of keys) { const t = await grid(192, 0, k.id); res.keys.push({ name: k.name, genus: k.genus, variant: k.variant, mine: t.g, b0: t.b0, b2: t.b2, touchesBox: t.touchesBox }); }
// 2. live, every 1/8 bar
res.live = [];
for (let b = 0; b < BARS; b += 1 / 8) {
  const t = await grid(NL, b), meta = await page.evaluate(b => ({ want: __qa.genusExpected(b), kf: __qa.keyframeAt(b) }), b);
  res.live.push({ bars: b, want: meta.want, mine: t.g, b0: t.b0, b2: t.b2, touchesBox: t.touchesBox, shape: `${meta.kf.from}→${meta.kf.to}` });
}
// a wrong moment counts only if it is still wrong on finer grids (n = 192 and 256): coarse grids merge near-touching surfaces
for (const x of res.live.filter(x => x.mine !== x.want)) { x.n192 = (await grid(192, x.bars)).g; x.n256 = (await grid(256, x.bars)).g; }
// 3–4. camera and slalom
res.cam = await page.evaluate(BARS => {
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = a => Math.hypot(...a);
  const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (len(a) * len(b))))) * 180 / Math.PI;
  const spf = 1 / 60, barsPerFrame = spf * 120 / 60 / 4;   // 120 bpm, 4/4
  let minSdf = Infinity, minAt = null, prev = null; const rates = [], upRates = [], rateAt = [], cover = [], emptyRuns = []; let emptyFrom = null;
  const add = (a, c, s = 1) => [a[0] + c[0] * s, a[1] + c[1] * s, a[2] + c[2] * s], crs = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], nrm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
  for (let b = 0; b < BARS; b += barsPerFrame) {
    const c = __qa.camera(b), d = __qa.sdf(...c.eye, b);
    {   // framing: 25 rays on a 5×5 grid over the 16:9 picture, marched through the shape's SDF (hit within 6 units)
      const st = __qa.state(b), f = nrm(c.fwd), r = nrm(crs(f, c.up)), u = crs(r, f), th = Math.tan(((c.fov || 60) / 2) * Math.PI / 180);
      let hits = 0;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const dir = nrm(add(add(f, r, (i / 2 - 1) * 0.9 * th * 16 / 9), u, (j / 2 - 1) * 0.9 * th));
        let s = 0; for (let k = 0; k < 80 && s < 6; k++) { const q = sdfJS(st, ...add(c.eye, dir, s)); if (q < 0.002) { hits++; break; } s += Math.max(q, 0.004); } }
      cover.push(hits / 25);
      if (!hits) { if (emptyFrom === null) emptyFrom = b; } else if (emptyFrom !== null) { emptyRuns.push({ from: +emptyFrom.toFixed(3), secs: +((b - emptyFrom) * 2).toFixed(2), mode: c.mode }); emptyFrom = null; }
    }
    if (d < minSdf) { minSdf = d; minAt = { bars: +b.toFixed(3), mode: c.mode }; }
    if (prev) { rates.push(ang(prev.fwd, c.fwd) / spf); upRates.push(ang(prev.up, c.up) / spf); rateAt.push({ bars: +b.toFixed(3), mode: c.mode, ph: Math.floor(b / 8), inPh: +(b % 8).toFixed(2) }); }
    prev = c;
  }
  const p = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(q * (s.length - 1))]; };
  // slalom windows: phrases where the camera is in thread mode
  const wins = []; for (let ph = 0; ph * 8 < BARS; ph++) { const m = __qa.camera(8 * ph + 4).mode; if (m === 'thread') wins.push({ ph, ts: 8 * ph + 1.75, te: 8 * ph + 6.25 }); }   // covers both 2.5–5.75 (f5f6a28) and 2–5.5 (9363bf0)
  const dives = wins.map(w => {
    const mid = (w.ts + w.te) / 2, holes = __qa.handles(mid).filter(h => h.closed && h.a > 0.99);
    const sums = holes.map(() => ({ n: 0, signed: 0 }));
    let pe = __qa.camera(w.ts).eye;
    for (let b = w.ts + 1 / 240; b <= w.te; b += 1 / 240) {
      const e = __qa.camera(b).eye, hs = __qa.handles(b);
      holes.forEach((h0, k) => { const h = hs.find(x => x.slot === h0.slot) || h0;
        const d0 = dot(sub(pe, h.c), h.n), d1 = dot(sub(e, h.c), h.n); if ((d0 < 0) === (d1 < 0)) return;
        const t = d0 / (d0 - d1), x = [pe[0] + (e[0] - pe[0]) * t, pe[1] + (e[1] - pe[1]) * t, pe[2] + (e[2] - pe[2]) * t], rr = len(sub(x, h.c));
        const disk = h.Rk > 0 ? h.R - h.Rk : h.R; if (rr >= disk) return;
        sums[k].n++; sums[k].signed += (d1 > d0 ? 1 : -1) * (h.Rk > 0 ? 2 : 1); });
      pe = e;
    }
    const page = __qa.thread(mid);
    return { ph: w.ph, holes: holes.map((h, k) => ({ slot: h.slot, type: h.type, knot: h.Rk > 0, crossings: sums[k].n, signed: sums[k].signed })), pageLinking: page && page.holes.map(x => x.linking) };
  });
  // turn peaks: top 5 fwd and up, at least ¼ bar apart, with bar, mode and position in the 8-bar phrase
  const peaks = arr => { const idx = arr.map((v, i) => i).sort((x, y) => arr[y] - arr[x]), out = [];
    for (const i of idx) { if (out.length >= 5) break; if (out.some(o => Math.abs(o.bars - rateAt[i].bars) < 0.25)) continue; out.push({ ...rateAt[i], deg: +arr[i].toFixed(0) }); } return out; };
  const fwdPeaks = peaks(rates), upPeaks = peaks(upRates), overBars = rateAt.filter((x, i) => rates[i] > 180 || upRates[i] > 180).map(x => x.bars);
  const longEmpty = emptyRuns.filter(x => x.secs > 0.25).sort((a, c) => c.secs - a.secs);
  return { coverMean: cover.reduce((a, x) => a + x, 0) / cover.length, coverP10: p(cover, 0.10), longEmpty, frames: rates.length, minSdf, minAt, p99: p(rates, 0.99), max: Math.max(...rates), upP99: p(upRates, 0.99), upMax: Math.max(...upRates), fwdPeaks, upPeaks, overFrames: overBars.length, dives, pageAngP99: __qa.angP99 && __qa.angP99() };
}, BARS);
await page.close();
// 5. sync and speed
{
  const p = await open('');
  res.sync = await p.evaluate(async () => { const seen = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 30000) { for (const e of __qa.events || []) seen.set(`${e.type}|${e.tBeat}`, e); await new Promise(r => setTimeout(r, 250)); }
    const by = {}; for (const e of seen.values()) if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (by[e.type] ??= []).push(e.perfDrawn - e.perfHeard);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
    return Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5) }])); });
  await p.close();
}
const sizes = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160] };
res.speed = {};
for (const q of ['', 'res=native']) {
  res.speed[q || 'default'] = {};
  for (const [sk, size] of Object.entries(sizes)) {
    if (q && sk === '1080p') continue;
    const p = await open(q, size); await p.waitForTimeout(2000);
    res.speed[q || 'default'][sk] = await p.evaluate(async () => { const t = []; let on = true; const b0 = __qa.bars; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise(r => setTimeout(r, 10000)); on = false; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), over20: dt.filter(x => x > 20).length, alive: __qa.bars > b0 + 2,
        caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] }; });
    await p.close();
  }
}
await browser.close(); server.close();

const badKeys = res.keys.filter(k => k.mine !== k.genus || k.b2 || k.touchesBox);
const badLive = res.live.filter(x => x.touchesBox || (x.mine !== x.want && x.n192 !== x.want && x.n256 !== x.want));
const gridOnly = res.live.filter(x => x.mine !== x.want && !badLive.includes(x));
const badDives = res.cam.dives.filter(d => !d.holes.length || d.holes.some(h => h.crossings !== 1 || Math.abs(h.signed) !== (h.knot ? 2 : 1)));
const pass = {
  keyGenus: badKeys.length === 0, liveGenus: badLive.length === 0, slalom: res.cam.dives.length > 0 && badDives.length === 0,
  clearance: res.cam.minSdf >= 0.05, turnRate: res.cam.p99 <= 180,
  noEmpty: res.cam.longEmpty.length === 0, framing: res.cam.coverMean >= 0.25 && res.cam.coverP10 >= 0.08,
  sync: Object.keys(res.sync).length > 0 && Object.values(res.sync).every(v => v.median <= 40),
  alive: Object.values(res.speed).every(o => Object.values(o).every(v => v.alive)),
  fps: Object.values(res.speed).every(o => Object.values(o).every(v => v.p95 <= 16.8 && v.over20 <= 3)),
  noErrors: !errors.length && Object.values(res.speed).every(o => Object.values(o).every(v => !v.caught)),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '25-shape-shifter-2', 'checks', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ res, errors, pass, badKeys, badLive, badDives }, null, 1));
const ok = v => v ? '✅' : '❌';
// group consecutive wrong live samples into stretches
const stretches = []; for (const x of badLive) { const l = stretches.at(-1); if (l && Math.abs(x.bars - l.to - 0.125) < 1e-9 && l.mine === x.mine && l.want === x.want) l.to = x.bars; else stretches.push({ from: x.bars, to: x.bars, mine: x.mine, want: x.want, shape: x.shape }); }
fs.writeFileSync(path.join(dir, 'check.md'), `# 25 Shape Shifter II check · ${stamp}\n\nGenus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.\n\n| gate | result | detail |\n|---|---|---|\n` +
  `| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ${ok(pass.keyGenus)} | ${res.keys.length} keyframes, ${badKeys.length} wrong${badKeys.length ? ': ' + badKeys.map(k => `${k.name} (listed ${k.genus}, mine ${k.mine}${k.b0 !== 1 ? `, ${k.b0} parts` : ''}${k.b2 ? `, ${k.b2} pockets` : ''}${k.touchesBox ? ', off the grid' : ''})`).join('; ') : ''} |\n` +
  `| 2 live genus = expected every ⅛ bar (n = ${NL}, ${BARS} bars; flagged moments re-counted at 192 and 256) | ${ok(pass.liveGenus)} | ${res.live.length} moments, ${gridOnly.length} flagged at n = ${NL} but right on a finer grid, ${badLive.length} wrong${stretches.length ? ': ' + stretches.slice(0, 12).map(s => `bars ${s.from}–${s.to} mine ${s.mine} want ${s.want} (${s.shape})`).join('; ') + (stretches.length > 12 ? ` … ${stretches.length} stretches` : '') : ''} |\n` +
  `| 3 slalom: each hole crossed once (trefoil linking 2) | ${ok(pass.slalom)} | ${res.cam.dives.length} dives, ${badDives.length} off${badDives.length ? ': ' + badDives.slice(0, 6).map(d => `phrase ${d.ph}: ` + (d.holes.length ? d.holes.map(h => `${h.type}${h.knot ? ' (knot)' : ''} ×${h.crossings} (${h.signed > 0 ? '+' : ''}${h.signed})`).join(', ') : 'no closed hole')).join('; ') : ''} |\n` +
  `| 4a camera ≥ 0.05 from the surface, every frame | ${ok(pass.clearance)} | min ${res.cam.minSdf.toFixed(3)} at bar ${res.cam.minAt.bars} (${res.cam.minAt.mode}), ${res.cam.frames} frames |\n` +
  `| 4b view turn rate p99 ≤ 180°/s | ${ok(pass.turnRate)} | fwd p99 ${res.cam.p99.toFixed(0)}°/s, max ${res.cam.max.toFixed(0)}°/s · up p99 ${res.cam.upP99.toFixed(0)}°/s, max ${res.cam.upMax.toFixed(0)}°/s · ${res.cam.overFrames} frames > 180°/s<br>fwd peaks: ${res.cam.fwdPeaks.map(x => `${x.deg}° bar ${x.bars} (${x.mode}, phrase bar ${x.inPh})`).join(', ')}<br>up peaks: ${res.cam.upPeaks.map(x => `${x.deg}° bar ${x.bars} (${x.mode}, phrase bar ${x.inPh})`).join(', ')} |\n` +
  `| 4c no empty picture longer than ¼ s (25-ray test) | ${ok(pass.noEmpty)} | ${res.cam.longEmpty.length} stretches${res.cam.longEmpty.length ? ', longest ' + res.cam.longEmpty.slice(0, 4).map(x => `${x.secs} s at bar ${x.from} (${x.mode})`).join(', ') : ''} |\n` +
  `| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ${ok(pass.framing)} | mean ${(res.cam.coverMean * 100).toFixed(1)} %, 10th percentile ${(res.cam.coverP10 * 100).toFixed(0)} % |\n` +
  `| 5 sync (≤ 40 ms) | ${ok(pass.sync)} | ${Object.entries(res.sync).map(([k, v]) => `${k} ${v.median} ms (n ${v.n})`).join(' · ')} |\n` +
  `| 60 fps | ${ok(pass.fps)} | |\n| page alive | ${ok(pass.alive)} | |\n| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |\n|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'] ? o['1080p'].p95 + ' / ' + o['1080p'].over20 : '–'} | ${o['1440p'] ? o['1440p'].p95 + ' / ' + o['1440p'].over20 : '–'} | ${o['4K'] ? o['4K'].p95 + ' / ' + o['4K'].over20 : '–'} | ${o['4K'] ? o['4K'].canvas.join('×') : '–'} |`).join('\n') + '\n');
console.log(dir);
