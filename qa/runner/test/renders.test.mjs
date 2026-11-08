// #188 PR1b: the conductor truths' node renders (renders.mjs) and how audio.mjs serves them. No browser, no real audio.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';

const R = await import('../renders.mjs');
const A = await import('../audio.mjs');
const { readWav } = await import('../audiocheck.mjs');
const { validate } = await import('../experiment.mjs');

test('renderMetronome 128: an exact grid, one beat every 60/128 s from 0, pos 1-4, sidecar v2', () => {
  const r = R.renderMetronome(128, 20);
  assert.equal(r.name, 'metronome-128-20');
  const b = r.grid.beats, period = 60000 / 128;
  assert.equal(r.grid.version, 2);
  assert.equal(r.grid.source.from, 'render');
  assert.ok(b.length >= 40 && b.length <= 43, `${b.length} beats in 20 s at 128`);
  assert.ok(b[0].ms >= 0 && b[0].ms < 2, `first click at ${b[0].ms} ms (no marker lead)`);
  for (let i = 1; i < b.length; i++) assert.ok(Math.abs(b[i].ms - b[i - 1].ms - period) <= 1000 / R.SR + 1e-6, `gap ${i}`);
  assert.deepEqual(b.slice(0, 6).map(x => x.pos), [1, 2, 3, 4, 1, 2]);
  assert.ok(b.every(x => x.conf === 1));
  assert.equal(r.pcm.length, 2 * 20 * R.SR, 'stereo, len seconds, no lead');
});

test('the grid sits on the audio: each beat is the first sample at or above 0.05', () => {
  const r = R.renderMetronome(120, 4);
  for (const { ms } of r.grid.beats) {
    const i = Math.round(ms * R.SR / 1000);
    assert.ok(Math.abs(r.pcm[2 * i]) / 32768 >= 0.05 - 1e-3, `sample at ${ms} ms reaches the level`);
    assert.ok(Math.abs(r.pcm[2 * (i - 1)]) / 32768 < 0.05, `the sample before ${ms} ms is still under it`);
  }
});

test('playlistTimeline: Q7 is 120, a cut to 128 at 30 s, an 8 s crossfade to 120 with its midpoint at 56 s', () => {
  const t = R.playlistTimeline(R.PLAYLIST_120_128);
  assert.deepEqual(t.map(e => [e.track, e.startS, e.endS, e.midS]), [
    ['metronome-120-60', 0, 30, null],
    ['metronome-128-60', 30, 60, 30],
    ['metronome-120-60', 52, 82, 56],
  ]);
  assert.deepEqual(t.map(e => e.in && e.in.kind), [undefined, 'cut', 'crossfade'].map(k => k || null));
  const f = R.playlistFile(R.PLAYLIST_120_128);
  assert.deepEqual(f.timeline, t);
  assert.equal(f.name, 'playlist-120-128');
});

test('ensureRenders: writes the two metronomes, their grids and the playlist into renders/, once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renders-'));
  try {
    const small = { metronomes: [[120, 6], [128, 6]] };
    const made = R.ensureRenders(dir, small);
    assert.deepEqual(made.sort(), ['metronome-120-6.beatgrid.json', 'metronome-120-6.wav', 'metronome-128-6.beatgrid.json', 'metronome-128-6.wav', 'playlist-120-128.json']);
    const out = path.join(dir, 'renders');
    const w = readWav(fs.readFileSync(path.join(out, 'metronome-128-6.wav')));
    assert.equal(w.sampleRate, 48000);
    assert.equal(w.channels, 2);
    const g = JSON.parse(fs.readFileSync(path.join(out, 'metronome-128-6.beatgrid.json'), 'utf8'));
    assert.deepEqual(g, R.renderMetronome(128, 6).grid, 'the file holds the rendered grid');
    assert.deepEqual(R.ensureRenders(dir, small), [], 'a second call makes nothing');
    assert.deepEqual(fs.readdirSync(out).filter(f => f.includes('.tmp-')), [], 'no temp files left');
    for (const f of fs.readdirSync(out)) assert.equal(A.isRender(f), true, `${f} counts as a render (ref_beats.py skips it)`);
    assert.deepEqual(A.sourceTracks(dir), [], 'renders/ adds no source track');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('serveAudio: /qa-audio/renders/ serves only metronome-/playlist- .wav and .json, with Range', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renders-serve-'));
  R.ensureRenders(dir, { metronomes: [[128, 2]], playlists: [R.PLAYLIST_120_128] });
  fs.writeFileSync(path.join(dir, 'renders', 'secret.flac'), 'x');
  fs.writeFileSync(path.join(dir, 'private.flac'), 'x');
  const server = http.createServer((req, res) => { if (!A.serveAudio(req, res, dir)) { res.writeHead(418); res.end(); } });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/qa-audio/renders/`;
  try {
    let r = await fetch(base + 'metronome-128-2.wav');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/wav');
    assert.equal((await r.arrayBuffer()).byteLength, fs.statSync(path.join(dir, 'renders', 'metronome-128-2.wav')).size);
    r = await fetch(base + 'metronome-128-2.wav', { headers: { range: 'bytes=0-43' } });
    assert.equal(r.status, 206);
    assert.equal((await r.arrayBuffer()).byteLength, 44);
    r = await fetch(base + 'metronome-128-2.beatgrid.json');
    assert.equal(r.headers.get('content-type'), 'application/json');
    assert.equal((await r.json()).version, 2);
    r = await fetch(base + 'playlist-120-128.json');
    assert.equal((await r.json()).timeline.length, 3);
    for (const bad of ['secret.flac', '..%2Fprivate.flac', 'metronome-999-1.wav', '%2E%2E/private.flac'])
      assert.equal((await fetch(base + bad)).status, 404, bad);
  } finally { server.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

test('experiment fields: renders and privacy are booleans, off by default', () => {
  const base = { version: 1, id: '00-conductor', page: 'clock-truth', seconds: 0 };
  const ok = validate({ ...base, renders: true, privacy: true });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.exp.renders, true);
  assert.equal(ok.exp.privacy, true);
  const plain = validate(base);
  assert.equal(plain.exp.renders, false);
  assert.equal(plain.exp.privacy, false);
  assert.match(validate({ ...base, privacy: 'yes' }).errors.join(), /privacy must be true or false/);
});
