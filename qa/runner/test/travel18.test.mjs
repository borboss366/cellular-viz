// 18 · Little Bang, beamline travel mode (the user, 20 Nov): the page's own arithmetic (experiments/18-travel.js) in node,
// frame by frame at 60 fps, and its wiring. The page in Chromium is travel18-smoke.test.mjs (box only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/18-travel.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/18-little-bang.html', import.meta.url), 'utf8');

test('18 travel: the speed eases after the knob (no jump), 0 stops the camera, 1 is the full speed; off without ?speedKnob', () => {
  const s = T.speedCreate(0.5), fps = 60, vs = [];
  for (let f = 0; f < 4 * fps; f++) vs.push(T.speedStep(s, f < fps ? null : f < 2 * fps ? 1 : 0, 1 / fps));
  let step = 0; for (let i = 1; i < vs.length; i++) step = Math.max(step, Math.abs(vs[i] - vs[i - 1]));
  assert.ok(step <= T.C.ACCEL / fps + 1e-12, `at most ${T.C.ACCEL} of the top speed a second (${(step * fps).toFixed(3)})`);
  assert.ok(Math.abs(vs[fps - 1] - Math.pow(0.5, T.C.SPEED_POW)) < 1e-12, 'before the knob moves: ?speed');
  assert.ok(vs[2 * fps - 1] > 0.85, `knob 1: most of the way to full speed within a second (${vs[2 * fps - 1]})`);
  assert.ok(vs[vs.length - 1] < 1e-3, `knob 0: stopped (${vs[vs.length - 1]})`);
  assert.ok(vs.every(v => v >= 0 && v <= 1));
  assert.equal(T.knobOf({ knob: n => (n === 4 ? 0.7 : null) }, 4), 0.7); assert.equal(T.knobOf({}, 4), null, 'no knob() before #268');
  // the page: travel only with ?speedKnob or ?travel=1; the bend and the ray are 0 / off otherwise
  assert.match(PAGE, /travel\.on = params\.speedKnob > 0 \|\| q\('travel'\) === '1';/);
  assert.match(PAGE, /bendNow = \[0, 0\];\n  if \(beam\) \{/);
  assert.match(PAGE, /let s = camS\(u\), tq = null;\n    if \(travel\.on\) \{/, "without travel the camera is today's camS(u)");
  assert.match(PAGE, /c\.xy \+= uBend \* c\.w \* \(1\.0 - exp\(-max\(c\.w, 0\.0\) \/ /, 'the bend is 0 when uBend is 0');
});

test('18 travel: the wandering target is smooth, bounded and deterministic, and moves over many bars, not every beat', () => {
  let maxStep = 0, maxX = 0, maxY = 0, prev = T.targetAt(0, 1);
  for (let k = 1; k <= 64 * 120; k++) {   // 120 bars at 64 samples a bar
    const p = T.targetAt(k / 64, 1);
    maxStep = Math.max(maxStep, Math.hypot(p.x - prev.x, p.y - prev.y)); maxX = Math.max(maxX, Math.abs(p.x)); maxY = Math.max(maxY, Math.abs(p.y)); prev = p;
  }
  assert.ok(maxX <= T.C.TARGET_X + 1e-12 && maxY <= T.C.TARGET_Y + 1e-12, `bounded (${maxX.toFixed(3)}, ${maxY.toFixed(3)})`);
  assert.ok(maxStep * 64 < 0.1, `slow: under 0.1 NDC a bar (${(maxStep * 64).toFixed(3)})`);
  const a = T.targetAt(7.25, 3), b = T.targetAt(7.25, 3), c = T.targetAt(7.25, 4);
  assert.deepEqual(a, b, 'deterministic'); assert.notDeepEqual(a, c, 'another seed, another path');
  const span = [0, 4, 8, 12, 16].map(bar => T.targetAt(bar, 1)), moved = Math.hypot(span[4].x - span[0].x, span[4].y - span[0].y);
  assert.ok(moved > 0.02, `it does wander over 16 bars (${moved.toFixed(3)})`);
});

test('18 travel: the ray follows the kick (brighter, a little thicker), never over its cap, at most 3 peaks a second', () => {
  const fps = 60, run = (kickHz, seconds) => {
    const s = T.rayCreate(), out = [];
    for (let f = 0; f < seconds * fps; f++) {
      const t = f / fps, ph = (t * kickHz) % 1, kick = Math.exp(-ph / kickHz / 0.15);   // a kick envelope, kickHz a second
      out.push({ t, ...T.rayStep(s, kick, 0.5, 1 / fps) });
    }
    return out;
  };
  const r2 = run(2, 6), peaks2 = r2.filter(x => x.peak).length;
  assert.ok(peaks2 >= 11 && peaks2 <= 12, `2 kicks a second: a peak on each (${peaks2})`);
  const at = i => r2[i], first = r2.findIndex((x, i) => i > 0 && x.peak);
  assert.ok(at(first).env > at(first - 1).env + 0.2 && at(first).width > at(first - 1).width, 'brighter and thicker on the kick');
  assert.ok(at(first + 15).env < at(first).env - 0.2, 'and back down within 250 ms');
  const r8 = run(8, 6), peaks8 = r8.filter(x => x.peak);
  assert.ok(peaks8.length / 6 <= 3 + 1e-9, `8 kicks a second: at most 3 peaks a second (${(peaks8.length / 6).toFixed(2)})`);
  for (let i = 1; i < peaks8.length; i++) assert.ok(peaks8[i].t - peaks8[i - 1].t >= T.C.RAY_MIN_GAP - 1e-9);
  for (const x of [...r2, ...r8]) assert.ok(x.env <= T.C.RAY_CAP + 1e-12 && x.env > 0, 'under the cap, never dark');
  const quiet = T.rayStep(T.rayCreate(), 0, 0, 1 / fps);
  assert.ok(Math.abs(quiet.env - T.C.RAY_BASE) < 1e-12 && quiet.width === 1, 'steady without music');
  assert.match(PAGE, /float f = smoothstep\(0\.5, 1\.5, ds\) \* \(1\.0 - smoothstep\(0\.55 \* uLen, uLen, ds\)\);/, 'the same brightness all along it (no flow)');
});
