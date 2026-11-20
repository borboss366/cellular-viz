// 24 · Paint Pour, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// (controls.beatGain; the page reads clock.beatGain(?beatKnob) or ?beatGain) scales the kick's gloss and the colour pulse
// (experiments/24-paint-pour.mjs beatTerms). The key safety check: at g = 1 (and absent) both are today's, bit for bit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BEAT, beatGainOf, beatTerms } from '../../../experiments/24-paint-pour.mjs';
import * as K from '../../../experiments/24-marble.mjs';
const SRC = fs.readFileSync(new URL('../../../experiments/24-paint-pour.mjs', import.meta.url), 'utf8');
const PAGE = fs.readFileSync(new URL('../../../experiments/24-paint-pour.html', import.meta.url), 'utf8');
const kicks = [0, 0.001, 0.1, 0.37, 0.5, 0.9, 1];
const pulses = Array.from({ length: 21 }, (_, i) => 0.7 * K.beatPulse(i / 20));   // ?pulse 0.7 over one beat

test('24 beat gain: g = 1 or absent (no beatGain() yet, knob untouched) draws exactly as today', () => {
  for (const kick of kicks) for (const pulse of pulses) for (const g of [1, undefined, null, NaN]) {
    const T = beatTerms(g, kick, pulse);
    assert.equal(T.kick, kick, 'uKick'); assert.equal(T.pulse, pulse, 'uPulse');
    assert.equal(1.0 + 0.1 * T.kick, 1.0 + 0.1 * kick, 'the gloss');
  }
  assert.equal(beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(beatGainOf({ beatGain: n => (n === 7 ? 2.5 : null) }, 7, null), 2.5, 'the knob');
  assert.equal(beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(beatGainOf({ beatGain: () => { throw new Error('x'); } }, 1, null), 1);
  // the scene: the kick and the pulse reach the shader through beatTerms; the song's ops and the pulse knob are as before
  assert.ok(!SRC.includes('gl.uniform1f(u.uKick, kick)') && !SRC.includes('gl.uniform1f(u.uPulse, pulse)'), 'old uniforms gone');
  assert.match(SRC, /const BT = beatTerms\(ctl\.beatGain, kick, pulse\);/);
  assert.match(SRC, /gl\.uniform1f\(u\.uKick, BT\.kick\); gl\.uniform1f\(u\.uPulse, BT\.pulse\);/);
  assert.match(SRC, /const pulse = \(ctl\.pulse > 0 \? ctl\.pulse : 0\) \* K\.beatPulse\(beats\);/, 'the pulse as before');
  assert.match(PAGE, /beatGain: qaBeatG !== null \? qaBeatG : beatGainOf\(clock, params\.beatKnob, params\.beatGain\)/);
  assert.match(PAGE, /pulse: K\.pulseAmount\(clock, params\.pulseKnob, params\.pulse\)/, 'the pulse knob untouched');
});

test('24 beat gain: g = 0 removes the kick gloss and the colour pulse', () => {
  for (const kick of kicks) for (const pulse of pulses) { const T = beatTerms(0, kick, 1 + pulse); assert.equal(T.kick, 0); assert.equal(T.pulse, 0); }
});

test('24 beat gain: g = 3 stays under the caps (gloss +0.3, pulse brightness +24 %) and pulses once a beat', () => {
  for (const kick of kicks) for (const pulse of [...pulses, 1]) {
    const T = beatTerms(3, kick, pulse);
    assert.deepEqual(beatTerms(8, kick, pulse), T, 'g clamps to 3');
    assert.ok(0.1 * T.kick <= 0.3 + 1e-12 && T.pulse <= BEAT.PULSE_CAP && K.PULSE_GAIN * T.pulse <= 0.24 + 1e-12);
  }
  // the pulse's brightness at g = 3, ?pulse 1, 180 bpm: rises of 10 % or more at most 3 a second
  const fps = 60, rises = [];
  let prev = 0;
  for (let f = 0; f < 6 * fps; f++) {
    const lum = 1 + K.PULSE_GAIN * beatTerms(3, 0, K.beatPulse(f / fps * 3)).pulse;
    if (prev && lum > prev * 1.1 && !(rises.length && f / fps - rises[rises.length - 1] < 0.15)) rises.push(f / fps);
    prev = lum;
  }
  const perSec = Math.max(0, ...[...Array(6).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
  assert.ok(perSec <= 3, `rises of 10 % or more: ${perSec} a second`);
});
