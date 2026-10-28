// Canyon-only extras for PR #41: per build (dir), (a) 30 s fps at 1920×1080 with vsync (as shipped),
// (b) uncapped fps (vsync + frame limit off) = GPU headroom, (c) pixel change between screenshots 0.7 s apart,
// (d) every console message (any level) mentioning shader/compile/link/GL, plus page errors.
//   node qa/check-canyon41.mjs <label>=<experiments dir> ...
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
const R = path.join(os.homedir(), 'qa-libs/root');
const env = { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` };
const base = ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'];
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}#hud{visibility:hidden !important}';
const out = {};
for (const spec of process.argv.slice(2)) {
  const [label, dir] = spec.split('=');
  const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(path.join(dir, '11-riemann-show.html')).pipe(r); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/11-riemann-show.html?scene=canyon`;
  const res = out[label] = {};
  for (const mode of ['vsync', 'uncapped']) {
    const browser = await chromium.launch({ env, args: mode === 'vsync' ? base : [...base, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const msgs = [], errs = [];
    page.on('console', m => { msgs.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(url); await page.addStyleTag({ content: FULL });
    await page.waitForTimeout(800); await page.click('#play').catch(() => {}); await page.waitForTimeout(1500);
    const secs = mode === 'vsync' ? 30 : 15;
    res[mode] = await page.evaluate(async secs => {
      const t = []; let on = true; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      const cam0 = __qa.tCam; await new Promise(r => setTimeout(r, secs * 1000)); on = false;
      const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), median: +dt[dt.length >> 1].toFixed(2), p99: +dt[Math.floor(dt.length * 0.99)].toFixed(1),
        worst: +dt.at(-1).toFixed(1), over20ms: dt.filter(x => x > 20).length, frames: t.length, alive: __qa.tCam !== cam0, caught: (__qa.errors || []).length, scene: __qa.scene };
    }, secs);
    if (mode === 'vsync') {
      const shots = []; for (let i = 0; i < 13; i++) { shots.push((await page.screenshot()).toString('base64')); await page.waitForTimeout(700); }
      res.motion = await page.evaluate(async shots => {
        const get = async b => { const im = new Image(); im.src = 'data:image/png;base64,' + b; await im.decode(); const c = new OffscreenCanvas(480, 270), x = c.getContext('2d'); x.drawImage(im, 0, 0, 480, 270); return x.getImageData(0, 0, 480, 270).data; };
        const ds = []; for (const s of shots) ds.push(await get(s));
        const o = []; for (let i = 1; i < ds.length; i++) { let s = 0, ch = 0; const n = ds[i].length / 4;
          for (let j = 0; j < ds[i].length; j += 4) { const a = Math.abs(ds[i][j] - ds[i - 1][j]) + Math.abs(ds[i][j + 1] - ds[i - 1][j + 1]) + Math.abs(ds[i][j + 2] - ds[i - 1][j + 2]); s += a; if (a > 24) ch++; }
          o.push({ meanDiff: +(s / n / 3).toFixed(2), changed: +(ch / n).toFixed(3) }); }
        const m = k => +(o.reduce((a, b) => a + b[k], 0) / o.length).toFixed(3);
        return { pairs: o.length, meanDiff: m('meanDiff'), changed: m('changed'), changedMin: Math.min(...o.map(x => x.changed)), changedMax: Math.max(...o.map(x => x.changed)) };
      }, shots);
      fs.writeFileSync(`/tmp/canyon-${label}.png`, Buffer.from(shots.at(-1), 'base64'));
    }
    res[mode + 'Console'] = msgs.filter(m => /shader|compile|link|GL_|WebGL|glsl|error/i.test(m));
    res[mode + 'PageErrors'] = errs;
    await browser.close();
  }
  server.close();
}
console.log(JSON.stringify(out, null, 1));
