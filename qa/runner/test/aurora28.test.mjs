// 28 Aurora (the user's brief, 21 Nov 23:00): the scene module's pure parts (experiments/28-aurora.mjs) and the page's
// wiring. The look itself is judged on the box's stills (qa/experiments/<PR>.json); here: the ripple is a wave that
// travels up and scales with the beat gain (0 = none), the drift never stops (no beat: on time), the sections blend
// without a jump, both ends of the height and colour knobs mean something, and the page is a set-ready scene.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AUR, beatGainOf, rippleAmp, ripplesCreate, rippleStep, rippleFront, phaseCreate, phaseStep, sectionShape,
  sectionParams, heightShape, colourMix, pickupCreate, pickup, knobValue, createScene, KNOBS } from '../../../experiments/28-aurora.mjs';
const EX = new URL('../../../experiments/', import.meta.url);
const PAGE = fs.readFileSync(new URL('28-aurora.html', EX), 'utf8'), SRC = fs.readFileSync(new URL('28-aurora.mjs', EX), 'utf8');

test('28 aurora: the beat gain scales the ripple, 0 gives none, capped at the top', () => {
  assert.equal(beatGainOf({}, 1, null), 1, 'no clock.beatGain: 1');
  assert.equal(beatGainOf({ beatGain: () => null }, 1, null), 1, 'knob untouched: 1');
  assert.equal(beatGainOf({ beatGain: n => (n === 5 ? 2.5 : null) }, 5, null), 2.5, 'slot B knob 5');
  assert.equal(beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(beatGainOf({ beatGain: () => 9 }, 1, null), 3, 'clamped to 3');
  assert.equal(rippleAmp(0), 0);
  assert.equal(rippleAmp(1), AUR.RIPPLE_AMP);
  assert.equal(rippleAmp(3), AUR.RIPPLE_CAP);
  for (let g = 0; g < 3; g += 0.1) assert.ok(rippleAmp(g + 0.1) >= rippleAmp(g), 'grows with g');
  // g = 0: a kick every beat for 8 s fires nothing
  const R = ripplesCreate();
  for (let i = 0; i <= 480; i++) rippleStep(R, { t: i / 60, kicks: i % 30 === 0 ? 1 : 0, g: 0, w: 1 });
  assert.equal(R.fired, 0); assert.equal(R.list.length, 0);
});

test('28 aurora: each kick is a band that starts at the lower edge and travels up, at most one per 0.2 s', () => {
  const R = ripplesCreate();
  for (let i = 0; i <= 480; i++) rippleStep(R, { t: i / 60, kicks: i % 30 === 0 ? 1 : 0, g: 1, w: 1 });   // 120 bpm, 8 s
  assert.ok(R.fired >= 16 && R.fired <= 17, `${R.fired} ripples`);
  assert.ok(R.list.length <= AUR.MAX_RIPPLES);
  // one ripple's front over its life: from the edge (about 0) up past the top (> 1), always rising, fading out
  const r = { t0: 10, amp: 0.5 };
  let prev = -Infinity, prevAmp = Infinity;
  for (let a = 0; a < AUR.RIPPLE_LIFE; a += 0.05) {
    const f = rippleFront(r, 10 + a);
    assert.ok(f.front > prev, 'rises'); assert.ok(f.amp <= prevAmp + 1e-12, 'fades'); prev = f.front; prevAmp = f.amp;
  }
  assert.ok(rippleFront(r, 10).front <= 0, 'starts at the lower edge');
  assert.ok(prev > 1, `reaches the top (${prev.toFixed(2)})`);
  assert.equal(rippleFront(r, 10 + AUR.RIPPLE_LIFE), null, 'gone after its life');
  // kicks 0.1 s apart: only every other one starts a ripple
  const F = ripplesCreate();
  for (let i = 0; i < 20; i++) rippleStep(F, { t: i * 0.1, kicks: 1, g: 1, w: 1 });
  assert.equal(F.fired, 10);
});

test('28 aurora: no beat (w = 0): clock kicks do nothing, the music\'s onsets ripple smaller; the drift runs on time', () => {
  const R = ripplesCreate();
  rippleStep(R, { t: 0, kicks: 1, g: 1, w: 0 });
  assert.equal(R.fired, 0, 'no ripple from the clock with no confident beat');
  rippleStep(R, { t: 1, onset: true, g: 1, w: 0 });
  assert.equal(R.fired, 1);
  assert.ok(Math.abs(R.list[0].amp - AUR.RIPPLE_AMP * AUR.RIPPLE_ENERGY) < 1e-12);
  // the phase: at w = 1 it follows the bars, at w = 0 the time, never backwards; a clock jump moves it by nothing
  const P = phaseCreate();
  phaseStep(P, { bars: 10, dt: 1 / 60, w: 1 });
  phaseStep(P, { bars: 10.5, dt: 1 / 60, w: 1 });
  assert.ok(Math.abs(P.v - 10.5) < 1e-12);
  let v = P.v;
  for (let i = 0; i < 600; i++) { phaseStep(P, { bars: 10.5, dt: 1 / 60, w: 0 }); assert.ok(P.v > v, 'moves every frame with no beat'); v = P.v; }
  assert.ok(Math.abs(P.v - (10.5 + 10 * AUR.IDLE_BARS_PER_S)) < 1e-6, 'on time at w = 0');
  const before = P.v;
  phaseStep(P, { bars: 400, dt: 1 / 60, w: 1 });
  phaseStep(P, { bars: 2, dt: 1 / 60, w: 1 });
  assert.ok(P.v >= before && P.v - before < 0.01, 'jumps ignored');
});

test('28 aurora: sections change the shape every 16 bars and blend over the last 4, never a jump', () => {
  const keys = ['foldFreq', 'foldAmp', 'baseOff', 'tilt', 'hue', 'violet'];
  const a = sectionParams(0, 1), b = sectionParams(1, 1);
  assert.ok(keys.some(k => Math.abs(a[k] - b[k]) > 0.02), 'two sections differ');
  assert.equal(sectionShape(5, 1).m, 0, 'no blend mid-section');
  const mid = sectionShape(8, 1); for (const k of keys) assert.ok(Math.abs(mid[k] - a[k]) < 1e-12, k);
  let prev = sectionShape(0, 1), maxStep = 0;
  for (let bars = 0.01; bars < 64; bars += 0.01) {
    const s = sectionShape(bars, 1);
    for (const k of keys) maxStep = Math.max(maxStep, Math.abs(s[k] - prev[k]));
    prev = s;
  }
  assert.ok(maxStep < 0.01, `largest change in 0.01 bar: ${maxStep}`);
  const end = sectionShape(16 - 1e-9, 1); for (const k of keys) assert.ok(Math.abs(end[k] - b[k]) < 1e-6, `${k} lands on the next section`);
});

test('28 aurora: both ends of the height and colour knobs mean something; the knobs read through a pick-up', () => {
  const lo = heightShape(0), hi = heightShape(1);
  assert.ok(lo.H <= 0.15 && lo.base < 0.02, 'a low thin band near the horizon');
  assert.ok(AUR.HORIZON + hi.base + hi.H >= 0.95, 'curtains filling the frame');
  const g0 = colourMix(0, 1), g1 = colourMix(1, 1), g1q = colourMix(1, 0);
  assert.equal(g0.violet, 0); assert.equal(g0.red, 0, 'all green');
  assert.equal(g1.violet, 1); assert.equal(g1.red, 1, 'full mix on a strong moment');
  assert.ok(g1q.red > 0 && g1q.red < 0.5, 'the red top fades when it is quiet');
  // pick-up: a value already there on arrival does not count until that knob moves
  const p = pickupCreate();
  assert.equal(pickup(p, 2, [0.1, 0.9, 0.5, null, null, null, null, null]), null);
  assert.equal(pickup(p, 2, [0.1, 0.91, 0.5, null, null, null, null, null]), null, 'within PICK_EPS');
  assert.equal(pickup(p, 2, [0.1, 0.5, 0.5, null, null, null, null, null]), 0.5, 'moved: live');
  assert.equal(pickup(p, 2, [0.1, 0.9, 0.5, null, null, null, null, null]), 0.9, 'stays live');
  assert.equal(knobValue(pickupCreate(), { knobs: null }, 2, 0.6), 0.6, 'no knobs: the fallback');
  assert.equal(knobValue(pickupCreate(), {}, 2, 0.3), 0.3);
  assert.deepEqual(KNOBS.map(k => [k.param, k.default]), [['beatKnob', 1], ['heightKnob', 2], ['colourKnob', 3]]);
});

test('28 aurora: the scene runs without a GL context (metrics), ripples on the kicks, keeps moving with no beat', () => {
  const s = createScene();
  for (let i = 0; i <= 600; i++) s.frame({ t: i / 60, beats: i / 30, bpb: 4, dt: 1 / 60, controls: { g: 1, height: 0.6, colour: 0.6, w: 1, kicks: i % 30 === 0 ? 1 : 0 } });
  assert.ok(s.qa.metrics.ripplesFired >= 20, `${s.qa.metrics.ripplesFired}`);
  assert.ok(s.qa.view.strength > 0 && s.qa.view.strength <= 1);
  const d0 = s.qa.metrics.driftBars;
  for (let i = 601; i <= 1200; i++) s.frame({ t: i / 60, beats: 0, bpb: 4, dt: 1 / 60, controls: { g: 1, w: 0, level: 0 } });
  assert.ok(s.qa.metrics.driftBars - d0 > 3, 'drifts on time with no beat');
  assert.ok(s.qa.view.glow >= AUR.IDLE_GLOW - 1e-9 && s.qa.view.glow < 1, 'a fainter glow, never off');
});

test('28 aurora page: a set-ready scene (panic, ?clock=, audio-in, clockLate), ASCII only, not in set.json', () => {
  assert.match(PAGE, /<script src="panic\.js"><\/script>/);
  assert.match(PAGE, /Clock\.create\(\{ source: q\('clock'\)/);
  assert.match(PAGE, /AudioIn\.create\(/);
  assert.match(PAGE, /AudioIn\.qa\(audio, window\.__qa\)/);
  assert.match(PAGE, /<canvas id="c"><\/canvas>/);
  assert.match(PAGE, /getContext\('webgl2'/);
  assert.match(PAGE, /import scene, \{[^}]*\} from '\.\/28-aurora\.mjs'/);
  assert.match(PAGE, /knobN\('beatKnob', 1\)/); assert.match(PAGE, /knobN\('heightKnob', 2\)/); assert.match(PAGE, /knobN\('colourKnob', 3\)/);
  assert.match(PAGE, /no-beat mode/);
  for (const [name, src] of [['28-aurora.html', PAGE], ['28-aurora.mjs', SRC]]) {
    const bad = [...src].findIndex(ch => ch.charCodeAt(0) > 0x7e || (ch.charCodeAt(0) < 0x20 && ch !== '\n'));
    assert.equal(bad, -1, `${name} is plain ASCII (first other character at ${bad})`);
  }
  const set = JSON.parse(fs.readFileSync(new URL('set.json', EX), 'utf8'));
  assert.ok(!set.scenes.some(x => x.page === '28-aurora.html'), 'not in the set');
  assert.ok(!/from ['"]\.\/(clock|audio-in|slot|panic)/.test(SRC), 'the module imports no shared file');
});
