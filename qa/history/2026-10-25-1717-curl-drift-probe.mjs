// curl look @40f2885: is the raw dye drift the advection itself? Drift per 10 s vs flow speed (wind) and eddy size (octaves),
// plus my own MAC divergence of the curl field and dye on the wall rows.   run: sh <same name>.sh [experiments dir]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q20/x/experiments', R = os.homedir() + '/qa-libs/root';
const b = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const srv = http.createServer((qq, r) => { const p = path.join(root, path.basename(new URL(qq.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
for (const q of ['', '&wind=45', '&wind=22.5', '&octaves=1', '&noiseScale=1.1']) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto(`http://127.0.0.1:${srv.address().port}/13-flow-lab.html?preset=curl&conserve=0&dissipation=0${q}`); await p.waitForTimeout(800); await p.click('#play');
  console.log(q || 'default', JSON.stringify(await p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 4000)); __qa.sourcesOff(); st.cur.music = { kick: 'none', snare: 'none', downbeat: 'none' };
    const sum = () => { const d = readTarget(F.dye.a); let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i+1] + d[i+2]; return s; };
    const div = () => { const W = F.simW, H = F.simH, v = readTarget(F.vel.a); let s2 = 0, sp = 0, mx = 0, wallN = 0;
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const uL = i ? v[(j*W+i)*4] : 0, uR = i < W-1 ? v[(j*W+i+1)*4] : 0, vB = j ? v[(j*W+i)*4+1] : 0, vT = j < H-1 ? v[((j+1)*W+i)*4+1] : 0;
        const d = uR - uL + vT - vB; s2 += d*d; sp += Math.hypot(uL, vB); }
      for (let i = 0; i < W; i++) wallN = Math.max(wallN, Math.abs(v[i*4+1])); for (let j = 0; j < H; j++) wallN = Math.max(wallN, Math.abs(v[(j*W)*4]));
      return { rel: Math.sqrt(s2 / (W*H)) / (sp / (W*H)), mean: sp / (W*H), wallNormalMax: wallN }; };
    await new Promise(r => setTimeout(r, 1200)); const m0 = sum(), t0 = performance.now(), d0 = div();
    await new Promise(r => setTimeout(r, 20000));
    return { per10s: +((sum() - m0) / m0 / ((performance.now() - t0) / 1000) * 10 * 100).toFixed(2), divRel: +d0.rel.toExponential(2), meanSpeed: +d0.mean.toFixed(1), wallNormalMax: +d0.wallNormalMax.toFixed(3), cflMax: null }; })));
  await p.close();
}
await b.close(); srv.close();
