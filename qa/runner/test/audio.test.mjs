// Unit tests for the real-track helpers (audio.mjs) and skipped gates. No browser, no network, no real audio.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';

const A = await import('../audio.mjs');
const E = await import('../experiment.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audio-test-'));
const dir = path.join(tmp, 'tracks');
fs.mkdirSync(dir);

// a FLAC header with STREAMINFO at 44.1 kHz (sample rate is 20 bits at byte 18 of the file)
function flacBytes() {
  const b = Buffer.alloc(64);
  b.write('fLaC', 0, 'latin1');
  const sr = 44100;
  b[18] = (sr >> 12) & 0xff; b[19] = (sr >> 4) & 0xff; b[20] = (sr & 0x0f) << 4;
  return b;
}
// an MP3 first frame with a LAME tag: delay 576, padding 1234
function mp3Bytes() {
  const b = Buffer.alloc(256);
  b.write('LAME3.100', 100, 'latin1');
  const o = 100 + 21, delay = 576, padding = 1234;
  b[o] = delay >> 4; b[o + 1] = ((delay & 0x0f) << 4) | (padding >> 8); b[o + 2] = padding & 0xff;
  return b;
}
// an M4A with an iTunSMPB atom: priming 0x840 = 2112, padding 0x1CA = 458
function m4aBytes() {
  return Buffer.concat([Buffer.alloc(32), Buffer.from('----mean....com.apple.iTunes....name....iTunSMPB....data........ 00000000 00000840 000001CA 00000000003F31F6 00000000', 'latin1')]);
}
fs.writeFileSync(path.join(dir, 'darude-sandstorm.flac'), flacBytes());
fs.writeFileSync(path.join(dir, 'darude-sandstorm.mp3'), mp3Bytes());   // the .flac wins
fs.writeFileSync(path.join(dir, 'prodigy-voodoo-people.mp3'), mp3Bytes());
fs.writeFileSync(path.join(dir, 'massive-attack-teardrop.m4a'), m4aBytes());
fs.writeFileSync(path.join(dir, 'not-a-track.flac'), flacBytes());
fs.writeFileSync(path.join(tmp, 'secret.flac'), flacBytes());           // outside the folder

test('audioDir: explicit, then $QA_AUDIO_DIR, then the default', () => {
  const old = process.env.QA_AUDIO_DIR;
  try {
    delete process.env.QA_AUDIO_DIR;
    assert.equal(A.audioDir(), A.AUDIO_DIR_DEFAULT);
    process.env.QA_AUDIO_DIR = dir;
    assert.equal(A.audioDir(), dir);
    assert.equal(A.audioDir(tmp), tmp);
    process.env.QA_AUDIO_DIR = '';
    assert.equal(A.audioDir(), A.AUDIO_DIR_DEFAULT);
  } finally { if (old === undefined) delete process.env.QA_AUDIO_DIR; else process.env.QA_AUDIO_DIR = old; }
});

test('findTrack: fixed names only, .flac before .wav/.m4a/.mp3, no paths', () => {
  assert.equal(A.findTrack('darude-sandstorm', dir).file, 'darude-sandstorm.flac');
  assert.equal(A.findTrack('darude-sandstorm.mp3', dir).file, 'darude-sandstorm.mp3');
  assert.equal(A.findTrack('prodigy-voodoo-people', dir).ext, '.mp3');
  assert.equal(A.findTrack('james-brown', dir), null);                  // not copied yet
  assert.equal(A.findTrack('not-a-track', dir), null);                  // not one of the fixed names
  assert.equal(A.findTrack('../secret', dir), null);
  assert.equal(A.findTrack('../secret.flac', dir), null);
  assert.equal(A.findTrack(null, dir), null);
  assert.equal(A.findTrack('darude-sandstorm', path.join(tmp, 'nowhere')), null);   // the folder doesn't exist yet
});

test('scanTracks lists present and missing names', () => {
  const s = A.scanTracks(dir);
  assert.deepEqual(s.present, ['darude-sandstorm', 'prodigy-voodoo-people', 'massive-attack-teardrop']);
  assert.deepEqual(s.missing, ['james-brown']);
  assert.deepEqual(A.scanTracks(path.join(tmp, 'nowhere')).missing, A.TRACKS);
});

test('encoder delay: LAME tag, iTunSMPB, edit list', () => {
  assert.deepEqual(A.lameDelay(mp3Bytes()), { delay: 576, padding: 1234, from: 'LAME tag' });
  assert.equal(A.lameDelay(Buffer.alloc(64)), null);
  assert.deepEqual(A.m4aDelay(m4aBytes()), { delay: 2112, padding: 458, from: 'iTunSMPB' });
  const elst = Buffer.alloc(40);   // ....elst, version 0, flags, 1 entry, segment duration, media time 1024
  elst.write('elst', 4, 'latin1'); elst[8] = 0; elst.writeUInt32BE(1, 12); elst.writeUInt32BE(5000, 16); elst.writeInt32BE(1024, 20);
  assert.equal(A.m4aDelay(elst).delay, 1024);
  assert.equal(A.m4aDelay(Buffer.alloc(64)), null);
});

test('trackInfo: name, file, sha256, sample rate, delay for lossy ones; missing ones say so', async () => {
  const f = await A.trackInfo('darude-sandstorm', dir);
  assert.equal(f.file, 'darude-sandstorm.flac');
  assert.equal(f.sha256, crypto.createHash('sha256').update(flacBytes()).digest('hex'));
  assert.equal(f.sampleRate, 44100);
  assert.equal(f.lossy, false);
  assert.equal(f.encoderDelay, null);
  assert.equal('path' in f, false);   // reports never carry the folder
  const m = await A.trackInfo('prodigy-voodoo-people', dir);
  assert.equal(m.lossy, true);
  assert.equal(m.encoderDelay.delay, 576);
  assert.deepEqual(await A.trackInfo('james-brown', dir), { name: 'james-brown', missing: true });
  assert.match(A.describe([f, m, { name: 'james-brown', missing: true }]), /darude-sandstorm\.flac sha256 [0-9a-f]{12} 44100 Hz · prodigy-voodoo-people\.mp3 .* encoder delay 576 samples \(LAME tag\) · james-brown: missing/);
});

test('tracksUsed: params, variants, sweep values and gate tracks', () => {
  const exp = { params: { track: 'darude-sandstorm' }, variants: [{ name: 'a', params: { track: 'james-brown' } }, { name: 'b', params: {} }],
    sweep: { track: ['prodigy-voodoo-people', 'nope'] }, gates: [{ metric: 'fps', min: 1, track: 'massive-attack-teardrop' }] };
  assert.deepEqual(A.tracksUsed(exp).sort(), [...A.TRACKS].sort());
  assert.deepEqual(A.tracksUsed({ params: {}, variants: [], gates: [] }), []);
});

test('gate.track validates against the fixed names', () => {
  const base = { version: 1, id: '13-flow-lab', seconds: 5 };
  assert.deepEqual(E.validate({ ...base, gates: [{ metric: 'fps', min: 1, track: 'darude-sandstorm' }] }).errors, []);
  assert.ok(E.validate({ ...base, gates: [{ metric: 'fps', min: 1, track: 'some-song' }] }).errors.some(e => e.includes('.track')));
});

test('gates on a missing track are skipped, not failed, and render as ℹ️', () => {
  const { exp } = E.validate({ version: 1, id: '13-flow-lab', seconds: 5,
    variants: [{ name: 'sand', params: { track: 'darude-sandstorm' } }, { name: 'jb', params: { track: 'james-brown' } }],
    gates: [{ metric: 'fps', min: 50, variant: 'sand' }, { metric: 'fps', min: 50, variant: 'jb' }, { metric: 'fps', min: 50, track: 'james-brown' }] });
  const size = { name: '1080p', w: 1920, h: 1080 };
  const runs = [{ label: 'sand@1080p', variant: 'sand', base: 'sand', size, metrics: { fps: 60 }, values: {} },
    { label: 'jb@1080p', variant: 'jb', base: 'jb', size, skipped: 'james-brown', metrics: {}, values: {} }];
  const g = E.evalGates(exp, runs, { missing: ['james-brown'] });
  assert.equal(g[0].ok, true);
  assert.equal(g[1].ok, null); assert.equal(g[1].skipped, true); assert.match(g[1].value, /skipped: track missing \(james-brown\)/);
  assert.equal(g[2].skipped, true);
  const md = E.checkMd('t', g);
  assert.match(md, /\| fps ≥ 50 \(jb\) \| ℹ️ \| skipped: track missing/);
  assert.equal(E.gatesFromMd(md).length, 1);   // qa/builds.mjs only gates ✅/❌ rows: the skipped ones never fail a build
});

test('serveAudio: /qa-audio/<fixed name> only, with Range; everything else falls through', async () => {
  const server = http.createServer((req, res) => { if (!A.serveAudio(req, res, dir)) { res.writeHead(418); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let r = await fetch(`${base}/qa-audio/darude-sandstorm`);
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/flac');
    assert.equal(Buffer.from(await r.arrayBuffer()).length, 64);
    r = await fetch(`${base}/qa-audio/darude-sandstorm`, { headers: { range: 'bytes=4-7' } });
    assert.equal(r.status, 206);
    assert.equal(r.headers.get('content-range'), 'bytes 4-7/64');
    assert.equal((await r.arrayBuffer()).byteLength, 4);
    r = await fetch(`${base}/qa-audio/james-brown`); assert.equal(r.status, 404); await r.text();
    r = await fetch(`${base}/qa-audio/..%2Fsecret.flac`); assert.equal(r.status, 404); await r.text();
    r = await fetch(`${base}/qa-audio/not-a-track`); assert.equal(r.status, 404); await r.text();
    r = await fetch(`${base}/13-flow-lab.html`); assert.equal(r.status, 418); await r.text();
  } finally { server.close(); }
});
