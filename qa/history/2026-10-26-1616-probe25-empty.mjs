// 2026-10-26 16:16 · 25 @9363bf0: "camera flies away and shows nothing" — per frame, march 25 rays over the picture (5×5 grid inside the FOV, 16:9)
// through the page's SDF; a frame is empty when no ray hits the shape within 6 units. Reports empty stretches ≥ 0.25 s and the share of the picture covered.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q27/x/experiments', R0 = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const p = await b.newPage(); await p.goto(`http://127.0.0.1:${srv.address().port}/25-shape-shifter-2.html`); await p.waitForTimeout(800);
console.log(JSON.stringify(await p.evaluate(() => {
  const add = (a, c, s = 1) => [a[0] + c[0] * s, a[1] + c[1] * s, a[2] + c[2] * s], cross = (a, c) => [a[1] * c[2] - a[2] * c[1], a[2] * c[0] - a[0] * c[2], a[0] * c[1] - a[1] * c[0]], nrm = a => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
  const step = 1 / 120, runs = [], by = {}; let cur = null, covSum = 0, n = 0;
  for (let t = 0; t < 96; t += step) {
    const c = __qa.camera(t), st = __qa.state(t), f = nrm(c.fwd), r = nrm(cross(f, c.up)), u = cross(r, f), th = Math.tan(((c.fov || 60) / 2) * Math.PI / 180), asp = 16 / 9;
    let hits = 0;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const sx = (i / 4 * 2 - 1) * 0.9 * th * asp, sy = (j / 4 * 2 - 1) * 0.9 * th, dir = nrm(add(add(f, r, sx), u, sy));
      let s = 0; for (let k = 0; k < 80 && s < 6; k++) { const d = sdfJS(st, ...add(c.eye, dir, s)); if (d < 0.002) { hits++; break; } s += Math.max(d, 0.004); }
    }
    covSum += hits / 25; n++;
    by[c.mode] ??= { frames: 0, empty: 0 }; by[c.mode].frames++;
    if (hits === 0) { by[c.mode].empty++; if (!cur) cur = { from: +t.toFixed(3), phraseBar: +(t % 8).toFixed(2), mode: c.mode }; cur.to = +t.toFixed(3); }
    else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  const long = runs.map(x => ({ ...x, secs: +((x.to - x.from + step) * 2).toFixed(2) })).filter(x => x.secs >= 0.25).sort((a, c) => c.secs - a.secs);
  return { byMode: by, meanCoverage: +(covSum / n).toFixed(3), emptyStretches: long.length, emptySecs: +long.reduce((s, x) => s + x.secs, 0).toFixed(1), longest: long.slice(0, 10) };
})));
await b.close(); srv.close();
