// 2026-10-26 10:01 · 23 Shape Shifter: does my Gauss–Bonnet integral converge? bumps on/off, n = 160 and 224, at bars 3, 9, 18, 24 (+ a pure doughnut moment)
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q26/x/experiments', R0 = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
for (const q of ['bumpAmp=0', '']) for (const n of [160, 224]) {
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${srv.address().port}/23-shape-shifter.html?family=auto&${q}`); await page.waitForTimeout(500);
  const out = [];
  for (const b of [3, 9, 18, 24]) {
  out.push(await page.evaluate(([b, n]) => {
    const s = __qa.state(b), c = s.center, L = 1.6, h = 2 * L / n, eps = 2 * h, f = new Float32Array((n + 2) ** 3), m = n + 2;
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) for (let k = 0; k < m; k++) f[(i * m + j) * m + k] = __qa.sdf(c[0] - L + (i - 0.5) * h, c[1] - L + (j - 0.5) * h, c[2] - L + (k - 0.5) * h, b);
    const F = (i, j, k) => f[(i * m + j) * m + k];
    let sum = 0;
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
      sum += K * Math.sqrt(g2) * (1 - Math.abs(f0) / eps) / eps * h * h * h;   // hat kernel δ_ε
    }
    const pg = __qa.totalK(160, b);
    return { bars: b, genus: s.genus, mine: sum, minePer4pi: sum / (4 * Math.PI), want: 1 - s.genus, page: pg.totalK / (4 * Math.PI) };
  }, [b, n]));
  }
  console.log(JSON.stringify({ q: q || 'bumps on', n, rows: out.map(x => ({ bars: x.bars, g: x.genus, mine: +x.minePer4pi.toFixed(3), page: +x.page.toFixed(3), want: x.want })) }));
  await page.close();
}
await browser.close(); srv.close();
