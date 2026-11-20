// Knob pick-up for the slot scenes' own knobs (the user's Mac session, 20 Nov: slot B switched to Hodge, the hexagons
// shook on the spot until a knob moved). The knobs are absolute and the shared clock keeps their last values, so slot B's
// knob 6, left at 100 by Paint Pour's pulse, was Hodge's dive at full depth (x12 zoom) the moment it loaded. The same
// knob 2/6 is Little Bang's travel speed and Paint Pour's pulse. Each scene's knob reader now ignores a knob that was
// already up on arrival until it moves by more than 0.02 (16-dive.js, 18-travel.js, 24-marble.mjs); the beat knob
// (clock.beatGain, the same meaning in every scene) does not go through it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as M from '../../../experiments/24-marble.mjs';
const require = createRequire(import.meta.url);
const Dive = require('../../../experiments/16-dive.js');
const T = require('../../../experiments/18-travel.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/16-hodge-kaleidoscope.html', import.meta.url), 'utf8');
const PAGE18 = fs.readFileSync(new URL('../../../experiments/18-little-bang.html', import.meta.url), 'utf8');
const PAGE24 = fs.readFileSync(new URL('../../../experiments/24-paint-pour.html', import.meta.url), 'utf8');
const K = (o = {}) => Array.from({ length: 8 }, (_, i) => (o[i + 1] === undefined ? null : o[i + 1]));
// a clock like clock.js's: knob(n) and the knobs list (a copy each read)
const clockOf = stored => ({ knob: n => stored[n - 1], get knobs() { return stored.slice(); } });

test('16b Hodge pick-up: knob 6 at 1.0 at load leaves the dive at depth 0 until the knob moves (Dive.knobOf)', () => {
  // slot B: knob 6 (Hodge's dive there) left at 1.0 by Paint Pour's pulse, knob 5 (the beat) at 0.5
  const stored = K({ 5: 0.5, 6: 1 }), clock = clockOf(stored), d = Dive.create();
  let f = 0;
  const frame = () => Dive.step(d, { t: f / 60, dt: 1 / 60, beats: f++ / 30, bpb: 4, barS: 2, knob: Dive.knobOf(clock, 6), keyHeld: false, fixed: 0 });
  for (let i = 0; i < 300; i++) { const o = frame(); assert.equal(o.depth, 0); assert.equal(o.zoom, 1); }
  assert.equal(d.bursts.length, 0, 'no burst from a knob that never moved');
  stored[5] = 0.99; assert.equal(Dive.knobOf(clock, 6), null, 'a jitter under 0.02 is not a move');
  stored[5] = 0.9; for (let i = 0; i < 240; i++) frame();
  assert.ok(d.depth > 0.85, `moved: the dive follows it (${d.depth})`);
  stored[5] = 1; assert.equal(Dive.knobOf(clock, 6), 1, 'and stays live (back to 1 is a full dive now)');
  assert.deepEqual(Dive.pickupState(clock), { snap: K({ 5: 0.5, 6: 1 }), live: [6] });
  // a new page (a new clock) starts its own pick-up; a knob unknown on arrival is live once it gets a value
  const s2 = K({ 6: 1 }), c2 = clockOf(s2);
  assert.equal(Dive.knobOf(c2, 7), null); s2[6] = 0.4; assert.equal(Dive.knobOf(c2, 7), 0.4, 'the glint knob, first turned here');
  assert.equal(Dive.knobOf(c2, 6), null, 'knob 6 still as found');
  // no knob values yet: no snapshot; a clock without the knobs list (tests, older clocks): as before
  const p = Dive.pickupCreate(); assert.equal(Dive.pickup(p, 2, K()), null); assert.equal(p.snap, null);
  assert.equal(Dive.knobOf({ knob: n => (n === 2 ? 0.4 : null) }, 2), 0.4);
  for (const bad of [0, 9, NaN, 'x']) assert.equal(Dive.knobOf(clock, bad), null);
  assert.equal(Dive.C.PICK_EPS, 0.02);
  // the page: dive and glint read Dive.knobOf (QA's fake knobs first); the beat knob reads clock.beatGain directly
  assert.match(PAGE, /const readKnob = n => \(n \? \(qaKnobs\.has\(n\) \? qaKnobs\.get\(n\) : Dive\.knobOf\(metronome, n\)\) : null\);/);
  assert.match(PAGE, /knob: readKnob\(params\.diveKnob\)/, 'the dive');
  assert.match(PAGE, /const glintKnob = params\.glintKnob \? readKnob\(params\.glintKnob\) : null;/, 'the glints');
  assert.match(PAGE, /Dive\.beatGainOf\(metronome, params\.beatKnob, params\.beatGain\)/, 'the beat knob: no pick-up');
  assert.ok(!/metronome\.knob\(|metronome\.knobs/.test(PAGE), 'no knob read that skips Dive.knobOf');
});

test('18 Little Bang pick-up: knob 2 left at 0 by Hodge\'s dive does not stop the camera on arrival (Travel.knobOf)', () => {
  const stored = K({ 1: 0.5, 2: 0 }), clock = clockOf(stored), s = T.speedCreate(0.5), v0 = s.v;
  for (let f = 0; f < 300; f++) T.speedStep(s, T.knobOf(clock, 2), 1 / 60);
  assert.equal(s.v, v0, 'the speed stays at ?speed (default 0.5) while the knob is as found');
  stored[1] = 0.01; assert.equal(T.knobOf(clock, 2), null, 'a jitter under 0.02 is not a move');
  stored[1] = 0.6; assert.equal(T.knobOf(clock, 2), 0.6, 'turned: the speed follows it');
  stored[1] = 0; assert.equal(T.knobOf(clock, 2), 0, 'live: 0 stops the camera now');
  assert.deepEqual(T.pickupState(clock).live, [2]);
  assert.equal(T.knobOf({ knob: n => (n === 4 ? 0.7 : null) }, 4), 0.7, 'no knobs list: as before');
  assert.equal(T.C.PICK_EPS, 0.02);
  assert.match(PAGE18, /Travel\.knobOf\(metronome, n\)/); assert.ok(!/metronome\.knob\(|metronome\.knobs/.test(PAGE18));
  assert.match(PAGE18, /Travel\.beatGainOf\(metronome, params\.beatKnob \|\| 1, params\.beatGain\)/, 'the beat knob: no pick-up');
});

test('24 Paint Pour pick-up: knob 2 left by another scene keeps ?pulse until it moves (K.pulseAmount)', () => {
  const stored = K({ 1: 0.5, 2: 0 }), clock = clockOf(stored);
  for (let f = 0; f < 120; f++) assert.equal(M.pulseAmount(clock, 2, 0.5), 0.5, 'knob 2 at 0 from Hodge\'s dive: ?pulse (0.5) still');
  stored[1] = 0.015; assert.equal(M.pulseAmount(clock, 2, 0.5), 0.5, 'a jitter under 0.02 is not a move');
  stored[1] = 0.8; assert.equal(M.pulseAmount(clock, 2, 0.5), 0.8, 'turned: the pulse follows it');
  stored[1] = 0; assert.equal(M.pulseAmount(clock, 2, 0.5), 0, 'live: all the way down is off now');
  assert.deepEqual(M.pickupState(clock).live, [2]);
  const s2 = K({ 1: 0.5 }), c2 = clockOf(s2);
  assert.equal(M.pulseAmount(c2, 2, 0), 0, 'knob 2 unknown: ?pulse'); s2[1] = 0.3; assert.equal(M.pulseAmount(c2, 2, 0), 0.3, 'first turned here: live at once');
  assert.equal(M.pulseAmount({ knob: n => (n === 1 ? 0.9 : null) }, 1, 0.6), 0.9, 'no knobs list: as before');
  assert.equal(M.pulseAmount(clock, 0, 0.6), 0.6, 'no pulseKnob: ?pulse');
  assert.equal(M.PICK_EPS, 0.02);
  assert.match(PAGE24, /pulse: K\.pulseAmount\(clock, params\.pulseKnob, params\.pulse\)/);
});
