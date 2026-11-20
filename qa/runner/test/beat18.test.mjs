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
    assert.ok(0.6 * LB.kick * T.lightScale(3) <= 1.0 + 1e-12, 'sprites and glow width at most 2x');
    assert.ok(T.glowOf(LB.kick, 3) - 0.7 <= 1.0 + 1e-12 && T.haloOf(LB.kick, 3) - 0.9 <= 0.25 + 1e-12, 'glow width +1.0, halo width +0.25 at most');
    for (const g of [1, 0.5, 0, undefined, NaN]) {   // the scaled caps change nothing at g <= 1, bit for bit
      assert.equal(T.glowOf(k, g), 0.7 + 0.6 * k); assert.equal(T.haloOf(k, g), 0.9 + 0.25 * k); assert.equal(k * T.lightScale(g), k);
    }
    assert.equal(LB.snare, s, 'the dipoles\' snare light (already 4x) stays as today');
    assert.equal(LB.hat, h, 'hats (4 a second) stay as today');
  }
  for (const cap of ['glowPx = 2.2 * sc * Travel.glowOf(bassEnv, L.beat.g)', 'stringSprites(sprites, L.kick * Travel.lightScale(L.beat.g), L.hat)',
    'halo = Travel.haloOf(bassEnv, L.beat.g)', 'const lv = [L.kick / Math.max(1, L.beat.g), L.snare, L.hat]']) assert.ok(PAGE.includes(cap), cap);
  assert.ok(!/Math\.min\(bassEnv/.test(PAGE), 'no clamp on the bass envelope (a clamp is a flat top: the peak moves off the kick)');
  // at g = 2 the bass-driven terms (the page's bassEnv, halo and glow width) peak in the kick's own frame, no plateau
  {
    const fps = 60, kickAt = [30, 60, 90, 120];   // 2 kicks a second at 120 BPM
    let bass = 0, last = -1e9;
    const halo = [], glow = [];
    for (let f = 0; f < 150; f++) {
      if (kickAt.includes(f)) last = f;
      const kick = f >= last ? Math.exp(-(f - last) / fps / 0.15) : 0;
      const LB = T.beatLanes(2, lanes(f >= kickAt[0] ? kick : 0, 0, 0));
      bass = Math.max(LB.kick, bass * Math.exp(-1 / fps / 0.25));   // the page's bassEnv
      halo.push(T.haloOf(bass, LB.beat.g)); glow.push(T.glowOf(bass, LB.beat.g));
    }
    for (const k of kickAt) {
      const span = [k, k + 29];
      for (const [name, s] of [['halo', halo], ['glow width', glow]]) {
        const w = s.slice(span[0], span[1] + 1), peak = w.indexOf(Math.max(...w));
        assert.equal(peak, 0, `${name} peaks ${peak} frames after the kick at frame ${k}`);
        assert.ok(w[1] < w[0] && w[2] < w[1], `${name} falls right after the kick at frame ${k} (no flat top)`);
      }
    }
  }
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
