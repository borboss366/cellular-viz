// 2026-10-26 08:15 · 14 Round Point (patched copy): (a) neck radius per keyframe with a parabola through the 3 lowest samples
// (removes the 96-point resampling jitter), (b) where L²/4πA rises at the end of a curve section, vs area and vertex count.
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q24/x/experiments', R = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
let p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`http://127.0.0.1:${srv.address().port}/14-round-point.html?scene=pinch`); await p.click('#play');
console.log('neck', JSON.stringify(await p.evaluate(async () => {
  await new Promise(r => { const f = () => (pinch.sim) ? r() : requestAnimationFrame(f); f(); });
  const fr = pinch.sim.frames.filter(f => f.pieces.length === 1), neck = fr.map(f => { const P = f.pieces[0], pts = []; for (let i = 0; i < P.length; i += 3) pts.push([P[i], P[i + 1]]);
    let k = 1; for (let i = 1; i < pts.length - 1; i++) if (Math.abs(pts[i][0]) < 0.35 && pts[i][1] < pts[k][1]) k = i;
    const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], [x2, y2] = pts[k + 1];   // parabola through the three points around the lowest one
    const den = (x0 - x1) * (x0 - x2) * (x1 - x2), A = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / den, B = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / den, C = (x1 * x2 * (x1 - x2) * y0 + x2 * x0 * (x2 - x0) * y1 + x0 * x1 * (x0 - x1) * y2) / den;
    return A > 0 ? C - B * B / (4 * A) : y1; });
  let up = 0, at = -1; for (let i = 1; i < neck.length; i++) if (neck[i] - neck[i - 1] > up) { up = neck[i] - neck[i - 1]; at = i; }
  return { frames: neck.length, first: neck[0], last: neck.at(-1), maxRise: up, riseAtFrame: at, ofFrames: neck.length }; })));
await p.close(); p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(`http://127.0.0.1:${srv.address().port}/14-round-point.html?scene=curve&kicks=0`); await p.click('#play');
console.log('iso', JSON.stringify(await p.evaluate(async () => {
  const area = P => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };
  const len = P => { let s = 0; for (let i = 0, n = P.length; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; s += Math.hypot(b[0] - a[0], b[1] - a[1]); } return s; };
  const k0 = __qa.section; await new Promise(r => { const f = () => (__qa.section !== k0 && __qa.alive) ? r() : requestAnimationFrame(f); f(); });
  const k = __qa.section, s = []; await new Promise(done => { const f = () => { if (__qa.section !== k) return done(); const P = __qa.polygon; if (P && __qa.alive) { const A = area(P), L = len(P); s.push({ bars: __qa.bars, A, iso: L * L / (4 * Math.PI * A), n: P.length }); } requestAnimationFrame(f); }; f(); });
  const A0 = s[0].A, rises = []; for (let i = 1; i < s.length; i++) if (s[i].iso > s[i - 1].iso + 1e-9) rises.push({ bars: +s[i].bars.toFixed(3), rise: +(s[i].iso - s[i - 1].iso).toExponential(2), areaShare: +(s[i].A / A0).toExponential(2), n: s[i].n });
  return { frames: s.length, rises: rises.slice(-12), risesAboveOnePercentArea: rises.filter(r => r.areaShare > 0.01).length }; })));
await b.close(); srv.close();
