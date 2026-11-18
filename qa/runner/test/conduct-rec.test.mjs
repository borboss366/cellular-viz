// The conductor's recording of its input (docs/SATURDAY_BRIEF.md box task 3, qa/conduct-rec.mjs): the AudioWorklet's
// chunks (stereo Int16, the frame of their first sample), the page's sender (offsets, a lost answer, the box down, a
// gap), and conduct-serve's /rec route (a valid WAV after every chunk, the .wav.json with startCtx). No browser; the
// headless run is in conduct-guest.test.mjs (box only).
//   node --test qa/runner/test/conduct-rec.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import * as R from '../../conduct-rec.mjs';
import * as S from '../../conduct-serve.mjs';

test('conduct-rec: the worklet makes stereo Int16 chunks from the frame of their first sample (mono to both, clip, silence; a stale currentFrame is no gap, a real jump is silence); the WAV header', async () => {
  const h = R.wavHeader(48000, 2, 1000), v = new DataView(h.buffer);
  assert.equal(h.length, 44);
  const tag = o => String.fromCharCode(h[o], h[o + 1], h[o + 2], h[o + 3]);
  assert.deepEqual([tag(0), tag(8), tag(12), tag(36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
  assert.deepEqual([v.getUint32(4, true), v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(32, true), v.getUint16(34, true), v.getUint32(40, true)],
    [1036, 1, 2, 48000, 192000, 4, 16, 1000]);

  const posted = [];
  let reg = null;
  const ctx = vm.createContext({ currentFrame: 0, Int16Array, Math,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: m => posted.push(m) }; } },
    registerProcessor: (name, cls) => { reg = { name, cls }; } });
  vm.runInContext(R.REC_WORKLET, ctx);
  assert.equal(reg.name, 'conduct-rec');
  const p = new reg.cls();
  const fill = x => new Float32Array(128).fill(x);
  let frame = 1000;
  for (let k = 0; k < 188; k++) {   // 188 quanta of 128 frames: one chunk of 24000, 64 frames left over
    ctx.currentFrame = frame;
    const inputs = k < 10 ? [[fill(0.5), fill(-0.5)]] : k < 20 ? [[fill(2)]] : [[]];
    assert.equal(p.process(inputs), true);
    frame += 128;
  }
  assert.equal(posted.length, 1);
  assert.equal(posted[0].frame, 1000, 'the frame of the first sample');
  const c = new Int16Array(posted[0].data);
  assert.equal(c.length, R.CHUNK_FRAMES * 2);
  assert.deepEqual([c[0], c[1]], [Math.round(0.5 * 32767), Math.round(-0.5 * 32767)], 'left, right interleaved');
  assert.deepEqual([c[2 * 1280], c[2 * 1280 + 1]], [32767, 32767], 'a mono input on both channels, clipped');
  assert.deepEqual([c[2 * 2560], c[2 * 2560 + 1]], [0, 0], 'no input: silence, the timeline goes on');
  for (let k = 0; k < 188; k++) { ctx.currentFrame = frame; p.process([[]]); frame += 128; }
  assert.equal(posted.length, 2);
  assert.equal(posted[1].frame, 1000 + R.CHUNK_FRAMES, 'the next chunk starts at the frame after the last');
  assert.deepEqual(posted.map(m => m.skipped), [0, 0]);

  // The box run of #261 @90c354d counted one gap. Chrome sets the worklet's currentFrame only when its render thread
  // gets the graph lock (a try-lock); while the main thread holds it, a quantum sees the previous quantum's value.
  // Quantum 187 holds the chunk boundary: the old processor took the stale value as the next chunk's start (128 early,
  // gaps 1) though every sample was written. The frames now come from the processor's own count.
  posted.length = 0;
  const p2 = new reg.cls();
  frame = 5000;
  for (let k = 0; k < 376; k++) {
    ctx.currentFrame = k === 187 ? frame - 128 : frame;   // the stale currentFrame at the chunk boundary
    p2.process([[fill(0.25)]]);
    frame += 128;
  }
  assert.deepEqual(posted.map(m => m.frame), [5000, 5000 + R.CHUNK_FRAMES], 'no gap from a stale currentFrame');
  assert.deepEqual(posted.map(m => m.skipped), [0, 0]);
  const rq = R.createRecorder({ ctx: { sampleRate: 48000 }, post: async () => ({ status: 200, ok: true, json: async () => ({}) }) });
  for (const m of posted) await rq.chunk(m);
  assert.deepEqual([rq.state.gaps, rq.state.skipped], [0, 0], 'the page sees no gap either');
  // a stale very first reading: re-anchored before the first chunk goes out, no silence
  posted.length = 0;
  const p4 = new reg.cls();
  frame = 7000;
  for (let k = 0; k < 188; k++) { ctx.currentFrame = k === 0 ? frame - 128 : frame; p4.process([[fill(0.25)]]); frame += 128; }
  assert.deepEqual([posted[0].frame, posted[0].skipped], [7000, 0]);

  // a real jump ahead (frames that never reached the processor): written as silence and counted, the file stays on the
  // context's clock
  posted.length = 0;
  const p3 = new reg.cls();
  frame = 0;
  for (let k = 0; k < 376; k++) {
    if (k === 200) frame += 256;   // after the first chunk is out (quantum 187)
    ctx.currentFrame = frame;
    p3.process([[fill(0.25)]]);
    frame += 128;
  }
  assert.deepEqual(posted.map(m => [m.frame, m.skipped]), [[0, 0], [R.CHUNK_FRAMES, 256]]);
  const c3 = new Int16Array(posted[1].data);   // quantum 200 starts at frame 25600 = 1600 into the second chunk
  assert.deepEqual([c3[2 * 1599], c3[2 * 1600], c3[2 * 1855], c3[2 * 1856]], [8192, 0, 0, 8192], '256 frames of silence where the frames were lost');
});

test('conduct-rec: the sender keeps the order and the offsets: the first chunk carries sr, ch, start; a lost answer, the box down, a gap', async () => {
  const sent = [];
  let mode = 'ok';
  const reply = (status, body = {}) => ({ status, ok: status === 200, json: async () => body });
  const post = async (q, body) => {
    sent.push({ q, n: body.byteLength });
    if (mode === 'down') throw new Error('the box is down');
    if (mode === 'landed') { mode = 'ok'; const off = Number(/off=(\d+)/.exec(q)[1]); return reply(409, { error: 'offset', size: off + body.byteLength }); }
    return reply(200, {});
  };
  const r = R.createRecorder({ ctx: { sampleRate: 48000 }, post, retryMs: 5 });
  assert.equal(r.text(), 'rec: waiting for the input');
  await r.chunk({ frame: 4800, data: new ArrayBuffer(400) });   // 100 frames
  assert.equal(sent[0].q, 'off=0&sr=48000&ch=2&start=0.1');
  assert.deepEqual([r.state.bytes, r.state.startCtx], [400, 0.1]);
  await r.chunk({ frame: 4900, data: new ArrayBuffer(400) });
  assert.equal(sent[1].q, 'off=400');
  mode = 'landed';   // the chunk reached the box but the answer was lost: 409 with the size after it, not sent again
  await r.chunk({ frame: 5000, data: new ArrayBuffer(400) });
  assert.deepEqual([r.state.bytes, r.state.queue.length, sent.length], [1200, 0, 3]);
  mode = 'down';
  await r.chunk({ frame: 5100, data: new ArrayBuffer(400) });
  assert.equal(r.state.queue.length, 1, 'the chunk waits');
  assert.match(r.state.error, /down/);
  mode = 'ok';
  await new Promise(res => setTimeout(res, 40));
  assert.deepEqual([r.state.queue.length, r.state.bytes, r.state.error], [0, 1600, null], 'sent on the retry, in order');
  assert.equal(sent[sent.length - 1].q, 'off=1200');
  assert.equal(r.state.gaps, 0);
  await r.chunk({ frame: 9999, data: new ArrayBuffer(400) });
  assert.equal(r.state.gaps, 1, 'a jump in frames is counted');
  // at page hide, what waits goes in one beacon at the right offset
  const q2 = R.createRecorder({ ctx: { sampleRate: 48000 }, post: async () => { throw new Error('down'); }, retryMs: 60e3 });
  await q2.chunk({ frame: 0, data: new ArrayBuffer(8) });
  await q2.chunk({ frame: 2, data: new ArrayBuffer(8) });
  const beacons = [];
  assert.equal(q2.stop((q, body) => { beacons.push({ q, n: body.byteLength }); return true; }), true);
  assert.deepEqual(beacons, [{ q: 'off=0&sr=48000&ch=2&start=0', n: 16 }]);
  clearTimeout(q2.state.retry);
});

test('conduct-serve /rec/<session>: the first chunk needs sr, ch, start; a valid WAV after every chunk; 409 with the size; the .wav.json', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-rec-')), sessions = path.join(root, 'sessions');
  const srv = http.createServer(S.createHandler({ tracksDir: path.join(root, 'tracks'), sessionsDir: sessions }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`, id = 'conductor-20261121-170000';
  const post = (q, body) => fetch(`${base}/rec/${id}?${q}`, { method: 'POST', body });
  try {
    assert.ok(S.BROWSER_MODULES.includes('conduct-rec.mjs'), 'the page imports it through the server');
    assert.equal((await post('off=0', Buffer.alloc(8))).status, 400, 'no sr, ch, start on the first chunk');
    assert.equal(fs.existsSync(path.join(sessions, `${id}.wav`)), false);
    let r = await post('off=0&sr=48000&ch=2&start=12.5', Buffer.alloc(8));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, size: 8, seconds: 0 });
    const side = JSON.parse(fs.readFileSync(path.join(sessions, `${id}.wav.json`), 'utf8'));
    assert.deepEqual(side, { version: 1, session: id, file: `${id}.wav`, format: 's16le', sampleRate: 48000, channels: 2, startCtx: 12.5 });
    r = await post('off=8', Buffer.from(Int16Array.from([1, 2, 3, 4]).buffer));
    assert.equal(r.status, 200);
    r = await post('off=8', Buffer.from(Int16Array.from([1, 2, 3, 4]).buffer));
    assert.equal(r.status, 409, 'a chunk sent again');
    assert.equal((await r.json()).size, 16);
    assert.equal((await post('off=16', Buffer.alloc(3))).status, 400, 'whole frames only');
    const wav = fs.readFileSync(path.join(sessions, `${id}.wav`));
    assert.equal(wav.length, 44 + 16);
    assert.deepEqual([wav.toString('ascii', 0, 4), wav.readUInt32LE(4), wav.readUInt32LE(24), wav.readUInt16LE(22), wav.readUInt32LE(40)], ['RIFF', 36 + 16, 48000, 2, 16]);
    assert.deepEqual([wav.readInt16LE(52), wav.readInt16LE(54), wav.readInt16LE(56), wav.readInt16LE(58)], [1, 2, 3, 4]);
    assert.deepEqual(await (await fetch(`${base}/rec/${id}`)).json(), side, 'GET: the .wav.json');
    assert.equal((await fetch(`${base}/rec/not-a-session`, { method: 'POST', body: 'x' })).status, 404);
  } finally {
    if (srv.closeAllConnections) srv.closeAllConnections();
    await new Promise(r => srv.close(() => r()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
