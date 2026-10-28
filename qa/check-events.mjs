// Sync from the page's own beat log (window.__qa.events), for scenes where motion can't be timed.
//   node qa/check-events.mjs --page 17-bsd-skater.html --query curve=x3-25x [--experiments dir] [--secs 40]
// Each event: perfHeard (when the sound is heard, performance.now ms) and perfDrawn (rAF
// timestamp of the first frame that draws it). Reports drawn − heard per type (median, p10,
// p90) at 1920×1080 Fullscreen. The page reports these itself; the motion check (check-pulse)
// is the independent cross-check where it works. Target (VIZ QA): ≤ 40 ms after the sound.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const pageName = arg('page', '17-bsd-skater.html'), query = arg('query', ''), secs = +arg('secs', 40), label = arg('label', pageName + ' ' + query);
const server = http.createServer((q, res) => { const p = path.join(expDir, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const R = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}?${query}`);
await page.addStyleTag({ content: '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}' });
await page.waitForTimeout(800); await page.click('#play').catch(() => {});
const evs = await page.evaluate(async secs => {
  const seen = new Map(); const t0 = performance.now();
  while (performance.now() - t0 < secs * 1000) { for (const e of (window.__qa && __qa.events) || []) seen.set(`${e.type}|${e.tBeat}|${e.perfDrawn}`, e); await new Promise(r => setTimeout(r, 250)); }
  return [...seen.values()];
}, secs);
await browser.close(); server.close();
const byType = {};
for (const e of evs) if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (byType[e.type] ??= []).push(e.perfDrawn - e.perfHeard);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
const res = Object.fromEntries(Object.entries(byType).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9) }]));
console.log(JSON.stringify({ label, events: evs.length, byType: res, errors }));
