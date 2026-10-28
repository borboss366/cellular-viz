// HD test: frame times at 2560×1440 and 3840×2160 (Fullscreen layout, dpr 1) per scene.
//   node qa/check-hd.mjs <label>=<experiments dir>|<page>|<query> ...
// Pass mark (VIZ QA): at 1440p, p95 frame ≤ 16.7 ms (vsync). 4K is reported as headroom:
// vsync p95 plus uncapped fps (vsync and frame limit off). The page must keep animating
// (some __qa clock moves), else the numbers mean nothing.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = path.join(os.homedir(), 'qa-libs/root');
const env = { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` };
const base = ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'];
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const SIZES = { '1440p': [2560, 1440], '4K': [3840, 2160] };
const SECS = 15;

async function measure(browser, url, [w, h]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await page.addStyleTag({ content: FULL });
  await page.waitForTimeout(800);
  await page.click('#play').catch(() => {});
  await page.waitForTimeout(2500);
  const r = await page.evaluate(async secs => {
    const clk = () => { const q = window.__qa || {}; return q.tCam ?? q.simTime ?? q.beats ?? q.bars ?? null; };
    const c0 = clk(), t = []; let on = true;
    const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
    await new Promise(r => setTimeout(r, secs * 1000)); on = false;
    const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    const cv = document.querySelector('canvas');
    return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p50: +dt[dt.length >> 1].toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1),
      worst: +dt.at(-1).toFixed(1), under: +(100 * dt.filter(x => x <= 16.7).length / dt.length).toFixed(1), alive: clk() != null && clk() !== c0,
      canvas: [cv.width, cv.height], caught: ((window.__qa || {}).errors || []).length };
  }, SECS);
  await page.close();
  return { ...r, errors: errors.length };
}

const out = {};
for (const spec of process.argv.slice(2)) {
  const [label, rest] = spec.split('='), [dir, pageName, query] = rest.split('|');
  const server = http.createServer((q, res) => { const p = path.join(dir, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res); });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/${pageName}?${query}`;
  out[label] = {};
  let b = await chromium.launch({ env, args: base });
  for (const [k, size] of Object.entries(SIZES)) out[label][k] = await measure(b, url, size);
  await b.close();
  b = await chromium.launch({ env, args: [...base, '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
  out[label]['4K uncapped'] = await measure(b, url, SIZES['4K']);
  await b.close();
  server.close();
}
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, 'hd', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify(out, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(dir, 'check.md'), `# HD test · ${stamp} · Radeon 780M (integrated)\n\nPass: 1440p p95 frame ≤ 16.7 ms with vsync, page animating. 4K = headroom.\n\n` +
  `| scene | 1440p p95 (≤16.7 ms frames) | 1440p pass | 4K p95 (≤16.7 ms) | 4K uncapped fps | canvas at 4K | alive | errors |\n|---|---|---|---|---|---|---|---|\n` +
  Object.entries(out).map(([k, o]) => `| ${k} | ${o['1440p'].p95} ms (${o['1440p'].under}%) | ${ok(o['1440p'].p95 <= 16.8 && o['1440p'].alive)} | ${o['4K'].p95} ms (${o['4K'].under}%) | ${o['4K uncapped'].fps} | ${o['4K'].canvas.join('×')} | ${[o['1440p'].alive, o['4K'].alive].every(Boolean) ? 'yes' : '**NO**'} | ${o['1440p'].errors + o['4K'].errors + o['1440p'].caught + o['4K'].caught} |`).join('\n') + '\n');
console.log(dir);
