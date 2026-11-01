// Clock PR 2 (experiments/clock.js): the file: source (#95 "file grid", authority locked). The sidecar v2/v1
// parser, the monotone-cubic warp, and the clock on T0(c), the synthetic DJ blend's tempo curve: 124 BPM, a ramp
// to 128 over 60–120 s, and the "1" shifting by one beat at 90 s. No browser: a fake AudioContext whose
// currentTime the test moves, and the grid handed in as fileData (the page fetches the track and its sidecar).
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');

// ---------- a fake AudioContext that keeps time and records the track's buffer sources ----------
function fakeContext(outputLatency = 0.02) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  const ctx = {
    currentTime: 0, sampleRate: 64, outputLatency, baseLatency: 0.005, destination: {}, started: [],
    resume() {},
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ frequency: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, start(at, off) { ctx.started.push([at, off]); }, stop() {} }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }),
    createAnalyser: () => node({ fftSize: 0, getFloatTimeDomainData() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return ctx;
}
const SETTINGS = () => ({ bpm: 120, bpb: 4, muted: false, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' });
const QA = { origin: 'qa' };
const LAT = 0.02;   // the fake's outputLatency: read() reports the clock at currentTime − LAT

// ---------- T0(c)'s tempo curve and its exact beats (#95) ----------
const bpmAt = s => (s < 60 ? 124 : s < 120 ? 124 + 4 * (s - 60) / 60 : 128);
// beat k's time in seconds, from the integrated curve: 124 beats to 60 s, beats 124–250 in the ramp, then 128 BPM
function beatSec(k) {
  if (k < 124) return k * 60 / 124;
  if (k < 250) return 60 + 15 * (Math.sqrt(15376 + 8 * (k - 124)) - 124);
  return 120 + (k - 250) * 60 / 128;
}
// the grid 312 ms into the track; from the first beat at or after 90 s the "1" moves one beat later (B's 1 on A's 2)
function t0c(lastSec = 148, offsetMs = 312) {
  const beats = []; let shiftAt = null;
  for (let k = 0; beatSec(k) <= lastSec; k++) {
    const s = beatSec(k);
    if (shiftAt === null && s >= 90) shiftAt = k;
    const pos = shiftAt === null ? k % 4 + 1 : ((k - 1) % 4 + 4) % 4 + 1;
    beats.push({ ms: offsetMs + s * 1000, pos, conf: 1, sec: s });
  }
  return { beats, shiftAt };
}
function fileRig(beats, extra = {}) {
  const ctx = fakeContext(LAT), settings = { ...SETTINGS(), ...(extra.settings || {}) };
  const c = Clock.create({ source: 'file:t0c.wav', settings, audioContext: () => ctx, timers: false, pump: true, keys: false,
    now: () => ctx.currentTime * 1000, fileData: { buffer: { duration: 150 }, grid: { version: 2, beats } } });
  return { ctx, c, settings };
}
const quiet = fn => { const orig = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = orig; } };

test('file grids: sidecar v2 and v1 parse to beats with a pos on every beat', () => {
  const v2 = Clock.parseGrid({ version: 2, beats: [{ ms: 312, pos: 1, conf: 0.94 }, { ms: 795.9, pos: 2, conf: 0.93 }, { ms: 1280, pos: 3 }] });
  assert.equal(v2.version, 2);
  assert.deepEqual(v2.beats.map(b => b.pos), [1, 2, 3]);
  assert.equal(v2.beats[0].conf, 0.94); assert.equal(v2.beats[2].conf, 1);
  const v1 = Clock.parseGrid({ bpm: 120, firstBeatMs: 100, beats: [100, 600, 1100, 1600, 2100] });
  assert.equal(v1.version, 1);
  assert.deepEqual(v1.beats.map(b => b.pos), [1, 2, 3, 4, 1], 'v1 has no pos: it counts from 1 on the first beat');
  const bare = Clock.parseGrid({ bpm: 120, firstBeatMs: 250 }, 4, 2000);
  assert.deepEqual(bare.beats.map(b => b.ms), [250, 750, 1250, 1750], 'bpm + firstBeatMs only: filled to the track end');
  const messy = Clock.parseGrid({ beats: [1000, 500, 500, 'x', 1500] });
  assert.deepEqual(messy.beats.map(b => b.ms), [500, 1000, 1500], 'sorted, duplicates and junk dropped');
  assert.throws(() => Clock.parseGrid({ beats: [1] }), /fewer than 2/);
  assert.throws(() => Clock.parseGrid(null), /not a JSON object/);
});

test('the warp is exact at every grid beat, monotone, and its inverse round-trips', () => {
  const { beats } = t0c();
  const w = Clock.makeWarp(beats);
  for (let k = 0; k < beats.length; k++) { assert.equal(w.at(k), beats[k].ms); assert.equal(w.inv(beats[k].ms), k); }
  let prev = -Infinity;
  for (let b = -2; b < beats.length + 2; b += 0.037) {
    const ms = w.at(b);
    assert.ok(ms > prev, `monotone at ${b}`); prev = ms;
    assert.ok(Math.abs(w.inv(ms) - b) < 1e-6, `inverse at ${b}`);
    assert.ok(w.slope(b) > 0);
  }
});

test('#95 truth 1 (file grid, no lag): every kick is on its grid beat within 1 ms through the 124 → 128 ramp, with no late booking', () => {
  const { beats } = t0c();
  const { ctx, c, settings } = fileRig(beats);
  c.start();
  assert.equal(c.source, 'file:t0c.wav'); assert.equal(c.fallback, null); assert.equal(c.file.status, 'playing');
  const seg = c.file.seg;
  for (let t = 0; t < 150; t += 1 / 60) { ctx.currentTime = t; c.read(); c.hitsDue(); }
  const kicks = c.hitLog.filter(h => h.lane === 'kick');
  assert.ok(kicks.length >= beats.length, `${kicks.length} kicks for ${beats.length} grid beats`);
  let worst = 0;
  beats.forEach((b, k) => { worst = Math.max(worst, Math.abs(kicks[k].time - (seg.at + b.ms / 1000))); });
  assert.ok(worst < 0.001, `worst kick ${(worst * 1000).toFixed(4)} ms off its grid beat`);
  assert.equal(c.lateStats.late, 0, 'nothing booked after its own time');
  assert.equal(settings.bpm, 128, 'settings.bpm follows the grid to 128');
  assert.equal(c.booked.length, 0, 'no clicks over the track unless settings.click');
});

test('#95 truth 1: beat count, bar position and bpm at every beat, the "1" shift included at once', () => {
  const { beats, shiftAt } = t0c();
  const { ctx, c } = fileRig(beats);
  c.start();
  let worstBpm = 0;
  for (let k = 0; k < beats.length; k++) {
    ctx.currentTime = c.beatTime(k) + LAT + 0.004;   // 4 ms after beat k is heard
    const r = c.read({ raw: true });
    assert.equal(Math.floor(r.beats), k, `beat ${k}`);
    assert.equal(r.beatInBar, beats[k].pos, `beat ${k}: bar position from the grid`);
    worstBpm = Math.max(worstBpm, Math.abs(r.bpm - bpmAt(beats[k].sec)) / bpmAt(beats[k].sec));
  }
  assert.ok(worstBpm <= 0.003, `bpm off the true curve by ${(worstBpm * 100).toFixed(3)} % at worst (≤ 0.3 %)`);
  // the first "1" after the shift is a new bar at once (no catch-up bars), and the bar count goes on from there
  const one = beats.findIndex((b, k) => k >= shiftAt && b.pos === 1);
  ctx.currentTime = c.beatTime(one) + LAT + 0.004;
  const r = c.read({ raw: true });
  assert.equal(r.beatInBar, 1); assert.equal(r.bar, c.posBar(one - 1).bar + 1);
});

test('#95 hand fixes on a file grid: nudge and setOne act at once and are logged; tap, x2, half and reset do nothing', () => {
  const { beats } = t0c();
  const { ctx, c } = fileRig(beats);
  const frame = t => { ctx.currentTime = t; return c.read({ raw: true }); };
  c.start();
  let t = 0;
  for (; t < 10; t += 1 / 60) frame(t);
  const before = c.read({ raw: true }), ct = ctx.currentTime, seg = c.file.seg;
  const j = c.fix('nudge', 30, QA);
  assert.equal(j.kind, 'nudge'); assert.equal(j.origin, 'qa');
  const after = c.read({ raw: true });
  assert.ok(Math.abs(after.beats - before.beats - 0.030 * 124 / 60) < 1e-6, 'the clock is 30 ms ahead at once');
  for (; t < 14; t += 1 / 60) frame(t);
  const kicks = c.hitLog.filter(h => h.lane === 'kick');
  const moved = kicks.filter(h => h.time > ct + 0.003);
  assert.ok(moved.length >= 5);
  for (const h of moved) {   // each new kick is its grid beat 30 ms earlier
    const k = Math.round(c.file.warp.inv((h.time - seg.at) * 1000 + 30));
    assert.ok(Math.abs(h.time - (seg.at + (beats[k].ms - 30) / 1000)) < 1e-6);
  }
  for (let i = 1; i < kicks.length; i++) assert.ok(kicks[i].time - kicks[i - 1].time >= 0.02, 'no doubled kick');

  for (; t < 20; t += 1 / 60) frame(t);
  const s1 = c.fix('setOne', null, QA), k = Math.round(s1.fromBeats);
  assert.equal(s1.kind, 'setOne');
  assert.equal(c.posBar(k).pos, 1); assert.equal(c.posBar(k + 1).pos, 2); assert.equal(c.posBar(k + 4).pos, 1);
  ctx.currentTime = c.beatTime(k + 4) + LAT + 0.004;
  const r = c.read({ raw: true });
  assert.equal(Math.floor(r.beats), k + 4); assert.equal(r.beatInBar, 1);

  quiet(() => { for (const kind of ['tap', 'x2', 'half', 'reset']) assert.equal(c.fix(kind, null, QA), null, kind); });
  assert.deepEqual(c.jumps.map(x => x.kind), ['nudge', 'setOne']);
  quiet(() => assert.equal(c.fix('nudge', 10, { origin: 'gesture:pad' }), null));
  assert.equal(c.fixRejected.length, 1, 'beat authority holds on file grids too');
});

test('seek moves the audio and the beats together, logged as a seek jump', () => {
  const { beats } = t0c();
  const { ctx, c } = fileRig(beats);
  c.start();
  let t = 0;
  for (; t < 5; t += 1 / 60) { ctx.currentTime = t; c.read(); }
  const j = c.seek(100), seg = c.file.seg;
  assert.equal(j.kind, 'seek'); assert.equal(seg.off, 100000);
  assert.deepEqual(ctx.started[ctx.started.length - 1], [seg.at, 100], 'the track restarts at 100 s');
  assert.ok(Math.abs(j.toBeats - c.file.warp.inv(100000)) < 1e-9);
  for (; t < 8; t += 1 / 60) { ctx.currentTime = t; c.read(); }
  const kicks = c.hitLog.filter(h => h.lane === 'kick' && h.time > seg.at - 1e-9);
  const k0 = beats.findIndex(b => b.ms >= 100000);
  assert.ok(kicks.length >= 5);
  kicks.forEach((h, i) => assert.ok(Math.abs(h.time - (seg.at + (beats[k0 + i].ms - 100000) / 1000)) < 1e-6, `kick ${i} after the seek`));
});

test('?click=1: the grid clicks sound over the track on their own bus', () => {
  const { beats } = t0c();
  const { ctx, c } = fileRig(beats, { settings: { click: true } });
  c.start();
  for (let t = 0; t < 3; t += 1 / 60) { ctx.currentTime = t; c.read(); }
  assert.ok(c.booked.length > 0);
  assert.equal(c.clickBus.gain.value, 0.35); assert.equal(c.master.gain.value, 1);
  c.setMuted(true);
  assert.equal(c.clickBus.gain.value, 0); assert.equal(c.master.gain.value, 0);
});

test('file source: loads through load(), says loading then playing, and reports a missing grid', async () => {
  const ctx = fakeContext(); let asked = null;
  const c = Clock.create({ source: 'file:/qa-audio/x', settings: SETTINGS(), audioContext: () => ctx, timers: false, keys: false,
    load: async (cx, url, gridUrl) => { asked = { url, gridUrl }; return { buffer: { duration: 30 }, grid: { bpm: 120, firstBeatMs: 0 } }; } });
  assert.equal(c.source, 'file:/qa-audio/x'); assert.equal(c.fallback, null);
  c.start();
  assert.equal(c.file.status, 'loading'); assert.equal(c.read().beats, -1);
  await new Promise(r => setTimeout(r, 0));
  assert.deepEqual(asked, { url: '/qa-audio/x', gridUrl: '/qa-audio/x.beatgrid.json' });
  assert.equal(c.file.status, 'playing'); assert.equal(c.file.grid.beats.length, 61);

  const warned = []; const orig = console.warn; console.warn = m => warned.push(m);
  try {
    const bad = Clock.create({ source: 'file:nope.mp3', settings: SETTINGS(), audioContext: fakeContext, timers: false, keys: false,
      load: async () => { throw new Error('beat grid nope.mp3.beatgrid.json: HTTP 404'); } });
    bad.start();
    await new Promise(r => setTimeout(r, 0));
    assert.equal(bad.file.status, 'error'); assert.match(bad.file.error, /404/); assert.equal(bad.read().beats, -1);
    assert.equal(warned.length, 1);
  } finally { console.warn = orig; }
});
