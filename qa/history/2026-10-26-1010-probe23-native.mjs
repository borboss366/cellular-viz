// 2026-10-26 10:10 · 23 Shape Shifter: fps with ?res=native (no 1080p render cap) at 1440p and 4K
import { chromium } from 'playwright'; import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const root = process.argv[2] || '/tmp/q26/x/experiments', R0 = os.homedir() + '/qa-libs/root';
const srv = http.createServer((q, r) => { const p = path.join(root, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: os.homedir() + '/qa-libs/fonts.conf', __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--use-angle=gl-egl', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
for (const [w, h] of [[2560, 1440], [3840, 2160]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } });
  await p.goto(`http://127.0.0.1:${srv.address().port}/23-shape-shifter.html?family=auto&res=native`);
  await p.addStyleTag({ content: '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}' }); await p.waitForTimeout(800); await p.click('#play'); await p.waitForTimeout(2000);
  console.log(w + 'x' + h, JSON.stringify(await p.evaluate(async () => { const t = []; let on = true; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
    await new Promise(r => setTimeout(r, 8000)); on = false; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] }; })));
  await p.close();
}
await browser.close(); srv.close();
