// 2026-10-26 16:12 · 25 @9363bf0: when does the shape leave the picture? per frame: angle between the view and the shape's centre vs half the vertical FOV, distance to the centre, by camera mode
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q27/x/experiments', R0 = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.goto(`http://127.0.0.1:${srv.address().port}/25-shape-shifter-2.html`); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const sub = (a, c) => [a[0] - c[0], a[1] - c[1], a[2] - c[2]], dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2], len = a => Math.hypot(...a);
  const step = 1 / 120, runs = [], by = {}; let cur = null;
  for (let t = 0; t < 96; t += step) {
    const c = __qa.camera(t), st = __qa.state(t), toC = sub(st.center, c.eye), d = len(toC);
    const off = Math.acos(Math.max(-1, Math.min(1, dot(toC, c.fwd) / (d * len(c.fwd))))) * 180 / Math.PI, half = (c.fov || 60) / 2;
    const out = off > half;   // the shape's centre is outside the picture (vertical half-FOV, conservative)
    by[c.mode] ??= { frames: 0, out: 0 }; by[c.mode].frames++; if (out) by[c.mode].out++;
    if (out) { if (!cur) cur = { from: +t.toFixed(3), phraseBar: +(t % 8).toFixed(2), mode: c.mode, maxOff: 0, maxDist: 0 }; cur.to = +t.toFixed(3); cur.maxOff = Math.max(cur.maxOff, Math.round(off)); cur.maxDist = Math.max(cur.maxDist, +d.toFixed(2)); }
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  const long = runs.map(r => ({ ...r, secs: +((r.to - r.from) * 2).toFixed(2) })).filter(r => r.secs >= 0.25).sort((a, c) => c.secs - a.secs);
  return { byMode: by, stretchesOver250ms: long.length, totalOutSecs: +(long.reduce((s, r) => s + r.secs, 0)).toFixed(1), longest: long.slice(0, 8) };
})));
await b.close(); srv.close();
