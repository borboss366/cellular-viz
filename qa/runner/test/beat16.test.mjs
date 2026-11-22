// 16b · Hodge Kaleidoscope, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"; then the Mac
// session: "make Hodge's beat effect about 4x stronger", the middle too): the beat gain g from clock.beatGain(?beatKnob)
// or ?beatGain scales only the kick/snare terms (experiments/16-dive.js beatTerms), each 4x the first beat-gain's, under
// the same caps (sizes +0.25, glow +1.0, snare hue 180 degrees), scaled not clamped (the hit's peak is never flattened).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Dive = require('../../../experiments/16-dive.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/16-hodge-kaleidoscope.html', import.meta.url), 'utf8');
const grid = [0, 0.001, 0.1, 0.25, 1 / 3, 0.5, 0.7, 0.9, 0.999, 1];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-12, `${msg}: ${a} vs ${b}`);

test('16b beat gain 4x: g = 1 (the knob untouched or in the middle) is 4x the first beat-gain\'s terms', () => {
  for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(1, k, 0.5, p);
    near(T.kickSize, 0.12 * k, 'the cell swell 0.12 (was 0.03)'); near(T.pop, 0.24 * p, 'the pop 0.24 (was 0.06)');
    near(T.breath, 0.08, 'the breath 0.08 (was 0.02)');
    near(T.glow, 1.0 * k, 'the kick glow: 4 x 0.35 = 1.4, capped at 1.0 (2x the gem)');
    assert.equal(T.hue, 180, 'the snare hue: 4 x 90 = 360, capped at 180 degrees'); assert.equal(T.hueG, 2);
    assert.ok(T.kickSize >= 4 * 0.03 * k - 1e-12 && T.pop >= 4 * 0.06 * p - 1e-12, '4x the old swell and pop');
  }
  assert.deepEqual([Dive.C.KICK_SIZE, Dive.C.POP, Dive.C.BREATH, Dive.C.KICK_GLOW, Dive.C.SNARE_HUE], [0.12, 0.24, 0.08, 1.4, 360]);
  assert.deepEqual([Dive.C.SIZE_CAP, Dive.C.GLOW_CAP, Dive.C.HUE_CAP], [0.25, 1.0, 180], 'the caps are unchanged');
  assert.equal(Dive.beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(Dive.beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(Dive.beatGainOf(null, 1, undefined), 1);
  assert.equal(Dive.beatGainOf({ beatGain: n => (n === 5 ? 2 : null) }, 5, null), 2, 'the knob');
  assert.equal(Dive.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(Dive.beatGainOf({ beatGain: () => { throw new Error('x'); } }, 1, null), 1);
  // the page: every term goes through beatTerms; the shader's glow and hue are the same capped-coefficient forms
  for (const old of ['(1 + 0.03 * kick)', '1 + 0.06 * st.popEnv', '1 + 0.02 * Math.sin(2 * Math.PI * bars)', '(1.0 + 0.35 * uKick)', '90.0 * uSnare', '0.35 * uBeatG * uKick', '90.0 * min(uBeatG, 2.0)']) assert.ok(!PAGE.includes(old), `old term gone: ${old}`);
  assert.match(PAGE, /Dive\.beatTerms\(qaBeatG !== null \? qaBeatG : Dive\.beatGainOf\(metronome, params\.beatKnob, params\.beatGain\), kick, snare, st\.popEnv\)/);
  assert.match(PAGE, /m \* \(1 \+ BT\.kickSize\) \* pop/); assert.match(PAGE, /const pop = 1 \+ BT\.pop;/);
  assert.match(PAGE, /1 \+ BT\.breath \* Math\.sin\(2 \* Math\.PI \* bars\), 1 \+ BT\.breath \* nb\.low/);
  assert.match(PAGE, /\(1\.0 \+ min\(1\.6, min\(1\.0, 1\.4 \* min\(uBeatG, 1\.0\)\) \+ 0\.3 \* max\(uBeatG - 1\.0, 0\.0\)\) \* uKick\)/); assert.match(PAGE, /min\(180\.0, 360\.0 \* uBeatG\) \* uSnare/);
  assert.match(PAGE, /params\.beatKnob = knobArg\('beatKnob'\) \|\| 1;/);
});

test('16b beat gain 4x: g = 0 removes the beat terms (no swell, pop, breath, kick glow or snare hue)', () => {
  for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(0, k, 1, p);
    assert.equal(T.kickSize, 0); assert.equal(T.pop, 0); assert.equal(T.breath, 0); assert.equal(T.glow, 0); assert.equal(T.hue, 0); assert.equal(T.hueG, 0);
  }
});

test('16b stronger top (Sunday, 22 Nov): the middle unchanged, the top clearly bigger, the shader glow matches beatTerms', () => {
  // the middle and below: bit for bit the 4x terms (the caps above never reached for g <= 1)
  for (const g of [0, 0.25, 0.5, 0.75, 1]) for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(g, k, 0.5, p);
    near(T.kickSize, Math.min(0.25, 0.12 * g) * k, `swell g ${g}`); near(T.pop, Math.min(0.25, 0.24 * g) * p, `pop g ${g}`);
    near(T.breath, Math.min(0.25, 0.08 * g), `breath g ${g}`); near(T.glow, Math.min(1, 1.4 * g) * k, `glow g ${g}`);
  }
  // the top (g 3): swell 0.40, pop 0.50, breath 0.30, glow 1.6; it grows all the way up from the middle
  const top = Dive.beatTerms(3, 1, 0, 1);
  near(top.kickSize, 0.40, 'swell at the top'); near(top.pop, 0.50, 'pop at the top'); near(top.breath, 0.30, 'breath at the top'); near(top.glow, 1.6, 'glow at the top');
  const old = { kickSize: 0.25, pop: 0.25, breath: 0.24, glow: 1.0 };   // the top before (#292)
  assert.ok(top.kickSize >= 1.5 * old.kickSize && top.pop >= 2 * old.pop - 1e-12, 'the sizes carry the extra');
  let prev = Dive.beatTerms(1, 1, 0, 1);
  for (let g = 1.1; g <= 3.0001; g += 0.1) {
    const T = Dive.beatTerms(g, 1, 0, 1);
    assert.ok(T.kickSize > prev.kickSize && T.pop > prev.pop && T.breath > prev.breath && T.glow > prev.glow, `grows at g ${g.toFixed(1)}`);
    prev = T;
  }
  // the shader's glow coefficient (GLSL on the page) equals beatTerms' at every g
  const glsl = g => Math.min(1.6, Math.min(1.0, 1.4 * Math.min(g, 1.0)) + 0.3 * Math.max(g - 1.0, 0.0));
  for (let g = 0; g <= 3.0001; g += 0.05) near(glsl(g), Dive.beatTerms(g, 1, 0, 0).glow, `shader glow g ${g.toFixed(2)}`);
});

test('16b beat gain 4x: g = 3 stays under the caps, every term peaks on its hit (no flat top), at most 3 big rises a second', () => {
  let maxSize = 0, maxPop = 0, maxGlow = 0;
  for (const k of grid) for (const p of grid) {
    const T = Dive.beatTerms(3, k, 1, p), T9 = Dive.beatTerms(9, k, 1, p);
    assert.deepEqual(T9, T, 'g clamps to 3');
    maxSize = Math.max(maxSize, T.kickSize); maxPop = Math.max(maxPop, T.pop); maxGlow = Math.max(maxGlow, T.glow);
    assert.ok(T.breath <= Dive.C.SIZE_MAX && T.hue <= Dive.C.HUE_CAP);
    assert.ok(T.kickSize >= Dive.beatTerms(1, k, 1, p).kickSize, 'the top is at least the middle');
  }
  assert.ok(maxSize <= Dive.C.SIZE_MAX + 1e-12 && maxPop <= Dive.C.SIZE_MAX + 1e-12, `sizes (${maxSize}, ${maxPop})`);
  near(maxGlow, Dive.C.GLOW_MAX, 'the kick glow reaches its top (2.6x the gem luminance), never more');
  near(Dive.beatTerms(3, 1, 0, 0).breath, 0.30, 'above the middle the knob adds breath');
  // scaled, not clamped: on a decaying kick every term falls on every frame after the hit (the old min() held a flat top)
  for (const g of [1, 2, 3]) {
    let prev = null;
    for (let f = 0; f < 30; f++) {
      const env = Math.exp(-f / 60 / 0.15), T = Dive.beatTerms(g, env, 0, env);
      if (prev) { assert.ok(T.kickSize < prev.kickSize && T.pop < prev.pop && T.glow < prev.glow, `g ${g}: falls at frame ${f}`); }
      prev = T;
    }
  }
  // the kick glow on the page's kick envelope (τ 0.15 s, a kick a beat, 120 and 180 bpm): rises of 10 % or more per s
  for (const bpm of [120, 180]) for (const g of [1, 3]) {
    const fps = 60, rises = [], bps = bpm / 60;
    let env = 0, prev = 0;
    for (let f = 0; f < 10 * fps; f++) {
      const t = f / fps, beat = Math.floor(t * bps), was = Math.floor((t - 1 / fps) * bps);
      env = f && beat !== was ? 1 : env * Math.exp(-1 / fps / 0.15);
      const lum = 1 + Dive.beatTerms(g, env, 0, 0).glow;
      if (lum > prev * 1.1) rises.push(t);
      prev = lum;
    }
    const perSec = Math.max(...[...Array(10).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
    assert.ok(perSec <= 3, `${bpm} bpm, g ${g}: jumps of 10 % or more: ${perSec} a second`);
  }
});
