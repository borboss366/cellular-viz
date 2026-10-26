// 2026-10-26 14:45 · 25 @f5f6a28: where does the view turn fastest? per frame (1/120 bar at 120 bpm) fwd and up angle rates, top spots and the share of time above 180°/s by camera mode
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q27/x/experiments', R0 = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.goto(`http://127.0.0.1:${srv.address().port}/25-shape-shifter-2.html`); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2], len = a => Math.hypot(...a), ang = (a, c) => Math.acos(Math.max(-1, Math.min(1, dot(a, c) / (len(a) * len(c))))) * 180 / Math.PI;
  const step = 1 / 120, spf = 1 / 60, rows = []; let prev = __qa.camera(0);
  for (let t = step; t < 96; t += step) { const c = __qa.camera(t); rows.push({ bars: +t.toFixed(3), mode: c.mode, prevMode: prev.mode, fwd: ang(prev.fwd, c.fwd) / spf, up: ang(prev.up, c.up) / spf }); prev = c; }
  const byMode = {}; for (const r of rows) { const k = r.mode; byMode[k] ??= { frames: 0, over: 0, upOver: 0 }; byMode[k].frames++; if (r.fwd > 180) byMode[k].over++; if (r.up > 180) byMode[k].upOver++; }
  const top = [...rows].sort((a, c) => c.fwd - a.fwd).slice(0, 8).map(r => ({ bars: r.bars, phraseBar: +(r.bars % 8).toFixed(3), mode: `${r.prevMode}→${r.mode}`, fwd: Math.round(r.fwd), up: Math.round(r.up) }));
  return { byMode, top };
})));
await b.close(); srv.close();
