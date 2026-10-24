// Does a scene move with the beat? Per rendered frame (60 Hz) it measures picture motion
// (mean |Δluma| between consecutive frames, 96×54 copy of the canvas through captureStream)
// and the beat phase from the page's own clock (window.__qa.bars × beats per bar).
// Reports: fps, mean motion, motion by beat phase (20 bins), where the peak sits after the
// beat (ms at the page's bpm), and how strong the pulse is (peak bin ÷ median bin).
//   node qa/check-pulse.mjs --page 11-riemann-show.html --query scene=canyon [--experiments dir] [--secs 60] [--label x] [--bins 50]
// Calibration (always, first): qa/data/flash.html draws a white frame on every beat and logs the
// rAF time it drew it; the delay until that frame reaches our capture callback is the measuring
// pipeline's own lag. The page's motion peak is reported raw and with that lag subtracted
// ("corrected"), which is the number to hold against the ≤ 40 ms target. Audio output latency
// is not included (headless has no speakers).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const pageName = arg('page', '11-riemann-show.html'), query = arg('query', 'scene=canyon'), secs = +arg('secs', 60), label = arg('label', query), N = +arg('bins', 50);

const server = http.createServer((req, res) => {
  const name = path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const p = name === 'flash.html' ? path.join(here, 'data', 'flash.html') : path.join(expDir, name);
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
// ---- calibration on the reference page ----
await page.goto(`http://127.0.0.1:${server.address().port}/flash.html`);
await page.waitForTimeout(500);
await page.click('#play');
await page.waitForTimeout(800);
const cal = await page.evaluate(async () => {
  const cv = document.querySelector('canvas');
  const vid = document.createElement('video'); vid.muted = true; vid.srcObject = cv.captureStream(60); await vid.play();
  const g = Object.assign(document.createElement('canvas'), { width: 16, height: 9 }).getContext('2d', { willReadFrequently: true });
  const seen = []; let wasBright = false; const t0 = performance.now();
  await new Promise(done => {
    const step = now => {
      g.drawImage(vid, 0, 0, 16, 9); const d = g.getImageData(0, 0, 16, 9).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i];
      const bright = s / (d.length / 4) > 128;
      if (bright && !wasBright) seen.push(performance.now());
      wasBright = bright;
      if (performance.now() - t0 < 20000) vid.requestVideoFrameCallback(step); else done();
    };
    vid.requestVideoFrameCallback(step);
  });
  // pair each seen flash with the latest draw before it
  const lags = seen.map(t => { const drawn = __qa.beats.filter(b => b <= t).at(-1); return drawn == null ? null : t - drawn; }).filter(x => x != null && x < 200);
  lags.sort((a, b) => a - b);
  return { n: lags.length, median: lags[lags.length >> 1], p10: lags[Math.floor(lags.length * 0.1)], p90: lags[Math.floor(lags.length * 0.9)] };
});

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
  // the page's beat clock against real time: sampled in a rAF callback queued after the page's own
  let clock = [], on = true;
  const tick = now => { if (window.__qa && __qa.bars != null) clock.push([now, __qa.bars]); if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  let prev = null; const rows = []; const t0 = performance.now();
  await new Promise(done => {
    const step = () => {
      g.drawImage(vid, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data, y = new Float32Array(W * H);
      let m = 0;
      for (let i = 0, j = 0; i < d.length; i += 4, j++) { y[j] = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; if (prev) m += Math.abs(y[j] - prev[j]); }
      if (prev) rows.push([performance.now(), null, m / (W * H)]);
      prev = y;
      if (performance.now() - t0 < secs * 1000) vid.requestVideoFrameCallback(step); else done();
    };
    vid.requestVideoFrameCallback(step);
  });
  on = false;
  const bpb = (typeof params !== 'undefined' && params.bpb) || 4, bpm = (typeof params !== 'undefined' && params.bpm) || 120;
  return { rows, bpb, bpm, clock };
}, secs);
await browser.close(); server.close();

const { rows, bpb, bpm, clock } = res;
const beatMs = 60000 / bpm;
// least-squares line beats(t) through the page clock (tempo is constant in these tests)
const cx = clock.map(c => c[0]), cy = clock.map(c => c[1] * bpb), n = cx.length;
const mx = cx.reduce((a, b) => a + b, 0) / n, my = cy.reduce((a, b) => a + b, 0) / n;
let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (cx[i] - mx) * (cy[i] - my); sxx += (cx[i] - mx) ** 2; }
const slope = sxy / sxx, icept = my - slope * mx;
const fitErrMs = Math.sqrt(cx.reduce((a, x, i) => a + (icept + slope * x - cy[i]) ** 2, 0) / n) / slope;
// each captured frame placed at its render time (capture time − measured pipeline lag)
const bins = Array.from({ length: N }, () => []);
for (const [tcb, , m] of rows) { const b = icept + slope * (tcb - cal.median); const ph = ((b % 1) + 1) % 1; bins[Math.min(N - 1, Math.floor(ph * N))].push(m); }
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const byPhase = bins.map(mean);
const sorted = [...byPhase].sort((a, b) => a - b), median = sorted[N >> 1];
const peak = byPhase.indexOf(Math.max(...byPhase));
// sub-bin peak: parabola through the peak bin and its (circular) neighbours
const yl = byPhase[(peak + N - 1) % N], y0 = byPhase[peak], yr = byPhase[(peak + 1) % N];
const shift = (yl - 2 * y0 + yr) !== 0 ? 0.5 * (yl - yr) / (yl - 2 * y0 + yr) : 0;
let peakMs = ((peak + 0.5 + shift) / N) * beatMs;
if (peakMs > beatMs / 2) peakMs -= beatMs;          // a peak just before the beat reads as negative
const fps = rows.length / ((rows.at(-1)[0] - rows[0][0]) / 1000);
const tempoBpm = slope * 60000;
const out = { label, page: pageName, query, frames: rows.length, fps: +fps.toFixed(1), meanMotion: +mean(rows.map(r => r[2])).toFixed(5),
  // peakMs is already at render time; raw = what the capture saw before taking the lag off
  correctedMs: Math.round(peakMs), rawMs: Math.round(peakMs + cal.median), pipelineLagMs: cal,
  clockFit: { tempoBpm: +tempoBpm.toFixed(2), residualMs: +fitErrMs.toFixed(1), samples: n },
  binMs: +(beatMs / N).toFixed(1), pulseStrength: +(byPhase[peak] / median).toFixed(2),
  byPhase: byPhase.map(v => +v.toFixed(5)), errors };
console.log(JSON.stringify(out));
