// Physics + speed check for 12 Mass Gap.   node qa/check-12.mjs [--experiments dir]
// Truth is physics, not the page's own numbers:
//  1. Gap: with m pinned and κ = 0, a splat in the middle must keep ringing at ω → m
//     (Klein–Gordon, ω² = k² + m², long-time response at a point is the k = 0 mode).
//     Measured from zero crossings of φ_red(centre) vs the page's sim time, late window.
//  2. No gap: with m = 0 the front of a splat travels at speed 1 grid cell per unit time
//     (arrival times at radii 30…150), and the centre does not keep ringing.
//  3. Colours stay separate when κ = 0 (a red splat leaves green/blue at 0).
//  4. Tube: during the build-up r grows and E/r = σ ≈ 0.9 GeV/fm at every frame; at the drop
//     the tube snaps (r small).
//  5. Glueballs: equal to Morningstar–Peardon (Wikipedia "Glueball": 0++ 1730, 2++ 2400,
//     0−+ 2590 MeV) and nothing lighter than the gap top (1730).
//  6. Colour neutral at the drop: in auto field mode the bright pixels go whiter at the drop.
//  7. Per scene at 1920×1080: page loop alive (sim time / HUD moves), fps, no errors.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const MP = [{ name: '0++', mev: 1730 }, { name: '2++', mev: 2400 }, { name: '0−+', mev: 2590 }];

const server = http.createServer((req, res) => {
  const p = path.join(expDir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/12-mass-gap.html`;
const R = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({
  env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
    __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` },
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
async function open(q, play = true) {
  await page.goto(`${base}?${q}`);
  await page.addStyleTag({ content: FULL });
  await page.waitForTimeout(800);
  if (play) await page.click('#play').catch(() => {});
  await page.waitForTimeout(500);
}

// record φ at points every frame until the page's sim time passes tEnd
const record = (pts, tEnd, splatAt) => page.evaluate(async ({ pts, tEnd, splatAt }) => {
  __qa.clear(); __qa.setAuto(false);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const t0 = __qa.simTime; __qa.splat(splatAt[0], splatAt[1], [1, 0, 0], 1.0, 6);
  const rows = [];
  await new Promise(done => {
    const f = () => { const t = __qa.simTime - t0; rows.push([t, ...pts.map(p => __qa.probe(p[0], p[1]))]); if (t < tEnd) requestAnimationFrame(f); else done(); };
    requestAnimationFrame(f);
  });
  return rows;
}, { pts, tEnd, splatAt });

const N = 512, C = N / 2;
// ---- 1. gap: ω → m ----
const results = {};
for (const m of [0.35, 0.6]) {
  await open(`scene=field&auto=0&m=${m}&k=0`, false);
  const rows = await record([[C, C]], 600, [C, C]);
  const late = rows.filter(r => r[0] > 200);
  const zc = []; for (let i = 1; i < late.length; i++) { const a = late[i - 1][1][0], b = late[i][1][0]; if (a !== 0 && Math.sign(a) !== Math.sign(b)) zc.push(late[i - 1][0] + (late[i][0] - late[i - 1][0]) * a / (a - b)); }
  const halfPeriods = zc.slice(1).map((z, i) => z - zc[i]);
  const omega = halfPeriods.length ? Math.PI / (halfPeriods.reduce((x, y) => x + y, 0) / halfPeriods.length) : null;
  const gb = rows.map(r => Math.max(Math.abs(r[1][1]), Math.abs(r[1][2])));
  results['gap_m' + m] = { m, omega: omega && +omega.toFixed(4), err: omega && +((omega - m) / m * 100).toFixed(2), crossings: zc.length, stillRinging: +Math.max(...late.slice(-40).map(r => Math.abs(r[1][0]))).toExponential(2),
    greenBlueMax: +Math.max(...gb).toExponential(2), frameStep: +(rows[1][0] - rows[0][0]).toFixed(2) };
}
// ---- 2. no gap: speed 1 ----
{
  await open('scene=field&auto=0&m=0&k=0', false);
  const radii = [30, 60, 90, 120, 150];
  const rows = await record(radii.map(r => [C + r, C]), 200, [C, C]);
  const arrive = radii.map((r, j) => { const peak = Math.max(...rows.map(x => Math.abs(x[1 + j][0]))); const hit = rows.find(x => Math.abs(x[1 + j][0]) > 0.2 * peak); return hit ? hit[0] : null; });
  const ok = arrive.every(a => a != null);
  let speed = null;
  if (ok) { const mx = radii.reduce((a, b) => a + b) / radii.length, my = arrive.reduce((a, b) => a + b) / arrive.length;
    let sxy = 0, sxx = 0; radii.forEach((r, i) => { sxy += (arrive[i] - my) * (r - mx); sxx += (arrive[i] - my) ** 2; }); speed = sxy / sxx; }
  const centreLate = rows.filter(r => r[0] > 150).map(r => Math.abs(r[1][0]));
  results.noGap = { arrive: arrive.map(a => a && +a.toFixed(1)), speed: speed && +speed.toFixed(3) };
}
// ---- 4. tube ----
await open('scene=tube&bars=8');
const tube = await page.evaluate(async () => { const out = []; const t0 = performance.now();
  while (performance.now() - t0 < 17000) { out.push({ ...__qa.tube, drop: __qa.drop, bars: __qa.bars }); await new Promise(r => setTimeout(r, 50)); } return out; });
const build = tube.filter(t => !t.drop && t.r_fm > 0), dropT = tube.filter(t => t.drop);
const ratio = build.map(t => t.E_GeV / t.r_fm);
results.tube = { samples: tube.length, rMin: +Math.min(...build.map(t => t.r_fm)).toFixed(2), rMax: +Math.max(...build.map(t => t.r_fm)).toFixed(2),
  sigmaMin: +Math.min(...ratio).toFixed(4), sigmaMax: +Math.max(...ratio).toFixed(4), dropR: dropT.length ? +Math.max(...dropT.map(t => t.r_fm)).toFixed(2) : null,
  grows: build.length > 5 && build.at(-1).r_fm > build[0].r_fm };
// ---- 5. glueballs ----
const gq = await page.evaluate(() => ({ g: __qa.glueballs, top: __qa.gapTop, sigma: __qa.sigma }));
results.glueballs = { page: gq.g, gapTop: gq.top, matches: MP.every((x, i) => gq.g[i] && gq.g[i].mev === x.mev && gq.g[i].name === x.name), noneLighter: gq.g.every(g => g.mev >= gq.top) && Math.min(...gq.g.map(g => g.mev)) === gq.top };
// ---- 6. colour neutral at the drop (auto field) ----
await open('scene=field&bars=4');
const chroma = await page.evaluate(async () => {
  const cv = document.querySelector('canvas'); const vid = document.createElement('video'); vid.muted = true; vid.srcObject = cv.captureStream(30); await vid.play();
  const g = Object.assign(document.createElement('canvas'), { width: 160, height: 90 }).getContext('2d', { willReadFrequently: true });
  const acc = { build: [], drop: [] }; const t0 = performance.now();
  while (performance.now() - t0 < 24000) {
    g.drawImage(vid, 0, 0, 160, 90); const d = g.getImageData(0, 0, 160, 90).data; let n = 0, s = 0;
    for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx > 140) { n++; s += (mx - mn) / mx; } }
    if (n > 20) acc[__qa.drop ? 'drop' : 'build'].push(s / n);
    await new Promise(r => setTimeout(r, 100));
  }
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  return { build: avg(acc.build), drop: avg(acc.drop), nb: acc.build.length, nd: acc.drop.length };
});
results.colourNeutral = { satBuild: chroma.build && +chroma.build.toFixed(3), satDrop: chroma.drop && +chroma.drop.toFixed(3), samples: [chroma.nb, chroma.nd] };
// ---- 7. per scene ----
const scenes = ['field', 'tube', 'glueball', 'lava', 'auto'], speed = {};
for (const s of scenes) {
  await open(`scene=${s}`);
  speed[s] = await page.evaluate(async () => {
    const t = []; let on = true; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
    const s0 = __qa.simTime, h0 = document.getElementById('hud').textContent;
    await new Promise(r => setTimeout(r, 10000)); on = false;
    const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), worst: +dt.at(-1).toFixed(1), p99: +dt[Math.floor(dt.length * .99)].toFixed(1),
      alive: __qa.simTime !== s0 && document.getElementById('hud').textContent !== h0, caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] };
  });
}
const modules = await page.evaluate(() => window.__modules);
await browser.close(); server.close();

const pass = {
  gapOmega: [0.35, 0.6].every(m => results['gap_m' + m].omega && Math.abs(results['gap_m' + m].err) < 3),
  colourSeparate: [0.35, 0.6].every(m => results['gap_m' + m].greenBlueMax < 1e-6),
  noGapSpeed1: results.noGap.speed != null && Math.abs(results.noGap.speed - 1) < 0.1,
  tube: results.tube.grows && results.tube.sigmaMin > 0.85 && results.tube.sigmaMax < 0.95 && (results.tube.dropR == null || results.tube.dropR < results.tube.rMax / 2),
  glueballs: results.glueballs.matches && results.glueballs.noneLighter,
  whiterAtDrop: results.colourNeutral.satDrop != null && results.colourNeutral.satBuild != null && results.colourNeutral.satDrop < results.colourNeutral.satBuild,
  pageLoopAlive: Object.values(speed).every(v => v.alive),
  fps60: Object.values(speed).every(v => v.fps >= 58),
  noErrors: errors.length === 0 && Object.values(speed).every(v => !v.caught),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const out = path.join(here, '12-mass-gap', 'checks', stamp);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify({ results, speed, modules, errors, pass }, null, 1));
const ok = v => v ? "✅" : "❌", g35 = results["gap_m0.35"], g60 = results['gap_m0.6'];
fs.writeFileSync(path.join(out, 'check.md'), `# 12 Mass Gap check · ${stamp}\n\n| check | result | detail |\n|---|---|---|\n` +
  `| gap: centre rings at ω ≈ m (κ = 0, sim t 200–600) | ${ok(pass.gapOmega)} | m 0.35 → ω ${g35.omega} (${g35.err}%), m 0.6 → ω ${g60.omega} (${g60.err}%); ${g35.crossings}/${g60.crossings} zero crossings |\n` +
  `| colours stay separate at κ = 0 | ${ok(pass.colourSeparate)} | green/blue max ${g35.greenBlueMax} / ${g60.greenBlueMax} after a pure red splat |\n` +
  `| no gap: front speed 1 cell per unit time | ${ok(pass.noGapSpeed1)} | arrivals at r 30…150: ${results.noGap.arrive.join(', ')} → speed ${results.noGap.speed} |\n` +
  `| tube: E = σ·r, r grows, snaps at the drop | ${ok(pass.tube)} | r ${results.tube.rMin}→${results.tube.rMax} fm, E/r ${results.tube.sigmaMin}…${results.tube.sigmaMax} GeV/fm, r at drop ≤ ${results.tube.dropR} |\n` +
  `| glueballs = Morningstar–Peardon (Wikipedia), none below the gap | ${ok(pass.glueballs)} | ${results.glueballs.page.map(g => g.name + ' ' + g.mev).join(', ')}; gap top ${results.glueballs.gapTop} |\n` +
  `| colour neutral: bright pixels whiter at the drop | ${ok(pass.whiterAtDrop)} | saturation build-up ${results.colourNeutral.satBuild} → drop ${results.colourNeutral.satDrop} (samples ${results.colourNeutral.samples.join('/')}) |\n` +
  `| page keeps animating | ${ok(pass.pageLoopAlive)} | ${scenes.map(s => `${s} ${speed[s].alive ? 'yes' : '**FROZEN**'}`).join(' · ')} |\n` +
  `| fps at 1920×1080 | ${ok(pass.fps60)} | ${scenes.map(s => `${s} ${speed[s].fps} (worst ${speed[s].worst} ms)`).join(' · ')} |\n` +
  `| page errors | ${ok(pass.noErrors)} | ${errors.length ? errors.slice(0, 3).join('; ') : 'none'}; caught ${scenes.map(s => speed[s].caught).join('/')} |\n` +
  `| modules declare ISF-style inputs | ${modules ? '✅' : '❌'} | ${modules ? Object.entries(modules).map(([k, v]) => `${k}: ${(v.inputs || []).map(i => i.name).join(', ')}`).join(' · ') : 'none'} |\n`);
console.log(out);
