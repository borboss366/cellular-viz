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
const lock = await page.evaluate(async ms => {
  const out = []; const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    const b = __qa.bars, t = __qa.tCam;
    if (b != null && t != null) out.push([b, t]);
    await new Promise(r => setTimeout(r, 30));
  }
  return out;
}, 16000);
const downbeats = lock.filter(([b]) => { const f = b - Math.floor(b); return f < 0.015 || f > 0.985; });
const lockErr = downbeats.map(([, t]) => Math.min(...TRUE120.map(z => Math.abs(z - t))));
const lockRes = { samples: lock.length, downbeats: downbeats.length, worst: lockErr.length ? Math.max(...lockErr) : null, median: lockErr.length ? [...lockErr].sort((a, b) => a - b)[lockErr.length >> 1] : null };

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
      canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height], scene: __qa.scene, alive };
  }, secs);
  await page.screenshot({ path: path.join(here, '11-riemann-show', `_${s}.png`) }).catch(() => {});
}
await browser.close(); server.close();

const pass = {
  zeros: zerosRes.count === zerosRes.want && zerosRes.worst < 1e-6 && !zerosRes.extra.length,
  ribbon: !ribbonRes.missing.length && !ribbonRes.extra.length,
  scope: !scopeRes.missing.length && !scopeRes.extra.length,
  primes: primesRes.piExactOk && primesRes.approxWorst < 0.5 && primesRes.stepsArePrimes,
  beatLock: lockRes.downbeats > 0 && lockRes.worst < 0.15,
  pageLoopAlive: Object.values(speed).every(v => v.alive),
  fps60: Object.values(speed).every(v => v.fps >= 58),
  noErrors: errors.length === 0,
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const out = path.join(here, '11-riemann-show', 'checks', stamp);
fs.mkdirSync(out, { recursive: true });
for (const s of scenes) { const f = path.join(here, '11-riemann-show', `_${s}.png`); if (fs.existsSync(f)) fs.renameSync(f, path.join(out, `${s}.png`)); }
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify({ truth: 'LMFDB zeros 1–40', zerosRes, ribbonRes, scopeRes, primesRes, lockRes, speed, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(out, 'check.md'), `# 11 Riemann show check · ${stamp}\n\nTruth: LMFDB zeros (qa/data/lmfdb-zeta-zeros-1-40.txt) and a sieve here; the page's numbers are compared, not trusted.\n\n` +
  `| check | result | detail |\n|---|---|---|\n` +
  `| zeros below 120 | ${ok(pass.zeros)} | ${zerosRes.count}/${zerosRes.want}, worst error ${zerosRes.worst.toExponential(1)}, ${zerosRes.extra.length} extra |\n` +
  `| ribbon: |ζ| minima at the zeros | ${ok(pass.ribbon)} | ${ribbonRes.count} minima, missing ${ribbonRes.missing.length}, extra ${ribbonRes.extra.length}${ribbonRes.extra.length ? ' (' + ribbonRes.extra.join(', ') + ')' : ''}, largest |ζ| at a minimum ${ribbonRes.worstAbsZeta} |\n` +
  `| scope: Z crossings at the zeros | ${ok(pass.scope)} | ${scopeRes.count} crossings, worst ${scopeRes.worst.toExponential(1)}, missing ${scopeRes.missing.length}, extra ${scopeRes.extra.length} |\n` +
  `| primes: approxPi(x, all ${zerosRes.count}) vs π(x), x = 2.5…99.5 | ${ok(pass.primes)} | worst ${primesRes.approxWorst.toFixed(3)} (with 10 zeros: ${primesRes.approx10Worst.toFixed(2)}); steps ${primesRes.steps}${primesRes.approxBad.length ? '; off: ' + primesRes.approxBad.slice(0, 6).join(' ') : ''} |\n` +
  `| beat lock: camera on a zero at each downbeat | ${ok(pass.beatLock)} | ${lockRes.downbeats} downbeat samples, worst ${lockRes.worst?.toFixed(3)}, median ${lockRes.median?.toFixed(3)} |\n` +
  `| page keeps animating (camera time moves) | ${ok(pass.pageLoopAlive)} | ${scenes.map(s => `${s} ${speed[s].alive ? 'yes' : '**FROZEN**'}`).join(' · ')} |\n` +
  `| fps at 1920×1080 per scene | ${ok(pass.fps60)} | ${scenes.map(s => `${s} ${speed[s].fps} (worst ${speed[s].worst} ms)`).join(' · ')} |\n` +
  `| page errors | ${ok(pass.noErrors)} | ${errors.length ? errors.slice(0, 3).join('; ') : 'none'} |\n`);
console.log(out);
