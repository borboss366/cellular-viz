// 24 Paint Pour on a tilted plane (the user, 20 Nov 22:12-22:21; VIZ research #87 comments 7049587530 and 7049690373):
// the maths the scene runs every frame (experiments/24-paint-pour.mjs TILT): the thin-film law u = K sin(theta) h^2,
// the thickness, the knob's mapping and slew, the kick's breath, the scroll and its coverage trim. The page's own
// gates (TT1-TT3, TK1-TK3 on the GPU) are in qa/experiments/<PR>.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as P from '../../../experiments/24-paint-pour.mjs';

const SRC = fs.readFileSync(new URL('../../../experiments/24-paint-pour.mjs', import.meta.url), 'utf8');
const { TILT } = P;

test('TT2 / TK1: downhill speed grows with sin(tilt), exactly 0 flat; knob 1 (60 degrees) far above knob 0', () => {
  assert.equal(P.downhillSpeed(1, 0), 0, 'flat: no flow');
  let prev = 0;
  for (let deg = 1; deg <= 60; deg++) {
    const v = P.downhillSpeed(1, deg);
    assert.ok(v > prev, `${deg} degrees: faster than ${deg - 1}`); prev = v;
  }
  const v20 = P.downhillSpeed(1, 20), v45 = P.downhillSpeed(1, 45);
  assert.ok(Math.abs(v45 / v20 - Math.sin(Math.PI / 4) / Math.sin(Math.PI / 9)) < 1e-12, 'the ratio is sin 45 / sin 20');
  const k0 = P.downhillSpeed(1, P.tiltOfKnob(0)), k1 = P.downhillSpeed(1, P.tiltOfKnob(1));
  assert.equal(k0, 0); assert.ok(k1 >= 5 * k0 && k1 > 0.09, `knob 1: ${k1} heights a second`);
  assert.ok(k1 <= 0.1, 'at most 0.1 screen heights a second: under the shader\'s motion damping (uV0), so no stripe flash');
  assert.deepEqual([P.tiltOfKnob(0), P.tiltOfKnob(0.5), P.tiltOfKnob(1), P.tiltOfKnob(2), P.tiltOfKnob(-1)], [0, 30, 60, 60, 0], 'linear 0 -> 60, clamped');
});

test('TT3: the h^2 law on the scene\'s own step: twice as thick advances 4x as far; thickness falls to 0 once poured', () => {
  for (const deg of [20, 35, 45, 60]) {
    const a = { h0: 1, g: 0, frozen: false }, b = { h0: 2, g: 0, frozen: false };
    for (let f = 0; f < 120; f++) { P.driftStep(a, deg, 1 / 60, -1); P.driftStep(b, deg, 1 / 60, -1); }
    assert.ok(Math.abs(b.g / a.g - 4) < 1e-12, `${deg} degrees: ratio ${b.g / a.g}`);
    assert.ok(Math.abs(a.g - 2 * P.downhillSpeed(1, deg)) < 1e-12, '2 s at the law\'s speed');
  }
  const f = { h0: 1, g: 0, frozen: true }; P.driftStep(f, 60, 1, -1); assert.equal(f.g, 0, 'a baked (frozen) group no longer slides');
  assert.equal(P.thicknessAt(1, -3), 1, 'still pouring: full thickness'); assert.equal(P.thicknessAt(1, 0), 1);
  assert.equal(P.thicknessAt(1, TILT.SET_S), 0, 'set after SET_S'); assert.equal(P.thicknessAt(1, 99), 0);
  let prev = 1;
  for (let s = 0.1; s < TILT.SET_S; s += 0.1) { const h = P.thicknessAt(1, s); assert.ok(h <= prev && h >= 0); prev = h; }
  assert.equal(P.H0.drop, 1); assert.equal(P.H0.kick, undefined, 'strokes (combs, vortices) are not paint: they do not slide');
});

test('the knob: slewed at <= 60 degrees a second, first frame on target; the kick breath: smooth, >= 140 ms tail, 0 when flat', () => {
  // a sweep 0 -> 60 -> 0 over 4 s (TK2, as ?qaTiltSweep=1) and a slam, at 60 and at 30 fps
  for (const fps of [60, 30]) {
    let d = P.slewTilt(null, 0, 0), maxRate = 0, maxLag = 0;
    for (let f = 1; f <= 8 * fps; f++) {
      const t = (f / fps) % 8, target = 60 * (t < 2 ? t / 2 : t < 4 ? 2 - t / 2 : 0), prev = d;
      d = P.slewTilt(d, target, 1 / fps);
      maxRate = Math.max(maxRate, Math.abs(d - prev) * fps); maxLag = Math.max(maxLag, Math.abs(d - target));
    }
    assert.ok(maxRate <= 60 + 1e-9, `${fps} fps: ${maxRate} degrees a second`);
    assert.ok(maxLag < 1e-9, `${fps} fps: the 4 s sweep (30 degrees a second) is followed exactly (${maxLag})`);
    let s = P.slewTilt(0, 60, 0); for (let f = 0; f < fps / 2; f++) s = P.slewTilt(s, 60, 1 / fps);
    assert.ok(Math.abs(s - 30) < 1e-9, `${fps} fps: a slam to 60 takes 1 s (${s} after 0.5 s)`);
  }
  assert.equal(P.slewTilt(null, 35, 0), 35, 'first frame: the target (the page\'s 35 at once)');
  assert.equal(P.breathEnv(0), 0, 'the hit: 0, then a 30 ms rise');
  let peak = 0, peakT = 0;
  for (let ms = 0; ms <= 1000; ms++) { const e = P.breathEnv(ms / 1000); if (e > peak) { peak = e; peakT = ms; } }
  assert.ok(Math.abs(peak - 1) < 1e-4 && peakT >= 40 && peakT <= 70, `peak 1 at ${peakT} ms`);
  assert.ok(P.breathEnv(0.14 + peakT / 1000) > 0.35, 'still breathing 140 ms after the peak (the tail is >= 140 ms)');
  assert.ok(P.breathEnv(1.5) < 1e-3);
  assert.equal(P.tiltEffective(0, 0.05, 3), 0, 'flat stays flat on the kick (TT1)');
  assert.ok(Math.abs(P.tiltEffective(35, peakT / 1000, 1) - 38) < 1e-3, '35 + 3 degrees at the breath\'s peak, g = 1');
  assert.ok(Math.abs(P.tiltEffective(35, peakT / 1000, 3) - 44) < 1e-3, 'x the beat gain (g 3: +9)');
  assert.equal(P.tiltEffective(35, peakT / 1000, 0), 35, 'beat knob down: no breath');
  assert.equal(P.tiltEffective(60, peakT / 1000, 3), 60, 'clamped to 60');
  assert.ok(P.tiltEffective(5, peakT / 1000, 1) < 5 + 3 * 0.6, 'faded in over the first 10 degrees');
});

test('the camera follows the flow: no scroll flat, the coverage trim keeps the dark share in its band; no Math.random', () => {
  assert.equal(P.scrollSpeed(0, 1), 0); assert.equal(P.scrollSpeed(0, 2), 0, 'flat: the camera stays put (TT1)');
  assert.ok(Math.abs(P.scrollSpeed(35, 1) - TILT.SCROLL * P.downhillSpeed(1, 35)) < 1e-15, 'SCROLL x the speed of h = 1 paint');
  assert.ok(P.scrollSpeed(35, 1) < P.downhillSpeed(1, 35), 'fresh thick paint outruns the camera (it runs down the screen)');
  assert.equal(P.trimTarget(null), 1); assert.equal(P.trimTarget(0.4), 1, 'in the band: as is');
  assert.ok(P.trimTarget(0.1) > 1 && P.trimTarget(0) <= 4, 'too covered: faster, more clean plane comes in');
  assert.ok(P.trimTarget(0.8) < 1 && P.trimTarget(1) >= 0.4, 'too dark: slower (and the pour feeds)');
  for (let x = 0; x < 1; x += 0.01) assert.ok(P.trimTarget(x + 0.01) <= P.trimTarget(x) + 1e-12, 'monotone');
  assert.ok(TILT.FEED_DARK > TILT.DARK_LO && TILT.FEED_DARK < 0.6 && TILT.DARK_HI <= 0.6, 'the feed and trim act inside truth 10\'s 25-60 %');
  assert.ok(!/Math\.random/.test(SRC), 'no Math.random in the scene (the feed comes from K.rngAt)');
  assert.match(SRC, /!\/\^\(trigger\|tilt\)\/\.test\(o\.cause\)/, 'truth 9 leaves the tilt feed out like the triggers');
  assert.match(SRC, /SCROLL: 0\.3,/, 'the camera choice in one place (TILT.SCROLL, 0 = fixed)');
});
