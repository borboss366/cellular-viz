// Maths + speed check for 10 Birch–Swinnerton-Dyer, recomputed independently in Node.
// Does NOT trust the page's own onCurve flags or countPoints: everything is redone here
// with BigInt fractions and a brute-force point count.
//   node qa/check-10.mjs [--experiments <dir>] [--secs 150]
// 1. y²=x³+17, pmax=5000, playing for --secs at 1920×1080 (Fullscreen layout): every point
//    the page publishes (sampled ~5×/s) must satisfy the curve exactly; a_p for every prime
//    shown must match a brute-force count and the Hasse bound; `integral` must be exactly
//    the 8 known x; fps over the whole run.
// 2. y²=x³−x: wait until p = 71 is shown; its count must be 72 (and our own count agrees).
// Writes qa/10-bsd/checks/<stamp>/{check.json, check.md}.
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
const secs = +arg('secs', 150);

// ---- independent maths ----
const parseFrac = s => { const [n, d = '1'] = String(s).split('/'); return [BigInt(n), BigInt(d)]; };
// y² = x³ + a x + b with x = xn/xd, y = yn/yd  ⇔  yn²·xd³ = (xn³ + a·xn·xd² + b·xd³)·yd²
function onCurveExact(a, b, xs, ys) {
  const [xn, xd] = parseFrac(xs), [yn, yd] = parseFrac(ys);
  if (xd <= 0n || yd <= 0n) return false;
  return yn * yn * xd ** 3n === (xn ** 3n + BigInt(a) * xn * xd * xd + BigInt(b) * xd ** 3n) * yd * yd;
}
function bruteCount(a, b, p) {             // 1 + #{(x,y) ∈ F_p² : y² = x³+ax+b}, plain double loop
  let n = 1;
  const P = BigInt(p), A = BigInt(a), B = BigInt(b);
  for (let x = 0n; x < P; x++) {
    const r = (((x * x * x + A * x + B) % P) + P) % P;
    for (let y = 0n; y < P; y++) if ((y * y) % P === r) n++;
  }
  return n;
}
function integralX(a, b, lo, hi) {         // x with x³+ax+b a perfect square, by BigInt Newton sqrt
  const out = [];
  const sqrt = v => { if (v < 2n) return v; let x = v, y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + v / x) / 2n; } return x; };
  for (let x = BigInt(lo); x <= BigInt(hi); x++) {
    const v = x ** 3n + BigInt(a) * x + BigInt(b);
    if (v >= 0n) { const r = sqrt(v); if (r * r === v) out.push(Number(x)); }
  }
  return out;
}
const KNOWN_17 = [-2, -1, 2, 4, 8, 43, 52, 5234];

// ---- page ----
const server = http.createServer((req, res) => {
  const p = path.join(expDir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/10-bsd.html`;
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
  // count rAF frames from here on
  await page.evaluate(() => { window.__frames = []; const f = t => { window.__frames.push(t); requestAnimationFrame(f); }; requestAnimationFrame(f); });
}
const snap = () => page.evaluate(() => window.__qa && ({ curve: __qa.curve, points: __qa.points, p: __qa.p, count: __qa.count, ap: __qa.ap,
  hasse: __qa.hasse, hops: __qa.hops, flashes: __qa.flashes, integral: __qa.integral, product: __qa.product }));

// ---- run 1: x³+17, pmax 5000 ----
await open('curve=x3%2B17&pmax=5000');
const seen = new Map(), primes = new Map();
let last = null, maxDigits = 0;
const t0 = Date.now();
while (Date.now() - t0 < secs * 1000) {
  const q = await snap();
  if (q) {
    last = q;
    for (const pt of q.points) { const k = pt.x + ',' + pt.y; if (!seen.has(k)) seen.set(k, pt); maxDigits = Math.max(maxDigits, pt.x.length); }
    for (const h of q.hasse) primes.set(h.p, h);
  }
  await page.waitForTimeout(200);
}
const frames = await page.evaluate(() => { const t = window.__frames; const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
  return { fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), p50: +dt[dt.length >> 1].toFixed(1), p99: +dt[Math.floor(dt.length * 0.99)].toFixed(1), worst: +dt.at(-1).toFixed(1) }; });
const canvasSize = await page.evaluate(() => [document.querySelector('canvas').width, document.querySelector('canvas').height]);
const shotFile = path.join(here, '10-bsd', 'last.png');

const { a, b } = last.curve;
const pts = [...seen.values()].map(pt => ({ x: pt.x, y: pt.y, pageSays: pt.onCurve, exact: onCurveExact(a, b, pt.x, pt.y) }));
const badPts = pts.filter(p => !p.exact);
const flagLies = pts.filter(p => p.pageSays !== p.exact);
const primeList = [...primes.keys()].sort((x, y) => x - y);
const first50 = primeList.slice(0, 50);
const apRows = first50.map(p => { const h = primes.get(p), n = bruteCount(a, b, p), ap = p + 1 - n;
  return { p, pageCount: h.count, ourCount: n, pageAp: h.ap, ourAp: ap, countOk: h.count === n, hasseOk: Math.abs(ap) <= 2 * Math.sqrt(p) }; });
const hasseAll = primeList.map(p => primes.get(p)).filter(h => Math.abs(h.ap) > 2 * Math.sqrt(h.p));
const ourIntegral = integralX(a, b, -2, 5234);
const pageIntegral = (last.integral || []).map(i => Number(i.x));
const integralPageExact = (last.integral || []).every(i => BigInt(i.y) ** 2n === BigInt(i.x) ** 3n + BigInt(a) * BigInt(i.x) + BigInt(b));
const sameSet = (u, v) => u.length === v.length && [...u].sort((p, q) => p - q).every((x, i) => x === [...v].sort((p, q) => p - q)[i]);

// ---- run 2: x³−x, until p = 71 ----
await open('curve=x3-x');
let p71 = null;
const t1 = Date.now();
while (Date.now() - t1 < 90000 && !p71) {
  const q = await snap();
  const h = q?.hasse?.find(h => h.p === 71);
  if (h) p71 = { pageCount: h.count, pageFn: await page.evaluate(() => __qa.countPoints(-1, 0, 71)) };
  await page.waitForTimeout(300);
}
const our71 = bruteCount(-1, 0, 71);

await browser.close(); server.close();

const pass = {
  pointsExactlyOnCurve: pts.length > 0 && badPts.length === 0,
  pageFlagsHonest: flagLies.length === 0,
  countsMatchBruteForce: apRows.length >= 50 && apRows.every(r => r.countOk),
  hasseBound: apRows.every(r => r.hasseOk) && hasseAll.length === 0,
  F71is72: !!p71 && p71.pageCount === 72 && our71 === 72,
  integralExactly8: sameSet(pageIntegral, KNOWN_17) && sameSet(ourIntegral, KNOWN_17) && integralPageExact,
  fps60: frames.fps >= 58,
  noErrors: errors.length === 0,
};
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const out = path.join(here, '10-bsd', 'checks', stamp);
fs.mkdirSync(out, { recursive: true });
const res = { secs, canvas: canvasSize, curve: last.curve, hops: last.hops, flashes: last.flashes, distinctPoints: pts.length, maxXDigits: maxDigits,
  badPts, flagLies, primesSeen: primeList.length, apRows, hasseViolations: hasseAll, p71: { ...p71, ours: our71 },
  integral: { page: pageIntegral, ours: ourIntegral, known: KNOWN_17, pageYsExact: integralPageExact }, frames, errors, pass };
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify(res, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(out, 'check.md'), `# 10 BSD check · ${stamp}\n\n` +
  `Independent recomputation in Node (BigInt fractions, brute-force counts); the page's own flags are only compared, not trusted.\n\n` +
  `| check | result | detail |\n|---|---|---|\n` +
  `| points exactly on y² = x³${a ? (a > 0 ? '+' : '') + a + 'x' : ''}+${b} | ${ok(pass.pointsExactlyOnCurve)} | ${pts.length} distinct points over ${secs} s, ${last.hops} hops, x up to ${maxDigits} digits, ${badPts.length} off the curve |\n` +
  `| page's onCurve flags agree | ${ok(pass.pageFlagsHonest)} | ${flagLies.length} disagreements |\n` +
  `| counts = brute force, first 50 primes | ${ok(pass.countsMatchBruteForce)} | ${apRows.filter(r => r.countOk).length}/${apRows.length} (primes ${first50[0]}…${first50.at(-1)}) |\n` +
  `| Hasse \\|a_p\\| ≤ 2√p | ${ok(pass.hasseBound)} | all ${primeList.length} primes shown (up to ${primeList.at(-1)}) |\n` +
  `| y² = x³ − x over F₇₁ has 72 points | ${ok(pass.F71is72)} | page ${p71 ? p71.pageCount : 'never reached 71'}, page fn ${p71 ? p71.pageFn : '—'}, ours ${our71} |\n` +
  `| integral points of x³+17 in [−2, 5234] | ${ok(pass.integralExactly8)} | page [${pageIntegral.join(', ')}], ours [${ourIntegral.join(', ')}] |\n` +
  `| fps at 1920×1080, pmax 5000 | ${ok(pass.fps60)} | ${frames.fps} fps, frame p50 ${frames.p50} ms, p99 ${frames.p99} ms, worst ${frames.worst} ms (canvas ${canvasSize.join('×')}) |\n` +
  `| page errors | ${ok(pass.noErrors)} | ${errors.length ? errors.slice(0, 3).join('; ') : 'none'} |\n`);
console.log(out);
