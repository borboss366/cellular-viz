// The shared audio input (experiments/audio-in.js): the 'clock' source passes the clock's lanes through unchanged,
// bands from the analyser, the QA beat log (each hit once, within one frame), the mic onset lanes, and fallbacks.
// No browser: a fake AudioContext whose currentTime and spectrum the test sets.
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const AudioIn = require('../../../experiments/audio-in.js');

const SR = 48000, BINS = 1024;
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  const ctx = {
    currentTime: 0, sampleRate: SR, outputLatency: 0.02, baseLatency: 0.005, destination: {},
    spectrum: new Float32Array(BINS).fill(-120),   // dB per bin, what the analyser reports
    resume() {},
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ frequency: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, loop: false, start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }),
    createAnalyser: () => node({ fftSize: 2048, frequencyBinCount: BINS, smoothingTimeConstant: 0,
      getFloatTimeDomainData() {}, getFloatFrequencyData(a) { a.set(ctx.spectrum); } }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createMediaStreamSource: () => node({}),
    decodeAudioData: async () => ({ duration: 1 }),
  };
  return ctx;
}
const hzBin = hz => Math.round(hz / (SR / 2 / BINS));
function setBand(ctx, lo, hi, db) { for (let k = hzBin(lo); k <= hzBin(hi); k++) ctx.spectrum[k] = db; }
function rig(source = 'clock', extra = {}) {
  const ctx = fakeContext();
  const clock = Clock.create({ bpm: 120, bpb: 4, audioContext: () => ctx, timers: false });
  let perf = 0;
  const audio = AudioIn.create({ clock, source, now: () => perf, ...extra });
  clock.start();
  const frame = (ms = 1000 / 60) => { ctx.currentTime += ms / 1000; perf += ms; clock.schedule(); return audio.read(); };
  return { ctx, clock, audio, frame };
}

test('bandLevels: energy only at 60-120 Hz lights the kick band', () => {
  const N = 8192, bin = hz => Math.round(hz / (SR / 2 / N));   // fine bins, so the band edges barely blur
  const db = new Float32Array(N).fill(-120);
  for (let k = bin(60); k <= bin(120); k++) db[k] = -20;
  const out = AudioIn.bandLevels(db, SR, {});
  assert.deepEqual(Object.keys(out), AudioIn.BANDS);
  assert.ok(out.kick > 0.6, `kick ${out.kick}`);
  for (const b of ['low', 'lowMid', 'mid', 'upperMid', 'presence', 'air']) assert.equal(out[b], 0, b);
});

test("'clock' source: lanes, level and beats are clock.read()'s, unchanged; bands come from the analyser", () => {
  const { ctx, clock, frame } = rig();
  setBand(ctx, 8000, 16000, -30);
  for (let i = 0; i < 200; i++) {
    const A = frame(), C = clock.read();
    for (const k of ['kick', 'snare', 'hat', 'level', 'beats', 'bars', 'phase', 'bar', 'beatInBar', 'bpm', 'confidence']) assert.equal(A[k], C[k], `${k} at frame ${i}`);
    assert.ok(A.bands.air > 0.5 && A.bands.kick === 0);
  }
});

test('beat log: every clock hit once, seen within one frame of its time', () => {
  const { clock, audio, frame } = rig();
  for (let i = 0; i < 60 * 8; i++) frame(i % 7 === 3 ? 25 : 1000 / 60);   // 8 s, some long frames
  const L = audio.beatLog;
  assert.ok(L.length >= 30, `${L.length} entries`);   // ~8.6 s at 120 bpm ≈ 4.3 bars × (4 kicks + 2 snares + 4 hats)
  for (const e of L) assert.ok(e.lagMs >= -1e-9 && e.lagMs <= e.frameMs + 1e-6, `lag ${e.lagMs} frame ${e.frameMs}`);
  const keys = L.map(e => e.lane + '@' + e.time.toFixed(6));
  assert.equal(new Set(keys).size, keys.length, 'no hit logged twice');
  const seen = clock.now();
  const due = clock.events.filter(h => h.time <= seen);
  for (const h of due) assert.ok(keys.includes(h.lane + '@' + h.time.toFixed(6)), `hit ${h.lane} ${h.time} logged`);
});

test('qa(): __qa.beatLog and __qa.audioIn are live getters', () => {
  const { audio, frame } = rig();
  const q = {}; AudioIn.qa(audio, Object.assign(q, { other: 1 }));
  for (let i = 0; i < 120; i++) frame();
  assert.ok(q.beatLog.length > 0 && q.beatLog === audio.beatLog);
  assert.equal(q.audioIn.source, 'clock'); assert.equal(q.audioIn.fallback, null);
});

test('an unknown source falls back to the clock and says so', () => {
  const { audio } = rig('line-in-please');
  assert.equal(audio.source, 'clock'); assert.match(audio.fallback, /unknown audio source/);
});

test("'mic' source: kick-band bursts become kick onsets with the clock's decay; beats still come from the clock", async () => {
  const stream = {};
  const { ctx, clock, audio, frame } = rig('mic', { getUserMedia: async () => stream });
  frame(); await new Promise(r => setImmediate(r));
  assert.equal(audio.status, 'mic');
  let peaks = 0, lastKick = 0;
  for (let i = 0; i < 60 * 4; i++) {
    ctx.spectrum.fill(-120);
    if (i % 30 < 3) setBand(ctx, 20, 120, -25);   // a burst every half second
    const A = frame();
    if (A.kick > 0.3 && lastKick <= 0.3) peaks++;
    lastKick = A.kick;
    assert.equal(A.beats, clock.read().beats);
    assert.equal(A.snare, 0);
  }
  assert.ok(peaks >= 6 && peaks <= 9, `${peaks} kick peaks for 8 bursts`);
  assert.ok(audio.events.every(e => e.lane === 'kick'));
});
