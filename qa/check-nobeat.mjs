// No-beat mode QA row for any scene page (the apartment MVP, Task 3). On the box's 780M, as check-shared.mjs:
//   node qa/check-nobeat.mjs --page 16-hodge-kaleidoscope.html [--secs 30] [--query 'capture=1'] [--out dir]
// 1920x1080, ?capture=1 (clean stills; Play pressed by itself), then three phases of --secs each (qa/nobeat.mjs):
// confidence forced to 0, the clock's own (locked), forced to 0 again. Writes check.md (the rows) and one still per
// phase (nobeat-1.png, locked.png, nobeat-2.png) for the user's grading. Exit 1 when a row fails.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runNoBeat, verdict } from './nobeat.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const pageName = arg('page');
if (!pageName || !/^[\w.-]+\.html$/.test(pageName)) { console.error('usage: --page NN-name.html [--secs 30] [--query capture=1]'); process.exit(2); }
const SECS = +arg('secs', 30), query = arg('query', 'capture=1');
const id = pageName.replace(/\.html$/, ''), pad = n => String(n).padStart(2, '0'), d = new Date();
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const out = path.resolve(arg('out', path.join(here, id, 'checks', `${stamp}-nobeat`)));
fs.mkdirSync(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((q, res) => {
  const p = path.resolve(expDir, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(expDir + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const errors = [];
let code = 0;
try {
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/${pageName}?${query}`, { timeout: 30e3 });
  if (!/capture=1/.test(query)) await page.click('#play', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const res = await runNoBeat(page, { phaseSecs: SECS, outDir: out });
  const v = verdict(res, { errors, budget: true });
  const md = `# No-beat mode · ${pageName} · ${stamp}\n\n${SECS} s per phase, ?${query}, 1920x1080. ${v.pass ? 'PASS' : 'FAIL'}\n\n` + v.lines.map(l => `- ${l}`).join('\n') +
    `\n\nStills for grading: ${res.phases.map(p => path.basename(p.still)).join(', ')}\n` + (errors.length ? `\nPage errors:\n${errors.slice(0, 5).map(e => '- ' + e.slice(0, 200)).join('\n')}\n` : '');
  fs.writeFileSync(path.join(out, 'check.md'), md);
  fs.writeFileSync(path.join(out, 'nobeat.json'), JSON.stringify({ page: pageName, secs: SECS, query, ...res, errors, pass: v.pass }, null, 1));
  console.log(md);
  if (!v.pass) code = 1;
} finally { await browser.close(); server.close(); }
console.log(out);
process.exit(code);
