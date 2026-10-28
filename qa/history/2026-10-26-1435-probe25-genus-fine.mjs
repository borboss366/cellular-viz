// 2026-10-26 14:35 · 25 @f5f6a28: re-count the 16 live moments check-25 flagged, at n = 128 / 192 / 256 (grid artefact or real extra hole?)
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

const times = [16.25, 17.25, 17.5, 22.125, 22.875, 23, 24.875, 25.375, 31.375, 47.5, 47.75, 50.375, 52.625, 60.625, 64.875, 89.5];
for (const b of times) {
  const want = await page.evaluate(b => __qa.genusExpected(b), b), out = { bars: b, want };
  for (const n of [128, 192, 256]) { const t = await grid(n, b); out['n' + n] = t.g; }
  out.page192 = await page.evaluate(b => __qa.genus(192, b).g, b);
  out.handles = await page.evaluate(b => __qa.handles(b).map(h => `${h.type}${h.closed ? '' : '(open)'} a${h.a.toFixed(2)}`).join(' '), b);
  console.log(JSON.stringify(out));
}
await browser.close(); server.close();
