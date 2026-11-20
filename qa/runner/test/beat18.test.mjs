// 18 · Little Bang, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// (clock.beatGain(?beatKnob) or ?beatGain, at most 2 here) scales the drum levels the page draws from
// (experiments/18-travel.js beatLanes). The key safety check: at g = 1 (and untouched) every level is today's, bit for bit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/18-travel.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/18-little-bang.html', import.meta.url), 'utf8');
const levels = [0, 0.001, 0.1, 1 / 3, 0.5, 0.7, 0.999, 1];
const lanes = (k, s, h) => ({ kick: k, snare: s, hat: h, bars: 7.5, beats: 30, phase: 0.5 });

test('18 beat gain: g = 1, untouched or no beatGain() yet draws exactly as today', () => {
  for (const k of levels) for (const s of levels) for (const h of [0, 0.4, 1]) for (const g of [1, undefined, null, NaN]) {
    const L = lanes(k, s, h), LB = T.beatLanes(g, L);
    assert.equal(LB.kick, k); assert.equal(LB.snare, s); assert.equal(LB.hat, h); assert.equal(LB.bars, L.bars);
    // today's terms: the FOV kick, the focusing magnets, the wires' kick glow
    assert.equal(1.15 + 0.06 * LB.kick, 1.15 + 0.06 * k); assert.equal(0.35 + 1.6 * LB.kick, 0.35 + 1.6 * k);
    assert.deepEqual(L, lanes(k, s, h), 'the clock and audio-in lanes are left alone');
  }
  assert.equal(T.beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(T.beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(T.beatGainOf({ beatGain: n => (n === 4 ? 0.5 : null) }, 4, null), 0.5, 'the knob');
  assert.equal(T.beatGainOf({ beatGain: () => 3 }, 1, null), 2, 'at most 2 here');
  assert.equal(T.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  // the page: one scaled lane object after the read; the travel speed is the knob's, not a drum level
  assert.match(PAGE, /const L0 = Object\.assign\(metronome\.read\(params\.lead \/ 1000\), params\.lead \? \{\} : audio\.read\(\)\);/);
  assert.match(PAGE, /const L = Travel\.beatLanes\(qaBeatG !== null \? qaBeatG : Travel\.beatGainOf\(metronome, params\.beatKnob \|\| 1, params\.beatGain\), L0\);/);
  assert.match(PAGE, /const knob = readKnob\(params\.speedKnob\), v = Travel\.speedStep\(travel\.speed, knob, dt\)/, 'the travel speed as before');
  assert.ok(!/speedStep\([^)]*L\.kick/.test(PAGE), 'no drum level in the speed');
});

test('18 beat gain: g = 0 removes every drum level (no FOV kick, magnet pulse, wire glow, ray kick)', () => {
  for (const k of levels) for (const s of levels) {
    const LB = T.beatLanes(0, lanes(k, s, 1));
    assert.deepEqual([LB.kick, LB.snare, LB.hat], [0, 0, 0]);
  }
  // the ray on kicks at g = 0: no peaks, steady at its base
  const ray = T.rayCreate(); let peaks = 0;
  for (let f = 0; f < 240; f++) { const kick = Math.exp(-((f / 60) % 0.5) / 0.15); if (T.rayStep(ray, T.beatLanes(0, lanes(kick, 0, 0)).kick, 0, 1 / 60).peak) peaks++; }
  assert.equal(peaks, 0);
});

test('18 beat gain: the knob top (3, clamped to 2) stays under the caps; snares and hats never go above today', () => {
  for (const k of levels) for (const s of levels) for (const h of [0, 0.5, 1]) {
    const LB = T.beatLanes(3, lanes(k, s, h));
    assert.deepEqual(LB, T.beatLanes(2, lanes(k, s, h)), 'g clamps to 2');
    assert.equal(LB.kick, 2 * k, 'the kick twice today');
    assert.ok(0.06 * LB.kick <= 0.15, 'the FOV kick under 0.15');
    assert.ok(0.5 * LB.kick <= 1.0, 'the wires\' kick glow at most 2x');
    assert.ok(0.6 * Math.min(LB.kick, T.C.BEAT_LIGHT_MAX) <= 1.0 + 1e-12, 'sprites and glow width at most 2x');
    assert.equal(Math.min(0.6 * k, 1), 0.6 * Math.min(k, T.C.BEAT_LIGHT_MAX), 'the light cap is not reached at g = 1');
    assert.equal(LB.snare, s, 'the dipoles\' snare light (already 4x) stays as today');
    assert.equal(LB.hat, h, 'hats (4 a second) stay as today');
  }
  for (const cap of ['Math.min(bassEnv, Travel.C.BEAT_LIGHT_MAX)', 'stringSprites(sprites, Math.min(L.kick, Travel.C.BEAT_LIGHT_MAX), L.hat)',
    'halo = 0.9 + 0.25 * Math.min(bassEnv, 1)', '[L.kick, L.snare, L.hat].map(x => Math.min(1, x))']) assert.ok(PAGE.includes(cap), cap);
  // the ray at g = 2 still peaks at most 3 a second and stays under its cap (18-travel.js rayStep)
  const ray = T.rayCreate(), fps = 60, peaks = [];
  let maxEnv = 0;
  for (let f = 0; f < 6 * fps; f++) {
    const t = f / fps, kick = Math.exp(-((t * 4) % 1) / 4 / 0.15);   // 4 kicks a second (x2 still falls under 0.5 between)
    const R = T.rayStep(ray, T.beatLanes(2, lanes(kick, 0, 0)).kick, 0.5, 1 / fps);
    if (R.peak) peaks.push(t); maxEnv = Math.max(maxEnv, R.env);
  }
  assert.ok(peaks.length / 6 <= 3 + 1e-9, `${(peaks.length / 6).toFixed(2)} peaks a second`);
  assert.ok(maxEnv <= T.C.RAY_CAP + 1e-12);
});
