// 16b · Hodge Kaleidoscope, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// from clock.beatGain(?beatKnob) or ?beatGain scales only the kick/snare terms (experiments/16-dive.js beatTerms). The
// key safety check: at g = 1 (and untouched, or before the clock has beatGain) every term is today's, bit for bit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Dive = require('../../../experiments/16-dive.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/16-hodge-kaleidoscope.html', import.meta.url), 'utf8');
const grid = [0, 0.001, 0.1, 0.25, 1 / 3, 0.5, 0.7, 0.9, 0.999, 1];

test('16b beat gain: g = 1, untouched or no beatGain() yet draws exactly as today', () => {
  for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(1, k, 0.5, p);
    assert.equal(T.kickSize, 0.03 * k); assert.equal(T.pop, 0.06 * p); assert.equal(T.breath, 0.02);
    assert.equal(T.glow, 0.35 * k); assert.equal(T.hueG, 1);
    assert.equal(1 + T.kickSize, 1 + 0.03 * k, 'the cell swell'); assert.equal(1 + T.pop, 1 + 0.06 * p, 'the pop');
  }
  assert.equal(Dive.beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(Dive.beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(Dive.beatGainOf(null, 1, undefined), 1);
  assert.equal(Dive.beatGainOf({ beatGain: n => (n === 5 ? 2 : null) }, 5, null), 2, 'the knob');
  assert.equal(Dive.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(Dive.beatGainOf({ beatGain: () => { throw new Error('x'); } }, 1, null), 1);
  // the page: the old terms are gone and every one goes through beatTerms; the shader keeps g = 1 exact
  for (const old of ['(1 + 0.03 * kick)', '1 + 0.06 * st.popEnv', '1 + 0.02 * Math.sin(2 * Math.PI * bars)', '(1.0 + 0.35 * uKick)', '90.0 * uSnare']) assert.ok(!PAGE.includes(old), `old term gone: ${old}`);
  assert.match(PAGE, /Dive\.beatTerms\(qaBeatG !== null \? qaBeatG : Dive\.beatGainOf\(metronome, params\.beatKnob, params\.beatGain\), kick, snare, st\.popEnv\)/);
  assert.match(PAGE, /m \* \(1 \+ BT\.kickSize\) \* pop/); assert.match(PAGE, /const pop = 1 \+ BT\.pop;/);
  assert.match(PAGE, /1 \+ BT\.breath \* Math\.sin\(2 \* Math\.PI \* bars\), 1 \+ BT\.breath \* nb\.low/);
  assert.match(PAGE, /\(1\.0 \+ min\(1\.0, 0\.35 \* uBeatG \* uKick\)\)/); assert.match(PAGE, /90\.0 \* min\(uBeatG, 2\.0\) \* uSnare/);
  assert.match(PAGE, /params\.beatKnob = knobArg\('beatKnob'\) \|\| 1;/);
});

test('16b beat gain: g = 0 removes the beat terms (no swell, pop, breath, kick glow or snare hue)', () => {
  for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(0, k, 1, p);
    assert.equal(T.kickSize, 0); assert.equal(T.pop, 0); assert.equal(T.breath, 0); assert.equal(T.glow, 0); assert.equal(T.hueG, 0);
  }
});

test('16b beat gain: g = 3 stays under the caps (sizes +0.25, glow +1.0) and never flashes more than 3 times a second', () => {
  let maxSize = 0, maxPop = 0, maxGlow = 0;
  for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(3, k, 1, p), T9 = Dive.beatTerms(9, k, 1, p);
    assert.deepEqual(T9, T, 'g clamps to 3');
    maxSize = Math.max(maxSize, T.kickSize); maxPop = Math.max(maxPop, T.pop); maxGlow = Math.max(maxGlow, T.glow);
    assert.ok(T.breath <= Dive.C.SIZE_CAP && T.hueG <= Dive.C.HUE_G_MAX);
    assert.ok(T.kickSize >= Dive.beatTerms(1, k, 1, p).kickSize, 'stronger than today');
  }
  assert.ok(maxSize <= 0.25 && maxPop <= 0.25, `sizes (${maxSize}, ${maxPop})`);
  assert.equal(maxGlow, 1.0, 'the kick glow reaches its cap (2x the gem luminance), never more');
  // the kick glow at g = 3 on the page's kick envelope (τ 0.15 s, 120 bpm, a kick a beat): rises of more than 10 % per s
  const fps = 60, rises = [];
  let env = 0, prev = 0;
  for (let f = 0; f < 10 * fps; f++) {
    const t = f / fps, beat = Math.floor(t * 2), was = Math.floor((t - 1 / fps) * 2);
    env = f && beat !== was ? 1 : env * Math.exp(-1 / fps / 0.15);
    const lum = 1 + Dive.beatTerms(3, env, 0, 0).glow;
    if (lum > prev * 1.1) rises.push(t);
    prev = lum;
  }
  const perSec = Math.max(...[...Array(10).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
  assert.ok(perSec <= 3, `jumps of 10 % or more: ${perSec} a second`);
});
