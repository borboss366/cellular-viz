// The check-shared clock booking row (qa/clock-late.mjs), hard since 7 Nov (#95 6704881403): late > 0 fails, a page on
// the shared clock without __qa.clockLate fails, a page not on the clock is n/a (listed, not failed).
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { clockLateRow, loadsClock, NAME } from '../../clock-late.mjs';
const Clock = createRequire(import.meta.url)('../../../experiments/clock.js');

const here = path.dirname(fileURLToPath(import.meta.url));
const good = { late: 0, lateMaxMs: 0, maxGapMs: 38.2, lookAheadMs: 100 };

test('clockLate: late > 0 fails, late 0 passes', () => {
  const bad = clockLateRow({ late: 2, lateMaxMs: 12.5, maxGapMs: 140, lookAheadMs: 100 }, true);
  assert.equal(bad.pass, false); assert.match(bad.detail, /late 2 \(worst 12\.5 ms\)/);
  const ok = clockLateRow(good, true);
  assert.equal(ok.pass, true); assert.match(ok.detail, /late 0 · max frame gap 38\.2 ms · look-ahead 100 ms/);
  assert.equal(clockLateRow({ lateMaxMs: 0 }, true).pass, false, 'no late count is a fail, not a pass');
  assert.equal(clockLateRow({ err: 'Target closed' }, true).pass, false, 'a read error fails');
  assert.ok(!/report-only/.test(NAME), 'the row is no longer report-only');
});

test('clockLate: a page that loads clock.js but reports no __qa.clockLate fails', () => {
  const r = clockLateRow(null, true);
  assert.equal(r.pass, false); assert.match(r.detail, /loads experiments\/clock\.js but reports no __qa\.clockLate/);
  assert.equal(clockLateRow(null, null).pass, false, 'when the page could not be checked for clock.js, a missing row still fails');
  // which <script src> count as the shared clock
  assert.equal(loadsClock(['clock.js']), true);
  assert.equal(loadsClock(['../lib/x.js', './clock.js?v=3']), true);
  assert.equal(loadsClock(['/cellular-viz/experiments/clock.js']), true);
  assert.equal(loadsClock(['clock-tracker.js', 'myclock.js', 'clock.json', '']), false);
  assert.equal(loadsClock(null), false);
  // every page in experiments/ that has <script src="clock.js"> is seen as on the clock (24 today)
  const dir = path.join(here, '..', '..', '..', 'experiments');
  const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  const onClock = pages.filter(f => loadsClock([...fs.readFileSync(path.join(dir, f), 'utf8').matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1])));
  assert.ok(onClock.length >= 20, `${onClock.length} pages on the clock`);
  assert.ok(onClock.includes('16-hodge-kaleidoscope.html') && onClock.includes('26-lattice-gas.html'));
});

test('clockLate: a page not on the clock is n/a (listed, not failed); a flash-only run is not measured', () => {
  const na = clockLateRow(null, false);
  assert.equal(na.pass, null); assert.match(na.detail, /^n\/a: page not on the shared clock/);
  const flashOnly = clockLateRow(undefined, true);
  assert.equal(flashOnly.pass, null); assert.match(flashOnly.detail, /not measured/);
  // a page off the clock that still reports a clockLate is judged on it
  assert.equal(clockLateRow(good, false).pass, true);
  assert.equal(clockLateRow({ ...good, late: 1 }, false).pass, false);
});

// #95 6704930372 item 2: a static guard. Every experiments/*.html that loads the shared clock must expose
// __qa.clockLate: by AudioIn.qa(…) (which defines it) or by defining clockLate itself (wiring-only pages 01/02/03/05).
// On main 2f07a19 this failed on exactly 01, 02, 03 and 05; it also guards every future page.
export const SETS_CLOCK_LATE_RE = /AudioIn\.qa\(|defineProperty\(\s*window\.__qa\s*,\s*['"]clockLate['"]|\bclockLate\s*:/;
test('clockLate: every page that loads clock.js exposes __qa.clockLate (AudioIn.qa or its own clockLate)', () => {
  const dir = path.join(here, '..', '..', '..', 'experiments');
  const missing = [];
  let onClock = 0;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    if (!loadsClock([...src.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map(m => m[1]))) continue;
    onClock++;
    if (!SETS_CLOCK_LATE_RE.test(src)) missing.push(f);
  }
  assert.deepEqual(missing, [], `pages on the clock without __qa.clockLate: ${missing.join(', ')}`);
  assert.ok(onClock >= 24, `${onClock} pages on the clock`);
  // the rule itself: a wiring-only page's own getter counts, a bare mention in a comment does not
  assert.ok(SETS_CLOCK_LATE_RE.test("Object.defineProperty(window.__qa, 'clockLate', { get: () => clock.lateStats })"));
  assert.ok(SETS_CLOCK_LATE_RE.test('window.__qa = AudioIn.qa(audio, window.__qa || {});'));
  assert.ok(!SETS_CLOCK_LATE_RE.test('// the clockLate row is hard now'));
});

// The booking at a large visual offset (Saturday fix list, 19 Nov): the visuals read offsetMs ahead of the heard time
// (+ = earlier), so the loops book bookAhead() = look-ahead + offset past currentTime. Before, hits past currentTime +
// look-ahead (100 ms at a steady frame rate) were not booked yet when the visuals reached them, so at +300 ms each came
// ~200 ms late. A metronome page here (the shared source has its own test in clock-shared.test.mjs).
function fakeCtx(t0 = 0) {
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
function offsetRun(offset) {
  const ctx = fakeCtx(0.3);
  let perf = 0;
  const c = Clock.create({ settings: { bpm: 128, bpb: 4, muted: true, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' },
    audioContext: () => ctx, timers: false, pump: true, now: () => perf, keys: false });
  c.setVisualOffset(offset);
  c.start();
  let worst = 0, n = 0;
  for (let i = 0; i < 1600; i++) {   // 8 s of 5 ms frames
    ctx.currentTime += 0.005; perf += 5;
    const v = c.now();
    for (const h of c.hitsDue()) { if (i > 200) { worst = Math.max(worst, v - h.time); n++; } }
  }
  return { c, worst, n };
}
test('clockLate: at a +140 or +300 ms visual offset the hits still reach the visuals on time and none is late; at 0 as before', () => {
  // +140 ms: the route delay measured on 18 Nov (the Saturday slider value)
  const s = offsetRun(140);
  assert.equal(s.c.lateStats.lookAheadMs, 100);
  assert.ok(s.n > 30 && s.worst <= 0.0051, `+140: ${s.n} hits, worst ${(s.worst * 1000).toFixed(3)} ms`);
  assert.equal(s.c.lateStats.late, 0);
  const a = offsetRun(300);
  console.log(`# offset +300: ${a.n} hits, worst ${(a.worst * 1000).toFixed(3)} ms after their time; ${JSON.stringify(a.c.lateStats)}`);
  assert.equal(a.c.lateStats.lookAheadMs, 100, 'the look-ahead is at its floor: +300 ms is past it');
  assert.ok(a.n > 30, `${a.n} hits (7 s at 128, 10 a bar)`);
  assert.ok(a.worst <= 0.0051, `within one 5 ms frame: worst ${(a.worst * 1000).toFixed(3)} ms`);
  assert.equal(a.c.lateStats.late, 0);
  assert.ok(Math.abs(a.c.bookAhead() - (a.c.lookAhead + 0.3)) < 1e-12, 'books look-ahead + offset');
  const z = offsetRun(0);
  assert.equal(z.c.bookAhead(), z.c.lookAhead, 'offset 0: the look-ahead exactly, as before');
  assert.equal(z.c.lateStats.late, 0);
  assert.ok(z.worst <= 0.0051);
  const neg = offsetRun(-100);
  assert.equal(neg.c.bookAhead(), neg.c.lookAhead, 'a negative offset (visuals later) books no further');
  // the hit times do not depend on the offset (only when they are handed out)
  assert.deepEqual(a.c.hitLog.filter(h => h.time < 7).map(h => h.time), z.c.hitLog.filter(h => h.time < 7).map(h => h.time));
});
