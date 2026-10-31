// Clock port batch A (contract: #95 comment 6533515449): experiments/audio-in.js and clock.js's hitLog / hitsDue.
// The 'clock' source passes the clock's lanes through unchanged, bands come from the analyser, due() hands each hit
// out once in the first frame that reaches it and logs it in beatLog, the mic source makes onset lanes, and unknown
// sources fall back. No browser: a fake AudioContext whose currentTime and spectrum the test sets.
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
      getFloatTimeDomainData(a) { a.fill(0.25); }, getFloatFrequencyData(a) { a.set(ctx.spectrum); } }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createMediaStreamSource: () => node({}),
    decodeAudioData: async () => ({ duration: 1 }),
  };
  return ctx;
}
const hzBin = hz => Math.round(hz / (SR / 2 / BINS));
function setBand(ctx, lo, hi, db) { for (let k = hzBin(lo); k <= hzBin(hi); k++) ctx.spectrum[k] = db; }
function rig(source = 'clock', extra = {}, settings = null) {
  const ctx = fakeContext();
  const clock = Clock.create({ bpm: 120, bpb: 4, audioContext: () => ctx, timers: false, ...(settings ? { settings } : {}) });
  const audio = AudioIn.create({ clock, source, storage: null, device: null, ...extra }).start();
  clock.start();
  let ms = 0;
  // one rAF frame: time moves, the clock books ahead, the page starts its frame, reads audio and responds to hits
  const frame = (step = 1000 / 60, lanes = ['kick', 'snare', 'hat']) => {
    ctx.currentTime += step / 1000; ms += step; clock.schedule();
    audio.frameStart(ms); const A = audio.read(); const hits = audio.due(lanes);
    return { A, hits };
  };
  return { ctx, clock, audio, frame };
}

test('bandLevels: energy only at 60-120 Hz lights the kick band', () => {
  const N = 8192, bin = hz => Math.round(hz / (SR / 2 / N));   // fine bins, so the band edges barely blur
  const db = new Float32Array(N).fill(-120);
  for (let k = bin(60); k <= bin(120); k++) db[k] = -20;
  const out = AudioIn.bandLevels(db, SR, {});
  assert.deepEqual(Object.keys(out), AudioIn.BANDS);
  assert.ok(out.kick > 0.9, `kick ${out.kick}`);
  for (const b of ['low', 'lowMid', 'mid', 'upperMid', 'presence', 'air']) assert.equal(out[b], 0, b);
});

test("'clock' source: kick, snare, hat and level are clock.read()'s; bands and wave come from the analyser", () => {
  const { ctx, clock, frame } = rig();
  setBand(ctx, 8000, 16000, -30);
  for (let i = 0; i < 200; i++) {
    const { A } = frame(), C = clock.read();
    for (const k of ['kick', 'snare', 'hat', 'level']) assert.equal(A[k], C[k], `${k} at frame ${i}`);
    assert.deepEqual(Object.keys(A.bands), Clock.BANDS);
    assert.ok(A.bands.air > 0.5 && A.bands.kick === 0);
    assert.ok(A.wave instanceof Float32Array && A.wave.length === 2048);
  }
});

test('hitLog keeps every hit since start(); events still prunes to the last second', () => {
  const { clock, frame } = rig();
  for (let i = 0; i < 60 * 6; i++) frame();
  assert.ok(clock.hitLog.length > clock.events.length);
  assert.ok(clock.hitLog[0].time < clock.ctx.currentTime - 4);
  const q = Clock.qaEvents(clock).filter(e => e.type === 'hit');
  assert.equal(q.length, clock.hitLog.length);
});

test('due(): each hit once, in the first frame whose visual time passed it; beatLog matches the contract', () => {
  const { clock, audio, frame } = rig();
  const got = [];
  for (let i = 0; i < 60 * 8; i++) got.push(...frame(i % 7 === 3 ? 25 : 1000 / 60).hits);
  const keys = got.map(h => h.lane + '@' + h.time.toFixed(6));
  assert.equal(new Set(keys).size, keys.length, 'no hit handed out twice');
  const reached = clock.hitLog.filter(h => h.time <= clock.now());
  assert.equal(got.length, reached.length, 'every reached hit handed out');
  assert.equal(audio.beatLog.length, got.length);
  for (const e of audio.beatLog) {
    for (const k of ['time', 'lane', 'now', 'beats', 'frame', 't', 'dt']) assert.ok(k in e, k);
    assert.ok(e.now - e.time >= 0 && e.now - e.time < e.dt + 0.001, `lag ${e.now - e.time} dt ${e.dt}`);
  }
});

const ALL16 = { bpm: 120, bpb: 4, muted: true, kick: 'x---x---x---x---', snare: '----x-------x---', hat: 'xxxxxxxxxxxxxxxx' };
const grid = h => 0.05 + h.step * 0.125;   // start() books step 0 at currentTime + 0.05; a 16th at 120 bpm is 0.125 s

test('swing: odd 16ths late by swing × a 16th, even ones and the steps (beats) stay on the grid', () => {
  const plain = rig('clock', {}, { ...ALL16 }), sw = rig('clock', {}, { ...ALL16, swing: 0.5 });
  for (let i = 0; i < 240; i++) { plain.frame(); sw.frame(); }
  assert.equal(sw.clock.hitLog.length, plain.clock.hitLog.length);
  for (const h of sw.clock.hitLog) {
    const want = grid(h) + (h.step % 2 ? 0.5 * 0.125 : 0);
    assert.ok(Math.abs(h.time - want) < 1e-9, `${h.lane} step ${h.step}: ${h.time} vs ${want}`);
  }
  for (const h of plain.clock.hitLog) assert.ok(Math.abs(h.time - grid(h)) < 1e-9, 'swing 0: on the grid');
  assert.ok(Math.abs(sw.clock.read({ raw: true }).beats - plain.clock.read({ raw: true }).beats) < 1e-12, 'beats unchanged by swing');
});

test('human: ± ms jitter per hit, hitLog stays in time order, due() still hands each hit out in its first frame', () => {
  const { clock, audio, frame } = rig('clock', {}, { ...ALL16, human: 40 });
  let n = 0;
  for (let i = 0; i < 60 * 8; i++) n += frame().hits.length;
  const L = clock.hitLog;
  for (let i = 1; i < L.length; i++) assert.ok(L[i - 1].time <= L[i].time, `hitLog out of order at ${i}`);
  assert.ok(L.some(h => Math.abs(h.time - grid(h)) > 0.005), 'some hits moved off the grid');
  for (const h of L) assert.ok(Math.abs(h.time - grid(h)) <= 0.040 + 1e-9, `jitter ${h.time - grid(h)}`);
  assert.equal(n, L.filter(h => h.time <= audio.now).length, 'every reached hit handed out');
  for (const e of audio.beatLog) assert.ok(e.now - e.time >= 0 && e.now - e.time < e.dt + 0.001, `lag ${e.now - e.time} dt ${e.dt}`);
});

test('dt is the step of the visual time between frames (audio clock), not rAF: ~10 ms audio chunks never read as late', () => {
  const { ctx, clock, audio } = rig();
  let ms = 0, audioMs = 0, late = 0;
  for (let i = 0; i < 60 * 8; i++) {
    ms += 1000 / 60;
    while (audioMs + 10 <= ms + (i % 3 === 0 ? 10 : 0)) audioMs += 10;   // currentTime moves in 10 ms chunks, some frames 20 ms
    ctx.currentTime = audioMs / 1000; clock.schedule();
    audio.frameStart(ms); audio.read(); audio.due(['kick', 'snare', 'hat']);
  }
  assert.ok(audio.beatLog.length > 20);
  for (const e of audio.beatLog) {
    if (!(e.now - e.time < e.dt + 0.001)) late++;
    assert.ok('rafDt' in e && Math.abs(e.rafDt - 1 / 60) < 1e-9);
  }
  assert.equal(late, 0);
  assert.ok(audio.beatLog.some(e => e.dt > e.rafDt + 0.002), 'some frames saw a bigger audio step than rAF');
});

test('due(lanes): only those lanes, and beatLanes says so', () => {
  const { audio, frame } = rig();
  const got = [];
  for (let i = 0; i < 240; i++) got.push(...frame(1000 / 60, ['kick']).hits);
  assert.ok(got.length >= 6 && got.every(h => h.lane === 'kick'));
  assert.deepEqual(audio.beatLanes, ['kick']);
});

test('qa(): __qa getters are live (beatLog, frame, beatLanes, events, audioIn)', () => {
  const { audio, frame } = rig();
  const q = AudioIn.qa(audio, { other: 1 });
  for (let i = 0; i < 120; i++) frame(1000 / 60, ['kick']);
  assert.ok(q.beatLog.length > 0 && q.beatLog === audio.beatLog);
  assert.equal(q.frame, 120);
  assert.deepEqual(q.beatLanes, ['kick']);
  assert.ok(q.events.filter(e => e.type === 'hit').length >= q.beatLog.length);
  assert.equal(q.audioIn.source, 'clock'); assert.equal(q.audioIn.fallback, null); assert.ok(Number.isFinite(q.audioIn.now));
});

test('an unknown source falls back to the clock and says so', () => {
  const { audio } = rig('dj-link-please');
  assert.equal(audio.source, 'clock'); assert.match(audio.fallback, /unknown audio source/);
});

test("'mic' source: kick-band bursts become kick onsets with the clock's decay", async () => {
  const { ctx, audio, frame } = rig('mic', { getUserMedia: async () => ({}), storage: null, device: null });
  frame(); await new Promise(r => setImmediate(r));
  assert.equal(audio.status, 'mic');
  let peaks = 0, last = 0;
  for (let i = 0; i < 60 * 4; i++) {
    ctx.spectrum.fill(-120);
    if (i % 30 < 3) setBand(ctx, 20, 120, -25);   // a burst every half second
    const { A } = frame();
    if (A.kick > 0.3 && last <= 0.3) peaks++;
    last = A.kick;
    assert.equal(A.snare, 0);
  }
  assert.ok(peaks >= 6 && peaks <= 9, `${peaks} kick peaks for 8 bursts`);
  assert.ok(audio.events.length > 0 && audio.events.every(e => e.lane === 'kick'));
});

// ---------- the input device by label (#95 comment 6481085928) ----------
function memStore() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; }
const DEVICES = [
  { kind: 'audioinput', deviceId: 'default', label: 'Default - MacBook Pro Microphone' },
  { kind: 'audioinput', deviceId: 'mbp', label: 'MacBook Pro Microphone (Built-in)' },
  { kind: 'audioinput', deviceId: 'bh2', label: 'BlackHole 2ch (Virtual)' },
  { kind: 'audiooutput', deviceId: 'spk', label: 'BlackHole 2ch (Virtual)' },
];
async function lineRig(device, storage, devices = DEVICES) {
  const asked = [];
  const r = rig('line', { device, storage, enumerateDevices: async () => devices, getUserMedia: async c => { asked.push(c); return { getTracks: () => [] }; } });
  r.frame(); await new Promise(res => setImmediate(res));
  return { ...r, asked };
}

test('?device=blackhole picks the BlackHole input by label, exact deviceId, no browser processing, and remembers it', async () => {
  const store = memStore();
  const { audio, asked } = await lineRig('BLACKHOLE', store);
  assert.equal(audio.status, 'line');
  const c = asked[asked.length - 1].audio;
  assert.deepEqual(c.deviceId, { exact: 'bh2' });   // the input, never the output with the same label
  assert.equal(c.echoCancellation, false); assert.equal(c.noiseSuppression, false); assert.equal(c.autoGainControl, false);
  assert.equal(audio.device.label, 'BlackHole 2ch (Virtual)'); assert.equal(audio.warning, null);
  assert.equal(store.getItem('cellular-viz.audioIn.device'), 'BLACKHOLE');
  const again = await lineRig(null, store);         // no ?device= next time: the stored choice
  assert.deepEqual(again.asked[again.asked.length - 1].audio.deviceId, { exact: 'bh2' });
});

test('no matching label: a warning and the default input; ?device=default forgets the stored choice', async () => {
  const store = memStore();
  const { audio, asked } = await lineRig('loopback', store);
  assert.match(audio.warning, /no audio input matches "loopback"/);
  assert.deepEqual(asked[asked.length - 1].audio.deviceId, { exact: 'default' });
  assert.equal(audio.status, 'line');
  await lineRig('default', store);
  assert.equal(store.getItem('cellular-viz.audioIn.device'), null);
});

test('labels hidden before permission: one plain getUserMedia first, then the match', async () => {
  let granted = false;
  const hidden = () => DEVICES.map(d => ({ ...d, label: granted ? d.label : '' }));
  const asked = [];
  const r = rig('line', { device: 'blackhole', storage: memStore(), enumerateDevices: async () => hidden(),
    getUserMedia: async c => { asked.push(c); granted = true; return { getTracks: () => [{ stop() {} }] }; } });
  r.frame(); await new Promise(res => setImmediate(res));
  assert.equal(asked.length, 2);
  assert.equal(asked[0].audio.deviceId, undefined);
  assert.deepEqual(asked[1].audio.deviceId, { exact: 'bh2' });
});
