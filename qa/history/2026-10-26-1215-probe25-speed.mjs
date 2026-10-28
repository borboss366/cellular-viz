// 2026-10-26 12:15 · 25 Shape Shifter II: how fast is the page's SDF (to size the genus sampling), song length, keyframe extents
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q27/x/experiments', R0 = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/25-shape-shifter-2.html`); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const st = stateAt(5), t0 = performance.now(); let s = 0; for (let i = 0; i < 200000; i++) s += sdfJS(st, Math.random() * 3 - 1.5, Math.random() * 3 - 1.5, Math.random() * 3 - 1.5);
  const us = (performance.now() - t0) / 200000 * 1000;
  // extents: max |x| of points inside, per keyframe, on a coarse 48³ grid of ±2.2
  const ext = __qa.keyframes.map(k => { const ks = keyState(k.id), c = ks.center || [0, 0, 0]; let m = 0; const n = 48, L = 2.2, h = 2 * L / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let l = 0; l < n; l++) { const x = -L + (i + .5) * h, y = -L + (j + .5) * h, z = -L + (l + .5) * h; if (sdfJS(ks, c[0] + x, c[1] + y, c[2] + z) < 0) m = Math.max(m, Math.abs(x), Math.abs(y), Math.abs(z)); }
    return [k.id.trim(), k.genus, +m.toFixed(2), ks.center ? 'c' : '-']; });
  const st2 = stateAt(0); return { usPerSdf: +us.toFixed(2), keys: Object.keys(st2).slice(0, 30), ph: st2.ph, ext, song: typeof songAt === 'function' ? songAt(0) : null };
})), errs);
await b.close(); srv.close();
