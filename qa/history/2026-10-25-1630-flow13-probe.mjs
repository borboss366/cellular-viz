// 2026-10-25 16:30 · 13 Flow Lab @f73683a follow-up: (a) lock at 120 BPM over 60 s (zero-crossing resolution ±1/60 Hz),
// (b) curl look raw dye drift at the adaptive budget vs fixed 120 iterations vs no hit splats.   run: sh qa/history/2026-10-25-1630-flow13-probe.sh
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q19/x/experiments', R = os.homedir() + '/qa-libs/root';
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const srv = http.createServer((qq, r) => { const p = path.join(root, path.basename(new URL(qq.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const open = async q => { const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto(`http://127.0.0.1:${srv.address().port}/13-flow-lab.html?${q}`); await p.waitForTimeout(800); await p.click('#play'); return p; };
for (const q of ['preset=vortex&probe=1&bpm=120', 'preset=vortex&probe=1&bpm=120&lock=0']) {
  const p = await open(q); await p.waitForTimeout(12000);
  console.log(q, JSON.stringify(await p.evaluate(async () => { const c = st.cur.obstacles[0], d = 2 * c.r * F.simH / F.simW, s = []; const t0 = performance.now();
    await new Promise(done => { const f = () => { s.push({ t: performance.now() / 1000, v: __qa.probe(c.x + 3 * d, c.y).v }); if (performance.now() - t0 < 60000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const m = s.reduce((a, p) => a + p.v, 0) / s.length, ups = []; for (let i = 1; i < s.length; i++) if (s[i-1].v < m && s[i].v >= m) ups.push(s[i-1].t + (m - s[i-1].v) / (s[i].v - s[i-1].v) * (s[i].t - s[i-1].t));
    return { want: settings.bpm / 120, got: +((ups.length - 1) / (ups.at(-1) - ups[0])).toFixed(4), cycles: ups.length - 1, secs: +(ups.at(-1) - ups[0]).toFixed(1) }; })));
  await p.close();
}
for (const q of ['preset=curl&conserve=0&dissipation=0', 'preset=curl&conserve=0&dissipation=0&adaptive=0&pressureIters=120']) {
  const p = await open(q);
  console.log(q, JSON.stringify(await p.evaluate(async () => { await new Promise(r => setTimeout(r, 4000)); __qa.sourcesOff(); st.cur.music = { kick: 'none', snare: 'none', downbeat: 'none' };
    const sum = () => { const d = readTarget(F.dye.a); let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i+1] + d[i+2]; return s; };
    await new Promise(r => setTimeout(r, 1200)); const m0 = sum(), t0 = performance.now(); await new Promise(r => setTimeout(r, 20000));
    return { per10s: +((sum() - m0) / m0 / ((performance.now() - t0) / 1000) * 10 * 100).toFixed(2), iters: __qa.iters, walls: st.walls, div: +(__qa.divergenceRMS().rel * 100).toFixed(2) }; })));
  await p.close();
}
await b.close(); srv.close();
