// 13 Flow Lab: vortex street rate over 60 s (zero-crossing resolution ≈ ±1.7 %, finer than the ±5 % gate) at 90/120/150 BPM, push on and off, shipped defaults.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q21/x/experiments', R = os.homedir() + '/qa-libs/root';
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const srv = http.createServer((qq, r) => { const p = path.join(root, path.basename(new URL(qq.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
for (const lock of [1, 0]) for (const bpm of [90, 120, 150]) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(`http://127.0.0.1:${srv.address().port}/13-flow-lab.html?preset=vortex&probe=1&bpm=${bpm}${lock ? '' : '&lock=0'}`); await p.waitForTimeout(800); await p.click('#play'); await p.waitForTimeout(12000);
  const r = await p.evaluate(async () => { const c = st.cur.obstacles[0], d = 2 * c.r * F.simH / F.simW, s = []; const t0 = performance.now();
    await new Promise(done => { const f = () => { s.push({ t: performance.now() / 1000, v: __qa.probe(c.x + 3 * d, c.y).v }); if (performance.now() - t0 < 60000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const m = s.reduce((a, p) => a + p.v, 0) / s.length, ups = []; for (let i = 1; i < s.length; i++) if (s[i-1].v < m && s[i].v >= m) ups.push(s[i-1].t + (m - s[i-1].v) / (s[i].v - s[i-1].v) * (s[i].t - s[i-1].t));
    const f = (ups.length - 1) / (ups.at(-1) - ups[0]), want = settings.bpm / 120; return { want, got: +f.toFixed(4), off: +((f / want - 1) * 100).toFixed(1), cycles: ups.length - 1 }; });
  console.log(JSON.stringify({ bpm, lock: !!lock, ...r })); await p.close();
}
await b.close(); srv.close();
