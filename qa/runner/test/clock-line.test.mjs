// Clock PR 3b (#173): the line source in clock.js. The tracker (clock-tracker.js, 3a) steers the clock under the
// authority table; tracker jumps rebook (R2); the latency timebase ignores the visual offset (R4); __qa.tracker and its
// state sequence (R6); hand fixes against the tracker (tap, x2, nudge) and the tap escape through the clock (R5).
// No browser: a fake AudioContext whose currentTime the test moves; frames come from the 3a analysis in node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { render } from './fixtures/tracker-scenarios.mjs';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const T = require('../../../experiments/clock-tracker.js');
const AudioIn = require('../../../experiments/audio-in.js');

const SR = 44100, QA = { origin: 'qa' };
const frac = x => x - Math.round(x);

// ---------- a fake AudioContext that records clicks and whether they were stopped before sounding ----------
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const clicks = [];
  const ctx = {
    currentTime: 0, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: { connect() {} }, clicks,
    resume() {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createOscillator: () => { const s = { frequency: param(), connect() {}, start(t) { s.t = t; clicks.push(s); }, stop(t) { if (t === 0) s.cancelled = true; } }; return s; },
    createBufferSource: () => { const s = { buffer: null, connect() {}, start(t) { s.t = t; clicks.push(s); }, stop(t) { if (t === 0) s.cancelled = true; } }; return s; },
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createAnalyser: () => ({ fftSize: 2048, connect() {}, getFloatTimeDomainData() {} }),
  };
  return ctx;
}
const SETTINGS = (click = false) => ({ bpm: 120, bpb: 4, muted: false, click,
  kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' });

// a tracker stand-in with a fixed tempo and a jump on demand (R2, R4: the clock's side only)
function stubTracker(bpm) {
  const P = 60 / bpm, jumps = [];
  let T0 = 0, B0 = 0;
  return {
    jumps, state: 'locked', confidence: 0.9, hasModel: true, tapped: false, octaveLock: null,
    get bpm() { return bpm; },
    push() {}, beatsAt: t => B0 + (t - T0) / P, timeOf: b => T0 + (b - B0) * P, tap() {}, scaleTempo() {},
    snapshot() { return { state: 'locked', confidence: 0.9, octaveLock: null, bpm, tapped: false, lastJump: jumps[jumps.length - 1] || null }; },
    jumpBy(t, d) { const from = B0 + (t - T0) / P; B0 += d; jumps.push({ type: 'jump', at: t, kind: 'acquire', fromBeats: from, toBeats: from + d }); },
  };
}
function stubClock(bpm, { click = false, offset = 0 } = {}) {
  const ctx = fakeContext(), tr = stubTracker(bpm);
  let perf = 0;
  const c = Clock.create({ source: 'line', settings: SETTINGS(click), audioContext: () => ctx, timers: false, pump: true,
    now: () => perf, tracker: tr, lineFeed: true, keys: false });
  if (offset) c.setVisualOffset(offset);
  c.start();
  const step = ms => { ctx.currentTime += ms / 1000; perf += ms; c.lineFrame({ t: ctx.currentTime, flux: 0 }); c.read(); };
  return { c, ctx, tr, step };
}

// the 3a analysis → frames; each frame moves the fake clock to its time, then feeds the clock and reads it (pump)
function runLine(s, { at = [], click = false } = {}) {
  const ctx = fakeContext();
  let perf = 0;
  const c = Clock.create({ source: 'line', settings: SETTINGS(click), audioContext: () => ctx, timers: false, pump: true,
    now: () => perf, lineFeed: true, keys: false });
  c.start();
  const frames = [];
  const an = T.createAnalyzer({ sampleRate: s.sr, onFrame: f => frames.push(f) });
  for (let i = 0; i < s.samples.length; i += 128) an.process(s.samples.subarray(i, Math.min(s.samples.length, i + 128)), i / s.sr);
  const hooks = at.slice().sort((a, b) => a.t - b.t), log = [];
  let prev = -Infinity, mono = true, bi = 0;
  for (const f of frames) {
    ctx.currentTime = f.t; perf = f.t * 1000;
    while (hooks.length && hooks[0].t <= f.t) hooks.shift().fn(c, f.t);
    c.lineFrame(f); c.read();
    const b = c.baseBeats(f.t);
    if (b >= 0 && prev >= 0 && b < prev - 1e-9 && c.line.tracker.state !== 'acquire') mono = false;
    if (b >= 0) prev = b;
    while (bi < s.beats.length && s.beats[bi] <= f.t) { const bb = c.baseBeats(s.beats[bi]); log.push({ t: s.beats[bi], b: bb, e: bb >= 0 ? frac(bb) : NaN }); bi++; }
  }
  return { c, ctx, log, mono };
}

test('line is a real source now: no fallback, trackerState and __qa.tracker are there', () => {
  const { c } = stubClock(128);
  assert.equal(c.source, 'line');
  assert.equal(c.fallback, null);
  const st = c.trackerState;
  for (const k of ['state', 'confidence', 'octaveLock', 'bpm', 'lastJump']) assert.ok(k in st, `trackerState.${k}`);
  const a = AudioIn.create({ clock: c, source: 'clock' }), q = AudioIn.qa(a, {});
  for (const k of ['state', 'confidence', 'octaveLock', 'bpm', 'lastJump']) assert.ok(k in q.tracker, `__qa.tracker.${k}`);
  assert.equal(q.tracker.state, 'locked');
  // other sources: null
  const m = Clock.create({ source: 'metronome', audioContext: () => fakeContext(), timers: false, keys: false });
  assert.equal(m.trackerState, null);
});

test('R2 rebook: an acquire jump at 174 BPM with 150 ms frames leaves no click on the old grid, clockLate.late = 0', () => {
  const { c, ctx, tr, step } = stubClock(174, { click: true });
  for (let i = 0; i < 10; i++) step(150);
  const tJ = ctx.currentTime;
  tr.jumpBy(tJ, 0.4);           // the tracker decides to jump (e.g. re-acquiring after a breakdown)
  c.lineFrame({ t: tJ, flux: 0 });
  for (let i = 0; i < 14; i++) step(150);
  const j = c.jumps.filter(x => x.origin === 'tracker');
  assert.equal(j.length, 1); assert.equal(j[0].kind, 'acquire');
  const after = ctx.clicks.filter(s => !s.cancelled && s.t > tJ + 128 / ctx.sampleRate);
  assert.ok(after.length > 10, `clicks after the jump: ${after.length}`);
  const off = after.map(s => Math.abs(frac(tr.beatsAt(s.t) * 4)));
  assert.ok(Math.max(...off) < 1e-6, `every click after the jump is on the new grid (worst ${Math.max(...off)} sixteenth)`);
  assert.ok(ctx.clicks.some(s => s.cancelled), 'old-grid clicks were booked and then stopped');
  assert.equal(c.lateStats.late, 0, `clockLate ${JSON.stringify(c.lateStats)}`);
  // and the future hits follow the new grid too
  const hits = c.hitLog.filter(h => h.time > tJ + 128 / ctx.sampleRate);
  assert.ok(hits.length && hits.every(h => Math.abs(frac(tr.beatsAt(h.time) * 4)) < 1e-6));
});

test('R4 timebase: visual offset 0 and +60 ms give the same hit times and raw beats', () => {
  const A = stubClock(128), B = stubClock(128, { offset: 60 });
  // 10 s at 128 (~21 beats, ~10 hits a bar): 40 steps (2 s, ~1 bar) were too short for > 20 hits on #180's first test-pr
  for (let i = 0; i < 200; i++) { A.step(50); B.step(50); }
  assert.ok(A.c.hitLog.length > 20, `hits logged in 10 s: ${A.c.hitLog.length}`);
  assert.deepEqual(B.c.hitLog.map(h => h.time), A.c.hitLog.map(h => h.time));
  assert.equal(B.c.read({ raw: true }).beats, A.c.read({ raw: true }).beats);
  assert.ok(Math.abs(B.c.read().beats - A.c.read().beats - 0.060 * 128 / 60) < 1e-9, 'only the visual read moves');
});

test('R6 state: the line clock through breakdown-0.40 goes locked → free-run → (acquire) → locked, one tracker jump', () => {
  const s = render('breakdown-0.40', { sr: SR }), tB = s.events.find(e => e.kind === 'breakdown').t;
  const { c } = runLine(s, { click: true });
  const states = c.line.stateLog.map(x => x.state), firstLock = states.indexOf('locked'), seq = states.slice(firstLock);
  const tj = c.jumps.filter(j => j.origin === 'tracker' && j.at > tB);
  console.log(`R6 states ${states.join('→')}; tracker jumps after the breakdown ${tj.map(j => `${j.kind}@${j.at.toFixed(2)}`).join(', ') || 'none'}; clockLate ${JSON.stringify(c.lateStats)}; trackerState ${JSON.stringify({ ...c.trackerState, states: undefined })}`);
  assert.ok(firstLock >= 0, `locks: ${states.join('→')}`);
  assert.equal(seq[1], 'free-run', `state sequence ${seq.join('→')}`);
  assert.equal(seq[seq.length - 1], 'locked', `state sequence ${seq.join('→')}`);
  assert.equal(tj.filter(j => j.kind === 'acquire').length, 1, `one acquire jump: ${tj.map(j => j.kind).join(',')}`);
  for (const k of ['state', 'confidence', 'octaveLock', 'bpm', 'lastJump']) assert.ok(k in c.trackerState);
});

test('line on 128-steady: hits on the tracked grid after the lock, settings.bpm follows, no late steps', () => {
  const s = render('128-steady', { sr: SR }), { c, log, mono } = runLine(s);
  const sig = log.filter(x => x.t > 12 && Number.isFinite(x.e)).map(x => x.e), srt = sig.slice().sort((a, b) => a - b);
  const bias = srt[Math.floor(srt.length / 2)], dev = sig.map(e => Math.abs(e - bias)).sort((a, b) => a - b);
  const p90 = dev[Math.floor(0.9 * (dev.length - 1) + 0.5)], max = dev[dev.length - 1];
  console.log(`line 128-steady: bpm ${c.settings.bpm}, hits ${c.hitLog.length}, phase around the bias p90 ${p90.toFixed(4)} max ${max.toFixed(4)} beat (bias ${bias.toFixed(4)}, n ${dev.length}), clockLate ${JSON.stringify(c.lateStats)}`);
  assert.ok(Math.abs(c.settings.bpm - 128) <= 1, `settings.bpm ${c.settings.bpm}`);
  assert.ok(c.hitLog.length > 100, `hits ${c.hitLog.length}`);
  assert.ok(dev.length > 40 && p90 <= 0.03, `clock phase at true beats after 12 s: p90 ${p90} beat around the bias (n ${dev.length})`);
  assert.ok(mono, 'beats monotonic after the lock');
  assert.equal(c.lateStats.late, 0, JSON.stringify(c.lateStats));
});

test('tap then tracker: a correct tap is followed (the tracker only nudges it), no override', () => {
  const s = render('128-steady', { sr: SR }), tTap = s.beats.find(t => t >= 12);
  const { c } = runLine(s, { at: [{ t: tTap, fn: c => c.fix('tap', QA) }] });
  const ov = c.jumps.filter(j => j.kind === 'override');
  console.log(`tap at ${tTap.toFixed(3)}: tapped ${c.trackerState.tapped}, overrides ${ov.length}, bpm ${c.trackerState.bpm}`);
  assert.equal(c.jumps.filter(j => j.kind === 'tap').length, 1);
  assert.equal(ov.length, 0, 'no override');
  assert.equal(c.trackerState.tapped, true);
});

test('R5 through the clock: two taps 5 % fast → exactly one override within 4 s + 1 bar', () => {
  const s = render('128-steady', { sr: SR }), P = 60 / 128, t1 = s.beats.find(t => t >= 12), t2 = t1 + 60 / (128 * 1.05);
  const { c } = runLine(s, { at: [{ t: t1, fn: c => c.fix('tap', QA) }, { t: t2, fn: c => c.fix('tap', QA) }] });
  const ov = c.jumps.filter(j => j.kind === 'override');
  console.log(`R5 clock: taps at ${t1.toFixed(3)}, ${t2.toFixed(3)}; overrides ${ov.map(j => (j.at - t2).toFixed(2) + ' s').join(', ') || 'none'}; bpm ${c.trackerState.bpm}`);
  assert.equal(ov.length, 1, 'exactly one override');
  assert.equal(ov[0].origin, 'tracker');
  assert.ok(ov[0].at - t2 <= 4 + 4 * P + 0.05, `override ${ov[0].at - t2} s after the second tap`);
  assert.equal(c.trackerState.tapped, false);
});

test('x2 then tracker: the octave lock holds against the half-tempo estimate', () => {
  const s = render('128-steady', { sr: SR }), tX = s.beats.find(t => t >= 12);
  const { c } = runLine(s, { at: [{ t: tX, fn: c => c.fix('x2', QA) }] });
  const st = c.trackerState;
  console.log(`x2: bpm ${st.bpm}, octaveLock ${st.octaveLock}, settings.bpm ${c.settings.bpm}`);
  assert.ok(Math.abs(st.bpm - 256) <= 3, `bpm ${st.bpm}`);
  assert.ok(st.octaveLock && Math.abs(st.octaveLock - 256) <= 3, `octaveLock ${st.octaveLock}`);
});

test('nudge then tracker: the shift stays (the PLL carries on underneath)', () => {
  const s = render('128-steady', { sr: SR }), tN = s.beats.find(t => t >= 12);
  const { c } = runLine(s, { at: [{ t: tN, fn: c => c.fix('nudge', 20, QA) }] });
  const t = s.duration - 1, d = c.baseBeats(t) - c.line.tracker.beatsAt(t);
  console.log(`nudge +20 ms: clock − tracker at the end ${(d * 60000 / 128).toFixed(2)} ms`);
  assert.ok(Math.abs(d - 0.020 * c.line.tracker.bpm / 60) < 0.002, `offset ${d} beat`);
  assert.equal(c.jumps.filter(j => j.kind === 'nudge').length, 1);
});

test('the metronome and file: sources are untouched by the line code (no tracker, no trackerState)', () => {
  const m = Clock.create({ source: 'metronome', audioContext: () => fakeContext(), timers: false, keys: false });
  assert.equal(m.line, null); assert.equal(m.trackerState, null);
  const u = Clock.create({ source: 'nope', audioContext: () => fakeContext(), timers: false, keys: false });
  assert.equal(u.source, 'metronome'); assert.match(u.fallback, /unknown clock source/);
});

test('fix(\'flip\') (Shift+F / controller): half a beat at the next bar line, logged with its origin, rebooked; the side check leaves it', () => {
  const s = render('128-steady', { sr: SR }), tF = s.beats.find(t => t >= 12);
  let sched = null, rejected = null;
  const { c, log } = runLine(s, { at: [{ t: tF, fn: c => { rejected = c.fix('flip', { origin: 'gesture:leap' }); sched = c.fix('flip', { origin: 'fix:key' }); } }] });
  const flips = c.jumps.filter(j => j.kind === 'flip'), sides = c.jumps.filter(j => j.kind === 'side');
  const after = log.filter(x => x.t > tF + 4 * 60 / 128 + 1).map(x => Math.abs(x.e));
  const medAfter = after.slice().sort((a, b) => a - b)[after.length >> 1];
  console.log(`flip: scheduled ${JSON.stringify(sched)}, jumps ${c.jumps.map(j => `${j.kind}/${j.origin}@${j.at.toFixed(2)}`).join(', ')}, |phase| at true beats after it ${medAfter.toFixed(3)} beat`);
  assert.equal(rejected, null, 'a gesture never flips');
  assert.ok(sched && sched.type === 'flip-scheduled' && sched.origin === 'fix:key');
  assert.equal(flips.length, 1, 'one flip');
  assert.equal(flips[0].origin, 'fix:key');
  assert.ok(Math.abs(flips[0].toBeats - flips[0].fromBeats - 0.5) < 1e-6, `half a beat: ${flips[0].fromBeats} → ${flips[0].toBeats}`);
  const onBar = Math.abs(frac((flips[0].fromBeats - c.line.offset - c.line.tracker.barOrigin) / 4)) * 4;
  assert.ok(onBar <= 0.05, `on a bar line (${onBar.toFixed(3)} beat off)`);
  assert.equal(sides.length, 0, 'the side check does not undo a hand flip');
  assert.ok(medAfter > 0.4, `the clock now sits on the off-beat (${medAfter})`);
  assert.equal(c.trackerState.lane.side.hand, true);
});
