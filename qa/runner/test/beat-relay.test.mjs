// The beat relay (qa/beat-relay.mjs, docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 1): the WebSocket framing, fan-out,
// late join, version mismatch, reconnect, a slow subscriber does not stall the others, the ping sweep, and the relay
// inside conduct-serve on the same port. Node only: the node client in beat-relay.mjs, no browser, no audio.
//   node --test qa/runner/test/beat-relay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as R from '../../beat-relay.mjs';
import * as S from '../../conduct-serve.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** a plain http server with the relay attached, on 127.0.0.1:<free port> */
async function startRelay(opts = {}) {
  const srv = http.createServer((req, res) => { res.writeHead(404); res.end(); });
  const relay = R.createRelay(opts).attach(srv);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const open = [];
  return {
    relay, port,
    url: (v = '1') => `ws://127.0.0.1:${port}${R.RELAY_PATH}?v=${v}`,
    async join(v = '1') { const c = await R.connect(`ws://127.0.0.1:${port}${R.RELAY_PATH}?v=${v}`); open.push(c); await c.wait(m => m.type === 'hello'); return c; },
    async close() { for (const c of open) c.peer.destroy(); relay.close(); await new Promise(r => srv.close(r)); },
  };
}
const clockMsg = (t, beats) => ({ type: 'clock', v: 1, t, beats, bpm: 124, phase: beats % 1, bar: Math.floor(beats / 4), beatInBar: Math.floor(beats % 4), bpb: 4, confidence: 0.9, state: 'locked', offsetMs: 0 });

test('beat relay framing: RFC 6455 accept key, frames of every length class round-trip masked and not, split anywhere', () => {
  assert.equal(R.acceptKey('dGhlIHNhbXBsZSBub25jZQ=='), 's3pPLMBiTxaQ9kYGzzhZRbK+xOo=', 'the RFC example');
  for (const n of [0, 1, 125, 126, 65535, 65536, 70000]) {
    for (const mask of [false, true]) {
      const data = Buffer.alloc(n, 0x61 + (n % 20));
      const frame = R.encodeFrame(1, data, mask);
      const rd = new R.FrameReader(1 << 20);
      const out = [];
      const cut = Math.min(frame.length, 3);
      out.push(...rd.push(frame.subarray(0, cut)), ...rd.push(frame.subarray(cut)));
      assert.equal(out.length, 1, `one frame (${n}, mask ${mask})`);
      assert.equal(out[0].fin, true); assert.equal(out[0].opcode, 1); assert.equal(out[0].masked, mask);
      assert.ok(out[0].payload.equals(data), `payload ${n} bytes, mask ${mask}`);
    }
  }
  // byte by byte, two frames back to back
  const two = Buffer.concat([R.encodeFrame(1, 'abc', true), R.encodeFrame(9, '', true)]);
  const rd = new R.FrameReader();
  const got = [];
  for (const b of two) got.push(...rd.push(Buffer.from([b])));
  assert.deepEqual(got.map(f => [f.opcode, f.payload.toString()]), [[1, 'abc'], [9, '']]);
  assert.throws(() => new R.FrameReader(10).push(R.encodeFrame(1, 'x'.repeat(11))), e => e.code === 1009, 'over the limit: 1009');
});

test('beat relay messages: v 1 and a type, the relay\'s own types reserved, source reserved by its version only', () => {
  assert.equal(R.checkMessage(clockMsg(1, 0)), '');
  assert.equal(R.checkMessage({ type: 'clock', v: 2 }), 'version');
  assert.equal(R.checkMessage({ v: 1 }), 'type');
  assert.equal(R.checkMessage({ type: 'Clock!', v: 1 }), 'type');
  assert.equal(R.checkMessage([1]), 'not an object');
  assert.equal(R.checkMessage({ type: 'hello', v: 1 }), 'reserved');
  assert.equal(R.checkMessage({ type: 'relay-error', v: 1 }), 'reserved');
  assert.equal(R.checkMessage({ type: 'time', v: 1 }), 'reserved');
  assert.equal(R.checkMessage({ type: 'source', v: 1, id: 'hand', t: 1, beats: 2, bpm: 120, confidence: 1 }), '');
  assert.equal(R.checkMessage({ type: 'source', v: 2 }), 'version', 'only the version is checked on a source');
});

test('beat relay seq, resync and time: a seq per type, the late state keeps it, resync to the asker only, a time echo', async () => {
  const H = await startRelay();
  try {
    const cond = await H.join(), a = await H.join(), b = await H.join();
    cond.send(clockMsg(1, 1)); cond.send(clockMsg(2, 2));
    cond.send({ type: 'panic', v: 1, t: 3, mode: 'calm', id: 'p1' });
    const c2 = await a.wait(m => m.type === 'clock' && m.beats === 2);
    const p = await a.wait(m => m.type === 'panic');
    assert.equal(c2.seq, 2, 'clock seq 2'); assert.equal(p.seq, 1, 'panic has its own seq');
    assert.equal(p.id, 'p1', 'a command keeps the id its sender gave it');
    const n = b.messages.length;
    a.send({ type: 'resync', v: 1 });
    const again = await a.wait(m => m.type === 'clock' && m.late === true);
    assert.equal(again.seq, 2, 'the late state carries its seq');
    await a.wait(m => m.type === 'panic' && m.late === true);
    await sleep(50);
    assert.equal(b.messages.length, n, 'a resync goes to the asker only');
    a.send({ type: 'time-ask', v: 1, id: 7, t0: 123.5 });
    const tm = await a.wait(m => m.type === 'time');
    assert.deepEqual([tm.id, tm.t0], [7, 123.5]); assert.ok(Number.isFinite(tm.ts));
    assert.equal(b.messages.filter(m => m.type === 'time' || m.type === 'time-ask' || m.type === 'resync').length, 0, 'asks are never passed on');
    const st = H.relay.stats();
    assert.deepEqual([st.resyncs, st.timeAsks], [1, 1]);
  } finally { await H.close(); }
});

test('beat relay levels may be lost, commands never: a backed-up page keeps only the newest levels and still gets the panic', async () => {
  const H = await startRelay({ levelBytes: 16 << 10, slowBytes: 256 << 20 });
  try {
    const cond = await H.join(), lag = await H.join();
    lag.peer.socket.pause();
    const N = 8000, pad = 'x'.repeat(4000);   // 32 MB of levels: far more than the kernel buffers hold
    for (let i = 0; i < N; i++) cond.send({ type: 'levels', v: 1, t: i, i, pad });
    cond.send({ type: 'panic', v: 1, t: N, mode: 'blackout', id: 'p-last' });
    for (let k = 0; k < 800 && H.relay.stats().in < N + 1; k++) await sleep(25);
    const st = H.relay.stats();
    assert.equal(st.in, N + 1, 'the relay read everything');
    assert.ok(st.levelsDropped > 0, `older levels were dropped (${st.levelsDropped})`);
    assert.equal(st.slow, 0, 'the page was not cut off for levels');
    lag.peer.socket.resume();
    await lag.wait(m => m.type === 'panic' && m.id === 'p-last', 20000);
    const last = await lag.wait(m => m.type === 'levels' && m.i === N - 1, 20000);
    assert.ok(last, 'the newest levels arrive once the page reads again');
    const got = lag.messages.filter(m => m.type === 'levels').map(m => m.i);
    assert.ok(got.length < N, `${got.length} of ${N} levels delivered`);
    assert.ok(got.every((x, k) => k === 0 || x > got[k - 1]), 'levels stay in order');
  } finally { await H.close(); }
});

test('beat relay fan-out: every message reaches every other page once, never the sender, stamped rt', async () => {
  const H = await startRelay();
  try {
    const cond = await H.join(), a = await H.join(), b = await H.join(), c = await H.join();
    assert.equal(H.relay.stats().clients, 4);
    cond.send(clockMsg(1000, 8));
    for (const x of [a, b, c]) {
      const m = await x.wait(m => m.type === 'clock');
      assert.equal(m.beats, 8); assert.equal(m.t, 1000, 'the publisher\'s own time is kept');
      assert.ok(Number.isFinite(m.rt), 'rt: the relay\'s arrival time');
    }
    // a slot's controls go the other way (slot -> conductor) and to the other pages too
    a.send({ type: 'controls', v: 1, slot: 'A', scene: 'Neon Lines', controls: [{ knob: 1, name: 'beat' }] });
    await cond.wait(m => m.type === 'controls');
    await b.wait(m => m.type === 'controls');
    cond.send({ type: 'panic', v: 1, t: 1001, mode: 'blackout' });
    for (const x of [a, b, c]) await x.wait(m => m.type === 'panic');
    await sleep(50);
    assert.equal(cond.messages.filter(m => m.type === 'clock' || m.type === 'panic').length, 0, 'nothing comes back to the sender');
    assert.equal(a.messages.filter(m => m.type === 'controls').length, 0, 'nor to the slot that sent its controls');
    for (const x of [a, b, c]) assert.equal(x.messages.filter(m => m.type === 'clock').length, 1, 'exactly once');
    // order is kept: 50 clock messages arrive in the order sent
    for (let i = 0; i < 50; i++) cond.send(clockMsg(2000 + i, 100 + i));
    await a.wait(m => m.type === 'clock' && m.beats === 149);
    const beats = a.messages.filter(m => m.type === 'clock' && m.beats >= 100).map(m => m.beats);
    assert.deepEqual(beats, Array.from({ length: 50 }, (_, i) => 100 + i));
  } finally { await H.close(); }
});

test('beat relay late join: the latest clock, knobs, controls per slot and panic at once; a cleared panic is not replayed', async () => {
  const H = await startRelay();
  try {
    const cond = await H.join(), watch = await H.join(), slotB = await H.join();
    cond.send({ type: 'knobs', v: 1, t: 1, knobs: [0.5, null, null, null, null, null, null, null] });
    cond.send(clockMsg(10, 4));
    cond.send(clockMsg(20, 5));
    cond.send({ type: 'jump', v: 1, t: 21, kind: 'flip', origin: 'hand', fromBeats: 5, toBeats: 7 });
    slotB.send({ type: 'controls', v: 1, slot: 'B', scene: 'Lenia', controls: [] });
    cond.send({ type: 'panic', v: 1, t: 22, mode: 'blackout' });
    cond.send({ type: 'slot', v: 1, t: 23, slot: 'A', dir: 1 });
    await watch.wait(m => m.type === 'slot');
    await watch.wait(m => m.type === 'controls');
    const late = await H.join();
    await late.wait(m => m.type === 'clock');
    const got = late.messages.map(m => m.type);
    assert.deepEqual(got, ['hello', 'knobs', 'controls', 'panic', 'clock'], 'state in that order, no jump or slot step replayed');
    assert.equal(late.messages[0].ok, true);
    const clock = late.messages.find(m => m.type === 'clock');
    assert.equal(clock.beats, 5, 'the latest clock'); assert.equal(clock.late, true);
    assert.equal(late.messages.find(m => m.type === 'panic').mode, 'blackout', 'a page loaded during a blackout stays black');
    assert.equal(late.messages.find(m => m.type === 'controls').slot, 'B');
    cond.send({ type: 'panic', v: 1, t: 30, mode: 'clear' });
    await watch.wait(m => m.type === 'panic' && m.mode === 'clear');
    const later = await H.join();
    await later.wait(m => m.type === 'clock');
    assert.equal(later.messages.filter(m => m.type === 'panic').length, 0, 'after clear: no panic replayed');
    assert.equal(H.relay.stats().state.panic, null);
  } finally { await H.close(); }
});

test('beat relay version: another v is refused with hello ok false and close 4001; a v 2 message is not passed on', async () => {
  const H = await startRelay();
  try {
    const old = await R.connect(H.url('2'));
    const hello = await old.wait(m => m.type === 'hello');
    assert.deepEqual([hello.ok, hello.error, hello.want], [false, 'version', 1]);
    assert.equal(await old.waitClosed(), 4001);
    const none = await R.connect(`ws://127.0.0.1:${H.port}${R.RELAY_PATH}`);
    assert.equal((await none.wait(m => m.type === 'hello')).ok, false, 'no v at all: refused too');
    await none.waitClosed();
    assert.equal(H.relay.stats().versionRefused, 2);
    assert.equal(H.relay.stats().clients, 0);
    const a = await H.join(), b = await H.join();
    a.send({ ...clockMsg(1, 1), v: 2 });
    const err = await a.wait(m => m.type === 'relay-error');
    assert.equal(err.error, 'version');
    a.peer.send('not json');
    await a.wait(m => m.type === 'relay-error' && m.error === 'not JSON');
    a.send({ type: 'hello', v: 1 });
    await a.wait(m => m.type === 'relay-error' && m.error === 'reserved');
    a.send(clockMsg(2, 2));
    await b.wait(m => m.type === 'clock');
    assert.equal(b.messages.filter(m => m.type === 'clock').length, 1, 'only the good message reached b');
    assert.equal(b.messages.filter(m => m.type === 'relay-error').length, 0, 'errors go to the sender only');
    assert.equal(H.relay.stats().rejected, 3);
    // a path other than /relay is not upgraded
    await assert.rejects(R.connect(`ws://127.0.0.1:${H.port}/other?v=1`), /404/);
  } finally { await H.close(); }
});

test('beat relay reconnect: a page that drops and comes back gets the state again; the conductor reconnects and goes on', async () => {
  const H = await startRelay();
  try {
    let cond = await H.join();
    const scene = await H.join();
    cond.send(clockMsg(1, 10));
    await scene.wait(m => m.type === 'clock');
    let page = await H.join();
    assert.equal(H.relay.stats().clients, 3);
    page.close();
    assert.equal(await page.waitClosed(), 1000);
    for (let i = 0; i < 50 && H.relay.stats().clients !== 2; i++) await sleep(10);
    assert.equal(H.relay.stats().clients, 2, 'the closed page left');
    page = await H.join();
    assert.equal((await page.wait(m => m.type === 'clock')).beats, 10, 'the state again on rejoin');
    // the conductor drops without a close frame (a reload), comes back and publishes
    cond.peer.destroy();
    for (let i = 0; i < 50 && H.relay.stats().clients !== 2; i++) await sleep(10);
    assert.equal(H.relay.stats().clients, 2, 'a dropped socket leaves too');
    cond = await H.join();
    cond.send(clockMsg(2, 11));
    await scene.wait(m => m.type === 'clock' && m.beats === 11);
    await page.wait(m => m.type === 'clock' && m.beats === 11);
    const st = H.relay.stats();
    assert.equal(st.joined - st.left, st.clients, 'no client is lost or counted twice');
  } finally { await H.close(); }
});

test('beat relay: a subscriber that stops reading is cut off and does not hold up the others', async () => {
  const H = await startRelay({ slowBytes: 256 << 10 });
  try {
    const cond = await H.join(), fast = await H.join(), slow = await H.join();
    slow.peer.socket.pause();   // stops reading: the kernel buffers fill, then the relay's
    const N = 8000, pad = 'x'.repeat(4000);   // 32 MB: more than the loopback's kernel buffers hold for the stalled page
    const t0 = Date.now();
    for (let i = 0; i < N; i++) cond.send({ type: 'clock', v: 1, t: i, beats: i, bpm: 120, pad });
    await fast.wait(m => m.type === 'clock' && m.beats === N - 1, 20000);
    const ms = Date.now() - t0;
    const beats = fast.messages.filter(m => m.type === 'clock').map(m => m.beats);
    assert.equal(beats.length, N, 'the fast page got every message');
    assert.ok(beats.every((b, i) => b === i), 'in order');
    const st = H.relay.stats();
    assert.equal(st.slow, 1, `the stalled page was cut off (${JSON.stringify(st)})`);
    assert.equal(st.clients, 2);
    assert.ok(ms < 15000, `${N} messages of 4 KB through the relay in ${ms} ms`);
    console.log(`# relay fan-out with a stalled subscriber: ${N} x 4 KB in ${ms} ms`);
  } finally { await H.close(); }
});

test('beat relay ping: a page that answers pings stays, a silent one is cut off after 2 ping periods', async () => {
  const H = await startRelay({ pingMs: 60 });
  try {
    const live = await H.join(), dead = await H.join();
    dead.peer.socket.pause();   // reads nothing, so it never answers a ping
    await sleep(400);
    assert.equal(live.closed, null, 'the live page is still open');
    const st = H.relay.stats();
    assert.equal(st.silent, 1, 'the silent page was cut off');
    assert.equal(st.clients, 1);
  } finally { await H.close(); }
});

test('conduct-serve carries the relay on its own port: /relay upgrades, /api/relay counts, the pages are still served', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-serve-'));
  const tracks = path.join(root, 'tracks');
  fs.mkdirSync(tracks, { recursive: true });
  const { server, relay } = S.makeServer({ tracksDir: tracks, sessionsDir: path.join(root, 'sessions') });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `127.0.0.1:${server.address().port}`;
  try {
    const a = await R.connect(`ws://${base}/relay?v=1`), b = await R.connect(`ws://${base}/relay?v=1`);
    await a.wait(m => m.type === 'hello'); await b.wait(m => m.type === 'hello');
    a.send({ type: 'panic', v: 1, t: 5, mode: 'calm' });
    assert.equal((await b.wait(m => m.type === 'panic')).mode, 'calm');
    const st = await (await fetch(`http://${base}/api/relay`)).json();
    assert.equal(st.version, 1); assert.equal(st.clients, 2); assert.equal(st.state.panic, 'calm');
    const root302 = await fetch(`http://${base}/`, { redirect: 'manual' });
    assert.ok(root302.status === 200 || (root302.status >= 300 && root302.status < 400), `the page route is unchanged (${root302.status})`);
    assert.equal((await fetch(`http://${base}/api/tracks`)).status, 200);
    a.peer.destroy(); b.peer.destroy();
    const plain = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: path.join(root, 'sessions') }));
    await new Promise(r => plain.listen(0, '127.0.0.1', r));
    try {
      assert.equal((await fetch(`http://127.0.0.1:${plain.address().port}/api/relay`)).status, 404, 'a handler without a relay says so');
    } finally { await new Promise(r => plain.close(r)); }
  } finally {
    relay.close();
    await new Promise(r => server.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
