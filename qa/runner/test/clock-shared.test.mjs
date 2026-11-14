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
function world({ recvT0 = 7.3 } = {}) {
  const w = { ms: 1e6 };
  const rctx = fakeContext(recvT0);
  const recv = Clock.create({ source: 'shared', settings: SETTINGS(120), audioContext: () => rctx, timers: false, pump: true,
    now: () => w.ms, epochNow: () => w.ms, sharedFeed: true, keys: false, badge: false });
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
/** advance the wall clock by ms in 5 ms steps; both contexts follow; deliver(msg) hands over what the publisher posts */
function run(W, P, ms, { deliver = true, each } = {}) {
  for (let s = 0; s < ms; s += 5) {
    W.w.ms += 5; W.rctx.currentTime += 0.005; P.pctx.currentTime += 0.005;
    P.pc.schedule();
    const before = P.sent.length;
    P.pub.tick();
    if (deliver) for (const m of P.sent.slice(before)) W.recv.sharedMessage(m);
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
  quiet(100);
  const slewStart = Math.abs(W.recv.baseBeats(W.hNow()) - P.pc.read({ raw: true }).beats);
  run(W, P, 300);
  assert.equal(W.recv.jumps.length, 0, '0.2 beat: no jump');
  const mid = Math.abs(W.recv.baseBeats(W.hNow()) - P.pc.read({ raw: true }).beats);
  assert.ok(mid < slewStart && mid > 0.001, `slewing: ${slewStart.toFixed(3)} -> ${mid.toFixed(3)} beat after 0.3 s`);
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
