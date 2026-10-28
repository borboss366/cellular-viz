// 2026-10-26 06:43 · why is __qa undefined on 14 Round Point @3862e5b? load it, print page errors and console
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q24/x/experiments', R = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); const logs = [];
p.on('pageerror', e => logs.push('ERR ' + e.stack.split('\n').slice(0, 4).join(' | '))); p.on('console', m => logs.push(m.type() + ' ' + m.text().slice(0, 300)));
await p.goto(`http://127.0.0.1:${srv.address().port}/14-round-point.html?scene=curve&kicks=0`); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => ({ qa: typeof window.__qa, hud: document.getElementById('hud')?.textContent.slice(0, 200) })));
console.log(logs.slice(0, 8).join('\n')); await b.close(); srv.close();
