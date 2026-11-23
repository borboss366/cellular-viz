// The shared source over the relay (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 2): experiments/shared-link.js (the
// channel and the relay socket as one channel-like object), clock.js using it, conduct-serve's cookie, and the shared
// clock's tests run through the relay (qa/beat-relay.mjs: relay.pass is the relay's own message path, no socket) with
// the channel copy on top (a Chrome window hears both) or without it (an OBS Browser Source hears the socket only).
// The last test runs two links over real sockets. No browser, no audio.
//   node --test qa/runner/test/shared-link.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as R from '../../beat-relay.mjs';
import * as CS from '../../conduct-serve.mjs';
const require = createRequire(import.meta.url);
const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../experiments');
const L = require(path.join(EX, 'shared-link.js'));
const Clock = require(path.join(EX, 'clock.js'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

class FakeChannel {
  constructor() { this.posted = []; this.onmessage = null; this.closed = false; this.peer = null; }
  postMessage(m) { this.posted.push(m); if (this.peer) this.peer.emit(JSON.parse(JSON.stringify(m))); }
  close() { this.closed = true; }
  emit(m) { if (this.onmessage) this.onmessage({ data: m }); }
}
function fakeNet() {
  const sockets = [];
  class FakeWS {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    open() { this.readyState = 1; if (this.onopen) this.onopen({}); }
    recv(m) { if (this.onmessage) this.onmessage({ data: typeof m === 'string' ? m : JSON.stringify(m) }); }
    drop() { this.readyState = 3; if (this.onclose) this.onclose({}); }
    send(t) { this.sent.push(JSON.parse(t)); }
    close() { this.readyState = 3; }
  }
  return { FakeWS, sockets };
}
function fakeTimers() {
  const q = [];
  return { q, setTimeout: (f, ms) => { const t = { f, ms }; q.push(t); return t; }, clearTimeout: t => { const i = q.indexOf(t); if (i >= 0) q.splice(i, 1); },
    fire() { const t = q.shift(); if (t) t.f(); return t; } };
}

test('shared-link: the socket opens on ?relay=1 or conduct-serve\'s cookie (never on ?relay=0), at the page\'s own origin; clock.js loads it; conduct-serve sets the cookie', async () => {
  assert.equal(L.relayWanted('', ''), false, 'a page anywhere else: channel only');
  assert.equal(L.relayWanted('?relay=1', ''), true);
  assert.equal(L.relayWanted('?a=1&relay=0', 'cvrelay=1'), false, '?relay=0 wins');
  assert.equal(L.relayWanted('', 'x=2; cvrelay=1'), true);
  assert.equal(L.relayWanted('', 'cvrelay=10'), false);
  assert.equal(L.relayWanted('?relay=ws%3A%2F%2Fb%3A9%2Frelay%3Fv%3D1', ''), true);
  assert.equal(L.relayUrl({ protocol: 'http:', host: 'localhost:8790' }, ''), 'ws://localhost:8790/relay?v=1');
  assert.equal(L.relayUrl({ protocol: 'https:', host: 'x' }, ''), 'wss://x/relay?v=1');
  assert.equal(L.relayUrl({ protocol: 'file:', host: '' }, ''), null);
  assert.equal(L.relayUrl({ protocol: 'http:', host: 'a' }, '?relay=ws%3A%2F%2Fb%3A9%2Frelay%3Fv%3D1'), 'ws://b:9/relay?v=1');
  const src = fs.readFileSync(path.join(EX, 'clock.js'), 'utf8');
  assert.match(src, /cvrelay=1/, 'clock.js decides on the same cookie');
  assert.match(src, /add\('relay-lib\.js', \(\) => add\('shared-link\.js'/, 'clock.js loads relay-lib.js, then shared-link.js');
  assert.match(src, /shared\.link = L\.create\(\{ channel: mine \|\| undefined \}\)/, 'the shared source hands its channel to the link');
  assert.match(src, /post = m => link\.postMessage\(m\)/, 'Clock.publish posts through the link');
  // conduct-serve: every page comes with the cookie when the relay is there; without the relay, none
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'link-serve-'));
  fs.mkdirSync(path.join(root, 'tracks'));
  const { server, relay } = CS.makeServer({ tracksDir: path.join(root, 'tracks'), sessionsDir: path.join(root, 'sessions') });
  const plain = http.createServer(CS.createHandler({ tracksDir: path.join(root, 'tracks'), sessionsDir: path.join(root, 'sessions') }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  await new Promise(r => plain.listen(0, '127.0.0.1', r));
  try {
    const page = await fetch(`http://127.0.0.1:${server.address().port}/experiments/clock-conductor.html`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('set-cookie') || '', /^cvrelay=1; Path=\//);
    const js = await fetch(`http://127.0.0.1:${server.address().port}/experiments/clock.js`);
    assert.equal(js.headers.get('set-cookie'), null, 'pages only');
    const other = await fetch(`http://127.0.0.1:${plain.address().port}/experiments/clock-conductor.html`);
    assert.equal(other.headers.get('set-cookie'), null, 'no relay, no cookie');
    for (const f of ['shared-link.js', 'relay-lib.js']) assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/experiments/${f}`)).status, 200, `${f} is served`);
  } finally {
    relay.close();
    await new Promise(r => server.close(r)); await new Promise(r => plain.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('shared-link: each message once from channel or socket, old seq and stale late clocks dropped, commands get ids, offset, resync, reconnect with backoff', () => {
  const wall = 1e6, N = fakeNet(), T = fakeTimers(), ch = new FakeChannel();
  const doc = { listeners: {}, visibilityState: 'visible', addEventListener(k, f) { this.listeners[k] = f; } };
  const link = L.create({ channel: ch, WebSocket: N.FakeWS, url: 'ws://h/relay?v=1', now: () => wall, setTimeout: T.setTimeout, clearTimeout: T.clearTimeout, random: () => 1, document: doc, measureConductor: false });
  const got = [];
  link.onmessage = e => got.push(e.data);
  assert.equal(N.sockets.length, 1);
  const s = N.sockets[0];
  s.open();
  assert.equal(link.state.socket, 'open');
  s.recv({ type: 'hello', v: 1, ok: true, clients: 2 });
  assert.deepEqual(link.state.hello, { ok: true, clients: 2, error: null }); assert.equal(got.length, 0, 'the hello stays in the link');
  // the same clock by the channel and by the socket (either first): once
  const clk = { type: 'clock', v: 1, t: wall, beats: 4, bpm: 120 };
  ch.emit(clk); s.recv({ ...clk, rt: 1, seq: 1 });
  s.recv({ ...clk, t: wall + 50, beats: 4.1, seq: 2 }); ch.emit({ ...clk, t: wall + 50, beats: 4.1 });
  assert.equal(got.filter(m => m.type === 'clock').length, 2);
  assert.equal(link.state.dropped.copy, 2);
  // a flip with its id by both paths: once
  const j = { type: 'jump', v: 1, t: wall, kind: 'flip', fromBeats: 4, toBeats: 4.5, id: 'c-1' };
  ch.emit(j); s.recv({ ...j, seq: 1 });
  assert.equal(got.filter(m => m.type === 'jump').length, 1); assert.equal(link.state.dropped.repeat, 1);
  // a socket message with a seq not newer than its type's last: old
  s.recv({ ...clk, t: wall + 100, seq: 2 });
  assert.equal(link.state.dropped.old, 1);
  // a late clock older than 2 s: the page free-runs instead of jumping to it
  s.recv({ ...clk, t: wall - 5000, late: true, seq: 3 });
  assert.equal(link.state.dropped.stale, 1);
  assert.equal(link.state.fromChannel + link.state.fromSocket, got.length);
  // the clock offset: 5 pings, 100 ms apart, the relay's answers
  for (let i = 0; i < 4; i++) T.fire();
  const asks = s.sent.filter(m => m.type === 'time-ask');
  assert.equal(asks.length, 5);
  asks.forEach((a, i) => s.recv({ type: 'time', v: 1, id: a.id, t0: a.t0, ts: a.t0 + 1000 + i }));
  assert.deepEqual(link.state.offset, { ms: 1000, rttMs: 0, n: 5 });
  assert.equal(link.offsetLog.length, 1, 'logged once per round (report only)');
  // a command posted without an id gets one, the same on both paths
  link.postMessage({ type: 'panic', v: 1, t: wall, mode: 'calm' });
  const viaCh = ch.posted[ch.posted.length - 1], viaWs = s.sent[s.sent.length - 1];
  assert.ok(viaCh.id && viaCh.id === viaWs.id, `the same id: ${viaCh.id}`);
  link.postMessage({ type: 'clock', v: 1, t: wall, beats: 1, bpm: 120 });
  assert.equal(ch.posted[ch.posted.length - 1].id, undefined, 'a clock message keeps its shape');
  // visible again: resync from the relay's state
  doc.listeners.visibilitychange();
  assert.equal(s.sent[s.sent.length - 1].type, 'resync'); assert.equal(link.state.resyncs, 1);
  // the socket drops: the channel goes on, the socket comes back after 250 ms, then 500 ms (jitter at its top here)
  T.q.length = 0;
  s.drop();
  assert.equal(link.state.socket, 'waiting'); assert.equal(T.q.length, 1); assert.equal(T.q[0].ms, 250);
  ch.emit({ ...clk, t: wall + 200 });
  assert.equal(got[got.length - 1].t, wall + 200, 'the channel still delivers');
  T.fire();
  assert.equal(N.sockets.length, 2);
  N.sockets[1].drop();
  assert.equal(T.q[0].ms, 500, 'the next wait doubles');
  T.fire();
  N.sockets[2].open();
  assert.equal(link.state.opens, 2); assert.equal(link.state.socket, 'open');
  link.close();
  assert.equal(ch.closed, true); assert.equal(link.state.socket, 'off');
});

test('shared-link offset to the conductor (owner\'s call A): 5 pings at the first open, the conductor answers, one report per load; >5 ms is a finding; nothing applies it', async () => {
  const LG = await import('../../conduct-log.mjs');
  let wall = 5e6;
  const relay = R.createRelay({ pingMs: 0 }), N = fakeNet(), TS = fakeTimers(), TC = fakeTimers();
  // the conductor's wall clock runs 7.2 ms ahead of the scene's
  const cond = L.create({ BroadcastChannel: null, WebSocket: N.FakeWS, url: 'ws://relay', now: () => wall + 7.2, setTimeout: TC.setTimeout, clearTimeout: TC.clearTimeout, answerPings: true, measureConductor: false });
  const scene = L.create({ BroadcastChannel: null, WebSocket: N.FakeWS, url: 'ws://relay', now: () => wall, setTimeout: TS.setTimeout, clearTimeout: TS.clearTimeout,
    location: { pathname: '/experiments/16-dive.html', search: '?clock=shared&slot=B' }, search: '?clock=shared&slot=B', idBase: 'pscene1' });
  const [cs, ss] = N.sockets;
  cs.send = text => { const out = relay.pass(text); if (out) ss.recv(out); };   // the relay passes each on to the other page
  ss.send = text => { wall += 1; const out = relay.pass(text); if (out) cs.recv(out); };   // 1 ms on the way there
  const reports = [], seen = [];
  cond.onmessage = e => reports.push(e.data);
  scene.onmessage = e => seen.push(e.data);
  cs.open();
  assert.equal(cond.state.conductorPing, 'answers');
  ss.open();
  assert.equal(scene.state.conductorPing, 'pinging');
  for (let i = 0; i < 20 && scene.state.conductorPing === 'pinging'; i++) TS.q.splice(0).forEach(t => t.f());   // the next 100 ms steps
  assert.equal(cond.state.pongs, 5, 'five answers');
  assert.equal(scene.state.conductorPing, 'done');
  const off = scene.state.conductorOffset;
  assert.ok(Math.abs(off.ms - 7.7) < 0.01, `offset ${off.ms} ms (7.2 ahead, plus half the 1 ms one-way trip)`);
  assert.deepEqual([off.rttMs, off.n, off.finding], [1, 5, true], 'over 5 ms: a finding');
  assert.equal(reports.length, 1, 'one report per load, on the conductor\'s link');
  const rec = LG.offsetRecord(reports[0]);
  assert.deepEqual(rec, { loadId: 'pscene1', page: '16-dive.html', slot: 'B', ms: off.ms, rttMs: 1, n: 5, finding: true });
  assert.equal(seen.filter(m => /clock-p|offset-report/.test(m.type)).length, 0, 'pings, pongs and reports never reach the scene');
  // a reconnect does not ping again (once per load); a scene with no conductor gives up after 3 s with no report
  ss.drop(); TS.q.splice(0).forEach(t => t.ms >= 100 && t.ms < 10000 && t.f());
  assert.equal(reports.length, 1);
  const N2 = fakeNet(), T2 = fakeTimers();
  let w2 = 0;
  const alone = L.create({ BroadcastChannel: null, WebSocket: N2.FakeWS, url: 'ws://relay', now: () => w2, setTimeout: T2.setTimeout, clearTimeout: T2.clearTimeout });
  N2.sockets[0].open();
  for (let i = 0; i < 50 && alone.state.conductorPing === 'pinging'; i++) { const due = T2.q.splice(0); if (!due.length) break; w2 += Math.max(...due.map(t => t.ms)); due.forEach(t => t.f()); }
  assert.equal(alone.state.conductorPing, 'no answer');
  assert.equal(alone.state.conductorOffset, null);
  assert.equal(N2.sockets[0].sent.filter(m => m.type === 'offset-report').length, 0);
  for (const l of [cond, scene, alone]) l.close();
});

// ---------- the shared clock's tests through the relay ----------
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
/** a scene on ?clock=shared fed by its link; the conductor's link; between them the relay's own message path and,
 *  with channel: true, the channel too (a Chrome window hears both; an OBS Browser Source only the socket) */
function relayWorld({ channel = false, bpm = 128, recvT0 = 9.1, pubT0 = 0.3 } = {}) {
  const w = { ms: 1e6 }, relay = R.createRelay({ pingMs: 0 }), N = fakeNet();
  const noTimers = { setTimeout: () => 0, clearTimeout: () => {} };
  const rctx = fakeContext(recvT0);
  const recv = Clock.create({ source: 'shared', settings: SETTINGS(120), audioContext: () => rctx, timers: false, pump: true,
    now: () => w.ms, epochNow: () => w.ms, sharedFeed: true, keys: false, badge: false });
  recv.start();
  const pubCh = new FakeChannel(), recvCh = new FakeChannel();
  if (channel) pubCh.peer = recvCh;
  const pubLink = L.create({ channel: pubCh, WebSocket: N.FakeWS, url: 'ws://relay', now: () => w.ms, ...noTimers });
  const recvLink = L.create({ channel: recvCh, WebSocket: N.FakeWS, url: 'ws://relay', now: () => w.ms, ...noTimers });
  const [ps, rs] = N.sockets;
  ps.send = text => { const out = relay.pass(text, ans => ps.recv(ans)); if (out) rs.recv(out); };   // through the relay
  rs.send = text => { relay.pass(text, ans => rs.recv(ans)); };
  ps.open(); rs.open();
  recvLink.onmessage = e => recv.sharedMessage(e.data);
  const pctx = fakeContext(pubT0);
  const pc = Clock.create({ source: 'metronome', settings: SETTINGS(bpm), audioContext: () => pctx, timers: false, pump: true, now: () => w.ms, keys: false });
  pc.start();
  const sent = [];
  const pub = Clock.publish(pc, { timers: false, epochNow: () => w.ms, post: m => sent.push(m) });
  return { w, rctx, recv, pctx, pc, pub, sent, relay, pubLink, recvLink, hNow: () => recv.now({ raw: true }) };
}
/** advance 5 ms at a time; what the publisher posts goes through its link (unless send is false) */
function step(W, ms, { send = true, each } = {}) {
  for (let s = 0; s < ms; s += 5) {
    W.w.ms += 5; W.rctx.currentTime += 0.005; W.pctx.currentTime += 0.005;
    W.pc.schedule();
    const before = W.sent.length;
    W.pub.tick();
    if (send) for (const m of W.sent.slice(before)) W.pubLink.postMessage(m);
    W.recv.schedule();
    if (each) each();
  }
}

test('shared over the relay (socket only, as in OBS): beats within 1 ms of the publisher at 128; bar and beat-in-bar; seq on every message', () => {
  const W = relayWorld({ channel: false });
  let worst = 0, n = 0;
  step(W, 12000, { each: () => {
    if (W.w.ms < 1e6 + 2000) return;
    const pb = W.pc.read({ raw: true }).beats, rb = W.recv.baseBeats(W.hNow());
    if (pb < 0 || rb < 0) return;
    worst = Math.max(worst, Math.abs(pb - rb) * 60 / 128 * 1000); n++;
  } });
  console.log(`# shared over the relay, 128: worst ${worst.toFixed(4)} ms over ${n} samples; link ${JSON.stringify(W.recvLink.state)}`);
  assert.ok(n > 1000, `${n} samples`);
  assert.ok(worst < 1, `worst ${worst.toFixed(3)} ms`);
  assert.equal(W.recv.sharedState.state, 'locked');
  assert.equal(W.recv.read().bpm, 128);
  const pr = W.pc.read({ raw: true }), rr = W.recv.read({ raw: true });
  assert.deepEqual([rr.bar, rr.beatInBar], [pr.bar, pr.beatInBar]);
  assert.equal(W.recvLink.state.fromChannel, 0, 'nothing by the channel');
  assert.ok(W.recvLink.state.fromSocket > 200, `${W.recvLink.state.fromSocket} messages by the socket`);
  assert.ok(W.relay.stats().state.clock, 'the relay keeps the latest clock');
});

test('shared over the relay with the channel too (Chrome): a flip lands once at the same bar line; a 2 s gap free-runs, then re-locks', () => {
  const W = relayWorld({ channel: true, bpm: 124 });
  step(W, 3000);
  // the publisher flips: a hand fix on the metronome moves its beats by half a beat, logged as a jump
  const before = W.recv.jumps.length;
  W.pc.fix('nudge', -1000 * 30 / 124, { origin: 'fix:key' });
  step(W, 2000);
  const jumps = W.recv.jumps.slice(before).filter(j => j.kind === 'nudge');
  assert.equal(jumps.length, 1, `the jump lands once though both paths carried it: ${JSON.stringify(W.recv.jumps.slice(before))}`);
  assert.equal(jumps[0].origin, 'shared:fix:key');
  assert.ok(W.recvLink.state.dropped.repeat + W.recvLink.state.dropped.copy > 50, `the second copies were dropped: ${JSON.stringify(W.recvLink.state.dropped)}`);
  const pb = W.pc.read({ raw: true }).beats, rb = W.recv.baseBeats(W.hNow());
  assert.ok(Math.abs(pb - rb) * 60 / 124 * 1000 < 1, `in step after the jump: ${((pb - rb) * 60 / 124 * 1000).toFixed(3)} ms`);
  // 2.5 s of silence on both paths: free-run ("shared clock lost"), then the next message re-locks
  let last = -Infinity, monotonic = true;
  step(W, 2500, { send: false, each: () => { const b = W.recv.baseBeats(W.hNow()); if (b < last - 1e-9) monotonic = false; last = b; } });
  assert.equal(W.recv.sharedState.state, 'free-run');
  step(W, 1000, { each: () => { const b = W.recv.baseBeats(W.hNow()); if (b < last - 1e-9) monotonic = false; last = b; } });
  assert.equal(W.recv.sharedState.state, 'locked');
  assert.ok(monotonic, 'beats never ran backwards');
});

test('shared-link over real sockets: two pages on a relay; the clock, a panic once, the offset, a late page gets the state, a dropped socket comes back', async () => {
  const srv = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  const relay = R.createRelay().attach(srv);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${srv.address().port}/relay?v=1`;
  const made = [];
  class NodeWS {
    constructor(u) {
      this.readyState = 0; made.push(this);
      R.connect(u).then(c => {
        this.c = c; this.readyState = 1;
        if (this.onopen) this.onopen({});
        for (const m of c.messages) if (this.onmessage) this.onmessage({ data: JSON.stringify(m) });
        c.on('msg', m => { if (this.onmessage) this.onmessage({ data: JSON.stringify(m) }); });
        c.on('closed', () => { this.readyState = 3; if (this.onclose) this.onclose({}); });
      }, () => { this.readyState = 3; if (this.onclose) this.onclose({}); });
    }
    send(t) { if (this.c) this.c.peer.send(t); }
    close() { this.readyState = 3; if (this.c) this.c.close(); }
  }
  const until = async (f, ms = 3000) => { const t0 = Date.now(); while (!f()) { if (Date.now() - t0 > ms) throw new Error('timed out'); await sleep(10); } };
  const mk = () => L.create({ BroadcastChannel: null, WebSocket: NodeWS, url });
  const links = [];
  try {
    const pub = mk(), scene = mk();
    links.push(pub, scene);
    const got = [];
    scene.onmessage = e => got.push(e.data);
    await until(() => pub.state.socket === 'open' && scene.state.socket === 'open');
    pub.postMessage({ type: 'clock', v: 1, t: Date.now(), beats: 8, bpm: 126, bar: 2, beatInBar: 1, bpb: 4, confidence: 1, state: 'locked', offsetMs: 0 });
    const panic = { type: 'panic', v: 1, t: Date.now(), mode: 'blackout', id: 'p-1' };
    pub.postMessage(panic); pub.postMessage(panic);
    await until(() => got.some(m => m.type === 'panic') && got.some(m => m.type === 'clock'));
    await sleep(100);
    assert.equal(got.filter(m => m.type === 'panic').length, 1, 'the same panic id once');
    assert.equal(relay.stats().duplicates, 1, 'the relay dropped the repeat');
    await until(() => scene.state.offset !== null, 4000);
    assert.ok(Math.abs(scene.state.offset.ms) < 50, `one machine: offset ${scene.state.offset.ms} ms (rtt ${scene.state.offset.rttMs} ms)`);
    console.log(`# relay offset on one machine: ${JSON.stringify(scene.state.offset)}`);
    // a page that joins late: the clock (within 2 s) and the blackout at once
    pub.postMessage({ type: 'clock', v: 1, t: Date.now(), beats: 8.5, bpm: 126, bar: 2, beatInBar: 1, bpb: 4, confidence: 1, state: 'locked', offsetMs: 0 });
    await until(() => got.some(m => m.type === 'clock' && m.beats === 8.5));
    const late = mk(); links.push(late);
    const lateGot = [];
    late.onmessage = e => lateGot.push(e.data);
    await until(() => lateGot.some(m => m.type === 'clock') && lateGot.some(m => m.type === 'panic'));
    assert.equal(lateGot.find(m => m.type === 'panic').mode, 'blackout');
    // the scene's socket drops: it comes back on its own and hears the publisher again
    const sock = made[1];
    sock.c.peer.destroy();
    await until(() => scene.state.opens === 2, 4000);
    pub.postMessage({ type: 'clock', v: 1, t: Date.now(), beats: 9, bpm: 126, bar: 2, beatInBar: 2, bpb: 4, confidence: 1, state: 'locked', offsetMs: 0 });
    await until(() => got.some(m => m.type === 'clock' && m.beats === 9));
    assert.ok(scene.state.attempts >= 1);
  } finally {
    for (const l of links) l.close();
    relay.close();
    await new Promise(r => srv.close(r));
  }
});
