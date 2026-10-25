// Group-law check for 17 BSD Skater, recomputed in Node with BigInt (page flags only compared).
//   node qa/check-17.mjs [--experiments dir] [--secs 75]
// Per curve (x3-25x, x3+17, x3-2x), playing at 1920×1080 (Fullscreen layout), every hop seen in
// window.__qa.lastHop is checked exactly:
//   all of P, Q, R, sum on y² = x³ + ax + b; sum = −R;
//   ollie (add): P, Q, R collinear (det = 0) and x_R = s² − x_P − x_Q, s = (y_Q − y_P)/(x_Q − x_P);
//   grind (dbl): Q = P, R on the tangent, s = (3x_P² + a)/(2y_P), x_R = s² − 2x_P;
//   big air: only if the line is vertical (add: x_P = x_G and y_P = −y_G; dbl: y_P = 0).
// Plus: page loop alive (beats advance), fps, errors.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const secs = +arg('secs', 75), extra = arg('query', '');
const CURVES = { 'x3-25x': { a: -25n, b: 0n, G: [45n, 300n] }, 'x3+17': { a: 0n, b: 17n, G: [-1n, 4n] }, 'x3-2x': { a: -2n, b: 0n, G: [-1n, 1n] } };

// exact rationals as [n, d] with d > 0, reduced
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
const Q = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d) || 1n; return [n / g, d / g]; };
const parse = s => { const [n, d = '1'] = String(s).split('/'); return Q(BigInt(n), BigInt(d)); };
const add = (x, y) => Q(x[0] * y[1] + y[0] * x[1], x[1] * y[1]);
const sub = (x, y) => Q(x[0] * y[1] - y[0] * x[1], x[1] * y[1]);
const mul = (x, y) => Q(x[0] * y[0], x[1] * y[1]);
const div = (x, y) => Q(x[0] * y[1], x[1] * y[0]);
const eq = (x, y) => x[0] === y[0] && x[1] === y[1];
const I = n => Q(BigInt(n));
const pt = p => p && { x: parse(p.x), y: parse(p.y) };
const onCurve = (c, P) => eq(mul(P.y, P.y), add(add(mul(mul(P.x, P.x), P.x), mul(I(c.a), P.x)), I(c.b)));
function checkHop(c, h) {
  const bad = [];
  if (h.type === 'air') {
    const P = pt(h.P);
    const vertAdd = eq(P.x, I(c.G[0])) && eq(P.y, I(-c.G[1])), vertDbl = P.y[0] === 0n;
    if (!vertAdd && !vertDbl) bad.push('big air with a non-vertical line');
    return bad;
  }
  const P = pt(h.P), Qp = pt(h.Q), R = pt(h.R), S = pt(h.sum);
  for (const [n, X] of [['P', P], ['Q', Qp], ['R', R], ['sum', S]]) {
    if (!onCurve(c, X)) bad.push(`${n} off the curve`);
    if (h[n === 'sum' ? 'sum' : n]?.onCurve === false) bad.push(`page says ${n} off`);
  }
  if (!eq(S.x, R.x) || !eq(S.y, Q(-R.y[0], R.y[1]))) bad.push('sum ≠ −R');
  let s;
  if (h.type === 'add') {
    if (eq(P.x, Qp.x)) { bad.push('add with x_P = x_Q (should be big air or a double)'); return bad; }
    s = div(sub(Qp.y, P.y), sub(Qp.x, P.x));
    if (!eq(R.x, sub(sub(mul(s, s), P.x), Qp.x))) bad.push('x_R ≠ s² − x_P − x_Q');
    // collinear: (Q − P) × (R − P) = 0
    const det = sub(mul(sub(Qp.x, P.x), sub(R.y, P.y)), mul(sub(Qp.y, P.y), sub(R.x, P.x)));
    if (det[0] !== 0n) bad.push('P, Q, R not collinear');
    if (!(eq(Qp.x, I(c.G[0])) && eq(Qp.y, I(c.G[1])))) bad.push('ollie partner is not G');
  } else if (h.type === 'dbl') {
    if (!eq(P.x, Qp.x) || !eq(P.y, Qp.y)) bad.push('grind with Q ≠ P');
    if (P.y[0] === 0n) { bad.push('grind at y = 0 (should be big air)'); return bad; }
    s = div(add(mul(I(3), mul(P.x, P.x)), I(c.a)), mul(I(2), P.y));
    if (!eq(R.x, sub(mul(s, s), mul(I(2), P.x)))) bad.push('x_R ≠ s² − 2x_P');
    if (!eq(sub(R.y, P.y), mul(s, sub(R.x, P.x)))) bad.push('R not on the tangent');
  } else bad.push('unknown type ' + h.type);
  return bad;
}

const server = http.createServer((req, res) => {
  const p = path.join(expDir, path.basename(decodeURIComponent(new URL(req.url, 'http://x').pathname)));
  if (!fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'text/html' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({
  env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
    __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` },
  args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const out = {};
for (const key of Object.keys(CURVES)) {
  await page.goto(`http://127.0.0.1:${server.address().port}/17-bsd-skater.html?curve=${encodeURIComponent(key)}${extra ? '&' + extra : ''}`);
  await page.addStyleTag({ content: '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}' });
  await page.waitForTimeout(800);
  await page.click('#play').catch(() => {});
  const r = await page.evaluate(async secs => {
    const hops = new Map(), airs = new Map(), t = []; let on = true;
    const f = n => { t.push(n); const h = __qa.lastHop; if (h) { const k = JSON.stringify(h); if (!hops.has(k)) hops.set(k, h); } for (const a of __qa.bigAirs || []) airs.set(a.beat, a); if (on) requestAnimationFrame(f); };
    requestAnimationFrame(f);
    const b0 = __qa.beats; await new Promise(r => setTimeout(r, secs * 1000)); on = false;
    const dt = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
    return { hops: [...hops.values()], airs: [...airs.values()], beatsMoved: __qa.beats - b0, maxDigits: Math.max(0, ...[...hops.values()].map(h => (h.sum?.x || h.P.x).length)),
      fps: +((t.length - 1) / ((t.at(-1) - t[0]) / 1000)).toFixed(1), worst: +dt.at(-1).toFixed(1), caught: (__qa.errors || []).length, canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height] };
  }, secs);
  const c = CURVES[key];
  const fails = r.hops.map(h => ({ type: h.type, bad: checkHop(c, h) })).filter(x => x.bad.length);
  const types = r.hops.reduce((m, h) => (m[h.type] = (m[h.type] || 0) + 1, m), {});
  out[key] = { hops: r.hops.length, types, bigAirs: r.airs.length, fails: fails.slice(0, 5), nFail: fails.length, maxDigits: r.maxDigits, beatsMoved: +r.beatsMoved.toFixed(1),
    fps: r.fps, worst: r.worst, caught: r.caught, canvas: r.canvas };
}
await browser.close(); server.close();
const pass = { groupLaw: Object.values(out).every(o => o.hops >= 5 && o.nFail === 0), alive: Object.values(out).every(o => o.beatsMoved > 10),
  fps60: Object.values(out).every(o => o.fps >= 58), noErrors: !errors.length && Object.values(out).every(o => !o.caught) };
const stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
const dir = path.join(here, '17-bsd-skater', 'checks', stamp + (extra ? '-' + extra.replace(/[^\w]+/g, '-') : ''));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'check.json'), JSON.stringify({ out, errors, pass }, null, 1));
const ok = v => v ? '✅' : '❌';
fs.writeFileSync(path.join(dir, 'check.md'), `# 17 BSD Skater check · ${stamp}\n\nEvery hop recomputed exactly in Node (BigInt rationals); page flags only compared.\n\n` +
  `| curve | hops checked | ollie / grind / air | failures | x up to | fps 1080p (worst) | beats moved |\n|---|---|---|---|---|---|---|\n` +
  Object.entries(out).map(([k, o]) => `| ${k} | ${o.hops} | ${o.types.add || 0} / ${o.types.dbl || 0} / ${o.bigAirs} | ${o.nFail}${o.nFail ? ' (' + o.fails.map(f => f.bad.join(',')).join('; ') + ')' : ''} | ${o.maxDigits} digits | ${o.fps} (${o.worst} ms) | ${o.beatsMoved} |`).join('\n') +
  `\n\n` + Object.entries(pass).map(([k, v]) => `- ${ok(v)} ${k}`).join('\n') + `\n\nErrors: ${errors.length ? errors.slice(0, 3).join('; ') : 'none'}\n`);
console.log(dir);
