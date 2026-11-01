// #141 audio checks (experiment kind "audio"): the runner's offline analysis (audiocheck.mjs) against audio-in.js's
// maths, the gates' numbers from a page log, the experiment fields, and audio-in's per-frame log.
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as AC from '../audiocheck.mjs';
import { validate, evalGates, expand } from '../experiment.mjs';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const AudioIn = require('../../../experiments/audio-in.js');

test('the offline mirror uses audio-in.js\'s bands, edges and dB mapping', () => {
  assert.deepEqual(AC.BANDS, AudioIn.BANDS);
  assert.deepEqual(AC.EDGES, AudioIn.EDGES);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (const sr of [44100, 48000]) {
    const db = new Float32Array(1024).map(() => -110 + 100 * rnd());
    db[5] = -Infinity;
    const theirs = AudioIn.bandLevels(db, sr, {}), ours = AC.bandLevels(db, sr);
    AC.BANDS.forEach((b, i) => assert.ok(Math.abs(theirs[b] - ours[i]) < 1e-12, `${b} at ${sr} Hz`));
  }
});

test('WAV: 16-bit PCM written and read back, channels averaged to mono', () => {
  const pcm = new Int16Array([1000, -1000, 16384, 16384, -32768, 0]);   // 3 stereo frames
  const w = AC.readWav(AC.wavBytes(pcm, 48000, 2));
  assert.equal(w.sampleRate, 48000); assert.equal(w.channels, 2);
  assert.deepEqual(Array.from(w.mono), [0, 0.5, -0.5]);
  assert.throws(() => AC.readWav(Buffer.from('not a wav at all, really')), /not a WAV/);
});

test('analyse: a 90 Hz sine lights the kick band most, at its RMS level', () => {
  const sr = 48000, n = sr * 2, x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.05 * Math.sin(2 * Math.PI * 90 * i / sr);
  const a = AC.analyse(x, sr, { fftSize: 2048, smoothing: 0 });
  assert.ok(a.t.length > 100);
  const mid = a.bands[Math.floor(a.bands.length / 2)];
  assert.equal(mid.indexOf(Math.max(...mid)), AC.BANDS.indexOf('kick'));
  assert.ok(Math.abs(a.rmsDb[50] - 20 * Math.log10(0.05 / Math.SQRT2)) < 0.3, `rms ${a.rmsDb[50]}`);
  const quiet = AC.analyse(new Float32Array(8192), sr);
  assert.ok(quiet.rmsDb.every(v => v < -150)); assert.ok(quiet.bands.every(b => b.every(v => v === 0)));
});

test('audioMetrics: level during and after, band differences, row correlation with its lag', () => {
  const open = 10, len = 8, log = [];
  for (let i = 0; i < 60 * 11; i++) {
    const t = open + i / 60, on = t < open + len;
    const lane = 0.5 + 0.4 * Math.sin(i / 7);
    log.push({ t, rmsDb: on ? -20 : -120, bands: on ? [0.5, 0.6, 0.5, 0.4, 0.4, 0.3, 0.2, 0.1] : [0, 0, 0, 0, 0, 0, 0, 0],
      lanes: [lane, 0.3], rows: [null, 0.3] });
  }
  for (let i = 3; i < log.length; i++) log[i].rows[0] = 2 * log[i - 3].lanes[0] + 0.1;   // row 0 follows its lane 3 frames late
  log[0].rows[0] = log[1].rows[0] = log[2].rows[0] = 0.1;
  const offline = { bands: Array.from({ length: 100 }, () => [0.5, 0.6, 0.5, 0.4, 0.4, 0.3, 0.2, 0.1 + 3 / 70]) };
  const m = AC.audioMetrics(log, { openedAt: open, device: { label: 'Fake Default Audio Input' }, banner: false }, offline, { len });
  assert.equal(m.deviceOk, 1); assert.equal(m.banner, 0);
  assert.equal(m.levelDuringDb, -20); assert.equal(m.levelAfterEndDb, -120);
  assert.deepEqual(m.bandDiffDb.slice(0, 7), [0, 0, 0, 0, 0, 0, 0]); assert.equal(m.bandDiffDb[7], 3);
  assert.ok(m.rowCorr[0] > 0.999, `row 0 corr ${m.rowCorr[0]}`); assert.equal(m.rowLagMs[0], 50);
  assert.equal(m.rowCorr[1], null, 'a constant row has no correlation');
  const g = AC.audioGateMetrics(m);
  assert.equal(g['audio.bandDiffDb.max'], 3); assert.ok(g['audio.rowCorr.min'] > 0.999); assert.equal(g['audio.levelAfterEndDb'], -120);
  const none = AC.audioMetrics(log, { openedAt: null, device: { label: 'MacBook Pro Microphone' } }, offline, { len }, 'fake');
  assert.equal(none.opened, false); assert.equal(none.deviceOk, 0); assert.equal(none.levelDuringDb, null);
});

const AUDIO_EXP = extra => ({ version: 1, id: '16-hodge-kaleidoscope', kind: 'audio', warmup: 2, seconds: 16,
  audio: { track: 'darude-sandstorm', from: 30, len: 16, noloop: true, via: 'fake' }, ...extra });

test('experiment: kind and audio fields, the run window, and report-only gates', () => {
  assert.deepEqual(validate({ version: 1, id: '16-hodge-kaleidoscope' }).exp.kind, 'both');
  const ok = validate(AUDIO_EXP({ gates: [{ metric: 'audio.levelDuringDb', min: -40, report: true }] }));
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.exp.audio, { track: 'darude-sandstorm', from: 30, len: 16, noloop: true, via: 'fake' });
  const errs = raw => validate(raw).errors.join(' | ');
  assert.match(errs(AUDIO_EXP({ seconds: 10 })), /1\.5 s past the excerpt/);
  assert.match(errs(AUDIO_EXP({ audio: { track: 'darude-sandstorm', len: 8, via: 'loop' } })), /audio-loop\.sh/);
  assert.match(errs(AUDIO_EXP({ audio: { track: 'some-other-song', len: 8 } })), /audio\.track/);
  assert.match(errs({ version: 1, id: '16-hodge-kaleidoscope', audio: { track: 'darude-sandstorm', len: 8 } }), /only with kind "audio"/);
  assert.match(errs({ version: 1, id: '16-hodge-kaleidoscope', kind: 'gpu' }), /kind: one of/);
  assert.match(errs(AUDIO_EXP({ gates: [{ metric: 'audio.levelDuringDb', min: -40, report: 'yes' }] })), /report/);

  const exp = ok.exp, run = expand(exp)[0];
  const rows = evalGates(exp, [{ ...run, metrics: { 'audio.levelDuringDb': -55 }, values: {} }]);
  assert.equal(rows[0].ok, null); assert.equal(rows[0].skipped, true, 'report-only: an ℹ️ row, never a fail');
  assert.match(rows[0].value, /^would fail/); assert.match(rows[0].name, /report-only/);
  const missing = evalGates(validate(AUDIO_EXP({ gates: [{ metric: 'audio.levelDuringDb', min: -40 }] })).exp,
    [{ ...run, metrics: {}, values: {}, skipped: 'darude-sandstorm' }], { missing: ['darude-sandstorm'] });
  assert.equal(missing[0].skipped, true); assert.match(missing[0].value, /track missing/);
});

// ---------- audio-in's per-frame log ----------
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  const ctx = {
    currentTime: 0, sampleRate: 48000, outputLatency: 0.02, baseLatency: 0.005, destination: {}, reads: 0,
    resume() {},
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ frequency: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, loop: false, start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }),
    createAnalyser: () => node({ fftSize: 2048, frequencyBinCount: 1024, smoothingTimeConstant: 0,
      getFloatTimeDomainData(a) { a.fill(0.1); }, getFloatFrequencyData(a) { ctx.reads++; a.fill(-60); } }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createMediaStreamSource: () => node({}),
  };
  return ctx;
}
function rig(source) {
  const ctx = fakeContext();
  const clock = Clock.create({ bpm: 120, bpb: 4, audioContext: () => ctx, timers: false, keys: false });
  const audio = AudioIn.create({ clock, source, storage: null, device: null, getUserMedia: async () => ({}) }).start();
  clock.start();
  let ms = 0;
  const frame = () => { ctx.currentTime += 1 / 60; ms += 1000 / 60; clock.schedule(); audio.frameStart(ms); return audio.read(); };
  return { ctx, audio, frame };
}

test('audio-in: a line input logs one entry per frame, read() reuses it, and the page adds its rows', async () => {
  const { ctx, audio, frame } = rig('mic');
  frame(); await new Promise(r => setImmediate(r));
  assert.equal(audio.status, 'mic'); assert.ok(Number.isFinite(audio.openedAt));
  const before = ctx.reads;
  for (let i = 0; i < 10; i++) { frame(); audio.logFrame({ rows: new Float32Array([0.5, 0.25]), lanes: [1, 0.5] }); }
  assert.equal(ctx.reads - before, 10, 'one analyser reading per frame, not two');
  assert.equal(audio.log.length, 10);
  const e = audio.log.at(-1);
  assert.equal(e.rmsDb, -20); assert.equal(e.bands.length, 8); assert.ok(e.bands.every(v => Math.abs(v - 30 / 70) < 1e-3));
  assert.deepEqual(e.rows, [0.5, 0.25]); assert.deepEqual(e.lanes, [1, 0.5]);
  const q = AudioIn.qa(audio, {});
  assert.equal(q.audioIn.log.length, 10); assert.equal(q.audioIn.banner, false); assert.equal(q.audioIn.smoothing, 0.5);
  assert.equal(q.audioIn.sampleRate, 48000); assert.equal(q.audioIn.openedAt, audio.openedAt);
});

test('audio-in: the default clock source keeps no log (perf runs read as before)', () => {
  const { ctx, audio, frame } = rig('clock');
  const before = ctx.reads;
  for (let i = 0; i < 10; i++) frame();
  assert.equal(audio.log.length, 0); assert.equal(ctx.reads - before, 10, 'read() still reads once per call');
});
