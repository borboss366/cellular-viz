// Height sweep for 09 Riemann: is the picture sound from Im s 0 to 60 (left half included)?
//   node qa/check-09-sweep.mjs [--experiments <dir>] [--step 3] [--top 60]
// For each height H: travel view held at H (?speed=0&height=H), 1920×1080 fullscreen, UI hidden.
//   black   – share of near-black pixels in the left (Re s < ½) and right half. The old bug: left half
//             all black from Im s ≈ 28.4 (float32 overflow of |sin(πs/2)|² in the functional equation).
//   seam    – the left half comes from the functional equation, the right from the direct series;
//             hue just left vs just right of Re s = ½ should match (median |Δhue| in turns).
//   zeros   – hue winding (+1) around every known zero ½+it inside the frame.
// Writes qa/09-riemann/checks/<stamp>-sweep/{sweep.json, sweep.md, h<H>.png}.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(repo, 'experiments')));
const step = +arg('step', 3), top = +arg('top', 60);
const W = 1920, H = 1080;
// first zero heights (LMFDB / Odlyzko), all below 60
const ZEROS = [14.134725, 21.022040, 25.010858, 30.424876, 32.935062, 37.586178, 40.918719, 43.327073,
  48.005151, 49.773832, 52.970321, 56.446248, 59.347044];

const server = http.createServer((req, res) => {
  const p = path.join(expDir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/09-riemann.html`;

const R = path.join(os.homedir(), 'qa-libs/root');
const gpu = fs.existsSync('/dev/dri/renderD128');
const browser = await chromium.launch({
  env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
    ...(gpu ? { __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` } : {}) },
  args: ['--autoplay-policy=no-user-gesture-required', ...(gpu ? ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, c => c === "T" ? "-" : c === ":" ? "" : "-");
const out = path.join(here, '09-riemann', 'checks', stamp + '-sweep');
fs.mkdirSync(out, { recursive: true });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';

const rows = [];
for (let h = 0; h <= top + 1e-9; h += step) {
  await page.goto(`${base}?speed=0&height=${h}`);
  await page.addStyleTag({ content: FULL });
  await page.waitForTimeout(1200);
  const held = await page.evaluate('typeof cam !== "undefined" ? cam.height.toFixed(3) : null');  // the page's own camera, not the HUD
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas{visibility:visible !important}' });
  await page.waitForTimeout(250);
  const file = `h${String(h).padStart(2, '0')}.png`;
  const png = await page.screenshot({ path: path.join(out, file) });
  const info = await page.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
    return { cw: c.width, ch: c.height, rect: [r.x, r.y, r.width, r.height] }; });
  // travel view: cx ½, cy H, hx = zoom/2 (7/2), hy = hx/aspect (kick punch is 0 with no music)
  const hx = 3.5, aspect = info.cw / info.ch, view = { cx: 0.5, cy: h, hx, hy: hx / aspect };
  const a = await page.evaluate(async ({ png, rect, view, zeros }) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const [rx, ry, rw, rh] = rect;
    const toPx = (x, y) => [rx + (x - (view.cx - view.hx)) / (2 * view.hx) * rw, ry + rh - (y - (view.cy - view.hy)) / (2 * view.hy) * rh];
    const rgb = (px, py) => { const i = (py * c.width + px) * 4; return [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255]; };
    const hueOf = ([r, gg, b]) => { const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn;
      if (dd < 0.04) return null; const h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4; return h / 6; };
    const hueAt = (x, y) => { const [px, py] = toPx(x, y).map(Math.round);
      if (px < 0 || py < 0 || px >= c.width || py >= c.height) return null; return hueOf(rgb(px, py)); };
    // black share per half (every 4th pixel)
    const seamPx = Math.round(toPx(0.5, view.cy)[0]);
    let lb = 0, ln = 0, rb = 0, rn = 0;
    for (let py = 0; py < c.height; py += 4) for (let px = 0; px < c.width; px += 4) {
      const v = Math.max(...rgb(px, py)), blk = v < 0.03;
      if (px < seamPx - 2) { ln++; lb += blk; } else if (px > seamPx + 2) { rn++; rb += blk; }
    }
    // seam: hue 3 px either side of Re s = ½ on every 2nd row
    const dh = [];
    for (let py = 0; py < c.height; py += 2) {
      const L = hueOf(rgb(seamPx - 3, py)), Rr = hueOf(rgb(seamPx + 3, py));
      if (L === null || Rr === null) continue;
      let x = Math.abs(L - Rr); x = Math.min(x, 1 - x); dh.push(x);
    }
    dh.sort((p, q) => p - q);
    const wind = (x, y, rad, n = 96) => { let tot = 0, prev = null, miss = 0;
      for (let k = 0; k <= n; k++) { const t = 2 * Math.PI * k / n, h = hueAt(x + rad * Math.cos(t), y + rad * Math.sin(t));
        if (h === null) { miss++; continue; } if (prev !== null) { let e = h - prev; e -= Math.round(e); tot += e; } prev = h; }
      return { w: Math.round(tot), miss }; };
    const zs = zeros.filter(t => t > view.cy - view.hy + 0.35 && t < view.cy + view.hy - 0.35).map(t => {
      const rs = [0.15, 0.25, 0.35].map(r => wind(0.5, t, r)).filter(r => r.miss < 40);
      const cnt = {}; rs.forEach(r => cnt[r.w] = (cnt[r.w] || 0) + 1);
      return { t, w: rs.length ? +Object.entries(cnt).sort((p, q) => q[1] - p[1])[0][0] : null };
    });
    return { leftBlack: lb / ln, rightBlack: rb / rn, seamMedian: dh.length ? dh[dh.length >> 1] : null,
      seamP90: dh.length ? dh[Math.floor(dh.length * 0.9)] : null, seamRows: dh.length, zeros: zs };
  }, { png: png.toString('base64'), rect: info.rect, view, zeros: ZEROS });
  rows.push({ h, held: held ? +held : null, file, y: [+(h - view.hy).toFixed(2), +(h + view.hy).toFixed(2)], ...a });
  console.log(h, JSON.stringify(rows.at(-1)));
}
await browser.close(); server.close();

const pass = {
  heldAtHeight: rows.every(r => r.held !== null && Math.abs(r.held - r.h) < 0.01),
  leftNotBlack: rows.every(r => r.leftBlack < 0.05),
  rightNotBlack: rows.every(r => r.rightBlack < 0.05),
  seamMatches: rows.every(r => r.seamMedian !== null && r.seamMedian < 0.03),
  zerosWind: rows.every(r => r.zeros.every(z => z.w === 1)),
  everyZeroSeen: ZEROS.every(t => rows.some(r => r.zeros.some(z => z.t === t))),
  noErrors: errors.length === 0,
};
fs.writeFileSync(path.join(out, 'sweep.json'), JSON.stringify({ step, top, rows, errors, pass }, null, 1));
const md = `# 09 Riemann height sweep · ${stamp}\n\nTravel view held (?speed=0&height=H), 1920×1080, strip width 7 (Re s −3…4), Im s H±${(3.5 * 9 / 16).toFixed(2)}.\n\n` +
  `| H | held | black left | black right | seam Δhue p50 / p90 | zeros (winding) |\n|---|---|---|---|---|---|\n` +
  rows.map(r => `| ${r.h} | ${r.held} | ${(r.leftBlack * 100).toFixed(1)}% | ${(r.rightBlack * 100).toFixed(1)}% | ${r.seamMedian?.toFixed(3)} / ${r.seamP90?.toFixed(3)} | ${r.zeros.map(z => `${z.t.toFixed(2)}:${z.w === 1 ? '✅' : '❌' + z.w}`).join(' ') || '–'} |`).join('\n') +
  `\n\n## Result\n\n` + Object.entries(pass).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`).join('\n') + `\n\nErrors: ${errors.length ? errors.join('; ') : 'none'}\n`;
fs.writeFileSync(path.join(out, 'sweep.md'), md);
console.log(out);
