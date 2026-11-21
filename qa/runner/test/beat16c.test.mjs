// 16c · 27 Neon Lines, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// (controls.beatGain; the page reads clock.beatGain(?beatKnob) or ?beatGain) scales only the beat pulse's terms
// (experiments/16-neon-lines.mjs beatTerms). The key safety check: at g = 1 (and absent) every term is today's, bit for bit.
// 21 Nov (the user: knob 1 from 0 to 100 showed no visible difference): halo 0.6 (cap +1.0) and a camera punch of
// 3 % x g x pulse (cap 9 %), applied after the speed fade; g = 0 gives neither.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BEAT, beatGainOf, beatTerms } from '../../../experiments/16-neon-lines.mjs';
const SRC = fs.readFileSync(new URL('../../../experiments/16-neon-lines.mjs', import.meta.url), 'utf8');
const PAGE = fs.readFileSync(new URL('../../../experiments/16-neon-lines.html', import.meta.url), 'utf8');
// the beat pulse as the scene makes it, over one beat at 60 fps and 120 bpm, and pulseK's values (smear, the drop glide)
const pulses = Array.from({ length: 31 }, (_, i) => { const f = i / 30; return (1 - Math.exp(-f / 0.06)) * Math.exp(-f / 0.36) / 0.62; });
const ks = [0, 0.2, 0.5, 0.83, 1];

test('16c beat gain: g = 1 or absent (no beatGain() yet, knob untouched) draws exactly as today', () => {
  for (const pulse of pulses) for (const pulseK of ks) for (const g of [1, undefined, null, NaN]) {
    const T = beatTerms(g, pulse, pulseK);
    // today's 16-neon-lines.mjs terms, verbatim
    assert.equal(1 + T.width + 0.25 * 0.3, 1 + 0.35 * pulseK * pulse + 0.25 * 0.3, 'beam width');
    assert.equal(1 + T.halo, 1 + Math.min(1.0, 0.6 * pulseK * pulse), 'halo (21 Nov: 0.6, cap +1.0)');
    assert.equal(T.punch, Math.min(0.09, 0.03 * pulseK * pulse), 'camera punch 3 % x pulse at g = 1');
    assert.equal(1 + T.inten + 0.5 * 0.3, 1 + 0.45 * pulseK * pulse + 0.5 * 0.3, 'intensity');
    assert.equal(1 + T.dsize, 1 + 0.12 * pulse, 'diamond size');
    assert.equal(1 + T.dglow + 0.8 * 0.3 + 0.6 * 0.2, 1 + 0.5 * pulse + 0.8 * 0.3 + 0.6 * 0.2, 'diamond glow');
  }
  assert.equal(beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(beatGainOf({ beatGain: n => (n === 6 ? 2.5 : null) }, 6, null), 2.5, 'the knob');
  assert.equal(beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(beatGainOf({ beatGain: () => { throw new Error('x'); } }, 1, null), 1);
  // the scene: every pulse term goes through beatTerms; the flare, the gold and the flash guards are untouched
  assert.equal(BEAT.HALO, 0.6); assert.equal(BEAT.HALO_CAP, 1.0); assert.equal(BEAT.PUNCH, 0.03); assert.equal(BEAT.PUNCH_CAP, 0.09);
  for (const old of ['0.35 * pulseK * pulse', '0.25 * pulseK * pulse', '0.45 * pulseK * pulse', '(1 + 0.12 * pulse)', '0.5 * pulse +']) assert.ok(!SRC.includes(old), `old term gone: ${old}`);
  assert.match(SRC, /const BT = beatTerms\(ctl\.beatGain, pulse, pulseK\);/);
  assert.match(SRC, /\(1 \+ BT\.width \+ 0\.25 \* flare\)/); assert.match(SRC, /\(1 \+ BT\.inten \+ 0\.5 \* flare\)/);
  assert.match(SRC, /const pulseK = st\.glide && st\.glide\.cause === 'drop' && s > 0 \? 0 : 1 - smear;/, 'the flash guard as before');
  assert.match(PAGE, /beatGain: qaBeatG !== null \? qaBeatG : beatGainOf\(metronome, params\.beatKnob, params\.beatGain\)/);
});

test('16c camera punch: a zoom after the speed fade, on beams, diamonds and the surface alike', () => {
  // the punch Z = 1 + BT.punch scales the drawn ends about the screen centre; beamFade still sees the unpunched ends
  assert.match(SRC, /const Z = 1 \+ BT\.punch, zoomP = q => \[W \/ 2 \+ \(q\[0\] - W \/ 2\) \* Z, H \/ 2 \+ \(q\[1\] - H \/ 2\) \* Z\];/);
  assert.match(SRC, /const a = zoomP\(a0\), b = zoomP\(b0\);/, 'putSeg draws the punched ends');
  assert.match(SRC, /const fb = beamFade\(label, A0, A1\);/, 'the speed fade measures the unpunched ends');
  assert.match(SRC, /if \(p\) \{ p = zoomP\(p\); size \*= Z; \}/, 'diamonds punch too');
  assert.match(SRC, /gl\.uniform1f\(su\.uFocal, cam\.focal \* Z\);/, 'the surface: focal x Z is the same zoom');
  assert.ok(SRC.indexOf('const Z = 1 + BT.punch') > SRC.indexOf('const beamFade = '), 'the punch comes after the speed fade');
  // the projection is W/2 + x * focal * H/2, so zooming about the centre by Z equals focal x Z
  const W = 1920, H = 1080, focal = 1 / Math.tan(19 * Math.PI / 180), x = 0.37, Z = 1.06;
  const zoomed = W / 2 + ((W / 2 + x * focal * H / 2) - W / 2) * Z, byFocal = W / 2 + x * (focal * Z) * H / 2;
  assert.ok(Math.abs(zoomed - byFocal) < 1e-9);
});

test('16c beat gain: g = 0 gives no camera punch and no halo beat', () => {
  for (const pulse of pulses) for (const pulseK of ks) {
    const T = beatTerms(0, pulse, pulseK);
    assert.equal(T.punch, 0, 'no punch'); assert.equal(T.halo, 0, 'no halo beat');
  }
  assert.equal(beatTerms(0, 1, 1).punch, 0);
  assert.equal(beatGainOf({ beatGain: () => 0 }, 1, null), 0, 'knob at the bottom (dead zone) gives g 0');
  // scaled, not gated: the punch grows with g up to its 9 % cap, and the flare does not reach it
  assert.ok(Math.abs(beatTerms(2, 1, 1).punch - 0.06) < 1e-12);
  assert.equal(beatTerms(3, 1.2, 1).punch, 0.09, 'capped at 9 %');
  assert.equal(beatTerms(3, 1, 0).punch, 0, 'pulseK 0 (the drop glide, full smear): no punch');
});

test('16c beat gain: g = 0 removes the beat pulse from beams and diamonds', () => {
  for (const pulse of pulses) for (const pulseK of ks) {
    const T = beatTerms(0, pulse, pulseK);
    assert.deepEqual([T.width, T.halo, T.inten, T.dsize, T.dglow, T.punch], [0, 0, 0, 0, 0, 0]);
  }
});

test('16c beat gain: g = 3 stays under the caps (beam light at most 2x, diamonds +0.25 size) and pulses once a beat', () => {
  let max = { width: 0, halo: 0, inten: 0, dsize: 0, dglow: 0, punch: 0 };
  for (const pulse of pulses) for (const pulseK of ks) {
    const T = beatTerms(3, pulse, pulseK);
    assert.deepEqual(beatTerms(7, pulse, pulseK), T, 'g clamps to 3');
    for (const k of Object.keys(max)) max[k] = Math.max(max[k], T[k]);
    assert.ok(T.inten >= beatTerms(1, pulse, pulseK).inten, 'stronger than today');
  }
  assert.ok(max.width <= BEAT.WIDTH_CAP && max.halo <= BEAT.HALO_CAP && max.inten <= 1.0 && max.dglow <= 1.0 && max.dsize <= 0.25 && max.punch <= 0.09, JSON.stringify(max));
  assert.ok(max.halo > 1.5 * beatTerms(1, 1, 1).halo, 'the halo beat at g = 3 is clearly bigger than at g = 1');
  assert.equal(max.inten, 1.0, 'the beam intensity reaches its cap (2x), never more');
  // rises of 10 % or more in the beam intensity factor at g = 3, 180 bpm (the page's top tempo): at most 3 a second
  const fps = 60, bps = 3, rises = [];
  let prev = 0;
  for (let i = 0; i < 6 * fps; i++) {
    const b = i / fps * bps, f = b - Math.floor(b), pulse = (1 - Math.exp(-f / 0.06)) * Math.exp(-f / 0.36) / 0.62;
    const lum = 1 + beatTerms(3, pulse, 1).inten;
    if (prev && lum > prev * 1.1 && !(rises.length && i / fps - rises[rises.length - 1] < 0.15)) rises.push(i / fps);   // one rise per pulse (its attack spans a few frames)
    prev = lum;
  }
  const perSec = Math.max(...[...Array(6).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
  assert.ok(perSec <= 3, `pulses of 10 % or more: ${perSec} a second`);
});
