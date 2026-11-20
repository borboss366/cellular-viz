// 11 · Riemann, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// (clock.beatGain(?beatKnob) or ?beatGain, at most 2 here) scales the drum levels the scenes draw from
// (experiments/11-beat.js beatLanes). The key safety check: at g = 1 (and untouched) every level is today's, bit for bit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../../experiments/11-beat.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/11-riemann-show.html', import.meta.url), 'utf8');
const levels = [0, 0.001, 0.1, 1 / 3, 0.5, 0.7, 0.999, 1];
const lanes = (k, s, h) => ({ kick: k, snare: s, hat: h, bars: 3.25, beats: 13, phase: 0.25, bpm: 120 });

test('11 beat gain: g = 1, untouched or no beatGain() yet draws exactly as today', () => {
  for (const k of levels) for (const s of levels) for (const h of [0, 0.4, 1]) for (const g of [1, undefined, null, NaN]) {
    const L = lanes(k, s, h), LB = B.beatLanes(g, L);
    assert.equal(LB.kick, k); assert.equal(LB.snare, s); assert.equal(LB.hat, h);
    assert.equal(LB.bars, L.bars); assert.equal(LB.beats, L.beats); assert.equal(LB.phase, L.phase);
    // the ribbon's terms with today's numbers
    assert.equal(0.06 * LB.kick, 0.06 * k, 'shake'); assert.equal(0.3 + LB.kick, 0.3 + k, 'roll');
    assert.deepEqual(L, lanes(k, s, h), 'the clock and audio-in lanes are left alone');
  }
  assert.equal(B.beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(B.beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(B.beatGainOf({ beatGain: n => (n === 3 ? 1.25 : null) }, 3, null), 1.25, 'the knob');
  assert.equal(B.beatGainOf({ beatGain: () => 3 }, 1, null), 2, 'at most 2 here');
  assert.equal(B.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  // the page: the scenes draw from the scaled lanes; the zero flash and the hit log keep the clock's own
  assert.match(PAGE, /const LB = RiemannBeat\.beatLanes\(qaBeatG !== null \? qaBeatG : RiemannBeat\.beatGainOf\(metronome, params\.beatKnob \|\| 1, params\.beatGain\), L\);/);
  assert.match(PAGE, /const S = \{ W, H, tc, L: LB, bars, flash, pad, sectionBars \};/);
  assert.match(PAGE, /const L = Object\.assign\(metronome\.read\(\), audio\.read\(\)\);/, 'the lanes as read');
  assert.match(PAGE, /if \(lz\.k !== lastK\) \{   \/\/ a zero on the downbeat\n    flash = 1; lastK = lz\.k;/, 'the zero flash as before');
  assert.match(PAGE, /flash = Math\.max\(0, flash - 0\.05\);/);
  assert.match(PAGE, /RiemannBeat\.beatLanes\(S\.L\.beat \? S\.L\.beat\.g : 1, metronome\.read\(params\.canyonLead \/ 1000\)\)/, 'the canyon look-ahead at the same gain');
  assert.match(PAGE, /<script src="11-beat\.js"><\/script>/);
});

test('11 beat gain: g = 0 removes every drum level from the pictures', () => {
  for (const k of levels) for (const s of levels) {
    const LB = B.beatLanes(0, lanes(k, s, 1));
    assert.deepEqual([LB.kick, LB.snare, LB.hat], [0, 0, 0]);
    assert.equal(0.06 * LB.kick, 0, 'no shake');
  }
});

test('11 beat gain: the knob top (3, clamped to 2) doubles kick and snare; the hats never go above today', () => {
  for (const k of levels) for (const s of levels) for (const h of [0, 0.5, 1]) {
    const LB = B.beatLanes(3, lanes(k, s, h));
    assert.deepEqual(LB, B.beatLanes(2, lanes(k, s, h)), 'g clamps to 2');
    assert.equal(LB.kick, 2 * k); assert.equal(LB.snare, 2 * s); assert.equal(LB.hat, h, 'hats (4 a second) stay as today');
    assert.ok(0.45 * LB.kick <= 0.9 + 1e-12, 'the ribbon\'s kick brightening at most +0.9 (under 2x)');
    assert.ok(0.12 * LB.kick <= 0.24 + 1e-12, 'the canyon\'s breath at most +0.24');
  }
  // the ribbon's whole-frame brightening (1 + 0.45·kick) at g = 2 on a kick every beat at 180 bpm: rises of 10 % or
  // more at most 3 a second
  const fps = 60, rises = [];
  let env = 0, prev = 0;
  for (let f = 0; f < 6 * fps; f++) {
    const t = f / fps, beat = Math.floor(t * 3), was = Math.floor((t - 1 / fps) * 3);
    env = f && beat !== was ? 1 : env * Math.exp(-1 / fps / 0.15);
    const lum = 1 + 0.45 * B.beatLanes(2, lanes(env, 0, 0)).kick;
    if (prev && lum > prev * 1.1) rises.push(t);
    prev = lum;
  }
  const perSec = Math.max(0, ...[...Array(6).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
  assert.ok(perSec <= 3, `kick brightenings of 10 % or more: ${perSec} a second`);
});
