// 16b · Hodge Kaleidoscope, the dive, the burst and the glints (the user's Saturday upgrades, 19 Nov): the page's own
// arithmetic (experiments/16-dive.js) in node, frame by frame at 60 fps. The rendered frame's brightness is the box smoke
// (dive16-smoke.test.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Dive = require('../../../experiments/16-dive.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/16-hodge-kaleidoscope.html', import.meta.url), 'utf8');

// run frames at 60 fps, 120 bpm; knobAt(beats) → the knob (or null); returns the outputs per frame
function run(seconds, knobAt, opts = {}) {
  const s = opts.state || Dive.create(), out = [], fps = 60, bps = 2, barS = 2;
  for (let f = 0; f <= seconds * fps; f++) {
    const t = (opts.t0 || 0) + f / fps, beats = t * bps;
    out.push({ t, beats, ...Dive.step(s, { t, dt: f ? 1 / fps : 0, beats, bpb: 4, barS, knob: knobAt ? knobAt(beats) : null,
      keyHeld: opts.keyAt ? opts.keyAt(beats) : false, fixed: opts.fixed || 0, low: opts.lowAt ? opts.lowAt(beats) : NaN, autoDrop: !!opts.autoDrop }) });
  }
  return { s, out };
}

test('16b dive: at rest (no knob, no key, ?dive 0, glint 0) every output is the old constant, so the look and the truths are unchanged', () => {
  const { s, out } = run(10, null);
  for (const o of out) { assert.equal(o.zoom, 1); assert.equal(o.fbZoom, 1.002); assert.equal(o.env, 0); assert.equal(o.depth, 0); assert.equal(o.fired, null); }
  assert.deepEqual(s.bursts, []);
  assert.deepEqual(Dive.glints(0, 1, 0, 1), { glint: 0, sweep: 0, prism: 0 }, 'glint off: no glint, no prism even on a hit');
  // the page: zoom = tileRadius × the dive's zoom, the trail zoom from the dive, everything off unless asked for
  assert.match(PAGE, /const zoom = params\.tileRadius \* D\.zoom;/);
  assert.match(PAGE, /uZoomFb, D\.fbZoom\)/);
  assert.match(PAGE, /diveKnob: knobArg\('diveKnob'\), glintKnob: knobArg\('glintKnob'\), dive: unit\('dive'\), glint: unit\('glint'\), autoDrop: q\('autoDrop'\) === '1'/);
  assert.match(PAGE, /if \(uGlint > 0\.0\)/); assert.match(PAGE, /if \(uPrism > 0\.0\)/);
  // the macros and the trigger are as before
  assert.match(PAGE, /const MACROS = \{ macro1: \['shapeRate', 0, 1\], macro2: \['spin', -2, 2\], macro3: \['tileRadius', 0\.6, 4\], macro4: \['trail', 0, 0\.98\] \};/);
});

test('16b dive: the depth follows a fake knob (low-pass with a rate cap), and the zoom with it', () => {
  const { out } = run(6, b => (b < 2 ? 0 : 0.8));
  const last = out[out.length - 1];
  assert.ok(Math.abs(last.depth - 0.8) < 1e-3, `depth ${last.depth}`);
  assert.ok(Math.abs(last.zoom - Dive.zoomOf(0.8)) < 1e-3 && last.zoom < 1, 'closer at depth');
  let maxStep = 0; for (let i = 1; i < out.length; i++) maxStep = Math.max(maxStep, Math.abs(out[i].depth - out[i - 1].depth));
  assert.ok(maxStep <= Dive.C.DIVE_RATE / 60 + 1e-12, `a slammed knob still moves ≤ ${Dive.C.DIVE_RATE}/s (${maxStep * 60}/s)`);
  let zStep = 0; for (let i = 1; i < out.length; i++) zStep = Math.max(zStep, Math.abs(Math.log(out[i].zoom / out[i - 1].zoom)));
  console.log(`dive: the largest zoom step a frame ${((Math.exp(zStep) - 1) * 100).toFixed(2)} %`);
  assert.ok(zStep < 0.06, 'under 6 % zoom a frame');
  assert.equal(Dive.knobOf({ knob: n => (n === 2 ? 0.4 : null) }, 2), 0.4); assert.equal(Dive.knobOf({ knob: () => null }, 2), null);
  assert.equal(Dive.knobOf({}, 2), null, 'no knob() before #268'); assert.equal(Dive.knobOf({ knob: () => 3 }, 9), null, 'knobs are 1..8');
});

test('16b burst: a fast turn-down fires exactly one burst, on the next beat; a slow one fires none', () => {
  // up to 0.9 over beats 0-4, held, then down to 0.1 within half a beat at beat 8.3, held there for 12 beats
  const fast = b => (b < 4 ? 0.9 * b / 4 : b < 8.3 ? 0.9 : b < 8.8 ? 0.9 - 0.8 * (b - 8.3) / 0.5 : 0.1);
  const { s, out } = run(12, fast);
  assert.equal(s.bursts.length, 1, JSON.stringify(s.bursts));
  const b = s.bursts[0];
  assert.equal(b.beat, 9, 'the next beat after the knob crossed 0.2'); assert.ok(b.firedBeats >= 9 && b.firedBeats < 9 + 2 / 60 + 1e-9, 'fired on that frame');
  assert.equal(out.filter(o => o.fired).length, 1);
  const peak = Math.max(...out.map(o => o.env)), after = out.filter(o => o.beats >= 9 + 6.5).map(o => o.env);
  assert.ok(peak > 0.9, `peak ${peak}`);
  let envStep = 0; for (let i = 1; i < out.length; i++) envStep = Math.max(envStep, Math.abs(out[i].env - out[i - 1].env));
  assert.ok(envStep < 0.15, `the burst rises over ≥ ${Dive.C.BURST_ATTACK} s, no step (${envStep.toFixed(3)} a frame)`);
  assert.ok(Math.max(0, ...after) < 0.06, 'settled within 1.5 bars');
  const slow = run(12, bb => (bb < 4 ? 0.9 : bb < 12 ? 0.9 - 0.8 * (bb - 4) / 8 : 0.1));
  assert.equal(slow.s.bursts.length, 0, 'a slow turn-down is no drop');
  // key B: hold dives in, release books one burst on the next beat
  const key = run(6, null, { keyAt: bb => bb > 1 && bb < 5.5 });
  assert.equal(key.s.bursts.length, 1); assert.equal(key.s.bursts[0].cause, 'key'); assert.equal(key.s.bursts[0].beat, 6);
  assert.ok(Math.max(...key.out.map(o => o.depth)) > 0.8, 'held 2.25 s: deep');
});

test('16b ?autoDrop: a burst when the low band comes back after 4 or more quiet bars, not after 2', () => {
  const low = (q0, q1) => b => (b >= q0 && b < q1 ? 0.05 : 0.7);
  const a = run(24, null, { autoDrop: true, lowAt: low(8, 8 + 4.5 * 4) });
  assert.equal(a.s.bursts.length, 1); assert.equal(a.s.bursts[0].cause, 'autoDrop');
  assert.equal(a.s.bursts[0].beat, Math.floor(8 + 4.5 * 4 + 1e-6) + 1, 'on the beat after the low band is back');
  const b = run(24, null, { autoDrop: true, lowAt: low(8, 16) });
  assert.equal(b.s.bursts.length, 0, '2 quiet bars: no drop');
  const c = run(24, null, { autoDrop: false, lowAt: low(8, 8 + 4.5 * 4) });
  assert.equal(c.s.bursts.length, 0, 'off by default');
});

test('16b glints: 0 when off, scale with glint, the sweep crosses the gem in 0.2 s, the prism ≤ 4 px with a ≥ 150 ms tail', () => {
  assert.deepEqual(Dive.glints(0, 1, 0.05, 1), { glint: 0, sweep: 0, prism: 0 });
  const g = Dive.glints(0.5, 1, 0.1, 1);
  assert.equal(g.glint, 0.5); assert.equal(g.prism, 0.5); assert.ok(Math.abs(g.sweep - 0.5) < 1e-12);
  assert.equal(Dive.glints(1, 1, 5, 0).sweep, 1, 'the band has left the gem');
  assert.ok(Dive.C.PRISM_PX <= 4 && Dive.C.PRISM_TAU >= 0.15 && Dive.C.HAT_TAU >= 0.12, 'a few px, tails ≥ 120 / 150 ms');
});

test('16b dive and burst: no frame-to-frame jump in the inputs that move the brightness (envelopes, zoom, trail zoom)', () => {
  const k = b => (b < 2 ? 0 : b < 6 ? (b - 2) / 4 : b < 6.2 ? 1 - (b - 6) / 0.2 * 0.95 : 0.05);
  const { out } = run(10, k);
  let worst = { env: 0, zoom: 0, fb: 0 };
  for (let i = 1; i < out.length; i++) {
    worst.env = Math.max(worst.env, Math.abs(out[i].env - out[i - 1].env));
    worst.zoom = Math.max(worst.zoom, Math.abs(Math.log(out[i].zoom / out[i - 1].zoom)));
    worst.fb = Math.max(worst.fb, Math.abs(out[i].fbZoom - out[i - 1].fbZoom));
  }
  console.log('dive + burst, the largest step a frame:', worst);
  assert.ok(worst.env < 0.15 && worst.zoom < 0.12 && worst.fb < 0.003, JSON.stringify(worst));
});
