// The slot-switch shake (the user's Mac session, 20 Nov, part 2): a freshly loaded slot scene draws its first frames
// on its own beat count (near 0) until the shared clock's count arrives (~1890 beats into the set). Hodge's shape
// schedule then fired one change per frame until it caught up (__qa.idx 198 a few seconds after load, then 920:
// ~720 changes in 150 beats), and Riemann's chase camera eased across the jump and fired the zero flash. Now a forward
// jump of more than a hold resets 16b's schedule (16c's already reset far ahead), an event never leaves it behind the
// clock, and Riemann snaps.
// Each test: the first frames at beat 2, then the clock at beat 2000 → at most 1 event, then the normal rate.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { schedStep as neonStep } from '../../../experiments/16-neon-lines.mjs';
const require = createRequire(import.meta.url);
const RB = require('../../../experiments/11-beat.js');
const EX = new URL('../../../experiments/', import.meta.url);
const HODGE = fs.readFileSync(new URL('16-hodge-kaleidoscope.html', EX), 'utf8');
const RIEMANN = fs.readFileSync(new URL('11-riemann-show.html', EX), 'utf8');

// 16b's scheduler, run from the page's own source (const newSched … through schedStep)
const hodgeSched = (() => {
  const a = HODGE.indexOf('const newSched = () =>'), b = HODGE.indexOf('const sched = newSched();');
  assert.ok(a > 0 && b > a, 'the scheduler source is on the page');
  return new Function(`${HODGE.slice(a, b)}; return { newSched, schedStep };`)();
})();
const newSched = () => ({ next: null, last: null, hold: null, pending: false, cause: 'auto' });

// frames at 60 fps and 120 BPM: 1 s at the page's own count from beat 2, then the shared clock's count from 2000 (20 s)
function run(step, s, hb, bpb) {
  const ev = [], bpf = 2 / 60;
  let b = 2;
  for (let f = 0; f < 60; f++, b += bpf) { const e = step(s, b, hb, bpb); if (e) ev.push({ ...e, f }); }
  const before = ev.length;
  b = 2000;
  const after = [];
  for (let f = 60; f < 60 + 60 * 20; f++, b += bpf) { const e = step(s, b, hb, bpb); if (e) after.push({ ...e, f }); }
  return { before, after };
}
function checkRate(name, after, hb) {
  const first2s = after.filter(e => e.f < 60 + 120).length;
  assert.ok(first2s <= 2, `${name}: ${first2s} changes in the 2 s after the jump (one a frame would be ~120)`);
  assert.ok(after.slice(0, 1).every(e => e.f > 60), `${name}: no change on the jump frame itself`);
  const gaps = after.slice(1).map((e, i) => e.beat - after[i].beat);
  assert.ok(gaps.length >= 2 && gaps.every(g => Math.abs(g - hb) < 1e-9), `${name}: then one change per hold (${gaps})`);
  // 20 s at 120 BPM = 40 beats: about 40 / hb changes, never a burst
  assert.ok(after.length <= Math.ceil(40 / hb) + 1, `${name}: ${after.length} changes in 20 s`);
}

test('16b Hodge: the first frames at beat 2, then the shared clock at 2000: no catch-up burst, then one change per hold', () => {
  const { newSched: ns, schedStep } = hodgeSched;
  for (const hb of [2, 4, 8]) {
    const s = ns(), { after } = run(schedStep, s, hb, 4);
    checkRate(`hold ${hb}`, after, hb);
  }
  // the old behaviour, for the record: the same frames without the reset fire one change a frame (the Mac session's shake)
  const old = (s, beats, hb, bpb) => {
    const g = hb >= bpb ? bpb : 1, up = (x, gg) => Math.ceil(x / gg - 1e-6) * gg;
    if (s.next === null || beats < s.last - 1e-6) { s.hold = hb; s.last = Math.floor(beats / g + 1e-6) * g; s.next = up(s.last + hb, g); }
    if (beats + 1e-6 < s.next) return null;
    const e = { beat: s.next }; s.last = s.next; s.next = up(s.last + hb, g); return e;
  };
  assert.ok(run(old, newSched(), 2, 4).after.filter(e => e.f < 180).length > 100, 'the old schedule caught up one change a frame');
  // the page's other test (the live clock's epoch) resets on the same forward jump
  assert.match(HODGE, /ahead - sched\.next > holdOf\(params\.shapeRate\) \* params\.bpb \+ 1e-6\) \{ liveClock\.epoch\+\+/);
  assert.match(HODGE, /beats - s\.next > holdBeats \+ 1e-6\) \{/);
});

test('16c Neon Lines: the same schedule (glides) already resets far ahead (2 holds + a bar): no catch-up burst after the switch', () => {
  for (const hb of [2, 4, 8]) {
    const { after } = run(neonStep, newSched(), hb, 4);
    checkRate(`hold ${hb}`, after, hb);
  }
});

test('11 Riemann: a jump of the bar count snaps the chase camera and takes the new zero without a flash', () => {
  const st = RB.jumpState();
  assert.equal(RB.jumped(st, 0.5), false, 'the first frame is not a jump');
  for (let f = 1; f < 60; f++) assert.equal(RB.jumped(st, 0.5 + f * 0.5 / 60), false, '60 fps playback is never a jump');
  assert.equal(RB.jumped(st, 472.4), true, 'the shared clock\'s count arrives: a jump');
  assert.equal(RB.jumped(st, 472.41), false); assert.equal(RB.jumped(st, 3), true, 'a jump back too');
  assert.equal(st.jumps, 2); assert.equal(RB.C.JUMP_BARS, 1);
  assert.equal(RB.jumped(st, NaN), false); assert.equal(RB.jumped(null, 3), false);
  // 180 BPM at a slow 10 fps (0.1 s, the frame cap) moves 0.075 bar: far under JUMP_BARS
  assert.ok(180 / 60 / 4 * 0.1 < RB.C.JUMP_BARS);
  // the page: on a jump, the camera restarts at its target and lastK takes the new zero (no flash), before the zero test
  const i = RIEMANN.indexOf('if (RiemannBeat.jumped(clockJump, bars)) { camState.eye = null; camState.at = null; lastK = lastZero(bars).k; }');
  assert.ok(i > 0, 'the snap');
  assert.ok(i < RIEMANN.indexOf('if (lz.k !== lastK) {'), 'before the zero flash test');
  assert.match(RIEMANN, /const clockJump = RiemannBeat\.jumpState\(\);/);
  assert.match(RIEMANN, /camState\.eye = camState\.eye \? lerp3\(camState\.eye, eyeT, 0\.08\) : eyeT;/, 'a null camera starts at its target');
});
