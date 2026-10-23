// Headless QA sweep: drives qa/harness.html in Chromium and writes
// qa/<exp-folder>/runs/<YYYY-MM-DD-HHMM>/ with results.json, report.md,
// one PNG still per variant, console.log and (git-ignored) .webm videos.
//
//   node qa/run.mjs --exp 06-lenia-effects.html [--variants file.txt] [--warm 4] [--dur 12]
//
// --variants: same lines as the harness textarea (label :: query ::tap).
// Without it the harness defaults are used.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');

// ---- args ----
const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => {
  if (x.startsWith('--')) a.push([x.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return a;
}, []));
const exp = args.exp || '06-lenia-effects.html';
const warm = +(args.warm ?? 4), dur = +(args.dur ?? 12);
const variants = args.variants ? fs.readFileSync(args.variants, 'utf8') : null;

// qa folder: existing one with the same number prefix, else the experiment name
const num = exp.slice(0, 3);
const expDir = fs.readdirSync(here).find(d => d.startsWith(num) && fs.statSync(path.join(here, d)).isDirectory())
  || exp.replace(/\.html$/, '');
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const out = path.join(here, expDir, 'runs', stamp);
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
fs.mkdirSync(path.join(out, 'videos'), { recursive: true });

// ---- static server for the repo (same origin, so the harness can read the iframe canvas) ----
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(repo, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(repo) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// ---- browser ----
// GPU only when the container got the render node (--device /dev/dri/renderD128) and --gpu off isn't set
const renderNode = '/dev/dri/renderD128';
const hasGpu = args.gpu !== 'off' && fs.existsSync(renderNode);
const flags = ['--autoplay-policy=no-user-gesture-required'];
if (hasGpu) flags.push('--use-angle=gl-egl', '--ignore-gpu-blocklist', '--enable-gpu-rasterization');
else flags.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
// libs unpacked without root (see qa/README.md, "Headless on the box")
const libs = [path.join(os.homedir(), 'qa-libs/root/usr/lib/x86_64-linux-gnu'), path.join(os.homedir(), 'qa-libs/root/lib/x86_64-linux-gnu')].filter(fs.existsSync);
const env = { ...process.env };
if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
// Mesa unpacked into ~/qa-libs too (radeonsi for the Radeon 780M); point GLVND and the DRI loader at it
const mesa = path.join(os.homedir(), 'qa-libs/root');
if (hasGpu && fs.existsSync(path.join(mesa, 'usr/share/glvnd/egl_vendor.d'))) {
  env.__EGL_VENDOR_LIBRARY_DIRS = path.join(mesa, 'usr/share/glvnd/egl_vendor.d');
  env.LIBGL_DRIVERS_PATH = path.join(mesa, 'usr/lib/x86_64-linux-gnu/dri');
}
const fontsConf = path.join(os.homedir(), 'qa-libs/fonts.conf');
if (!env.FONTCONFIG_FILE && fs.existsSync(fontsConf)) env.FONTCONFIG_FILE = fontsConf;

const browser = await chromium.launch({ args: flags, env });
const page = await browser.newPage({ viewport: { width: 720, height: 1100 } });
const log = [];
const t0 = Date.now();
const note = (kind, text) => log.push(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${kind}: ${text}`);
page.on('console', m => note(`console.${m.type()}`, m.text()));
page.on('pageerror', e => note('pageerror', e.message));
page.on('requestfailed', r => note('requestfailed', r.url()));

await page.goto(`${base}/qa/harness.html`);
const renderer = await page.evaluate(() => {
  const g = document.createElement('canvas').getContext('webgl2');
  if (!g) return 'no webgl2';
  const d = g.getExtension('WEBGL_debug_renderer_info');
  return g.getParameter(d ? d.UNMASKED_RENDERER_WEBGL : g.RENDERER);
});
note('info', `chromium ${browser.version()} · renderer ${renderer}`);

// experiments the harness doesn't list yet (a fresh PR) get an option added on the fly
await page.evaluate(e => { const s = document.getElementById('exp');
  if (![...s.options].some(o => o.value === e)) s.add(new Option(e, e), s.options.length - 1); }, exp);
await page.selectOption('#exp', exp);
if (variants) await page.fill('#variants', variants);
await page.fill('#warm', String(warm));
await page.fill('#dur', String(dur));
const nVariants = await page.evaluate(() => parseVariants().length);
note('info', `sweep ${exp} · ${nVariants} variants · warm ${warm}s · record ${dur}s`);
await page.click('#run');

// ---- drive the sweep: press Play when asked, grab a still mid-recording ----
const frame = page.frameLocator('#frame');
const stills = new Set();
const huds = {};
let lastStatus = '';
const deadline = Date.now() + nVariants * (warm + dur + 30) * 1000 + 60000;
while (Date.now() < deadline) {
  const st = await page.textContent('#status');
  if (st !== lastStatus && !st.includes('recording')) { note('harness', st.replace(/\n/g, ' | ')); lastStatus = st; }
  if (st.startsWith('done')) break;
  if (await page.isVisible('#overlay')) {
    // the overlay covers the iframe: let clicks through it, press Play for real, then Continue
    await page.evaluate(() => { document.getElementById('overlay').style.pointerEvents = 'none'; });
    const play = frame.locator('#play');
    if (await play.count()) await play.click({ timeout: 5000 }).catch(e => note('warn', 'play click: ' + e.message.split('\n')[0]));
    else note('warn', 'no #play in experiment; continuing without it');
    await page.evaluate(() => { document.getElementById('overlay').style.pointerEvents = ''; });
    await page.click('#overlayGo');
  }
  const m = st.match(/^\[(\d+)\/\d+\] (.+)\nrecording (\d+)\//);
  if (m && +m[3] >= dur / 2 && !stills.has(m[1])) {
    stills.add(m[1]);
    const file = path.join(out, 'stills', `${pad(+m[1])}-${m[2].replace(/[^\w-]+/g, '-')}.png`);
    await frame.locator('canvas').first().screenshot({ path: file }).catch(e => note('warn', 'still: ' + e.message));
    // the experiment's own info box (fps, sim cost, mass…) if it has one
    const hud = await frame.locator('#hud').first().textContent({ timeout: 1000 }).catch(() => null);
    if (hud) { huds[m[2]] = hud.trim(); note('hud', `${m[2]}: ${hud.trim().replace(/\n/g, ' | ')}`); }
  }
  await page.waitForTimeout(200);
}

// ---- collect ----
const results = await page.evaluate(() => results.map(({ videoUrl, ...r }) => r));
const reportMd = await page.evaluate(() => report());
const videos = await page.evaluate(async () => Promise.all(results.map(async r => {
  if (!r.videoUrl) return null;
  const b = await (await fetch(r.videoUrl)).blob();
  const buf = new Uint8Array(await b.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
})));
results.forEach((r, i) => {
  if (huds[r.label]) r.hud = huds[r.label];
  if (!videos[i]) return;
  const f = `${pad(i + 1)}-${r.label.replace(/[^\w-]+/g, '-')}.webm`;
  fs.writeFileSync(path.join(out, 'videos', f), Buffer.from(videos[i], 'base64'));
  r.video = `videos/${f}`;
});

const meta = {
  exp, stamp, warm, dur, host: os.hostname(), cpu: os.cpus()[0]?.model, gpu: hasGpu ? `${renderNode} (ANGLE gl-egl, Mesa)` : 'none (SwiftShader software GL)',
  chromium: browser.version(), renderer, note: !hasGpu ? 'fps is software-rendered and says nothing about the phone'
    : /SwiftShader|llvmpipe/i.test(renderer) ? 'render node present but Chromium fell back to software GL; fps not comparable' : '',
};
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ meta, results }, null, 1));
fs.writeFileSync(path.join(out, 'report.md'),
  `# ${exp} · headless run ${stamp}\n\n` +
  `- box: ${meta.host} · ${meta.cpu}\n- GPU: ${meta.gpu}\n- Chromium ${meta.chromium} · ${renderer}\n- warm-up ${warm}s · record ${dur}s\n` +
  (meta.note ? `- ⚠ ${meta.note}\n` : '') + `\n${reportMd}\n\nStills: \`stills/\` · videos stay on the box (\`videos/\`, git-ignored).\n`);
fs.writeFileSync(path.join(out, 'console.log'), log.join('\n') + '\n');

await browser.close();
server.close();
console.log(out);
