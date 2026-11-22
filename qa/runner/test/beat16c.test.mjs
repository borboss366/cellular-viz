// 16c Neon Lines, beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"): the beat gain g
// (controls.beatGain; the page reads clock.beatGain(?beatKnob) or ?beatGain) scales only the beat pulse's terms
// (experiments/16-neon-lines.mjs beatTerms). 21 Nov: halo and a camera punch (#296, window-rise gate <= 0.25 at g 1
// and g 3). Sunday 22 Nov (the user, Saturday's Mac session): at the beat knob's top the beams about 10x thicker on the
// beat, with their core light lowered as they widen (a 10x beam carries 10^0.4 = 2.5x the light, the old width +
// intensity terms carried 2.7x), a glow that jumps with the beat, and a thickness knob (?thickKnob, set.json: 2).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BEAT, beatGainOf, beatTerms, thickOf, coreGain, pickupCreate, pickup, THICK_MIN, THICK_MAX } from '../../../experiments/16-neon-lines.mjs';
const SRC = fs.readFileSync(new URL('../../../experiments/16-neon-lines.mjs', import.meta.url), 'utf8');
const PAGE = fs.readFileSync(new URL('../../../experiments/16-neon-lines.html', import.meta.url), 'utf8');
const SET = JSON.parse(fs.readFileSync(new URL('../../../experiments/set.json', import.meta.url), 'utf8'));
// the beat pulse as the scene makes it, over one beat at 60 fps and 120 bpm, and pulseK's values (smear, the drop glide)
const pulses = Array.from({ length: 31 }, (_, i) => { const f = i / 30; return (1 - Math.exp(-f / 0.06)) * Math.exp(-f / 0.36) / 0.62; });
const ks = [0, 0.2, 0.5, 0.83, 1];
const near = (a, b, e = 1e-12) => Math.abs(a - b) < e;

test('16c beat gain: g = 1 or absent (no beatGain() yet, knob untouched): the thickening, the glow jump and the old terms', () => {
  for (const pulse of pulses) for (const pulseK of ks) for (const g of [1, undefined, null, NaN]) {
    const T = beatTerms(g, pulse, pulseK);
    assert.ok(near(T.thick, Math.min(9, 3 * pulseK * pulse)), 'beam thickening 3 x pulse at g 1 (4x at the peak)');
    assert.ok(near(T.glow, Math.min(0.7, 0.6 * pulseK * pulse)), 'glow jump');
    assert.equal(T.width, 0, 'the old width term is gone (the thickening carries it)');
    assert.equal(T.inten, 0, 'the old intensity term is gone');
    assert.equal(1 + T.halo, 1 + Math.min(0.3, 0.3 * pulseK * pulse), 'halo width as #296');
    assert.equal(T.punch, Math.min(0.04, 0.02 * pulseK * pulse), 'camera punch 2 % x pulse at g = 1');
    assert.equal(1 + T.dsize, 1 + 0.12 * pulse, 'diamond size');
    assert.equal(1 + T.dglow + 0.8 * 0.3 + 0.6 * 0.2, 1 + 0.5 * pulse + 0.8 * 0.3 + 0.6 * 0.2, 'diamond glow');
  }
  assert.equal(beatGainOf({}, 1, null), 1, 'no clock.beatGain (before PR A)');
  assert.equal(beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(beatGainOf({ beatGain: n => (n === 5 ? 2.5 : null) }, 5, null), 2.5, 'slot B knob 5');
  assert.equal(beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(beatGainOf({ beatGain: () => { throw new Error('x'); } }, 1, null), 1);
  assert.deepEqual([BEAT.THICK, BEAT.THICK_CAP, BEAT.CORE_EXP, BEAT.GLOW, BEAT.GLOW_CAP, BEAT.HALO, BEAT.HALO_CAP, BEAT.PUNCH, BEAT.PUNCH_CAP],
    [3, 9, 0.6, 0.6, 0.7, 0.3, 0.3, 0.02, 0.04]);
  // the scene: the beam width takes the knob's base and the thickening, the core light goes down with them, the halo jumps
  assert.match(SRC, /const BT = beatTerms\(ctl\.beatGain, pulse, pulseK\);/);
  assert.match(SRC, /\(1\.1 \+ 3\.2 \* glowK\) \* sc \* thickBase \* \(1 \+ BT\.thick \+ 0\.25 \* flare\)/);
  assert.match(SRC, /const inten = \(0\.45 \+ 0\.8 \* ctl\.intensity\) \* \(1 \+ 0\.5 \* flare\);/);
  assert.match(SRC, /const uCoreNow = coreGain\(BT\.thick, thickBase\), uHaloNow = 1 \+ BT\.glow;/);
  assert.match(SRC, /1\.6 \* core \* uCore \+ 0\.30 \* halo \* uHalo/, 'the line shader: core and halo light');
  assert.match(SRC, /gl\.uniform1f\(lu\.uCore, uCoreNow\); gl\.uniform1f\(lu\.uHalo, uHaloNow\);/);
  assert.match(SRC, /const pulseK = st\.glide && st\.glide\.cause === 'drop' && s > 0 \? 0 : 1 - smear;/, 'the flash guard as before');
  assert.match(PAGE, /beatGain: qaBeatG !== null \? qaBeatG : beatGainOf\(metronome, params\.beatKnob, params\.beatGain\)/);
});

test('16c camera punch: a zoom after the speed fade, on beams, diamonds and the surface alike', () => {
  assert.match(SRC, /const Z = 1 \+ BT\.punch, zoomP = q => \[W \/ 2 \+ \(q\[0\] - W \/ 2\) \* Z, H \/ 2 \+ \(q\[1\] - H \/ 2\) \* Z\];/);
  assert.match(SRC, /const a = zoomP\(a0\), b = zoomP\(b0\);/, 'putSeg draws the punched ends');
  assert.match(SRC, /const fb = beamFade\(label, A0, A1\);/, 'the speed fade measures the unpunched ends');
  assert.match(SRC, /if \(p\) \{ p = zoomP\(p\); size \*= Z; \}/, 'diamonds punch too');
  assert.match(SRC, /gl\.uniform1f\(su\.uFocal, cam\.focal \* Z\);/, 'the surface: focal x Z is the same zoom');
  assert.ok(SRC.indexOf('const Z = 1 + BT.punch') > SRC.indexOf('const beamFade = '), 'the punch comes after the speed fade');
  const W = 1920, H = 1080, focal = 1 / Math.tan(19 * Math.PI / 180), x = 0.37, Z = 1.06;
  const zoomed = W / 2 + ((W / 2 + x * focal * H / 2) - W / 2) * Z, byFocal = W / 2 + x * (focal * Z) * H / 2;
  assert.ok(Math.abs(zoomed - byFocal) < 1e-9);
});

test('16c beat gain: g = 0 removes every beat term (no thickening, no glow jump, no punch)', () => {
  for (const pulse of pulses) for (const pulseK of ks) {
    const T = beatTerms(0, pulse, pulseK);
    assert.deepEqual([T.width, T.halo, T.inten, T.dsize, T.dglow, T.punch, T.thick, T.glow], [0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(coreGain(T.thick), 1, 'core light as today');
  }
  assert.equal(beatGainOf({ beatGain: () => 0 }, 1, null), 0, 'knob at the bottom (dead zone) gives g 0');
  assert.equal(beatTerms(3, 1, 0).thick, 0, 'pulseK 0 (the drop glide, full smear): no thickening');
  assert.equal(beatTerms(3, 1, 0).glow, 0);
});

test('16c beat gain: g = 3 makes the beams 10x thicker on the beat, the light grows only 10^0.4, once a beat', () => {
  assert.equal(beatTerms(3, 1.2, 1).thick, 9, 'capped at 10x');
  assert.equal(beatTerms(3, 1.2, 1).glow, 0.7, 'glow jump capped at +0.7');
  assert.ok(beatTerms(3, 1, 1).thick >= 8.9, '10x at the knob top');
  assert.ok(beatTerms(1, 1, 1).thick >= 2.9 && beatTerms(1, 1, 1).thick <= 3, '4x at the knob middle');
  // the light a beam carries: width x core = (1 + thick)^(1 - CORE_EXP); never more than 10^0.4
  let maxLight = 0;
  for (const pulse of pulses) for (const pulseK of ks) {
    const T = beatTerms(3, pulse, pulseK), light = (1 + T.thick) * coreGain(T.thick);
    assert.deepEqual(beatTerms(7, pulse, pulseK), T, 'g clamps to 3');
    maxLight = Math.max(maxLight, light);
  }
  assert.ok(maxLight <= Math.pow(10, 0.4) + 1e-9 && maxLight > 2.4, `beam light at most 2.5x (was 2.7x at g 3): ${maxLight}`);
  // rises of 10 % or more in the beam's light at g = 3, 180 bpm (the page's top tempo): at most 3 a second
  const fps = 60, bps = 3, rises = [];
  let prev = 0;
  for (let i = 0; i < 6 * fps; i++) {
    const b = i / fps * bps, f = b - Math.floor(b), pulse = (1 - Math.exp(-f / 0.06)) * Math.exp(-f / 0.36) / 0.62;
    const T = beatTerms(3, pulse, 1), lum = (1 + T.thick) * coreGain(T.thick) + 1 + T.glow;
    if (prev && lum > prev * 1.1 && !(rises.length && i / fps - rises[rises.length - 1] < 0.15)) rises.push(i / fps);
    prev = lum;
  }
  const perSec = Math.max(...[...Array(6).keys()].map(s => rises.filter(t => t >= s && t < s + 1).length));
  assert.ok(perSec <= 3, `pulses of 10 % or more: ${perSec} a second`);
});

test('16c thickness knob: knob 2 (slot B 6) through the pick-up, a quarter .. today .. 4x, never more light', () => {
  assert.equal(thickOf(0), THICK_MIN); assert.equal(thickOf(0.5), 1); assert.equal(thickOf(1), THICK_MAX);
  assert.equal(thickOf(NaN), 1); assert.equal(thickOf(null), 1);
  for (let k = 0; k <= 1; k += 0.05) assert.ok(thickOf(k + 0.05) > thickOf(k), 'grows with the knob');
  // thicker from the knob: the core light divides by the same factor, so the beam's light never grows (flash-safe)
  for (const base of [1, 1.5, 2, 4]) assert.ok(near(base * coreGain(0, base), 1), `base ${base}`);
  assert.equal(coreGain(0, 0.25), 1, 'thinner: as bright, less light');
  // the pick-up: a value already there on arrival does not count until that knob moves
  const p = pickupCreate();
  assert.equal(pickup(p, 2, [0.5, 0.9, null, null, null, null, null, null]), null);
  assert.equal(pickup(p, 2, [0.5, 0.7, null, null, null, null, null, null]), 0.7);
  assert.equal(pickup(p, 2, [0.5, 0.9, null, null, null, null, null, null]), 0.9, 'stays live');
  // the page and the set
  assert.match(PAGE, /params\.thickKnob = n >= 1 && n <= 8 \? n : 0;/);
  assert.match(PAGE, /thick: thickNow\(\),/);
  assert.match(PAGE, /fakeThick: k =>/);
  const neon = SET.scenes.find(s => s.page === '16-neon-lines.html');
  assert.deepEqual(neon.query, { thickKnob: '2' }, 'set.json: the thickness knob is the slot\'s knob 2 (slot B 6)');
  assert.ok(/WIDTH_MAX: 48/.test(SRC) && /Math\.min\(BEAT\.WIDTH_MAX \* sc,/.test(SRC), 'beam width capped');
});
