// ?clock=shared (the apartment MVP, Task 1; the user 14 Nov 14:55): Clock.publish on the conductor side, the shared
// source in clock.js on a scene. No browser: two fake AudioContexts on different time bases, one wall clock (the
// page-independent ms both sides stamp with), messages handed over directly (the BroadcastChannel's job in a page).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../experiments');

function fakeContext(t0 = 0) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  return {
    currentTime: t0, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: { connect() {} }, resume() {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator: () => ({ frequency: param(), connect() {}, start() {}, stop() {} }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }),
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createAnalyser: () => ({ fftSize: 2048, connect() {}, getFloatTimeDomainData() {} }),
  };
}
const SETTINGS = bpm => ({ bpm, bpb: 4, muted: true, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' });

/** a world: one wall clock (ms), a receiver on ?clock=shared whose AudioContext runs on its own time base */
function world({ recvT0 = 7.3, opts = {} } = {}) {
  const w = { ms: 1e6 };
  const rctx = fakeContext(recvT0);
  const recv = Clock.create({ source: 'shared', settings: SETTINGS(120), audioContext: () => rctx, timers: false, pump: true,
    now: () => w.ms, epochNow: () => w.ms, sharedFeed: true, keys: false, badge: false, ...opts });
  recv.start();
  const hNow = () => recv.now({ raw: true });
  return { w, rctx, recv, hNow };
}
/** a metronome publisher on another AudioContext (its own time base), published with Clock.publish */
function metronomePublisher(w, bpm, pubT0 = 0.4) {
  const pctx = fakeContext(pubT0);
  const pc = Clock.create({ source: 'metronome', settings: SETTINGS(bpm), audioContext: () => pctx, timers: false, pump: true, now: () => w.ms, keys: false });
  pc.start();
  const sent = [];
  const pub = Clock.publish(pc, { timers: false, epochNow: () => w.ms, post: m => sent.push(m) });
  return { pctx, pc, pub, sent };
}
/** advance the wall clock by ms in 5 ms steps; both contexts follow; deliver hands over what the publisher posts (a
 *  function: each message goes through it first) */
function run(W, P, ms, { deliver = true, each } = {}) {
  for (let s = 0; s < ms; s += 5) {
    W.w.ms += 5; W.rctx.currentTime += 0.005; P.pctx.currentTime += 0.005;
    P.pc.schedule();
    const before = P.sent.length;
    P.pub.tick();
    if (deliver) for (const m of P.sent.slice(before)) W.recv.sharedMessage(typeof deliver === 'function' ? deliver(m) : m);
    W.recv.schedule();
    if (each) each();
  }
}

test('shared: Clock.publish sends the output clock at most 20 Hz with page-independent stamps; nothing before the clock has beats', () => {
  const W = world(), P = metronomePublisher(W.w, 128);
  run(W, P, 2000, { deliver: false });
  const clocks = P.sent.filter(m => m.type === 'clock');
  assert.ok(clocks.length >= 30 && clocks.length <= 41, `${clocks.length} messages in 2 s (20 Hz max)`);
  for (let i = 1; i < clocks.length; i++) assert.ok(clocks[i].t - clocks[i - 1].t >= 49, `interval ${clocks[i].t - clocks[i - 1].t} ms`);
  const m = clocks[clocks.length - 1];
  for (const k of ['t', 'beats', 'bpm', 'phase', 'bar', 'beatInBar', 'confidence', 'state', 'offsetMs']) assert.ok(k in m, `message has ${k}`);
  assert.equal(m.bpm, 128);
  assert.ok(clocks.every(c => c.beats >= 0), 'no message before the clock has beats');
  assert.equal(Clock.SHARED_CHANNEL, 'cellular-viz-clock');
});

test('shared: a fake publisher at 128, the receiver on another time base: beats within 1 ms of the publisher (hard)', () => {
  const W = world({ recvT0: 13.37 }), P = metronomePublisher(W.w, 128, 0.2);
  let worst = 0, n = 0;
  run(W, P, 12000, { each: () => {
    if (W.w.ms < 1e6 + 2000) return;   // after the first second or so of messages
    const pb = P.pc.read({ raw: true }).beats, rb = W.recv.baseBeats(W.hNow());
    if (pb < 0 || rb < 0) return;
    worst = Math.max(worst, Math.abs(pb - rb) * 60 / 128 * 1000); n++;
  } });
  console.log(`# shared 128: worst ${worst.toFixed(4)} ms over ${n} samples; ${JSON.stringify(W.recv.sharedState)}`);
  assert.ok(n > 1000, `${n} samples`);
  assert.ok(worst < 1, `worst ${worst.toFixed(3)} ms`);
  assert.equal(W.recv.sharedState.state, 'locked');
  assert.equal(W.recv.read().bpm, 128);
  assert.equal(W.recv.lateStats.late, 0, 'no step booked after its own time');
  assert.ok(W.recv.hitLog.length > 40, `the page's patterns booked on the shared beats: ${W.recv.hitLog.length} hits`);
  const pr = P.pc.read({ raw: true }), rr = W.recv.read({ raw: true });
  assert.deepEqual([rr.bar, rr.beatInBar], [pr.bar, pr.beatInBar], 'bar and beat-in-bar as the publisher');
});

test('shared: a flip on the publisher lands on the receiver at the same bar line (jump { kind: flip })', () => {
  // a publisher stand-in: a clock-like object whose beats jump +1/2 at a bar line, logged as the line source logs a flip
  const W = world(), sent = [], bpm = 124, P0 = 60 / bpm;
  const pctx = fakeContext(3.1), jumps = [];
  let B0 = 0, T0 = 3.1;
  const pc = { ctx: pctx, playing: true, jumps, settings: { bpb: 4 }, visualOffsetMs: 0, trackerState: { state: 'locked' },
    now: () => pctx.currentTime,
    read() { const b = B0 + (pctx.currentTime - T0) / P0, k = Math.floor(b); return { beats: b, bpm, phase: b - k, bar: Math.floor(k / 4), beatInBar: k % 4 + 1, confidence: 0.9 }; } };
  const pub = Clock.publish(pc, { timers: false, epochNow: () => W.w.ms, post: m => sent.push(m) });
  const P = { pctx, pc: { schedule() {} }, pub, sent };
  run(W, P, 3000);
  // the flip: at the next bar line the publisher's beats move +0.5
  const bNow = pc.read().beats, barLine = 4 * (Math.floor(bNow / 4) + 1), tFlip = T0 + (barLine - B0) * P0;
  let landed = null;
  run(W, P, 4000, { each: () => {
    if (!landed && pctx.currentTime >= tFlip) {
      const from = B0 + (pctx.currentTime - T0) / P0;
      B0 += 0.5; landed = { at: pctx.currentTime, from, to: from + 0.5 };
      jumps.push({ type: 'jump', at: pctx.currentTime, kind: 'flip', fromBeats: from, toBeats: from + 0.5, origin: 'fix:key' });
    }
  } });
  assert.ok(landed, 'the publisher flipped');
  const rj = W.recv.jumps.filter(j => j.kind === 'flip');
  assert.equal(rj.length, 1, `one flip on the receiver: ${JSON.stringify(W.recv.jumps)}`);
  assert.ok(Math.abs(rj[0].fromBeats - barLine) < 0.02, `it lands at the same bar line: from ${rj[0].fromBeats} (bar line ${barLine})`);
  assert.ok(Math.abs(rj[0].toBeats - landed.to) < 1e-6, 'to the publisher\'s beats');
  assert.equal(rj[0].origin, 'shared:fix:key');
  assert.equal(W.recv.jumps.filter(j => j.kind === 'shared').length, 0, 'the state messages after it agree: no extra jump');
  const pb = pc.read().beats, rb = W.recv.baseBeats(W.hNow());
  assert.ok(Math.abs(pb - rb) * P0 * 1000 < 1, `in step after the flip: ${((pb - rb) * P0 * 1000).toFixed(3)} ms`);
});

test('shared: a 2 s gap → free-run at the last tempo ("shared clock lost"), then a silent re-lock; beats monotonic throughout', () => {
  const W = world(), P = metronomePublisher(W.w, 128);
  let prev = -Infinity, mono = true;
  const watch = () => { const b = W.recv.baseBeats(W.hNow()); if (b >= 0) { if (b < prev - 1e-9) mono = false; prev = b; } };
  run(W, P, 3000, { each: watch });
  assert.equal(W.recv.sharedState.state, 'locked');
  run(W, P, 2600, { deliver: false, each: watch });
  const lost = W.recv.sharedState;
  assert.equal(lost.state, 'free-run', 'no message for 2 s: free-run');
  assert.equal(lost.lost, true);
  const pb = P.pc.read({ raw: true }).beats, rb = W.recv.baseBeats(W.hNow());
  assert.ok(Math.abs(pb - rb) * 60 / 128 * 1000 < 1, 'free-running at the last tempo, still on the beat');
  run(W, P, 2000, { each: watch });
  const back = W.recv.sharedState;
  assert.equal(back.state, 'locked', 're-locked');
  assert.equal(back.lost, false);
  assert.equal(W.recv.jumps.length, 0, 'silently: no jump');
  assert.ok(mono, 'beats never ran backwards');
  assert.deepEqual(back.states.map(s => s.state), ['locked', 'free-run', 'locked']);
});

test('shared: a phase error up to 1/4 beat slews (no jump); over 1/4 beat jumps (kind shared) and rebooks; hand fixes do nothing on a scene', () => {
  const W = world(), P = metronomePublisher(W.w, 120);
  run(W, P, 2000);
  // the publisher moves +0.2 beat and the event is not sent (a stand-in for drift): the receiver slews
  const quiet = ms => { P.pc.fix('nudge', ms, { origin: 'qa' }); P.pub.seenJumps = P.pc.jumps.length; };
  quiet(100);   // the metronome carries the new count from its next sixteenth on
  run(W, P, 400);
  assert.equal(W.recv.jumps.length, 0, '0.2 beat: no jump');
  // 5 % of 120 bpm = 0.1 beat/s: after ~0.3 s of slewing about 0.17 beat is left
  const mid = Math.abs(W.recv.baseBeats(W.hNow()) - P.pc.read({ raw: true }).beats);
  assert.ok(mid > 0.1 && mid < 0.195, `slewing, not snapping: ${mid.toFixed(3)} beat left after 0.4 s`);
  run(W, P, 6000);
  assert.ok(Math.abs(W.recv.baseBeats(W.hNow()) - P.pc.read({ raw: true }).beats) * 500 < 1, 'slewed in');
  quiet(700);   // 1.4 beat: over 1/4 beat
  run(W, P, 200);
  const j = W.recv.jumps.filter(x => x.kind === 'shared');
  assert.equal(j.length, 1, 'one jump');
  assert.equal(j[0].origin, 'shared');
  assert.ok(Math.abs(j[0].toBeats - j[0].fromBeats - 1.4) < 0.01, `by the error: ${(j[0].toBeats - j[0].fromBeats).toFixed(3)}`);
  assert.equal(W.recv.fix('nudge', 10, { origin: 'fix:key' }), null, 'a hand fix on a scene does nothing');
  assert.equal(W.recv.lateStats.late, 0);
});

test('shared: the conductor page publishes its output clock; ?clock=shared is a known source; the publisher page', () => {
  const html = fs.readFileSync(path.join(EX, 'clock-conductor.html'), 'utf8');
  assert.match(html, /const publisher = Clock\.publish\(clock\);/, 'the conductor publishes its output clock');
  assert.match(html, /log, clock, shadow, publisher,/, '__qa.conductor.publisher');
  const c = Clock.create({ source: 'shared', settings: SETTINGS(120), audioContext: () => fakeContext(), timers: false, sharedFeed: true, keys: false, badge: false });
  assert.equal(c.source, 'shared'); assert.equal(c.fallback, null);
  assert.equal(c.sharedState.state, 'waiting');
  const pubPage = fs.readFileSync(path.join(EX, 'clock-publish.html'), 'utf8');
  assert.match(pubPage, /Clock\.publish\(clock\)/);
  assert.ok(/^[\x00-\x7f]*$/.test(pubPage), 'the publisher page is plain ASCII (#205)');
});

// ---------- the visual offset on the shared clock (Saturday fix list, 19 Nov: "the delay should be done too") ----------
// mac session 18 Nov: the conductor's Calibrate slider moved only the conductor's own flash; the scenes ignored the
// offsetMs in every clock message. Now a scene takes it (+ = visuals earlier, as on the conductor: now() = heard time
// + offset, so the visuals show the music offsetMs ahead, covering the Chrome -> OBS -> NDI -> Resolume -> projector lag).
test('shared offset: the scene follows the publisher\'s offsetMs (+ = visuals earlier), changes and back to 0', () => {
  const W = world(), P = metronomePublisher(W.w, 128);
  P.pc.setVisualOffset(120);
  run(W, P, 1000);
  assert.equal(W.recv.visualOffsetMs, 120, 'the publisher\'s offset');
  assert.ok(Math.abs(W.recv.now() - W.recv.now({ raw: true }) - 0.120) < 1e-12, 'the scene\'s visual time is 120 ms ahead of the heard time');
  const rb = W.recv.read({ raw: true, lead: 0.120 }), vb = W.recv.read();
  assert.ok(Math.abs(vb.beats - rb.beats) < 1e-9, 'read() shows the beat 120 ms ahead, as the conductor\'s flash');
  assert.equal(W.recv.sharedState.offsetMs, 120); assert.equal(W.recv.sharedState.offsetFrom, 'publisher');
  P.pc.setVisualOffset(300);
  run(W, P, 200);
  assert.equal(W.recv.visualOffsetMs, 300, 'a slider move reaches the scene with the next message (20 Hz)');
  P.pc.setVisualOffset(0);
  run(W, P, 200);
  assert.equal(W.recv.visualOffsetMs, 0);
  assert.equal(W.recv.jumps.length, 0, 'the offset moves no beats: no jump');
  assert.equal(W.recv.lateStats.late, 0);
});

test('shared offset: offsetMs 0, or no offsetMs at all (an older publisher), changes nothing (same hits, beats, offset 0)', () => {
  const A = world(), PA = metronomePublisher(A.w, 128);
  const B = world(), PB = metronomePublisher(B.w, 128);
  const strip = m => { const c = { ...m }; delete c.offsetMs; return c; };
  run(A, PA, 4000, { each: () => A.recv.hitsDue() });
  run(B, PB, 4000, { deliver: strip, each: () => B.recv.hitsDue() });
  assert.ok(PA.sent.some(m => m.type === 'clock' && m.offsetMs === 0), 'A got offsetMs 0');
  assert.equal(A.recv.visualOffsetMs, 0); assert.equal(B.recv.visualOffsetMs, 0);
  assert.equal(A.recv.bookAhead(), A.recv.lookAhead, 'at offset 0 the booking horizon is the look-ahead, as before');
  assert.ok(A.recv.hitLog.length > 15, `${A.recv.hitLog.length} hits`);
  assert.deepEqual(A.recv.hitLog.map(h => `${h.lane}@${h.time.toFixed(9)}`), B.recv.hitLog.map(h => `${h.lane}@${h.time.toFixed(9)}`));
  const ra = A.recv.read({ raw: true }), rb = B.recv.read({ raw: true });
  for (const k of ['beats', 'bpm', 'phase', 'bar', 'beatInBar']) assert.equal(ra[k], rb[k], k);
  assert.equal(A.recv.now(), A.recv.now({ raw: true }), 'no visual offset');
  assert.deepEqual([A.recv.lateStats.late, B.recv.lateStats.late, A.recv.sharedState.skipped, B.recv.sharedState.skipped], [0, 0, 0, 0]);
});

// +140 ms: the route delay measured on 18 Nov (notes, "Delay measured": the projector ~140 ms after the conductor's
// beat lamp), so the slider's Saturday value; +300 ms: headroom. Both are over the 100 ms look-ahead.
for (const OFF of [140, 300]) {
  test(`shared offset: at +${OFF} ms (over the 100 ms look-ahead) every hit still reaches the visuals on time, none late or skipped`, () => {
    const W = world(), P = metronomePublisher(W.w, 128);
    P.pc.setVisualOffset(OFF);
    run(W, P, 3000, { each: () => W.recv.hitsDue() });   // a frame every 5 ms: the look-ahead adapts down to its 100 ms floor
    assert.equal(W.recv.visualOffsetMs, OFF);
    assert.equal(W.recv.lateStats.lookAheadMs, 100, `the look-ahead is at its floor, so +${OFF} ms is past it`);
    const v0 = W.recv.now(), got = [];
    let worst = 0, leadMin = Infinity;
    run(W, P, 6000, { each: () => {
      const v = W.recv.now(), heard = W.recv.now({ raw: true });
      for (const h of W.recv.hitsDue()) { got.push(h); worst = Math.max(worst, v - h.time); leadMin = Math.min(leadMin, h.time - heard); }
    } });
    const v1 = W.recv.now();
    const want = W.recv.hitLog.filter(h => h.time > v0 && h.time <= v1);
    console.log(`# shared +${OFF} ms: ${got.length} hits handed out, worst ${(worst * 1000).toFixed(3)} ms after their time; ${JSON.stringify(W.recv.lateStats)}`);
    assert.ok(want.length >= 25, `${want.length} hits in 6 s at 128`);
    assert.deepEqual(got.filter(h => h.time > v0).map(h => h.time), want.map(h => h.time), 'every hit in the window handed out, once, in order');
    assert.ok(worst <= 0.0051, `each hit within one 5 ms frame of its time: worst ${(worst * 1000).toFixed(3)} ms (before 19 Nov: ~${OFF - 100} ms)`);
    assert.equal(W.recv.lateStats.late, 0, 'no step booked after its own time');
    assert.equal(W.recv.sharedState.skipped, 0, 'no step skipped');
    // the sign: each hit reaches the visuals ~OFF ms BEFORE its sound is heard (visuals earlier)
    assert.ok(leadMin >= OFF / 1000 - 0.0051 && leadMin <= OFF / 1000 + 1e-9, `handed out ${(leadMin * 1000).toFixed(3)} ms before it is heard`);
  });
}

test('shared offset: ?offset= on the scene URL (or opts.offset) wins over the publisher\'s offsetMs; other sources ignore ?offset=', () => {
  const W = world({ opts: { offset: 40 } }), P = metronomePublisher(W.w, 128);
  assert.equal(W.recv.visualOffsetMs, 40, 'set at create');
  P.pc.setVisualOffset(300);
  run(W, P, 1000);
  assert.equal(W.recv.visualOffsetMs, 40, 'the publisher\'s 300 is ignored');
  assert.equal(W.recv.sharedState.offsetFrom, 'url');
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'location'), old = globalThis.location;
  try {
    globalThis.location = { search: '?clock=shared&offset=-20&capture=1' };
    const U = world(), PU = metronomePublisher(U.w, 128);
    PU.pc.setVisualOffset(150);
    run(U, PU, 1000);
    assert.equal(U.recv.visualOffsetMs, -20, '?offset=-20 from the page URL');
    assert.equal(U.recv.sharedState.offsetFrom, 'url');
    const m = Clock.create({ source: 'metronome', settings: SETTINGS(120), audioContext: () => fakeContext(), timers: false, keys: false });
    assert.equal(m.visualOffsetMs, 0, 'a page not on the shared clock does not read ?offset= here');
  } finally {
    if (had) globalThis.location = old; else delete globalThis.location;
  }
  const N = world();
  assert.equal(N.recv.visualOffsetMs, 0); assert.equal(N.recv.sharedState.offsetFrom, 'publisher');
});

// ---------- the knobs (the fix list, 19 Nov 22:00): the controller's pot row 1 → the scenes ----------
// The conductor hands pot row 1 (8 values 0..1) to publisher.setKnobs; a scene on ?clock=shared reads clock.knob(n).
test('shared knobs: the conductor\'s pot row 1 reaches a scene (own message on change, 20 Hz at most, and in every clock message)', () => {
  const W = world(), P = metronomePublisher(W.w, 128);
  run(W, P, 1000);
  const NONE = [null, null, null, null, null, null, null, null];
  assert.deepEqual(W.recv.knobs, NONE, 'null until known');
  assert.equal(W.recv.knob(1), null);
  assert.ok(P.sent.filter(m => m.type === 'clock').every(m => !('knobs' in m)), 'no knobs field before any knob moved');
  // knob 1 moves: its own message goes out at once
  const k1 = [0.5, null, null, null, null, null, null, null];
  assert.equal(P.pub.setKnobs(k1), true);
  const first = P.sent[P.sent.length - 1];
  assert.deepEqual(first, { type: 'knobs', v: 1, t: W.w.ms, knobs: k1 });
  W.recv.sharedMessage(first);
  assert.equal(W.recv.knob(1), 0.5);
  assert.equal(W.recv.knob(2), null);
  assert.equal(P.pub.setKnobs(k1), false, 'the same values again: nothing sent');
  // a fast turn: 10 changes within the same 50 ms send nothing more until the tick; the last value wins
  const before = P.sent.length;
  for (let i = 1; i <= 10; i++) P.pub.setKnobs([0.5, i / 10, null, null, null, null, null, 0.25]);
  assert.equal(P.sent.length, before, 'held back by the 20 Hz limit');
  run(W, P, 200);
  const knobMsgs = P.sent.filter(m => m.type === 'knobs');
  for (let i = 1; i < knobMsgs.length; i++) assert.ok(knobMsgs[i].t - knobMsgs[i - 1].t >= 49, 'at most 20 Hz');
  assert.equal(knobMsgs.length, 2, 'the held-back change went out once');
  assert.deepEqual(W.recv.knobs, [0.5, 1, null, null, null, null, null, 0.25]);
  assert.equal(W.recv.knob(8), 0.25);
  assert.equal(W.recv.knob(0), null); assert.equal(W.recv.knob(9), null); assert.equal(W.recv.knob(1.5), null);
  // every clock message carries them: a scene opened later gets them with its first clock message
  const lastClock = P.sent.filter(m => m.type === 'clock').pop();
  assert.deepEqual(lastClock.knobs, [0.5, 1, null, null, null, null, null, 0.25]);
  const late = world();
  late.recv.sharedMessage({ ...lastClock, t: late.w.ms });
  assert.deepEqual(late.recv.knobs, lastClock.knobs, 'from one clock message');
  // the knobs never touch the clock
  assert.equal(W.recv.jumps.length, 0);
  assert.equal(W.recv.sharedState.state, 'locked');
  // before Play (no AudioContext yet) they are kept too; bad values are cleaned, a wrong length ignored
  const idle = Clock.create({ source: 'shared', settings: SETTINGS(120), audioContext: () => fakeContext(), timers: false, sharedFeed: true, keys: false, badge: false });
  idle.sharedMessage({ type: 'knobs', v: 1, t: 1, knobs: [1.7, -0.2, 'x', NaN, 0.3, null, undefined, 1] });
  assert.deepEqual(idle.knobs, [1, 0, null, null, 0.3, null, null, 1]);
  idle.sharedMessage({ type: 'knobs', v: 1, t: 2, knobs: [0.1, 0.2] });
  assert.equal(idle.knob(5), 0.3, 'a list that is not 8 long is ignored');
  idle.knobs[0] = 0.9;
  assert.equal(idle.knob(1), 1, 'clock.knobs is a copy');
  assert.equal(idle.sharedState.msgs, 0, 'a knobs message is not a clock message');
  // other sources: all null
  const m = Clock.create({ source: 'metronome', settings: SETTINGS(120), audioContext: () => fakeContext(), timers: false, keys: false });
  assert.deepEqual(m.knobs, NONE); assert.equal(m.knob(1), null);
  assert.equal(Clock.KNOBS, 8);
});

// ---------- the beat knob (the user, 20 Nov 15:34): one knob per slot scales every scene's kick/snare/hat terms ----------
test('beat knob: Clock.beatGain(k): null -> 1 (as before), the dead zone -> 0 (beat off), centre 1, top 3; clock.beatGain(n) reads knob n', () => {
  assert.equal(Clock.BEAT_DEAD_ZONE, 0.05); assert.equal(Clock.BEAT_GAIN_MAX, 3);
  assert.equal(Clock.beatGain(null), 1, 'not moved yet: the scene looks as today');
  assert.equal(Clock.beatGain(undefined), 1); assert.equal(Clock.beatGain(NaN), 1); assert.equal(Clock.beatGain('0.5'), 1);
  assert.equal(Clock.beatGain(0), 0, 'fully down: beat off');
  assert.equal(Clock.beatGain(0.05), 0, 'the dead zone\'s edge is still off');
  assert.equal(Clock.beatGain(-1), 0);
  assert.ok(Math.abs(Clock.beatGain(0.5) - 1) < 1e-12, 'centre = 1');
  assert.ok(Math.abs(Clock.beatGain(1) - 3) < 1e-12, 'top = 3');
  assert.equal(Clock.beatGain(7), 3, 'clamped');
  const g06 = Clock.beatGain(0.06);
  assert.ok(g06 > 0.3 && g06 < 0.4, `just above the dead zone: about 1/3 (${g06})`);
  let last = 0;
  for (let k = 0.06; k <= 1; k += 0.01) { const g = Clock.beatGain(k); assert.ok(g >= last && g <= 3, `rising at ${k}`); last = g; }
  // on a scene: knob n over the shared clock; before any knob message, and on other sources, always 1
  const idle = Clock.create({ source: 'shared', settings: SETTINGS(120), audioContext: () => fakeContext(), timers: false, sharedFeed: true, keys: false, badge: false });
  assert.equal(idle.beatGain(1), 1, 'no knob message yet');
  idle.sharedMessage({ type: 'knobs', v: 1, t: 1, knobs: [0, 0.5, null, null, 1, null, null, 0.03] });
  assert.deepEqual([idle.beatGain(1), idle.beatGain(5), idle.beatGain(3), idle.beatGain(8)], [0, 3, 1, 0]);
  assert.ok(Math.abs(idle.beatGain(2) - 1) < 1e-12);
  assert.deepEqual([idle.beatGain(0), idle.beatGain(9), idle.beatGain(undefined), idle.beatGain('1')], [1, 1, 1, 1], 'no such knob: 1');
  const m = Clock.create({ source: 'metronome', settings: SETTINGS(120), audioContext: () => fakeContext(), timers: false, keys: false });
  assert.equal(m.beatGain(1), 1, 'other sources: 1');
});

test('shared knobs: without a controller nothing changes (clock messages as before, receiver knobs null, beats on time); old receivers are safe', () => {
  const W = world(), P = metronomePublisher(W.w, 128);
  let worst = 0;
  run(W, P, 4000, { each: () => {
    if (W.w.ms < 1e6 + 2000) return;
    const pb = P.pc.read({ raw: true }).beats, rb = W.recv.baseBeats(W.hNow());
    if (pb >= 0 && rb >= 0) worst = Math.max(worst, Math.abs(pb - rb) * 60 / 128 * 1000);
  } });
  const clocks = P.sent.filter(m => m.type === 'clock');
  assert.ok(clocks.length > 50);
  for (const m of clocks) assert.deepEqual(Object.keys(m), ['type', 'v', 't', 'beats', 'bpm', 'phase', 'bar', 'beatInBar', 'bpb', 'confidence', 'state', 'offsetMs'], 'the clock message as before');
  assert.equal(P.sent.filter(m => m.type === 'knobs').length, 0);
  assert.deepEqual(W.recv.knobs, [null, null, null, null, null, null, null, null]);
  assert.ok(worst < 1, `beats within 1 ms: ${worst.toFixed(3)}`);
  assert.equal(W.recv.jumps.length, 0);
  // a knobs message on the channel: panic.js ignores it, setup-check counts only clock messages
  const panicLib = require('../../../experiments/panic.js');
  assert.equal(panicLib.panicMode({ type: 'knobs', v: 1, t: 1, knobs: [0, 0, 0, 0, 0, 0, 0, 0] }), null);
  // the receiver's clock is the same with or without a knobs message in between
  const A = world(), PA = metronomePublisher(A.w, 128), B = world(), PB = metronomePublisher(B.w, 128);
  const k = { type: 'knobs', v: 1, t: 0, knobs: [0.2, 0.4, 0.6, 0.8, 1, 0, 0.1, 0.3] };
  run(A, PA, 2000);
  run(B, PB, 2000, { deliver: m => { B.recv.sharedMessage({ ...k, t: m.t }); return m; } });
  assert.deepEqual(A.recv.hitLog.map(h => h.time), B.recv.hitLog.map(h => h.time));
  assert.equal(A.recv.read({ raw: true }).beats, B.recv.read({ raw: true }).beats);
  assert.deepEqual(A.recv.sharedState.msgs, B.recv.sharedState.msgs);
  assert.deepEqual(B.recv.knobs, k.knobs);
});
