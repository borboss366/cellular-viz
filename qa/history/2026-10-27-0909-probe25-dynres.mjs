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
// probe: res=native at 4K for 20 s; per frame dt, canvas width, bar and camera mode; where are the >20 ms frames?
const p = await open(arg('q', 'res=native'), [3840, 2160]);
const out = await p.evaluate(async () => { const rows = []; let on = true, last = null;
  const f = n => { const c = document.querySelector('canvas'); if (last !== null) rows.push([+(n / 1000).toFixed(3), +(n - last).toFixed(1), c.width, +__qa.bars.toFixed(2), (__qa.camera(__qa.bars) || {}).mode]); last = n; if (on) requestAnimationFrame(f); };
  requestAnimationFrame(f); await new Promise(r => setTimeout(r, 20000)); on = false; return rows; });
await browser.close(); server.close();
const t0 = out[0][0], widths = []; let w = null;
for (const r of out) if (r[2] !== w) { w = r[2]; widths.push(`${(r[0] - t0).toFixed(1)}s→${w}`); }
console.log('canvas width changes:', widths.join(', '));
const slow = out.filter(r => r[1] > 20);
console.log('frames > 20 ms:', slow.length, 'of', out.length);
for (const r of slow) console.log(`  t ${(r[0] - t0).toFixed(2)} s  dt ${r[1]} ms  width ${r[2]}  bar ${r[3]}  ${r[4]}`);
for (const [a, b] of [[0, 2.8], [2.8, 12.8], [12.8, 20]]) { const s = out.filter(r => r[0] - t0 >= a && r[0] - t0 < b); console.log(`window ${a}-${b}s: ${s.filter(r => r[1] > 20).length} slow, fps ${(s.length / (b - a)).toFixed(1)}`); }
