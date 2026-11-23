// The levels message (beat server task 3; docs/BEAT_RELAY_PROTOCOL.md): experiments/levels.js (the binary frame), the
// relay passing it on, a link sending and reading it, clock.js keeping it and publishing it at 30 a second, audio-in's
// ?audio=shared (bands and energy from the message, kicks aged from their own time), and the owner's rule B: only the
// shared code reads levels; no scene does. Node only.
//   node --test qa/runner/test/levels.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as R from '../../beat-relay.mjs';
const require = createRequire(import.meta.url);
const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../experiments');
const DOCS = path.resolve(EX, '..', 'docs');
const LV = require(path.join(EX, 'levels.js'));
const SL = require(path.join(EX, 'shared-link.js'));
const Clock = require(path.join(EX, 'clock.js'));
const AudioIn = require(path.join(EX, 'audio-in.js'));
const near = (a, b, e = 1e-5) => Math.abs(a - b) <= e;
const msg = (t, kicks = []) => ({ type: 'levels', v: 1, t, broadband: 0.42, low: 0.6, phase: 0.25, side: NaN, bands: [0.7, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05, 0.01], kicks });

test('levels binary frame: 60 + 12 n bytes, round trip in f32/f64, at most 8 kicks, a bad frame is null', () => {
  const m = msg(1.7e12 + 0.5, [{ t: 1.7e12 - 40.25, vel: 0.9 }, { t: 1.7e12 - 10, vel: 0.4 }]);
  const buf = LV.encode(m);
  assert.equal(buf.byteLength, 60 + 24);
  const d = LV.decode(buf);
  assert.equal(d.type, 'levels'); assert.equal(d.t, m.t, 'the time is f64: exact');
  assert.ok(near(d.broadband, 0.42) && near(d.low, 0.6) && near(d.phase, 0.25));
  assert.ok(Number.isNaN(d.side), 'no side: NaN');
  m.bands.forEach((b, i) => assert.ok(near(d.bands[i], b), `band ${i}`));
  assert.deepEqual(d.kicks.map(k => k.t), [1.7e12 - 40.25, 1.7e12 - 10], 'each kick keeps its own time');
  assert.ok(near(d.kicks[0].vel, 0.9));
  assert.equal(LV.decode(Buffer.from(buf)).t, m.t, 'a node Buffer decodes too');
  const many = LV.decode(LV.encode(msg(5, Array.from({ length: 12 }, (_, i) => ({ t: i, vel: 1 })))));
  assert.deepEqual(many.kicks.map(k => k.t), [4, 5, 6, 7, 8, 9, 10, 11], 'the newest 8');
  const bad = new Uint8Array(LV.encode(msg(5)));
  bad[0] = 0x4d; assert.equal(LV.decode(bad.buffer), null, 'magic');
  assert.equal(LV.decode(new ArrayBuffer(59)), null, 'too short');
  assert.equal(LV.decode(LV.encode(msg(5, [{ t: 1, vel: 1 }])).slice(0, 70)), null, 'length must match n');
  assert.equal(LV.RATE_HZ, 30);
});

test('the relay passes a levels frame on unchanged (binary), refuses a bad one; a link sends levels as binary and reads them back', async () => {
  const srv = http.createServer((q, s) => { s.writeHead(404); s.end(); });
  const relay = R.createRelay().attach(srv);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${srv.address().port}/relay?v=1`;
  const a = await R.connect(url), b = await R.connect(url);
  try {
    await a.wait(m => m.type === 'hello'); await b.wait(m => m.type === 'hello');
    const frame = Buffer.from(LV.encode(msg(1234.5, [{ t: 1200, vel: 1 }])));
    a.send(frame);
    const got = await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('no binary')), 3000); b.once('bin', buf => { clearTimeout(t); res(buf); }); });
    assert.ok(Buffer.compare(got, frame) === 0, 'byte for byte');
    assert.equal(LV.decode(got).kicks[0].t, 1200);
    a.send(Buffer.from([1, 2, 3, 4]));
    const err = await a.wait(m => m.type === 'relay-error');
    assert.equal(err.error, 'binary');
    assert.equal(relay.stats().binaryIn, 1);
  } finally { a.peer.destroy(); b.peer.destroy(); relay.close(); await new Promise(r => srv.close(r)); }
  // a link: levels out as one binary frame on the socket, the object on the channel; a binary frame in -> the object
  const sent = [], posted = [];
  class WS { constructor() { this.readyState = 0; WS.last = this; } send(d) { sent.push(d); } close() {} }
  const ch = { postMessage: m => posted.push(m), close() {}, onmessage: null };
  const link = SL.create({ channel: ch, WebSocket: WS, url: 'ws://x/relay?v=1', setTimeout: () => 0, clearTimeout: () => {}, measureConductor: false });
  const s = WS.last; s.readyState = 1; s.onopen();
  const got = [];
  link.onmessage = e => got.push(e.data);
  link.postMessage(msg(50, [{ t: 40, vel: 1 }]));
  const bin = sent.find(d => d instanceof ArrayBuffer);
  assert.ok(bin, 'a binary frame on the socket'); assert.equal(LV.decode(bin).t, 50);
  assert.equal(posted[posted.length - 1].type, 'levels', 'the object on the channel');
  s.onmessage({ data: LV.encode(msg(60)) });
  assert.equal(got.length, 1); assert.equal(got[0].type, 'levels'); assert.equal(got[0].t, 60);
  s.onmessage({ data: LV.encode(msg(60)) });
  ch.onmessage({ data: msg(60) });
  assert.equal(got.length, 1, 'the same t again (the other path): once');
  assert.equal(link.state.levelsIn, 2);
  link.close();
});

test('clock.js keeps the conductor\'s levels (shared source) and Clock.publish sends them at most 30 a second', () => {
  let ms = 1e6;
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const ctx = { currentTime: 2, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: { connect() {} }, resume() {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }), createOscillator: () => ({ frequency: param(), connect() {}, start() {}, stop() {} }),
    createBufferSource: () => ({ buffer: null, connect() {}, start() {}, stop() {} }), createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createAnalyser: () => ({ fftSize: 2048, connect() {}, getFloatTimeDomainData() {} }) };
  const recv = Clock.create({ source: 'shared', settings: { bpm: 120, bpb: 4, muted: true }, audioContext: () => ctx, timers: false, now: () => ms, epochNow: () => ms, sharedFeed: true, keys: false, badge: false });
  assert.equal(recv.sharedLevels, null, 'none before a message');
  recv.sharedMessage(msg(ms - 20));
  assert.equal(recv.sharedLevels.msg.t, ms - 20, 'kept even before Play');
  recv.start();
  ms += 100;
  const L = recv.sharedLevels;
  assert.equal(L.n, 1); assert.equal(L.ageMs, 100);
  assert.equal(recv.sharedState.state, 'waiting', 'levels are not a clock: the shared clock still waits');
  const out = [];
  const pc = { ctx, playing: false, jumps: [], read: () => ({ beats: -1 }) };
  const pub = Clock.publish(pc, { timers: false, epochNow: () => ms, post: m => out.push(m) });
  for (let i = 0; i < 600; i++) { pub.levels(msg(ms)); ms += 1; }   // 1000 a second offered, 600 ms
  assert.ok(out.length >= 17 && out.length <= 19, `${out.length} sent in 600 ms (30 a second)`);
  assert.equal(pub.levels({ type: 'clock' }), null);
});

test('audio-in ?audio=shared: bands and energy from the levels, kicks aged from their own time, stale levels fall to 0; the lanes stay the clock\'s', () => {
  let wall = 5e6, audioT = 10;
  let levels = null;
  const ctx = { currentTime: 10, sampleRate: 48000, createAnalyser: () => ({ fftSize: 2048, smoothingTimeConstant: 0, frequencyBinCount: 1024, connect() {} }) };
  const clock = { ctx, playing: true, settings: { bpb: 4 }, sharedState: { state: 'locked' },
    read: () => ({ beats: 8, bpm: 120, confidence: 0, kick: 0.33, snare: 0, hat: 0, level: 0.33 }),
    now: () => audioT,
    get sharedLevels() { return levels ? { msg: levels, ageMs: wall - levels.at, n: 1 } : null; },
    heardAt: te => audioT - (wall - te) / 1000 };
  const none = AudioIn.create({ clock, source: 'shared', nowSec: () => audioT }).start();
  assert.equal(none.source, 'shared'); assert.equal(none.fallback, null);
  let r = none.read();
  assert.equal(none.status, 'waiting'); assert.deepEqual(Object.values(r.bands), [0, 0, 0, 0, 0, 0, 0, 0], 'no levels yet: silence');
  levels = { ...msg(wall - 30, [{ t: wall - 50, vel: 1 }]), at: wall - 30 };
  const a = AudioIn.create({ clock, source: 'shared', nowSec: () => audioT }).start();
  r = a.read();
  assert.equal(a.status, 'shared');
  assert.ok(near(r.energy.bands.sub, 0.7, 1e-6) && near(r.energy.bands.air, 0.01, 1e-6), 'the first reading starts at the message');
  assert.ok(near(r.energy.level, 0.2825, 1e-6), `level ${r.energy.level}`);
  const k1 = Math.exp(-0.05 / 0.15) * (1 - Math.exp(-10));
  assert.ok(near(r.energy.kick, k1, 1e-4), `the kick 50 ms after its own time: ${r.energy.kick} vs ${k1}`);
  assert.equal(r.kick, 0.33, 'the lanes are the clock\'s, never the levels\' kicks');
  // 100 ms later: the same kick, aged from when it happened (the message's arrival does not matter)
  wall += 100; audioT += 0.1;
  r = a.read();
  assert.ok(near(r.energy.kick, Math.exp(-0.15 / 0.15), 1e-3), `150 ms after: ${r.energy.kick}`);
  assert.equal(a.sharedSeen, 1, 'the kick counted once');
  // no message for over a second: the bands fall to 0, the envelopes release (250 ms) frame by frame
  for (let i = 0; i < 12; i++) { wall += 250; audioT += 0.25; r = a.read(); }
  assert.equal(a.status, 'waiting');
  assert.ok(r.energy.bands.sub < 0.01, `released: ${r.energy.bands.sub}`);
  const q = AudioIn.qa(a, {});
  assert.deepEqual(q.audioIn.shared, { levelsIn: 1, ageMs: Math.round(wall - levels.at), kicksSeen: 1 });
});

test('rule B: only the shared code reads the levels; no scene works out a beat from them; the protocol doc says so', () => {
  const allowed = new Set(['audio-in.js', 'clock.js', 'shared-link.js', 'levels.js', 'clock-conductor.html', 'levels-host.html', 'slot.html']);
  const readers = [];
  for (const f of fs.readdirSync(EX).filter(f => /\.(html|js|mjs)$/.test(f))) {
    if (allowed.has(f)) continue;
    const src = fs.readFileSync(path.join(EX, f), 'utf8');
    if (/sharedLevels|LevelsLib|heardAt\(|levels\.js|'levels'/.test(src)) readers.push(f);
  }
  assert.deepEqual(readers, [], `pages that read the levels message themselves: ${readers.join(', ')}`);
  const doc = fs.readFileSync(path.join(DOCS, 'BEAT_RELAY_PROTOCOL.md'), 'utf8');
  assert.match(doc, /No page works out tempo, phase or the bar from levels or kicks\. A scene that does\s+fails review\./);
  assert.match(doc, /Each kick carries its own time/);
  const ai = fs.readFileSync(path.join(EX, 'audio-in.js'), 'utf8');
  assert.match(ai, /INTENSITY ONLY/);
});
