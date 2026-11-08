// #188 PR1b, Q10: only a same-origin POST /log of JSON lines ≤ 64 KB is taken; the request log turns into one row.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

const P = await import('../privacy.mjs');
const O = 'http://127.0.0.1:5555';
const post = (x = {}) => ({ method: 'POST', path: '/log', origin: O, serverOrigin: O, contentType: 'application/json', ...x });
const body = s => ({ body: s, bytes: Buffer.byteLength(s) });

test('checkLogPost: a same-origin POST /log of JSON lines is ok', () => {
  const c = P.checkLogPost(post(body('{"t":1}\n{"t":2,"k":"fix"}\n')));
  assert.deepEqual(c, { ok: true, reason: null, lines: 2 });
  assert.equal(P.checkLogPost(post({ contentType: 'application/x-ndjson; charset=utf-8', ...body('{"a":1}') })).ok, true);
});

test('checkLogPost: the 64 KB edge, exactly LOG_MAX is ok and one byte more is not', () => {
  const line = n => JSON.stringify({ pad: 'x'.repeat(n - 11) }) + '\n';   // {"pad":"…"}\n is n bytes
  const at = line(P.LOG_MAX);
  assert.equal(Buffer.byteLength(at), P.LOG_MAX);
  assert.equal(P.checkLogPost(post(body(at))).ok, true);
  const over = line(P.LOG_MAX + 1);
  const c = P.checkLogPost(post(body(over)));
  assert.equal(c.ok, false);
  assert.match(c.reason, /65537 bytes > 65536/);
});

test('checkLogPost: bad JSON, other paths, methods, origins and types are refused', () => {
  const no = (x, re) => { const c = P.checkLogPost(post(x)); assert.equal(c.ok, false, JSON.stringify(x)); assert.match(c.reason, re); };
  no(body('{"ok":1}\nnot json\n'), /line 2 is not JSON/);
  no(body('{"ok":1'), /line 1 is not JSON/);
  no({ ...body('{}'), path: '/upload' }, /POST to \/upload/);
  no({ ...body('{}'), method: 'PUT' }, /PUT is not allowed/);
  no({ ...body('{}'), origin: 'http://evil.example' }, /origin http:\/\/evil.example/);
  no({ ...body('{}'), origin: null }, /origin missing/);
  no({ ...body('{}'), contentType: 'text/plain' }, /content type text\/plain/);
  no({ ...body('{}'), contentType: 'multipart/form-data; boundary=x' }, /content type multipart\/form-data/);
  no(body(''), /empty body/);
  no(body('\n\n'), /no JSON lines/);
});

test('handleWrite: a real server takes the good POST, refuses the rest with the right status, and logs each', async () => {
  const log = [], got = [];
  let origin = null;
  const server = http.createServer((req, res) => {
    if (P.handleWrite(req, res, { serverOrigin: origin, record: e => log.push(e), onLines: t => got.push(t) })) return;
    res.writeHead(200); res.end('file');
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${server.address().port}`;
  const send = (p, opts) => fetch(origin + p, opts);
  try {
    let r = await send('/log', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{"k":"pair","t":5}' });
    assert.equal(r.status, 204);
    assert.deepEqual(got, ['{"k":"pair","t":5}\n']);
    r = await send('/log', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{"pad":"' + 'x'.repeat(P.LOG_MAX) + '"}' });
    assert.equal(r.status, 413);
    r = await send('/log', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: 'nope' });
    assert.equal(r.status, 400);
    r = await send('/log', { method: 'POST', headers: { origin: 'http://evil.example', 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 403);
    r = await send('/other', { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{}' });
    assert.equal(r.status, 405);
    r = await send('/x.html');
    assert.equal(await r.text(), 'file', 'GET falls through to the file server');
    assert.equal(got.length, 1, 'only the good POST reached onLines');
    assert.deepEqual(log.map(e => [e.status, e.ok]), [[204, true], [413, false], [400, false], [403, false], [405, false]]);
    assert.ok(log.every(e => e.type === 'http' && e.method === 'POST'));
  } finally { server.close(); }
});

test('privacyRow: clean logs pass; a bad write, another origin or a WebSocket fails the row', () => {
  const ok = [{ type: 'http', method: 'GET', path: '/clock-conductor.html', ok: true },
    { type: 'http', method: 'POST', path: '/log', ok: true, bytes: 120, lines: 2 },
    { type: 'http', method: 'POST', path: '/log', ok: true, bytes: 300, lines: 3 }];
  const r = P.privacyRow(ok);
  assert.equal(r.ok, true);
  assert.match(r.value, /2 POST \/log \(420 bytes, max 300\) · 1 GET\/HEAD · no other origin, no WebSocket/);
  assert.equal(P.privacyRow([]).ok, true, 'a page that sends nothing passes');
  const bad = P.privacyRow([...ok, { type: 'http', method: 'POST', path: '/upload', ok: false, reason: 'POST to /upload (only /log)', bytes: 2 }]);
  assert.equal(bad.ok, false);
  assert.match(bad.value, /POST \/upload: POST to \/upload/);
  const other = P.privacyRow([...ok, { type: 'request', origin: 'https://fonts.example' }]);
  assert.equal(other.ok, false);
  assert.match(other.value, /1 request\(s\) to https:\/\/fonts.example/);
  const ws = P.privacyRow([...ok, { type: 'ws', url: 'ws://127.0.0.1:9/x' }]);
  assert.equal(ws.ok, false);
  assert.match(ws.value, /1 WebSocket/);
});
