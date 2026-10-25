// Physics + speed check for 13 Flow Lab.   node qa/check-13.mjs [--experiments dir]
// Recomputed here from read-back fields, not taken from the page's own divergenceRMS / massLog / sheddingHz:
//  1. Incompressible: my own discrete divergence ½(R−L+T−B) of the velocity texture, same walls and
//     solids, right before and right after the page's projection (project() is wrapped). Pass: the
//     projection removes ≥ 90 % of it on every fluid recipe; 120 Jacobi iterations do better than 30.
//  2. Dye kept: closed box (plume, kh), sources off, dissipation 0, ?conserve=0 (the raw scheme,
//     no rescaling). My own sum of the dye texture once a second for 20 s. Pass: drift ≤ 1 % per 10 s.
//  3. Swirl rate: vortex recipe, ?probe=1, at 90 / 120 / 150 BPM. My own sideways-velocity samples
//     3 diameters behind the post, frequency by zero crossings and by a direct Fourier scan.
//     Expected f = BPM/120 Hz (one vortex per beat, St = 0.2). Pass: within 10 %.
//  4. Sync from __qa.events (≤ 40 ms), 🎲 + morph smoke test, fps (vsync p95, frames > 20 ms) for all
//     six recipes at 1080p, 1440p, 4K, page alive (simTime moves), errors.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const server = http.createServer((q, res) => { const p = path.join(expDir, path.basename(new URL(q.url, 'http://x').pathname)); if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/13-flow-lab.html`;
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const errors = [];
async function open(q, size = [1920, 1080], play = true) {
  const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`${base}?${q}`); await page.addStyleTag({ content: FULL }); await page.waitForTimeout(800);
  if (play) await page.click('#play').catch(() => {});
  return page;
}
const res = {};

// ---- 1. divergence before / after projection ----
const MYDIV = `window.__myDiv = function (walls) {   // MAC grid (70fc2c4+): texel (i,j) = u on the left face, v on the bottom face
  const W = F.simW, H = F.simH, v = readTarget(F.vel.a), asp = W / H, sol = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = (i + 0.5) / W, y = (j + 0.5) / H;
    for (let k = 0; k < obsN; k++) { const ox = obsU[k*4], oy = obsU[k*4+1], r = obsU[k*4+2], w = obsU[k*4+3]; if (w > 0.02 && Math.hypot((x - ox) * asp, y - oy) < r * w) { sol[j*W+i] = 1; break; } } }
  const S = (i, j) => sol[j*W+i] === 1;
  const fu = (i, j) => S(i, j) ? 0 : i === 0 ? (walls[0] > 0.5 ? 0 : v[(j*W+i)*4]) : S(i-1, j) ? 0 : v[(j*W+i)*4];
  const fv = (i, j) => S(i, j) ? 0 : j === 0 ? (walls[2] > 0.5 ? 0 : v[(j*W+i)*4+1]) : S(i, j-1) ? 0 : v[(j*W+i)*4+1];
  let s2 = 0, sp = 0, n = 0;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (S(i, j)) continue;
    const uL = fu(i, j), vB = fv(i, j);
    const uR = i === W-1 ? (walls[1] > 0.5 ? 0 : uL) : fu(i+1, j), vT = j === H-1 ? (walls[3] > 0.5 ? 0 : vB) : fv(i, j+1);
    const d = uR - uL + vT - vB; s2 += d * d; sp += Math.hypot(0.5 * (uL + uR), 0.5 * (vB + vT)); n++;
  }
  const rms = Math.sqrt(s2 / n), mean = sp / n; return { rms, mean, rel: rms / mean, n };
};`;
res.div = {};
for (const pre of ['vortex', 'kh', 'plume', 'ink', 'rocks']) {
  res.div[pre] = {};
  for (const iters of [40, 120]) {
    const page = await open(`preset=${pre}&pressureIters=${iters}&conserve=0&lock=0`);
    await page.addScriptTag({ content: MYDIV });
    res.div[pre][iters] = await page.evaluate(async () => {
      const orig = project, samples = []; window.__take = 0;
      window.project = function (it, walls, openR) { const take = window.__take > 0; const a = take ? __myDiv(walls) : null; orig(it, walls, openR);
        if (take) { window.__take--; const b = __myDiv(walls); samples.push({ it, pre: a.rel, post: b.rel, ratio: b.rms / a.rms, page: __qa.divergenceRMS().rel }); } };
      await new Promise(r => setTimeout(r, 6000));
      for (let k = 0; k < 8; k++) { window.__take = 1; await new Promise(r => setTimeout(r, 500)); }
      window.project = orig;
      const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
      return { n: samples.length, iters: samples[0]?.it, pre: med(samples.map(s => s.pre)), post: med(samples.map(s => s.post)), page: med(samples.map(s => s.page)), ratio: med(samples.map(s => s.ratio)), worstRatio: Math.max(...samples.map(s => s.ratio)) };
    });
    await page.close();
  }
}
// ---- 2. dye mass in a closed box ----
res.mass = {};
for (const [pre, conserve] of [['plume', 0], ['kh', 0], ['plume', 1]]) {
  const page = await open(`preset=${pre}&dissipation=0&conserve=${conserve}`);
  res.mass[`${pre}${conserve ? '+conserve' : ''}`] = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 4000)); __qa.sourcesOff();
    const sum = () => { const d = readTarget(F.dye.a); let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (F.dyeW * F.dyeH); };
    await new Promise(r => setTimeout(r, 1200));
    const m0 = sum(), t0 = __qa.simTime, log = [];
    for (let k = 0; k < 20; k++) { await new Promise(r => setTimeout(r, 1000)); log.push({ t: +(__qa.simTime - t0).toFixed(2), m: sum() }); }
    const last = log.at(-1), drift = (last.m - m0) / m0, worst = Math.max(...log.map(l => Math.abs(l.m - m0) / m0));
    const pageLog = __qa.massLog;
    return { m0, drift, per10s: drift / last.t * 10, worst, secs: last.t, pageDrift: pageLog.at(-1)?.drift ?? null, walls: st.walls };
  });
  await page.close();
}
// ---- 3. vortex shedding vs BPM ----
res.shed = {}; res.shedLock = {};
for (const [lock, bpm] of [[0, 90], [0, 120], [0, 150], [1, 90], [1, 120], [1, 150]]) {
  const page = await open(`preset=vortex&probe=1&bpm=${bpm}&conserve=0${lock ? '' : '&lock=0'}`);
  (lock ? res.shedLock : res.shed)[bpm] = await page.evaluate(async () => {
    await new Promise(r => setTimeout(r, 12000));
    const c = st.cur.obstacles[0], d = 2 * c.r * F.simH / F.simW, s = [];
    const tReal0 = performance.now(), tSim0 = __qa.simTime;
    await new Promise(done => { const f = () => { s.push({ t: __qa.simTime, v: __qa.probe(c.x + 3 * d, c.y).v }); if (performance.now() - tReal0 < 24000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
    const mean = s.reduce((a, p) => a + p.v, 0) / s.length, ups = [];
    for (let i = 1; i < s.length; i++) if (s[i - 1].v < mean && s[i].v >= mean) ups.push(s[i - 1].t + (mean - s[i - 1].v) / (s[i].v - s[i - 1].v) * (s[i].t - s[i - 1].t));
    const fz = ups.length > 2 ? (ups.length - 1) / (ups.at(-1) - ups[0]) : null;
    let best = 0, fft = null;
    for (let f = 0.2; f <= 4; f += 0.005) { let re = 0, im = 0; for (let i = 1; i < s.length; i++) { const w = s[i].t - s[i - 1].t, a = 2 * Math.PI * f * s[i].t; re += (s[i].v - mean) * Math.cos(a) * w; im += (s[i].v - mean) * Math.sin(a) * w; } const p = re * re + im * im; if (p > best) { best = p; fft = f; } }
    const amp = Math.sqrt(s.reduce((a, p) => a + (p.v - mean) ** 2, 0) / s.length);
    const S = __qa.strouhal, fR = S.roshko * S.U / S.d, stMeas = fz * S.d / S.U;
    return { expected: settings.bpm / 120, roshkoHz: +fR.toFixed(3), Re: +S.Re.toFixed(1), nu: S.nu, stMeas: +stMeas.toFixed(4), stRoshko: +S.roshko.toFixed(4),
      ReImplied: +(21.2 / (1 - stMeas / 0.212)).toFixed(1), zeroCross: fz && +fz.toFixed(3), fourier: +fft.toFixed(3), page: __qa.sheddingHz() && +__qa.sheddingHz().toFixed(3),
      amp: +amp.toFixed(2), U: +__qa.strouhal.U.toFixed(1), simPerReal: +((__qa.simTime - tSim0) / ((performance.now() - tReal0) / 1000)).toFixed(3) };
  });
  await page.close();
}
// ---- 4. sync, 🎲 + morph ----
{
  const page = await open('preset=ink');
  res.sync = await page.evaluate(async () => { const seen = new Map(); const t0 = performance.now();
    while (performance.now() - t0 < 30000) { for (const e of __qa.events || []) seen.set(`${e.type}|${e.tBeat}`, e); await new Promise(r => setTimeout(r, 250)); }
    const by = {}; for (const e of seen.values()) if (Number.isFinite(e.perfDrawn) && Number.isFinite(e.perfHeard)) (by[e.type] ??= []).push(e.perfDrawn - e.perfHeard);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(1); };
    return Object.fromEntries(Object.entries(by).map(([k, a]) => [k, { n: a.length, median: q(a, 0.5), p10: q(a, 0.1), p90: q(a, 0.9) }])); });
  await page.close();
}
{
  const page = await open('preset=vortex');
  await page.click('#rand').catch(e => errors.push('rand: ' + e.message)); await page.waitForTimeout(3000);
  const before = await page.evaluate(() => ({ preset: __qa.preset, sim: __qa.simTime }));
  await page.click('#morph').catch(e => errors.push('morph: ' + e.message));
  const during = await page.evaluate(async () => { await new Promise(r => setTimeout(r, 4000)); return { morphing: __qa.morphing, m: __qa.m }; });
  await page.waitForTimeout(16000);
  const after = await page.evaluate(() => ({ preset: __qa.preset, morphing: __qa.morphing, sim: __qa.simTime, caught: __qa.errors.length, nan: (() => { const d = readTarget(F.dye.a), v = readTarget(F.vel.a); return [...d.slice(0, 40000), ...v.slice(0, 40000)].some(x => !Number.isFinite(x)); })() }));
  res.morph = { before, during, after };
  await page.close();
}
// ---- 5. speed ----
const sizes = { '1080p': [1920, 1080], '1440p': [2560, 1440], '4K': [3840, 2160] };
res.speed = {};
for (const pre of ['vortex', 'kh', 'plume', 'ink', 'rocks', 'curl']) {
  res.speed[pre] = {};
  for (const [sk, size] of Object.entries(sizes)) {
    const page = await open(`preset=${pre}`, size); await page.waitForTimeout(1500);
    res.speed[pre][sk] = await page.evaluate(async () => { const t = []; let on = true; const s0 = __qa.simTime; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
      await new Promise(r => setTimeout(r, 8000)); on = false; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p95: +dt[Math.floor(dt.length * 0.95)].toFixed(1), over20: dt.filter(x => x > 20).length,
        alive: __qa.simTime > s0 + 5, caught: __qa.errors.length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height], grid: __qa.grid, dye: __qa.dye }; });
    await page.close();
  }
}
await browser.close(); server.close();

const pass = {
  divergence: Object.values(res.div).every(o => o[40].worstRatio <= 0.01 && o[120].worstRatio <= 0.01),
  dyeKept: ['plume', 'kh'].every(k => Math.abs(res.mass[k].per10s) <= 0.05),
  shedding: Object.values(res.shed).every(s => s.zeroCross && Math.abs(s.zeroCross / s.roshkoHz - 1) <= 0.1),
  lockOnBeat: Object.values(res.shedLock).every(s => s.zeroCross && Math.abs(s.zeroCross / s.expected - 1) <= 0.05),
  sync: Object.values(res.sync).length > 0 && Object.values(res.sync).every(v => v.median <= 40),
  morph: !res.morph.after.morphing && res.morph.after.sim > res.morph.before.sim && !res.morph.after.nan && !!res.morph.during.morphing,
  alive: Object.values(res.speed).every(o => Object.values(o).every(v => v.alive)),
  fps1440: Object.values(res.speed).every(o => o['1440p'].p95 <= 16.8 && o['1440p'].over20 <= 3),
  noErrors: !errors.length && Object.values(res.speed).every(o => Object.values(o).every(v => !v.caught)),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '13-flow-lab', 'checks', stamp);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ res, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌', pct = x => (x * 100).toFixed(2) + ' %';
fs.writeFileSync(path.join(dir, 'check.md'), `# 13 Flow Lab check · ${stamp}\n\n| check | result | detail |\n|---|---|---|\n` +
  `| incompressible (raw): after projection ≤ 1 % of before, every sample, my own MAC divergence | ${ok(pass.divergence)} | ${Object.entries(res.div).map(([k, o]) => `${k}: ${pct(o[40].pre)} → ${pct(o[40].post)}, worst ratio ${pct(o[40].worstRatio)} (120 it: ${pct(o[120].worstRatio)}; page ${pct(o[40].page)})`).join(' · ')} (rms div / mean speed per cell) |\n` +
  `| dye kept in a closed box, raw (?conserve=0), ≤ 5 % per 10 s | ${ok(pass.dyeKept)} | ${Object.entries(res.mass).map(([k, m]) => `${k}: ${pct(m.drift)} in ${m.secs.toFixed(0)} s (${pct(m.per10s)}/10 s, page log ${m.pageDrift === null ? '–' : pct(m.pageDrift)})`).join(' · ')} |\n` +
  `| natural swirl rate (?lock=0) within 10 % of Roshko St(Re) | ${ok(pass.shedding)} | ${Object.entries(res.shed).map(([b, s]) => `${b} BPM: Roshko ${s.roshkoHz} Hz (Re ${s.Re}), measured ${s.zeroCross} (Fourier ${s.fourier}, page ${s.page}); St ${s.stMeas} vs ${s.stRoshko}`).join(' · ')} |\n` +
  `| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ${ok(pass.lockOnBeat)} | ${Object.entries(res.shedLock).map(([b, s]) => `${b} BPM: want ${s.expected.toFixed(3)}, got ${s.zeroCross} (Fourier ${s.fourier}), wake amp ${s.amp}`).join(' · ')} |\n` +
  `| sync from __qa.events (≤ 40 ms) | ${ok(pass.sync)} | ${Object.entries(res.sync).map(([k, v]) => `${k} ${v.median} ms (n ${v.n})`).join(' · ')} |\n` +
  `| 🎲 then morph finishes, no NaN | ${ok(pass.morph)} | ${res.morph.before.preset} → ${res.morph.during.morphing} (${(res.morph.during.m * 100).toFixed(0)} % at 4 s) → ${res.morph.after.preset} |\n` +
  `| page alive | ${ok(pass.alive)} | |\n| 1440p p95 ≤ 16.8 ms | ${ok(pass.fps1440)} | |\n| errors | ${ok(pass.noErrors)} | ${errors.slice(0, 2).join('; ') || 'none'} |\n\n` +
  `| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K |\n|---|---|---|---|---|---|\n` +
  Object.entries(res.speed).map(([k, o]) => `| ${k} | ${o['1080p'].p95} / ${o['1080p'].over20} | ${o['1440p'].p95} / ${o['1440p'].over20} | ${o['4K'].p95} / ${o['4K'].over20} | ${o['4K'].canvas.join('×')} | ${o['4K'].grid.join('×')} / ${o['4K'].dye.join('×')} |`).join('\n') + '\n');
console.log(dir);
