// Does a scene move with the beat? Per rendered frame (60 Hz) it measures picture motion
// (mean |Δluma| between consecutive frames, 96×54 copy of the canvas through captureStream)
// and the beat phase from the page's own clock (window.__qa.bars × beats per bar).
// Reports: fps, mean motion, motion by beat phase (20 bins), where the peak sits after the
// beat (ms at the page's bpm), and how strong the pulse is (peak bin ÷ median bin).
//   node qa/check-pulse.mjs --page 11-riemann-show.html --query scene=canyon [--experiments dir] [--secs 60] [--label x]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const pageName = arg('page', '11-riemann-show.html'), query = arg('query', 'scene=canyon'), secs = +arg('secs', 60), label = arg('label', query);

const server = http.createServer((req, res) => {
  const p = path.join(expDir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const R = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({
  env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
    __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` },
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}?${query}`);
await page.addStyleTag({ content: '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}' });
await page.waitForTimeout(800);
await page.click('#play');
await page.waitForTimeout(2000);

const res = await page.evaluate(async secs => {
  const cv = document.querySelector('canvas');
  const vid = document.createElement('video'); vid.muted = true; vid.srcObject = cv.captureStream(60); await vid.play();
  const W = 96, H = 54, pc = document.createElement('canvas'); pc.width = W; pc.height = H;
  const g = pc.getContext('2d', { willReadFrequently: true });
  let prev = null; const rows = []; const t0 = performance.now();
  await new Promise(done => {
    const step = () => {
      g.drawImage(vid, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data, y = new Float32Array(W * H);
      let m = 0;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) { y[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; if (prev) m += Math.abs(y[j] - prev[j]); }
      if (prev && window.__qa && __qa.bars != null) rows.push([performance.now() - t0, __qa.bars, m / (W * H)]);
      prev = y;
      if (performance.now() - t0 < secs * 1000) vid.requestVideoFrameCallback(step); else done();
    };
    vid.requestVideoFrameCallback(step);
  });
  const bpb = (typeof params !== 'undefined' && params.bpb) || 4, bpm = (typeof params !== 'undefined' && params.bpm) || 120;
  return { rows, bpb, bpm };
}, secs);
await browser.close(); server.close();

const { rows, bpb, bpm } = res;
const beatMs = 60000 / bpm, N = 20;
const bins = Array.from({ length: N }, () => []);
for (const [, bars, m] of rows) { const ph = (bars * bpb) % 1; bins[Math.min(N - 1, Math.floor(ph * N))].push(m); }
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const byPhase = bins.map(mean);
const sorted = [...byPhase].sort((a, b) => a - b), median = sorted[N >> 1];
const peak = byPhase.indexOf(Math.max(...byPhase));
const fps = rows.length / ((rows.at(-1)[0] - rows[0][0]) / 1000);
const out = { label, page: pageName, query, frames: rows.length, fps: +fps.toFixed(1), meanMotion: +mean(rows.map(r => r[2])).toFixed(5),
  peakAfterBeatMs: Math.round((peak + 0.5) / N * beatMs), pulseStrength: +(byPhase[peak] / median).toFixed(2),
  byPhase: byPhase.map(v => +v.toFixed(5)), errors };
console.log(JSON.stringify(out));
