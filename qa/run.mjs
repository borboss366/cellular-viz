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
const expRoot = args.experiments ? path.resolve(args.experiments) : null;
const tag = args.tag ? String(args.tag).replace(/[^\w-]+/g, '-') : '';

// qa folder: existing one with the same number prefix, else the experiment name
const num = exp.slice(0, 3);
const expDir = fs.readdirSync(here).find(d => d.startsWith(num) && fs.statSync(path.join(here, d)).isDirectory())
  || exp.replace(/\.html$/, '');
const pad = n => String(n).padStart(2, '0');
const now = new Date();
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
const out = path.join(here, expDir, 'runs', stamp + (tag ? '-' + tag : ''));
fs.mkdirSync(path.join(out, 'stills'), { recursive: true });
fs.mkdirSync(path.join(out, 'videos'), { recursive: true });

// ---- static server for the repo (same origin, so the harness can read the iframe canvas) ----
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // --experiments <dir>: test another branch's pages with this branch's harness
  const root = expRoot && rel.startsWith('/experiments/') ? path.dirname(expRoot) : repo;
  const p = path.join(root, rel.startsWith('/experiments/') && expRoot ? rel.replace(/^\/experiments/, '/' + path.basename(expRoot)) : rel);
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
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
const series = {};
const blends = {}; // label → [t s, phase, fps, switches] from 08 Blend // label → page Auto state over the recording: [t s, cover, coverSmooth, sigma]
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
  if (m) {
    const f = page.frames().find(x => x.url().includes('/experiments/'));
    const a = f && await f.evaluate(() => typeof auto === 'undefined' ? null
      : [+(auto.cover ?? -1).toFixed(4), +(auto.coverSmooth ?? -1).toFixed(4), +(auto.sigma ?? 0).toFixed(5)]).catch(() => null);
    if (a) (series[m[2]] ??= { t0: Date.now(), pts: [] }).pts.push([+((Date.now() - series[m[2]].t0) / 1000).toFixed(2), ...a]);
    // 08 Blend: phase of the show and its own fps
    const b = f && await f.evaluate(() => typeof show === 'undefined' || typeof fps === 'undefined' ? null
      : [show.phase, fps, show.switches]).catch(() => null);
    if (b) (blends[m[2]] ??= { t0: Date.now(), pts: [] }).pts.push([+((Date.now() - blends[m[2]].t0) / 1000).toFixed(2), ...b]);
  }
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
  if (series[r.label]) { r.autoSeries = series[r.label].pts; r.coverStats = coverStats(r.autoSeries); }
  if (blends[r.label]) { r.blendSeries = blends[r.label].pts; r.blendStats = blendStats(r.blendSeries, r.series || []); }
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
const withCover = results.filter(r => r.coverStats);  // null when the page never measured
if (withCover.length) fs.appendFileSync(path.join(out, 'report.md'),
  `\n## Cover over time (page's own Auto cover, sampled ~5×/s)\n\n` +
  `| variant | mean | min | time < 10% | longest < 10% | time < 3% | longest < 3% | 40→10% drops (s) |\n|---|---|---|---|---|---|---|---|\n` +
  withCover.map(r => { const c = r.coverStats;
    return `| ${r.label} | ${c.mean}% | ${c.min}% | ${c.under10}% | ${c.longest10} s | ${c.under3}% | ${c.longest3} s | ${c.drops.length ? c.drops.join(', ') : '—'} |`; }).join('\n') + '\n');
const withBlend = results.filter(r => r.blendStats);
if (withBlend.length) fs.appendFileSync(path.join(out, 'report.md'),
  `\n## Switches (08 Blend; picture sampled 4×/s, page fps 5×/s)\n\n` +
  `| variant | switches | fps hold (median / min) | fps during switch (median / min) | lit min, hold | lit min, switch | samples < 3% lit |\n|---|---|---|---|---|---|---|\n` +
  withBlend.map(r => { const b = r.blendStats;
    return `| ${r.label} | ${b.switches} | ${b.fpsHold.join(' / ')} | ${b.fpsBlend.join(' / ')} | ${b.litHold}% | ${b.litBlend}% | ${b.dark} |`; }).join('\n') + '\n');
fs.writeFileSync(path.join(out, 'console.log'), log.join('\n') + '\n');

await browser.close();
server.close();
console.log(out);

// share of time under a cover level, longest stretch under it, and how long each fall from ≥40% to <10% took
function coverStats(pts) {
  pts = pts.filter(p => p[1] >= 0);                 // -1 = page hasn't measured yet
  if (!pts.length) return null;
  const t = pts.map(p => p[0]), c = pts.map(p => p[1]);
  const span = (t.at(-1) - t[0]) || 1;
  const under = lvl => { let tot = 0, run = 0, best = 0;
    for (let i = 1; i < c.length; i++) { const dt = t[i] - t[i - 1];
      if (c[i] < lvl) { tot += dt; run += dt; best = Math.max(best, run); } else run = 0; }
    return [+(100 * tot / span).toFixed(1), +best.toFixed(1)]; };
  const drops = []; let hi = null;
  for (let i = 0; i < c.length; i++) {
    if (c[i] >= 0.40) hi = t[i];
    else if (c[i] < 0.10 && hi !== null) { drops.push(+(t[i] - hi).toFixed(1)); hi = null; }
  }
  const [u10, l10] = under(0.10), [u3, l3] = under(0.03);
  return { samples: c.length, mean: +(100 * c.reduce((a, b) => a + b, 0) / c.length).toFixed(1), min: +(100 * Math.min(...c)).toFixed(1),
    max: +(100 * Math.max(...c)).toFixed(1), under10: u10, longest10: l10, under3: u3, longest3: l3, drops };
}

function blendStats(bs, lum) {
  const med = a => a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : '—';
  const pick = ph => bs.filter(p => (p[1] === 'blend') === ph).map(p => p[2]).filter(x => x > 0);
  const phaseAt = t => { let ph = bs[0]?.[1]; for (const p of bs) { if (p[0] > t) break; ph = p[1]; } return ph; };
  const litIn = blend => lum.filter(l => (phaseAt(l[0]) === 'blend') === blend).map(l => l[1]);
  const mn = a => a.length ? +(100 * Math.min(...a)).toFixed(0) : '—';
  return { switches: (bs.at(-1)?.[3] ?? 0) - (bs[0]?.[3] ?? 0),
    fpsHold: [med(pick(false)), pick(false).length ? Math.min(...pick(false)) : '—'],
    fpsBlend: [med(pick(true)), pick(true).length ? Math.min(...pick(true)) : '—'],
    litHold: mn(litIn(false)), litBlend: mn(litIn(true)), dark: lum.filter(l => l[1] < 0.03).length };
}
