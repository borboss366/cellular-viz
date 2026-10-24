// Maths + speed check for 11 Riemann show, against outside truth.
//   node qa/check-11.mjs [--experiments <dir>] [--secs 10]
// Truth: the first 40 zeta zeros from LMFDB (qa/data/lmfdb-zeta-zeros-1-40.txt, fetched from
// https://www.lmfdb.org/zeros/zeta/list?start=1&limit=40) and a prime sieve written here.
// 1. __qa.zeros: every LMFDB zero below 120 found, none extra, each within 1e-6.
// 2. ribbon: one |ζ| minimum near each zero (within one sample step, 0.02), none elsewhere.
// 3. scope: one zero crossing near each zero (within 0.005), none elsewhere.
// 4. primes: our own sieve for π(x); approxPi(x, all zeros) within ½ of π(x) halfway between
//    integers 2.5…99.5, and the steps it shows are exactly the primes.
// 5. beat lock: in the ribbon scene, at every downbeat the camera sits on a zero (|t − γ| < 0.15).
// 6. fps at 1920×1080 (Fullscreen layout), playing, per scene.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(repo, 'experiments')));
const secs = +arg('secs', 10);

const TRUE = fs.readFileSync(path.join(here, 'data', 'lmfdb-zeta-zeros-1-40.txt'), 'utf8').trim().split('\n').map(l => +l.trim().split(/\s+/)[1]);
const TRUE120 = TRUE.filter(t => t > 10 && t < 120);
const sieve = n => { const s = new Uint8Array(n + 1), out = []; for (let i = 2; i <= n; i++) { if (s[i]) continue; out.push(i); for (let j = i * i; j <= n; j += i) s[j] = 1; } return out; };
const PR = sieve(1000);
const pi = x => PR.filter(p => p <= x).length;

const server = http.createServer((req, res) => {
  const p = path.join(expDir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/11-riemann-show.html`;
const R = path.join(os.homedir(), 'qa-libs/root');
const gpu = fs.existsSync('/dev/dri/renderD128');
const browser = await chromium.launch({
  env: { ...process.env, LD_LIBRARY_PATH: `${R}/usr/lib/x86_64-linux-gnu:${R}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
    ...(gpu ? { __EGL_VENDOR_LIBRARY_DIRS: `${R}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R}/usr/lib/x86_64-linux-gnu/dri` } : {}) },
  args: ['--autoplay-policy=no-user-gesture-required', ...(gpu ? ['--use-angle=gl-egl', '--ignore-gpu-blocklist'] : [])] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
async function open(q) {
  await page.goto(`${base}?${q}`);
  await page.addStyleTag({ content: FULL });
  await page.waitForTimeout(800);
  await page.click('#play').catch(() => {});
  await page.waitForTimeout(700);
}

// ---- maths from __qa ----
await open('scene=ribbon');
const qa = await page.evaluate(() => {
  const xs = []; for (let x = 2.5; x <= 99.5; x += 1) xs.push(x);
  return { zeros: __qa.zeros, ribbon: __qa.ribbonMinima, scope: __qa.scopeCrossings, primeSteps: __qa.primeSteps,
    approx: xs.map(x => [x, __qa.approxPi(x, __qa.zeros.length)]), approx10: xs.map(x => [x, __qa.approxPi(x, 10)]),
    piExact: xs.map(x => [x, __qa.piExact(x)]) };
});
const near = (list, t, tol) => list.filter(v => Math.abs(v - t) <= tol);
const zerosRes = { count: qa.zeros.length, want: TRUE120.length,
  worst: Math.max(...TRUE120.map(t => Math.min(...qa.zeros.map(z => Math.abs(z - t))))),
  extra: qa.zeros.filter(z => !TRUE120.some(t => Math.abs(z - t) < 1e-3)) };
const ribT = qa.ribbon.map(r => r.t);
const ribbonRes = { count: ribT.length, missing: TRUE120.filter(t => !near(ribT, t, 0.021).length), extra: ribT.filter(r => !TRUE120.some(t => Math.abs(r - t) <= 0.021)),
  worstAbsZeta: Math.max(...qa.ribbon.map(r => r.absZeta)) };
const scopeRes = { count: qa.scope.length, missing: TRUE120.filter(t => !near(qa.scope, t, 0.005).length), extra: qa.scope.filter(s => !TRUE120.some(t => Math.abs(s - t) <= 0.005)),
  worst: Math.max(...TRUE120.map(t => Math.min(...qa.scope.map(s => Math.abs(s - t))))) };
const primesRes = {
  piExactOk: qa.piExact.every(([x, v]) => v === pi(x)),
  approxWorst: Math.max(...qa.approx.map(([x, v]) => Math.abs(v - pi(x)))),
  approxBad: qa.approx.filter(([x, v]) => Math.abs(v - pi(x)) >= 0.5).map(([x, v]) => `${x}:${v.toFixed(2)}≠${pi(x)}`),
  approx10Worst: Math.max(...qa.approx10.map(([x, v]) => Math.abs(v - pi(x)))),
  stepsArePrimes: qa.primeSteps.every(p => PR.includes(p)) && qa.primeSteps.length === pi(Math.max(...qa.primeSteps)),
  steps: `${qa.primeSteps[0]}…${qa.primeSteps.at(-1)} (${qa.primeSteps.length})`,
};

// ---- beat lock in the ribbon scene ----
// Every frame (rAF, after the page's own draw): bars and tCam. The k-th zero belongs on downbeat k, so on
// the first frame after each downbeat, tCam − u·(γ[k+1] − γ[k]) (u = how far past the downbeat) must be γ[k].
// We use LMFDB's γ, not the page's. Also every frame: tCam vs the LMFDB warped clock at that bars value.
const lock = await page.evaluate(async ms => {
  const out = []; const t0 = performance.now();
  await new Promise(res => { const f = () => { const b = __qa.bars, t = __qa.tCam; if (b != null && t != null) out.push([b, t]);
    if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
  return out;
}, 16000);
const LOOP = Math.min(30, qa.zeros.length - 1);
const TZ = TRUE.filter(t => t > 10);
const warpTrue = b => { const bb = ((b % LOOP) + LOOP) % LOOP, k = Math.floor(bb), u = bb - k; return { k, u, t: TZ[k] + u * (TZ[k + 1] - TZ[k]) }; };
const frameErr = lock.map(([b, t]) => Math.abs(t - warpTrue(b).t));
const after = lock.filter(([b], i) => i > 0 && Math.floor(b) > Math.floor(lock[i - 1][0]));
const atDown = after.map(([b, t]) => { const { k, u } = warpTrue(b); return { bar: Math.floor(b), u: +u.toFixed(4), err: Math.abs(t - u * (TZ[k + 1] - TZ[k]) - TZ[k]), nearestFrame: Math.abs(t - TZ[k]) }; });
const downbeats = lock.filter(([b]) => { const f = b - Math.floor(b); return f < 0.015 || f > 0.985; });
const lockErr = downbeats.map(([, t]) => Math.min(...TRUE120.map(z => Math.abs(z - t))));
const lockRes = { samples: lock.length, frameWorst: Math.max(...frameErr), downbeats: atDown.length, worst: atDown.length ? Math.max(...atDown.map(d => d.err)) : null,
  nearestFrameWorst: atDown.length ? Math.max(...atDown.map(d => d.nearestFrame)) : null, atDown,
  windowSamples: downbeats.length, windowWorst: lockErr.length ? Math.max(...lockErr) : null, windowMedian: lockErr.length ? [...lockErr].sort((a, b) => a - b)[lockErr.length >> 1] : null };

// ---- blank frames: screenshots every second per scene (HUD hidden), lit share and spread of luma ----
async function lumaStats(buf) {
  return page.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const w = 480, h = 270, c = new OffscreenCanvas(w, h), x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; let lit = 0, s = 0, s2 = 0; const n = w * h;
    for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; if (l > 16) lit++; s += l; s2 += l * l; }
    const m = s / n; return { lit: +(lit / n).toFixed(4), mean: +m.toFixed(1), sd: +Math.sqrt(Math.max(0, s2 / n - m * m)).toFixed(1) };
  }, buf.toString('base64'));
}
const isBlank = v => v.lit < 0.005 || v.sd < 2;
async function blankPass(q, n, every, scenesSeen) {
  await open(q);
  await page.addStyleTag({ content: '#hud{visibility:hidden !important}' });
  const shots = [];
  for (let i = 0; i < n; i++) {
    await page.waitForTimeout(every);
    const sc = await page.evaluate(() => [__qa.scene, +(__qa.bars ?? -1).toFixed(2)]);
    const st = await lumaStats(await page.screenshot());
    shots.push({ scene: sc[0], bars: sc[1], ...st, blank: isBlank(st) });
    if (scenesSeen) scenesSeen.push(sc[0]);
  }
  return shots;
}
// ---- fps per scene ----
const scenes = ['ribbon', 'march', 'scope', 'primes', 'canyon', 'map', 'auto'];
const speed = {};
for (const s of scenes) {
  await open(`scene=${s}`);
  // the page's own loop must keep going: its camera time has to move (our rAF counter alone can't tell)
  speed[s] = await page.evaluate(async secs => {
    const t = []; let on = true; const f = n => { t.push(n); if (on) requestAnimationFrame(f); }; requestAnimationFrame(f);
    const cam0 = __qa.tCam, hud0 = document.getElementById('hud').textContent;
    await new Promise(r => setTimeout(r, secs * 1000)); on = false;
    const alive = __qa.tCam != null && __qa.tCam !== cam0 && document.getElementById('hud').textContent !== hud0;
    const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p99: +dt[Math.floor(dt.length * 0.99)].toFixed(1), worst: +dt.at(-1).toFixed(1),
      canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height], scene: __qa.scene, alive,
      caught: (__qa.errors || []).map(e => String(e.message || e)).slice(0, 3), caughtN: (__qa.errors || []).length };
  }, secs);
  await page.screenshot({ path: path.join(here, '11-riemann-show', `_${s}.png`) }).catch(() => {});
}
const blank = {};
for (const sc of scenes.filter(x => x !== 'auto')) blank[sc] = await blankPass(`scene=${sc}`, 8, 1000);
// auto with 1-bar sections (2 s at 120 bpm): every scene and its crossfade within ~12 s
const autoSeen = [];
blank['auto (1-bar sections)'] = await blankPass('scene=auto&bars=1', 24, 500, autoSeen);
const autoOrder = autoSeen.filter((x, i) => x !== autoSeen[i - 1]);
await browser.close(); server.close();

const pass = {
  zeros: zerosRes.count === zerosRes.want && zerosRes.worst < 1e-6 && !zerosRes.extra.length,
  ribbon: !ribbonRes.missing.length && !ribbonRes.extra.length,
  scope: !scopeRes.missing.length && !scopeRes.extra.length,
  primes: primesRes.piExactOk && primesRes.approxWorst < 0.5 && primesRes.stepsArePrimes,
  beatLock: lockRes.downbeats > 0 && lockRes.worst < 1e-3 && lockRes.frameWorst < 1e-3,
  noBlank: Object.values(blank).every(v => v.every(x => !x.blank)),
  autoSwitch: ['ribbon', 'march', 'scope', 'primes', 'canyon'].every(x => autoSeen.includes(x)),
  pageLoopAlive: Object.values(speed).every(v => v.alive),
  fps60: Object.values(speed).every(v => v.fps >= 58),
  noErrors: errors.length === 0 && Object.values(speed).every(v => !v.caughtN),
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const out = path.join(here, '11-riemann-show', 'checks', stamp);
fs.mkdirSync(out, { recursive: true });
for (const s of scenes) { const f = path.join(here, '11-riemann-show', `_${s}.png`); if (fs.existsSync(f)) fs.renameSync(f, path.join(out, `${s}.png`)); }
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify({ truth: 'LMFDB zeros 1–40', zerosRes, ribbonRes, scopeRes, primesRes, lockRes, speed, blank, autoOrder, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(out, 'check.md'), `# 11 Riemann show check · ${stamp}\n\nTruth: LMFDB zeros (qa/data/lmfdb-zeta-zeros-1-40.txt) and a sieve here; the page's numbers are compared, not trusted.\n\n` +
  `| check | result | detail |\n|---|---|---|\n` +
  `| zeros below 120 | ${ok(pass.zeros)} | ${zerosRes.count}/${zerosRes.want}, worst error ${zerosRes.worst.toExponential(1)}, ${zerosRes.extra.length} extra |\n` +
  `| ribbon: |ζ| minima at the zeros | ${ok(pass.ribbon)} | ${ribbonRes.count} minima, missing ${ribbonRes.missing.length}, extra ${ribbonRes.extra.length}${ribbonRes.extra.length ? ' (' + ribbonRes.extra.join(', ') + ')' : ''}, largest |ζ| at a minimum ${ribbonRes.worstAbsZeta} |\n` +
  `| scope: Z crossings at the zeros | ${ok(pass.scope)} | ${scopeRes.count} crossings, worst ${scopeRes.worst.toExponential(1)}, missing ${scopeRes.missing.length}, extra ${scopeRes.extra.length} |\n` +
  `| primes: approxPi(x, all ${zerosRes.count}) vs π(x), x = 2.5…99.5 | ${ok(pass.primes)} | worst ${primesRes.approxWorst.toFixed(3)} (with 10 zeros: ${primesRes.approx10Worst.toFixed(2)}); steps ${primesRes.steps}${primesRes.approxBad.length ? '; off: ' + primesRes.approxBad.slice(0, 6).join(' ') : ''} |\n` +
  `| beat lock: camera on a zero at each downbeat | ${ok(pass.beatLock)} | ${lockRes.downbeats} downbeats seen frame by frame: worst ${lockRes.worst?.toExponential(1)} (tCam on the first frame after the downbeat, wound back by u·gap, vs LMFDB γ); every one of ${lockRes.samples} frames vs the LMFDB warped clock: worst ${lockRes.frameWorst.toExponential(1)}; raw nearest frame ${lockRes.nearestFrameWorst?.toFixed(3)} (one frame of camera travel); old ±0.015-bar window: worst ${lockRes.windowWorst?.toFixed(3)} |\n` +
  `| no blank frames (screenshots, HUD hidden) | ${ok(pass.noBlank)} | ${Object.entries(blank).map(([k, v]) => `${k} ${v.filter(x => x.blank).length}/${v.length} blank (lit ≥ ${Math.min(...v.map(x => x.lit)).toFixed(2)}, sd ≥ ${Math.min(...v.map(x => x.sd))})`).join(' · ')} |\n` +
  `| auto switches through every scene | ${ok(pass.autoSwitch)} | order seen with bars=1: ${autoOrder.join(' → ')} |\n` +
  `| page keeps animating (camera time moves) | ${ok(pass.pageLoopAlive)} | ${scenes.map(s => `${s} ${speed[s].alive ? 'yes' : '**FROZEN**'}`).join(' · ')} |\n` +
  `| fps at 1920×1080 per scene | ${ok(pass.fps60)} | ${scenes.map(s => `${s} ${speed[s].fps} (worst ${speed[s].worst} ms)`).join(' · ')} |\n` +
  `| page errors (thrown + caught in __qa.errors) | ${ok(pass.noErrors)} | thrown: ${errors.length ? errors.slice(0, 3).join('; ') : 'none'}; caught: ${scenes.map(s => `${s} ${speed[s].caughtN}`).join(' · ')}${scenes.some(s => speed[s].caughtN) ? ' — ' + scenes.flatMap(s => speed[s].caught).slice(0, 2).join('; ') : ''} |\n`);
console.log(out);
