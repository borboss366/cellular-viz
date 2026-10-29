// Gates for 23 Shape Shifter (Poincaré v2).   node qa/check-23.mjs [--experiments dir]
// Recomputed here from the page's signed distance __qa.sdf(x, y, z, bars) only, with my own code:
//  1. Genus: sample the solid on my own n³ grid (centre ± 1.6), then in Node: b0 (26-connected solid parts),
//     b2 (enclosed pockets of the 6-connected outside), χ of the cubical complex (V − E + F − C),
//     g = b0 + b2 − χ (one part, no pockets: g = 1 − χ). Over a full 32-bar cycle every bar, and every
//     1/8 bar within ±1 bar of each drop: g must equal 1 on [0,14), 0 on [14,30), 1 on [30,32), changing
//     only within 1/4 bar of the drop. Grid resolution vs the thinnest feature is reported.
//  2. Gauss–Bonnet: my own ∫K dA (Hessian of the sampled field, co-area with a hat kernel) at n = 160 must be
//     4π(1 − g) within 5 %, on both families; the page's totalK is shown alongside.
//  3. Camera: __qa.camera(bars) for every 1/64 bar of the cycle; my own __qa.sdf at the eye > 0 (and ≥ 0.02).
//  4. Surgery/attach events at the drop bar, sync from __qa.events ≤ 40 ms, 60 fps 1080p–4K, alive, errors.
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
const base = `http://127.0.0.1:${server.address().port}/23-shape-shifter.html`;
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

const res = {};
const page = await open('family=auto', [1920, 1080], false);
// a 32-bar cycle: every bar, and every 1/8 bar within ±1 bar of the drops at 14 and 30
const times = [...new Set([...Array.from({ length: 32 }, (_, i) => i + 0.5), ...Array.from({ length: 17 }, (_, i) => 13 + i / 8), ...Array.from({ length: 17 }, (_, i) => 29 + i / 8)])].sort((a, b) => a - b);
const expected = b => (b % 32) < 14 ? 1 : (b % 32) < 30 ? 0 : 1;
const N = 96;
res.genus = [];
for (const b of times) {
  const g = await page.evaluate(([b, n]) => {
    const s = __qa.state(b), c = s.center, L = 1.6, h = 2 * L / n, occ = new Uint8Array(n * n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) occ[(i * n + j) * n + k] = __qa.sdf(c[0] - L + (i + 0.5) * h, c[1] - L + (j + 0.5) * h, c[2] - L + (k + 0.5) * h, b) < 0 ? 1 : 0;
    let edge = 0; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (occ[(0 * n + i) * n + j] || occ[((n - 1) * n + i) * n + j] || occ[(i * n + 0) * n + j] || occ[(i * n + n - 1) * n + j] || occ[(i * n + j) * n] || occ[(i * n + j) * n + n - 1]) edge++; }
    return { occ: Array.from(occ).join(''), h, featureMin: s.featureMin, from: s.from, to: s.to, pageGenus: s.genus, touchesBox: edge };
  }, [b, N]);
  const occ = Uint8Array.from(g.occ, ch => ch === '1' ? 1 : 0), t = topo(occ, N);
  res.genus.push({ bars: b, expected: expected(b), ...t, pageGenus: g.pageGenus, h: +g.h.toFixed(4), featureMin: g.featureMin && +g.featureMin.toFixed(4), shape: `${g.from}→${g.to}`, touchesBox: g.touchesBox });
}
// Gauss–Bonnet, my own integral at n = 160, a few moments of each family. Judged with ?bumpAmp=0 (ruling on #56,
// 26 Oct: the beat bumps add fine curvature that n = 160 can't resolve; the theorem holds on the bare surface).
res.gb = [];
const gbPage = await open('bumpAmp=0', [1920, 1080], false);
for (const b of [3, 9, 18, 24]) {
  res.gb.push(await gbPage.evaluate(([b, n]) => {
    const s = __qa.state(b), c = s.center, L = 1.6, h = 2 * L / n, eps = 2 * h, f = new Float32Array((n + 2) ** 3), m = n + 2;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) for (let k = 0; k < m; k++) f[(i * m + j) * m + k] = __qa.sdf(c[0] - L + (i - 0.5) * h, c[1] - L + (j - 0.5) * h, c[2] - L + (k - 0.5) * h, b);
    const F = (i, j, k) => f[(i * m + j) * m + k];
    let sum = 0, sumAbs = 0;
    for (let i = 1; i < m - 1; i++) for (let j = 1; j < m - 1; j++) for (let k = 1; k < m - 1; k++) {
      const f0 = F(i, j, k); if (Math.abs(f0) >= eps) continue;
      const gx = (F(i + 1, j, k) - F(i - 1, j, k)) / (2 * h), gy = (F(i, j + 1, k) - F(i, j - 1, k)) / (2 * h), gz = (F(i, j, k + 1) - F(i, j, k - 1)) / (2 * h);
      const fxx = (F(i + 1, j, k) - 2 * f0 + F(i - 1, j, k)) / (h * h), fyy = (F(i, j + 1, k) - 2 * f0 + F(i, j - 1, k)) / (h * h), fzz = (F(i, j, k + 1) - 2 * f0 + F(i, j, k - 1)) / (h * h);
      const fxy = (F(i + 1, j + 1, k) - F(i + 1, j - 1, k) - F(i - 1, j + 1, k) + F(i - 1, j - 1, k)) / (4 * h * h);
      const fxz = (F(i + 1, j, k + 1) - F(i + 1, j, k - 1) - F(i - 1, j, k + 1) + F(i - 1, j, k - 1)) / (4 * h * h);
      const fyz = (F(i, j + 1, k + 1) - F(i, j + 1, k - 1) - F(i, j - 1, k + 1) + F(i, j - 1, k - 1)) / (4 * h * h);
      // Gaussian curvature of a level set: K = gᵀ adj(H) g / |g|⁴
      const a11 = fyy * fzz - fyz * fyz, a22 = fxx * fzz - fxz * fxz, a33 = fxx * fyy - fxy * fxy, a12 = fxz * fyz - fxy * fzz, a13 = fxy * fyz - fxz * fyy, a23 = fxy * fxz - fxx * fyz;
      const g2 = gx * gx + gy * gy + gz * gz; if (g2 < 1e-8) continue;
      const K = (gx * gx * a11 + gy * gy * a22 + gz * gz * a33 + 2 * (gx * gy * a12 + gx * gz * a13 + gy * gz * a23)) / (g2 * g2);
      const w = Math.sqrt(g2) * (1 - Math.abs(f0) / eps) / eps * h * h * h;   // hat kernel δ_ε
      sum += K * w; sumAbs += Math.abs(K) * w;
    }
    const pg = __qa.totalK(160, b);
    const hook = typeof __qa.minFeature === 'function', mf = hook ? __qa.minFeature(b) : null;   // null from the hook = no thin feature at this bar
    return { bars: b, genus: s.genus, mine: sum, minePer4pi: sum / (4 * Math.PI), absPer4pi: sumAbs / (4 * Math.PI), want: 1 - s.genus, page: pg.totalK / (4 * Math.PI),
      h, hook, minFeature: Number.isFinite(mf) ? mf : null };
  }, [b, 160]));
}
await gbPage.close();
// verdicts, ruling on #56 (VIZ research, 29 Oct, comment 6493806554):
//  wrong genus (any frame): |∫K/4π − (1−g)| ≥ 0.5 → ❌
//  resolved frame (__qa.minFeature(b) ≥ 2h, or null = no thin feature; without the hook only genus 0 counts as resolved):
//    |∫K − 4π(1−g)| ≤ 0.05·∫|K| dA → ✅ else ❌ · unresolved → ⚠️ · every genus in the run needs ≥ 1 resolved frame, else ⚠️
for (const x of res.gb) {
  const err = Math.abs(x.minePer4pi - x.want);
  x.resolved = !x.hook ? x.genus === 0 : x.minFeature == null ? true : x.minFeature >= 2 * x.h;
  x.verdict = err >= 0.5 ? 'wrong genus' : !x.resolved ? 'unresolved' : err <= 0.05 * x.absPer4pi ? 'ok' : 'off';
}
const gbGenera = [...new Set(res.gb.map(x => x.genus))], gbUncovered = gbGenera.filter(g => !res.gb.some(x => x.genus === g && x.resolved));
// camera over the cycle
res.cam = await page.evaluate(() => { let min = Infinity, at = null, fly = 0, pushed = 0, n = 0;
  for (let b = 0; b < 32; b += 1 / 64) { const c = __qa.camera(b), d = __qa.sdf(...c.eye, b); n++; if (c.mode === 'fly') fly++; if (c.pushes) pushed++; if (d < min) { min = d; at = { bars: +b.toFixed(3), mode: c.mode }; } }
  return { samples: n, minSdf: min, at, flyFrames: fly, pushedFrames: pushed }; });
await page.close();
// events and sync: 36 s live (covers one drop at 120 bpm: bar 14 = 28 s)
{
  const p = await open('family=auto');
  res.sync = await p.evaluate(async () => { const seen = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 36000) { for (const e of __qa.events || []) seen.set(`${e.type}|${e.tBeat}`, e); await new Promise(r => setTimeout(r, 250)); }
    const by = {}, special = []; for (const e of seen.values()) { if (['surgery', 'attach', 'fly', 'morph'].includes(e.type)) special.push({ type: e.type, bar: e.bar });
      if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (by[e.type] ??= []).push(e.perfDrawn - e.perfHeard); }
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
    return { by: Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5) }])), special }; });
  await p.close();
}
const sizes = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160] };
res.speed = {};
for (const fam of ['auto', '1', '0']) {
  res.speed[fam] = {};
  for (const [sk, size] of Object.entries(sizes)) {
    const p = await open(`family=${fam}`, size); await p.waitForTimeout(2000);
    res.speed[fam][sk] = await p.evaluate(async () => { const t = []; let on = true; const b0 = __qa.bars; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise(r => setTimeout(r, 10000)); on = false; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), over20: dt.filter(x => x > 20).length, alive: __qa.bars > b0 + 2,
        caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] }; });
    await p.close();
  }
}
await browser.close(); server.close();

const G = res.genus, nearDrop = b => [14, 30].some(d => Math.abs((b % 32) - d) <= 0.25);
const wrong = G.filter(x => x.g !== x.expected && !nearDrop(x.bars));
const switches = []; for (let i = 1; i < G.length; i++) if (G[i].g !== G[i - 1].g) switches.push({ from: G[i - 1].g, to: G[i].g, between: [G[i - 1].bars, G[i].bars] });
const pass = {
  genus: wrong.length === 0 && switches.every(s => nearDrop(s.between[0]) || nearDrop(s.between[1])) && switches.length === 2 && G.every(x => x.b2 === 0 && x.touchesBox === 0),
  gaussBonnet: res.gb.some(x => x.verdict === 'wrong genus' || x.verdict === 'off') ? false : (res.gb.some(x => x.verdict === 'unresolved') || gbUncovered.length) ? 'warn' : true,
  camera: res.cam.minSdf > 0.02,
  events: res.sync.special.some(e => e.type === 'surgery' && e.bar === 14),
  sync: Object.values(res.sync.by).every(v => v.median <= 40),
  alive: Object.values(res.speed).every(o => Object.values(o).every(v => v.alive)),
  fps: Object.values(res.speed).every(o => Object.values(o).every(v => v.p95 <= 16.8 && v.over20 <= 3)),
  noErrors: !errors.length && Object.values(res.speed).every(o => Object.values(o).every(v => !v.caught)),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '23-shape-shifter', 'checks', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ res, errors, pass, wrong, switches }, null, 1));
const ok = v => v === 'warn' ? '⚠️' : v ? '✅' : '❌', fmin = Math.min(...G.filter(x => x.featureMin).map(x => x.featureMin));
fs.writeFileSync(path.join(dir, 'check.md'), `# 23 Shape Shifter check · ${stamp}\n\nEverything below is rebuilt from \`__qa.sdf\` with my own grid code.\n\n| gate | result | detail |\n|---|---|---|\n` +
  `| 1 genus constant except at the drop (my b0 + b2 − χ, n = ${N}, h = ${G[0].h}) | ${ok(pass.genus)} | ${G.length} moments; ${wrong.length} wrong away from the drops${wrong.length ? ' (e.g. bar ' + wrong.slice(0, 4).map(w => `${w.bars}: g ${w.g} want ${w.expected}, ${w.shape}`).join('; ') + ')' : ''} · switches: ${switches.map(s => `${s.from}→${s.to} between bars ${s.between.join(' and ')}`).join(', ')} · thinnest feature ${fmin.toFixed(3)} vs h ${G[0].h} |\n` +
  `| 2 Gauss–Bonnet ∣∫K − 4π(1 − g)∣ ≤ 0.05·∫∣K∣ on resolved frames (minFeature ≥ 2h), never the wrong genus; n = 160, bumpAmp=0 | ${ok(pass.gaussBonnet)} | ${res.gb.map(x => `bar ${x.bars} (g ${x.genus}): mine ${x.minePer4pi.toFixed(3)}·4π, page ${x.page.toFixed(3)}·4π, ∫∣K∣ ${x.absPer4pi.toFixed(2)}·4π, want ${x.want}, minFeature/h ${!x.hook ? 'no hook' : x.minFeature != null ? (x.minFeature / x.h).toFixed(2) : 'none thin'} → ${x.verdict}`).join(' · ')}${gbUncovered.length ? ` · no resolved sample for g ${gbUncovered.join(', ')}` : ''} |\n` +
  `| 3 camera never inside (sdf at the eye, every 1/64 bar) | ${ok(pass.camera)} | min sdf ${res.cam.minSdf.toFixed(3)} at bar ${res.cam.at.bars} (${res.cam.at.mode}) · ${res.cam.flyFrames} fly samples, ${res.cam.pushedFrames} pushed out |\n` +
  `| 4 surgery event on the drop | ${ok(pass.events)} | ${res.sync.special.map(e => `${e.type} bar ${e.bar}`).join(', ')} |\n` +
  `| 5 sync from __qa.events (≤ 40 ms) | ${ok(pass.sync)} | ${Object.entries(res.sync.by).map(([k, v]) => `${k} ${v.median} ms (n ${v.n})`).join(' · ')} |\n` +
  `| 60 fps 1080p/1440p/4K | ${ok(pass.fps)} | |\n| page alive | ${ok(pass.alive)} | |\n| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `| family | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |\n|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'].p95} / ${o['1080p'].over20} | ${o['1440p'].p95} / ${o['1440p'].over20} | ${o['4K'].p95} / ${o['4K'].over20} | ${o['4K'].canvas.join('×')} |`).join('\n') + '\n');
console.log(dir);
