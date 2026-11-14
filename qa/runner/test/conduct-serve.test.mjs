// The conductor page's server and session log (#188 Task 1): qa/conduct-serve.mjs serves the page, the tracks (Range),
// their grids and takes the log line by line, refusing lines that don't fit schema v1; qa/conduct-log.mjs writes
// records the scorer's parseLog reads. A temp tracks folder with fake bytes; no browser, no real audio.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import * as S from '../../conduct-serve.mjs';
import * as L from '../../conduct-log.mjs';
import { markRecord, snapMark } from '../../marks.mjs';
import { parseLog } from '../../conduct-score.mjs';

/** a temp data folder: tracks/ (two sources, a render, a non-audio file), corpus-map.json beside, sessions/ */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-')), tracks = path.join(root, 'tracks');
  fs.mkdirSync(path.join(tracks, 'renders'), { recursive: true });
  fs.writeFileSync(path.join(tracks, 'artist-a.flac'), Buffer.from(Array.from({ length: 1000 }, (_, i) => i % 251)));
  fs.writeFileSync(path.join(tracks, 'artist-b.wav'), Buffer.alloc(64, 7));
  fs.writeFileSync(path.join(tracks, 'artist-a.beatgrid.json'), JSON.stringify({ version: 2, beats: [{ ms: 250 }, { ms: 750 }] }));
  fs.writeFileSync(path.join(tracks, 'notes.txt'), 'x');
  fs.writeFileSync(path.join(tracks, 'renders', 'mix-a-b-a.wav'), Buffer.alloc(32, 1));
  fs.writeFileSync(path.join(tracks, 'renders', 'mix-a-b-a.beatgrid.json'), JSON.stringify({ version: 2, beats: [], derived: true }));
  fs.writeFileSync(path.join(root, 'corpus-map.json'), JSON.stringify({ version: 1, tracks: { 'track-a': 'artist-a' } }));
  return { root, tracks, sessions: path.join(root, 'sessions') };
}
async function withServer(fx, fn) {
  const srv = http.createServer(S.createHandler({ tracksDir: fx.tracks, sessionsDir: fx.sessions }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try { await fn(base); } finally { await new Promise(r => srv.close(r)); fs.rmSync(fx.root, { recursive: true, force: true }); }
}

test('conduct-log: schema v1 records with ctx from the audio clock, a session head, failed posts kept for the next flush', async () => {
  let t = 1.25;
  const sent = [];
  let fail = true;
  const log = new L.ConductLog({ id: 'conductor-20261109-160000', now: () => t, post: async body => { if (fail) throw new Error('offline'); sent.push(body); } });
  log.add('track', { idx: 0, event: 'play', id: 'track-a', posMs: 0 });
  t = 2.5;
  log.add('beat', { src: 'clock', beatInBar: 1, ctx: 2.75 });
  assert.equal(log.all[0].type, 'session');
  assert.deepEqual([log.all[1].ctx, log.all[2].ctx], [1.25, 2.75], 'now() unless the record carries its own ctx');
  assert.throws(() => log.add('nonsense', {}), /log type/);
  assert.equal(await log.flush(), 0, 'offline: nothing sent');
  assert.equal(log.pending.length, 3, 'kept for the next flush');
  fail = false;
  assert.equal(await log.flush(), 3);
  assert.equal(log.pending.length, 0);
  assert.deepEqual(parseLog(sent.join('')).map(r => r.type), ['session', 'track', 'beat'], 'the scorer parses what the page sends');
  assert.match(L.sessionId(new Date(2026, 10, 9, 16, 5, 7)), /^conductor-20261109-160507$/);
  assert.throws(() => new L.ConductLog({ id: '../etc' }), /session id/);
});

test('conduct-serve /api/tracks: sources then built mixes, corpus ids from the map, grid flags, no paths', async () => {
  const fx = fixture();
  await withServer(fx, async base => {
    const list = await (await fetch(`${base}/api/tracks`)).json();
    assert.deepEqual(list.map(t => [t.idx, t.label, t.id, t.kind, t.grid]),
      [[0, 'artist-a', 'track-a', 'track', true], [1, 'artist-b', null, 'track', false], [2, 'mix-a-b-a', 'mix-a-b-a', 'mix', true]]);
    assert.ok(!JSON.stringify(list).includes(fx.root), 'no folder in the list');
  });
});

test('conduct-serve /audio and /grid: bytes with Range (206, suffix, 416), HEAD, 404 for a missing grid or track', async () => {
  const fx = fixture();
  await withServer(fx, async base => {
    const all = Buffer.from(await (await fetch(`${base}/audio/0`)).arrayBuffer());
    assert.equal(all.length, 1000);
    const r = await fetch(`${base}/audio/0`, { headers: { range: 'bytes=100-199' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), 'bytes 100-199/1000');
    assert.deepEqual(Buffer.from(await r.arrayBuffer()), all.subarray(100, 200));
    const tail = await fetch(`${base}/audio/0`, { headers: { range: 'bytes=-10' } });
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), all.subarray(990));
    assert.equal((await fetch(`${base}/audio/0`, { headers: { range: 'bytes=2000-2100' } })).status, 416);
    const head = await fetch(`${base}/audio/1`, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '64');
    assert.equal((await (await fetch(`${base}/grid/0`)).json()).beats.length, 2);
    assert.equal((await fetch(`${base}/grid/1`)).status, 404, 'no grid for that track');
    assert.equal((await fetch(`${base}/audio/9`)).status, 404);
  });
});

test('conduct-serve static: / → the page, experiments/ files, only the browser-safe qa modules, no traversal', async () => {
  const fx = fixture();
  await withServer(fx, async base => {
    const root = await fetch(`${base}/`, { redirect: 'manual' });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get('location'), '/experiments/clock-conductor.html');
    const clock = await fetch(`${base}/experiments/clock.js`);
    assert.equal(clock.status, 200);
    assert.match(clock.headers.get('content-type'), /javascript/);
    assert.equal((await fetch(`${base}/qa/marks.mjs`)).status, 200);
    assert.equal((await fetch(`${base}/qa/conduct-log.mjs`)).status, 200);
    for (const p of ['/qa/conduct-score.mjs', '/qa/corpus.json', '/experiments/..%2Fqa%2Fcorpus.json', '/experiments/%2e%2e/qa/corpus.json', '/tracks/artist-a.flac']) {
      assert.equal((await fetch(`${base}${p}`)).status, 404, p);
    }
  });
});

test('conduct-serve /log: schema v1 lines appended and read back; a bad line is refused whole; bad session ids are 404', async () => {
  const fx = fixture();
  await withServer(fx, async base => {
    const id = 'conductor-20261109-160000', url = `${base}/log/${id}`;
    let t = 0;
    const log = new L.ConductLog({ id, now: () => t, post: async body => {
      const r = await fetch(url, { method: 'POST', body });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } });
    log.add('latency', { outputLatency: 0.02, baseLatency: 0.005, clockLatency: 0.025, visualOffsetMs: 0, analysisDelayMs: 12, sampleRate: 48000 });
    log.add('track', { idx: 0, event: 'play', id: 'track-a', posMs: 0 });
    t = 5; log.add('pair', { idx: 0, posMs: 5000 });
    log.add('sample', { clock: { bpm: 120, conf: 0.9, state: 'locked' }, shadow: { bpm: 120, conf: 0.9, state: 'locked' } });
    log.add('fix', { id: 1, kind: 'flip', origin: 'key' });
    log.add('mark', markRecord(5.1, 0, snapMark({ beats: [{ ms: 4500 }, { ms: 5000 }, { ms: 5500 }] }, 'kickIn', 5080)));
    assert.equal(await log.flush(), 7);
    t = 6; log.add('beat', { src: 'shadow' });
    assert.equal(await log.flush(), 1);
    const back = await (await fetch(url)).text();
    assert.equal(back, log.toJsonl(), 'the server keeps exactly what the page logged');
    assert.equal(parseLog(back).find(r => r.type === 'mark').trackMs, 5000, 'the mark is snapped');
    const before = fs.readFileSync(path.join(fx.sessions, `${id}.jsonl`), 'utf8');
    const bad = await fetch(url, { method: 'POST', body: '{"type":"beat","ctx":7,"src":"clock"}\n{"type":"beat","ctx":8}\n' });
    assert.equal(bad.status, 400);
    assert.match((await bad.json()).lines[0], /line 2: beat: src missing/);
    assert.equal(fs.readFileSync(path.join(fx.sessions, `${id}.jsonl`), 'utf8'), before, 'nothing of a refused post is written');
    assert.equal((await fetch(`${base}/log/..%2Fevil`, { method: 'POST', body: '' })).status, 404);
    assert.deepEqual(S.checkLines('{"type":"key","ctx":1,"shown":false}\n\n'), []);
  });
});

test('conduct-serve --socket: a stale file at the path is replaced, the socket is 0600 and serves the page and the API', async () => {
  const fx = fixture(), sock = path.join(fx.root, 'conductor.sock');
  fs.writeFileSync(sock, 'left by a crash');
  const srv = http.createServer(S.createHandler({ tracksDir: fx.tracks, sessionsDir: fx.sessions }));
  const get = p => new Promise((resolve, reject) => {
    http.get({ socketPath: sock, path: p }, res => { let b = ''; res.on('data', d => { b += d; }); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: b })); }).on('error', reject);
  });
  try {
    assert.equal(await S.listenSocket(srv, sock), sock);
    const st = fs.lstatSync(sock);
    assert.ok(st.isSocket(), 'a socket now, not the stale file');
    assert.equal(st.mode & 0o777, 0o600, 'only the owner (the host proxy runs as the same user)');
    const tracks = await get('/api/tracks');
    assert.equal(tracks.status, 200);
    assert.ok(JSON.parse(tracks.body).length >= 2, 'the tracks list comes over the socket');
    const root = await get('/');
    assert.ok(root.status === 200 || (root.status >= 300 && root.status < 400), `/ answers (${root.status})`);
  } finally {
    await new Promise(r => srv.close(r));
    fs.rmSync(fx.root, { recursive: true, force: true });
  }
});

test('conduct-serve by stem (14 Nov: hc-09 logged while another track played): a file added after the list was read never answers for the old place', async () => {
  const fx = fixture();
  const A = Buffer.alloc(40, 0xa), B = Buffer.alloc(50, 0xb), Cc = Buffer.alloc(60, 0xc);
  for (const f of fs.readdirSync(fx.tracks)) if (f !== 'renders') fs.rmSync(path.join(fx.tracks, f), { recursive: true, force: true });
  fs.rmSync(path.join(fx.tracks, 'renders'), { recursive: true, force: true });
  fs.writeFileSync(path.join(fx.tracks, 'a.wav'), A);
  fs.writeFileSync(path.join(fx.tracks, 'c.wav'), Cc);
  fs.writeFileSync(path.join(fx.tracks, 'c.beatgrid.json'), JSON.stringify({ version: 2, beats: [{ ms: 100 }] }));
  await withServer(fx, async base => {
    const list = await (await fetch(`${base}/api/tracks`)).json();
    assert.deepEqual(list.map(t => [t.idx, t.label]), [[0, 'a'], [1, 'c']], 'c is idx 1');
    fs.writeFileSync(path.join(fx.tracks, 'b.wav'), B);   // the folder changes after the page read its list
    const byPlace = await fetch(`${base}/audio/1?stem=c`);
    assert.equal(byPlace.status, 409, 'the place moved: track list changed, never b');
    assert.equal((await byPlace.json()).error, 'track list changed');
    assert.equal((await fetch(`${base}/grid/1?stem=c`)).status, 409);
    const byStem = await fetch(`${base}/audio/s/c`);
    assert.equal(byStem.status, 200);
    assert.equal(byStem.headers.get('x-track-stem'), 'c');
    assert.deepEqual(Buffer.from(await byStem.arrayBuffer()), Cc, '/audio/s/c is c');
    const grid = await fetch(`${base}/grid/s/c`);
    assert.equal(grid.headers.get('x-track-stem'), 'c');
    assert.deepEqual((await grid.json()).beats, [{ ms: 100 }], '/grid/s/c is c\'s grid');
    const plain = await fetch(`${base}/audio/1`);
    assert.equal(plain.headers.get('x-track-stem'), 'b', 'without ?stem= the place answers, and says which track it sent');
    assert.deepEqual(Buffer.from(await plain.arrayBuffer()), B);
    assert.equal((await fetch(`${base}/audio/2?stem=c`)).status, 200, 'the new place with the right stem');
    assert.equal((await fetch(`${base}/audio/s/nope`)).status, 404);
    assert.equal((await fetch(`${base}/audio/s/c`, { headers: { range: 'bytes=0-9' } })).status, 206, 'Range by stem too');
  });
});
