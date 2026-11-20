// 06 · Lenia + effects, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// (clock.beatGain(?beatKnob) or ?beatGain, at most 2 here) scales only the lanes' terms (experiments/06-beat.js). The key
// safety check: at g = 1 (and untouched, or before the clock has beatGain) every term is today's, bit for bit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../../experiments/06-beat.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/06-lenia-effects.html', import.meta.url), 'utf8');
const grid = [0, 0.001, 0.02, 0.1, 0.25, 1 / 3, 0.5, 0.7, 0.9, 0.999, 1];

test('06 beat gain: g = 1, untouched or no beatGain() yet draws exactly as today', () => {
  const fxBulge = 0.5, fxBloom = 0.6, fxZoom = 1.006, now = 12345.678;
  for (const k of grid) for (const s of grid) for (const h of [0, 0.4, 1]) {
    const T = B.beatTerms(1, k, s, h);
    // today's 06-lenia-effects.html terms, verbatim
    assert.equal(fxBulge * k * 0.02 * T.bulge, fxBulge * k * 0.02, 'bulge');
    assert.equal(fxBloom * (1 + T.bloomKick), fxBloom * (1 + 1.5 * k), 'bloom pump');
    assert.equal(0.8 + T.light + 0.1 * now / 1000, 0.8 + 1.2 * s + 0.1 * now / 1000, 'light swing');
    assert.equal(1 + (fxZoom - 1) * (1 + T.zoomKick), 1 + (fxZoom - 1) * (1 + 2 * k), 'trail zoom');
    assert.equal(T.snare, s, 'uSnare'); assert.equal(T.hat, h, 'uHat');
  }
  assert.equal(B.beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(B.beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(B.beatGainOf({ beatGain: n => (n === 2 ? 1.5 : null) }, 2, null), 1.5, 'the knob');
  assert.equal(B.beatGainOf({ beatGain: () => 3 }, 1, null), 2, 'at most 2 here');
  assert.equal(B.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  // the page: every lane term goes through beatTerms; μ, the blobs and the bases are untouched
  for (const old of ['1 + 1.5 * L.kick', '0.8 + 1.2 * L.snare', '(1 + 2 * L.kick)', 'mSnareFlash ? L.snare : 0', 'mHatShimmer ? L.hat : 0']) assert.ok(!PAGE.includes(old), `old term gone: ${old}`);
  assert.match(PAGE, /const BT = LeniaBeat\.beatTerms\(qaBeatG !== null \? qaBeatG : LeniaBeat\.beatGainOf\(metronome, params\.beatKnob \|\| 1, params\.beatGain\), L\.kick, L\.snare, L\.hat\);/);
  assert.match(PAGE, /bulge\(params\.fxBulge \* L\.kick \* 0\.02 \* BT\.bulge\)/);
  assert.match(PAGE, /const muEff = params\.mu \+ \(maps\.mKickMu \? 0\.005 \* L\.kick : 0\);/, 'μ as before');
  assert.match(PAGE, /<script src="06-beat\.js"><\/script>/);
});

test('06 beat gain: g = 0 removes the beat terms (no bulge, bloom pump, zoom kick, light swing, snare flash, hat shimmer)', () => {
  for (const k of grid) for (const s of grid) {
    const T = B.beatTerms(0, k, s, 1);
    assert.deepEqual([T.bulge, T.bloomKick, T.light, T.zoomKick, T.snare, T.hat], [0, 0, 0, 0, 0, 0]);
  }
});

test('06 beat gain: the knob top (g 3, clamped to 2) stays under the caps; the hats never go above today', () => {
  for (const k of grid) for (const s of grid) for (const h of [0, 0.5, 1]) {
    const T = B.beatTerms(3, k, s, h), T2 = B.beatTerms(2, k, s, h);
    assert.deepEqual(T, T2, 'g clamps to 2');
    assert.equal(T.g, 2);
    assert.ok(T.snare <= 2 + 1e-12, 'snare flash at most ×2 (+1.0)');
    assert.ok(T.bloomKick <= B.C.BLOOM_CAP && T.bloomKick >= B.beatTerms(1, k, s, h).bloomKick, 'bloom pump stronger, capped');
    assert.equal(T.hat, h, 'hats (4 a second) stay as today');
  }
  // the snare flash at g = 2: one 10 % rise per snare (2 a bar), far under 3 a second at 120-180 bpm
  const fps = 60, rises = [];
  let env = 0, prev = 0;
  for (let f = 0; f < 6 * fps; f++) {
    const t = f / fps, beat = Math.floor(t * 3), was = Math.floor((t - 1 / fps) * 3);   // 180 bpm
    env = f && beat !== was && beat % 2 === 1 ? 1 : env * Math.exp(-1 / fps / 0.12);   // the snare on beats 2 and 4
    const lum = 1 + 0.5 * B.beatTerms(2, 0, env, 0).snare;
    if (prev && lum > prev * 1.1) rises.push(t);
    prev = lum;
  }
  const perSec = Math.max(...[...Array(6).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
  assert.ok(perSec <= 3, `snare flashes of 10 % or more: ${perSec} a second`);
});
