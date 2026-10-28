// Maths + speed check for 09 Riemann at 1920×1080 on the box GPU.
//   node qa/check-09.mjs [--experiments <dir>] [--secs 10]
// 1. Overview screenshot (no music, no marks). Hue = arg ζ, so around a zero the hue turns
//    once forwards (+1), around the pole once backwards (−1), elsewhere 0. Scans the whole
//    view on a grid and lists every cell with a non-zero winding, then compares with the
//    known zeros (critical line + trivial) and the pole.
// 2. fps over N s while playing, in travel view and in overview.
// Writes qa/09-riemann/checks/<stamp>/{check.json, check.md, overview.png, overview-marks.png}.
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
const secs = +arg('secs', 10);
const W = 1920, H = 1080;

const ZEROS = [14.134725, 21.022040, 25.010858, 30.424876, 32.935062, 37.586178];
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

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, (c) => c === 'T' ? '-' : c === ':' ? '' : '-');
const out = path.join(here, '09-riemann', 'checks', stamp);
fs.mkdirSync(out, { recursive: true });

// ---- 1. zeros by winding number ----
// Same layout as the page's Fullscreen button (#wrap:fullscreen → 100vw × 100vh), without needing a user gesture
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
async function shot(q, file) {
  await page.goto(`${base}?${q}`);
  await page.addStyleTag({ content: FULL });
  await page.waitForTimeout(1500);
  // hide the UI so only the canvas is measured
  await page.addStyleTag({ content: 'body *{visibility:hidden !important} canvas{visibility:visible !important}' });
  await page.waitForTimeout(300);
  return page.screenshot({ path: path.join(out, file) });
}
await shot('view=overview&hud=short&bands=0.25', 'overview.png');      // few |ζ| bands: more hue to read
await shot('view=overview&hud=short&marks=1', 'overview-marks.png');
const info = await page.evaluate(() => ({ cw: document.querySelector('canvas').width, ch: document.querySelector('canvas').height,
  rect: (r => [r.x, r.y, r.width, r.height])(document.querySelector('canvas').getBoundingClientRect()) }));

// s-plane window of the overview (09: cx −1, cy 18, hx 20·max(1,aspect), hy 20/min(1,aspect))
const [rx, ry, rw, rh] = info.rect, aspect = info.cw / info.ch;
const view = { cx: -1, cy: 18, hx: 20 * Math.max(1, aspect), hy: 20 / Math.min(1, aspect) };

const analysis = await page.evaluate(async ({ png, rect, view, zeros }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + png; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const [rx, ry, rw, rh] = rect;
  const toPx = (x, y) => [rx + (x - (view.cx - view.hx)) / (2 * view.hx) * rw, ry + rh - (y - (view.cy - view.hy)) / (2 * view.hy) * rh];
  const hueAt = (x, y) => {
    const [px, py] = toPx(x, y).map(Math.round);
    if (px < 0 || py < 0 || px >= c.width || py >= c.height) return null;
    const i = (py * c.width + px) * 4, r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), dd = mx - mn;
    if (dd < 0.04) return null;                                   // grey: no hue to read
    let h = mx === r ? ((gg - b) / dd) % 6 : mx === gg ? (b - r) / dd + 2 : (r - gg) / dd + 4;
    return h / 6;                                                 // 0..1 turns
  };
  // winding of hue around a counter-clockwise (in the s-plane) circle
  const wind = (x, y, rad, n = 96) => {
    let tot = 0, prev = null, miss = 0;
    for (let k = 0; k <= n; k++) {
      const a = 2 * Math.PI * k / n, h = hueAt(x + rad * Math.cos(a), y + rad * Math.sin(a));
      if (h === null) { miss++; continue; }
      if (prev !== null) { let dh = h - prev; dh -= Math.round(dh); tot += dh; }
      prev = h;
    }
    return { w: Math.round(tot), raw: +tot.toFixed(2), miss };
  };
  const expected = [
    ...zeros.map(t => ({ what: `zero ½+${t}i`, x: 0.5, y: t, want: 1 })),
    ...[-2, -4, -6, -8, -10].map(x => ({ what: `trivial zero ${x}`, x, y: 0, want: 1 })),
    { what: 'pole s=1', x: 1, y: 0, want: -1 },
  ].filter(e => e.y >= view.cy - view.hy + 0.6 && e.y <= view.cy + view.hy - 0.6 && e.x >= view.cx - view.hx + 0.6 && e.x <= view.cx + view.hx - 0.6);
  const vote = (x, y, radii) => {
    const rs = radii.map(r => wind(x, y, r)).filter(r => r.miss < 40);
    if (!rs.length) return { w: 0, raw: 0, miss: 97, radii: 0 };
    const counts = {}; rs.forEach(r => counts[r.w] = (counts[r.w] || 0) + 1);
    const w = +Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    return { w, raw: rs.map(r => r.raw).join('/'), miss: Math.min(...rs.map(r => r.miss)), radii: rs.length };
  };
  const at = expected.map(e => ({ ...e, ...vote(e.x, e.y, [0.2, 0.3, 0.45, 0.6]) }));
  // scan: every 0.5×0.5 cell of the strip −3 ≤ x ≤ 4 (and the real axis out to −12)
  const found = [];
  const cell = 0.5;
  for (let y = view.cy - view.hy + cell; y < view.cy + view.hy - cell; y += cell)
    for (let x = -12; x <= 4; x += cell) {
      if (x < -3 && Math.abs(y) > 1.5) continue;
      const r = wind(x + cell / 2, y + cell / 2, cell * 0.72, 48);
      if (r.w !== 0 && r.miss < 8) found.push({ x: +(x + cell / 2).toFixed(2), y: +(y + cell / 2).toFixed(2), w: r.w });
    }
  return { at, found, size: [c.width, c.height] };
}, { png: fs.readFileSync(path.join(out, 'overview.png')).toString('base64'), rect: info.rect, view, zeros: ZEROS });

// cluster scan hits (one feature lights up neighbouring cells)
const clusters = [];
for (const f of analysis.found) {
  const c = clusters.find(c => Math.hypot(c.x - f.x, c.y - f.y) < 1.1 && c.w === f.w);
  if (c) { c.n++; c.x = (c.x * (c.n - 1) + f.x) / c.n; c.y = (c.y * (c.n - 1) + f.y) / c.n; } else clusters.push({ ...f, n: 1 });
}
const knownPts = [...ZEROS.map(t => [0.5, t, 1]), ...[-2, -4, -6, -8, -10, -12].map(x => [x, 0, 1]), [1, 0, -1]];
for (const c of clusters) {
  const k = knownPts.find(([x, y, w]) => w === c.w && Math.hypot(x - c.x, y - c.y) < 0.9);
  c.match = k ? (k[2] < 0 ? 'pole s=1' : k[1] === 0 ? `trivial ${k[0]}` : `zero ${k[1]}`) : 'UNEXPECTED';
}

// ---- 2. fps at 1080p while playing ----
async function fps(q) {
  await page.goto(`${base}?${q}`);
  await page.addStyleTag({ content: FULL });
  await page.waitForTimeout(1000);
  await page.click('#play').catch(() => {});
  await page.waitForTimeout(1500);
  return page.evaluate(async s => {
    const t = []; let on = true;
    const f = now => { t.push(now); if (on) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    await new Promise(r => setTimeout(r, s * 1000)); on = false;
    const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p50ms: +dt[dt.length >> 1].toFixed(1), p99ms: +dt[Math.floor(dt.length * 0.99)].toFixed(1), worstMs: +dt.at(-1).toFixed(1),
      canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] };
  }, secs);
}
const speed = { travel: await fps('hud=short'), overview: await fps('view=overview&hud=short') };
const renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e.UNMASKED_RENDERER_WEBGL); });

await browser.close(); server.close();

const pass = {
  zerosOnLine: analysis.at.filter(a => a.what.startsWith('zero')).every(a => a.w === a.want),
  trivialAndPole: analysis.at.filter(a => !a.what.startsWith('zero')).every(a => a.w === a.want),
  noStray: clusters.every(c => c.match !== 'UNEXPECTED'),
  fps60: speed.travel.fps >= 58 && speed.overview.fps >= 58,
  noErrors: errors.length === 0,
};
const res = { renderer, viewport: [W, H], canvas: [info.cw, info.ch], view, expected: analysis.at, scan: clusters, speed, errors, pass };
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify(res, null, 1));
const md = `# 09 Riemann check · ${stamp}\n\n- ${renderer}\n- viewport ${W}×${H}, canvas ${info.cw}×${info.ch}\n- overview window: x ${(view.cx - view.hx).toFixed(1)}…${(view.cx + view.hx).toFixed(1)}, y ${(view.cy - view.hy).toFixed(1)}…${(view.cy + view.hy).toFixed(1)}\n\n` +
  `## Winding of hue at the known points (want +1 zero, −1 pole)\n\n| point | winding | raw |\n|---|---|---|\n` +
  analysis.at.map(a => `| ${a.what} | ${a.w === a.want ? '✅' : '❌'} ${a.w} | ${a.raw} |`).join('\n') +
  `\n\n## Scan of −3 ≤ Re s ≤ 4 (and the real axis to −12): every pinwheel found\n\n| at | winding | cells | is |\n|---|---|---|---|\n` +
  clusters.map(c => `| ${c.x.toFixed(2)} + ${c.y.toFixed(2)}i | ${c.w} | ${c.n} | ${c.match} |`).join('\n') +
  `\n\n## Speed at 1920×1080, playing, ${secs} s\n\n| view | fps | frame p50 | p99 | worst |\n|---|---|---|---|---|\n` +
  Object.entries(speed).map(([k, v]) => `| ${k} | ${v.fps} | ${v.p50ms} ms | ${v.p99ms} ms | ${v.worstMs} ms |`).join('\n') +
  `\n\n## Result\n\n` + Object.entries(pass).map(([k, v]) => `- ${v ? '✅' : '❌'} ${k}`).join('\n') + `\n\nErrors: ${errors.length ? errors.join('; ') : 'none'}\n`;
fs.writeFileSync(path.join(out, 'check.md'), md);
console.log(out);
