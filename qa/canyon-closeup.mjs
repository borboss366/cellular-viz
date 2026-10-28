// Canyon look, frame for frame, between builds: does a change alter the picture?
//   node qa/canyon-closeup.mjs <out dir> <label>=<experiments dir> <label>=<experiments dir> [--bars 0.5,2.25,...]
// Time is frozen: performance.now and rAF timestamps come from window.__T, so with the metronome
// not playing (muted, no click) the page draws bars = (__T − clockStart)·bpm/60/bpb exactly the same
// in every build. 1920×1080, Fullscreen layout, UI hidden. For each bar time: a full screenshot per
// build, a 3× close-up of the ground just below the horizon centre (grazing angle, where a coarse
// march misses crests), and per-pixel differences against the first build.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const out = path.resolve(args[0]);
const builds = args.slice(1).filter(a => a.includes('=') && !a.startsWith('--')).map(a => { const [k, v] = a.split('='); return { label: k, dir: path.resolve(v) }; });
const bi = args.indexOf('--bars');
const BARS = (bi > 0 ? args[bi + 1] : '0.5,1.3,2.25,3.6,4.1,5.5,6.7,7.4').split(',').map(Number);
fs.mkdirSync(out, { recursive: true });
const W = 1920, H = 1080;

const R = path.join(os.homedir(), 'qa-libs/root');
const gpu = fs.existsSync('/dev/dri/renderD128');
const browser = await chromium.launch({
  env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
    ...(gpu ? { __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` } : {}) },
  args: gpu ? ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const shots = {};   // label -> [png buffers]
const errors = {};
for (const b of builds) {
  const server = http.createServer((req, res) => {
    const p = path.join(b.dir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  errors[b.label] = [];
  page.on('pageerror', e => errors[b.label].push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors[b.label].push(m.text()); });
  await page.addInitScript(() => {
    window.__T = 1000;
    performance.now = () => window.__T;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = cb => raf(() => cb(window.__T));
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/11-riemann-show.html?scene=canyon&muted=1&bpm=120`);
  await page.addStyleTag({ content: '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important} body *{visibility:hidden !important} canvas{visibility:visible !important}' });
  await page.waitForTimeout(1500);
  shots[b.label] = [];
  for (const bars of BARS) {
    // bpm 120, 4/4: one bar = 2 s
    await page.evaluate(ms => { window.__T = 1000 + ms; }, bars * 2000);
    await page.waitForTimeout(400);   // several frames at the same time: the bake pass is done
    const st = await page.evaluate(() => ({ scene: window.__qa.scene, bars: window.__qa.bars, tCam: window.__qa.tCam }));
    const png = await page.screenshot();
    fs.writeFileSync(path.join(out, `${b.label}-b${bars}.png`), png);
    shots[b.label].push({ bars, st, png });
  }
  await page.close(); server.close();
}

// compare every build against the first, in a page (decode PNGs on canvas)
const page = await browser.newPage();
const ref = builds[0].label, rows = [];
for (let i = 0; i < BARS.length; i++) {
  for (const b of builds.slice(1)) {
    const r = await page.evaluate(async ({ a, c, W, H }) => {
      const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode();
        const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; const g = cv.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, cv.width, cv.height).data; };
      const A = await load(a), C = await load(c);
      let sum = 0, n = 0, big = 0, gsum = 0, gn = 0, gbig = 0;
      for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
        const k = (y * W + x) * 4;
        const d = (Math.abs(A[k] - C[k]) + Math.abs(A[k + 1] - C[k + 1]) + Math.abs(A[k + 2] - C[k + 2])) / 3;
        sum += d; n++; if (d > 24) big++;
        if (y > H * 0.35 && y < H * 0.6 && x > W * 0.25 && x < W * 0.75) { gsum += d; gn++; if (d > 24) gbig++; }   // grazing band
      }
      return { meanDiff: +(sum / n).toFixed(2), over24: +(100 * big / n).toFixed(2), grazingMean: +(gsum / gn).toFixed(2), grazingOver24: +(100 * gbig / gn).toFixed(2) };
    }, { a: shots[ref][i].png.toString('base64'), c: shots[b.label][i].png.toString('base64'), W, H });
    rows.push({ bars: BARS[i], vs: `${b.label} vs ${ref}`, sameTime: Math.abs(shots[ref][i].st.tCam - shots[b.label][i].st.tCam) < 1e-9, scene: shots[b.label][i].st.scene, ...r });
  }
  // close-up pair: 640×360 crop around the grazing band centre, 3×
  const crop = { x: W / 2 - 320, y: H * 0.42 - 180, width: 640, height: 360 };
  const pair = await browser.newPage({ viewport: { width: 1920, height: 1080 * builds.length } });
  await pair.setContent('<body style="margin:0;background:#000">' + builds.map(b =>
    `<div style="position:relative;width:1920px;height:1080px;overflow:hidden"><img src="data:image/png;base64,${shots[b.label][i].png.toString('base64')}" style="position:absolute;left:${-crop.x * 3}px;top:${-crop.y * 3}px;width:${W * 3}px;height:${H * 3}px;image-rendering:pixelated"><div style="position:absolute;left:12px;top:8px;color:#fff;font:28px sans-serif;text-shadow:0 0 4px #000">${b.label} · bar ${BARS[i]}</div></div>`).join('') + '</body>');
  await pair.waitForTimeout(200);
  await pair.screenshot({ path: path.join(out, `closeup-b${BARS[i]}.png`) });
  await pair.close();
}
await browser.close();
fs.writeFileSync(path.join(out, 'closeup.json'), JSON.stringify({ builds: builds.map(b => b.label), bars: BARS, rows, errors }, null, 1));
console.log(JSON.stringify({ rows, errors }));
