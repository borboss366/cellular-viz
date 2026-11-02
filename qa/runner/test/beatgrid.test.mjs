// #173 (#95 comment 6564285787): Beat This! is the gridder; qa/beatgrid.mjs turns its .ref.beats into the clock's
// sidecar v2. Hard gate: six synthetic Beat This! grids go through the converter and the clock's file: source, and
// every grid beat is heard within 1 ms of its time with the bar position Beat This! gave it. Plus the hand edits:
// replayed on top, kept across re-conversion, orphans kept and listed, never dropped.
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseRefBeats, toSidecar, replayEdits, convertFile, ensureGrids } from '../../beatgrid.mjs';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');

// ---------- the clock with a fake AudioContext (as clock-file.test.mjs) ----------
function fakeContext(outputLatency = 0.02) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect() {}, disconnect() {}, ...extra });
  const ctx = {
    currentTime: 0, sampleRate: 64, outputLatency, baseLatency: 0.005, destination: {}, started: [],
    resume() {},
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ frequency: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, start(at, off) { ctx.started.push([at, off]); }, stop() {} }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }),
    createAnalyser: () => node({ fftSize: 0, getFloatTimeDomainData() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
  return ctx;
}
const LAT = 0.02;
function fileRig(grid, duration) {
  const ctx = fakeContext(LAT);
  const settings = { bpm: 120, bpb: 4, muted: false, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' };
  const c = Clock.create({ source: 'file:grid.wav', settings, audioContext: () => ctx, timers: false, pump: true, keys: false,
    now: () => ctx.currentTime * 1000, fileData: { buffer: { duration }, grid } });
  return { ctx, c };
}

// ---------- six synthetic Beat This! outputs (time<TAB>beat-in-bar) ----------
const tsv = rows => rows.map(([t, n]) => `${t.toFixed(5)}\t${n}`).join('\n') + '\n';
function steady(bpm, secs, t0 = 0.31, bpb = 4, first = 1) {
  const rows = []; const p = 60 / bpm;
  for (let k = 0; t0 + k * p <= secs; k++) rows.push([t0 + k * p, ((first - 1 + k) % bpb) + 1]);
  return rows;
}
const ramp = () => {   // 124 → 128 over 60–120 s, as #95 T0(c)
  const sec = k => k < 124 ? k * 60 / 124 : k < 250 ? 60 + 15 * (Math.sqrt(15376 + 8 * (k - 124)) - 124) : 120 + (k - 250) * 60 / 128;
  const rows = []; for (let k = 0; sec(k) <= 140; k++) rows.push([0.312 + sec(k), (k % 4) + 1]); return rows;
};
const shifted = () => {   // the "1" moves one beat later at 90 s (an incoming track's downbeat), as Beat This! reports it
  const rows = []; const p = 60 / 124; let shiftAt = null;
  for (let k = 0; k * p <= 120; k++) { const t = k * p; if (shiftAt === null && t >= 90) shiftAt = k; rows.push([0.2 + t, shiftAt === null ? (k % 4) + 1 : (((k - 1) % 4) + 4) % 4 + 1]); }
  return rows;
};
const irregular = () => {   // a 2-beat bar inside 4/4 (a DJ cut), kept as given
  const p = 60 / 126, pattern = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 1, 2, 3, 4, 1, 2, 3, 4];
  const rows = []; for (let r = 0; r < 6; r++) pattern.forEach((n, i) => rows.push([0.15 + (r * pattern.length + i) * p, n])); return rows;
};
const pickup = () => steady(132, 60, 0.4, 4, 3);   // an anacrusis: the track starts on beat 3
const jitter = () => {   // Beat This!-like ±8 ms wobble around 140 BPM, non-uniform intervals
  const rows = []; const p = 60 / 140; let s = 7;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  for (let k = 0; k * p <= 60; k++) rows.push([0.5 + k * p + (rnd() - 0.5) * 0.016, (k % 4) + 1]);
  return rows;
};
const GRIDS = { 'steady-128': () => steady(128, 90), 'ramp-124-128': ramp, 'downbeat-shift': shifted, 'irregular-bar': irregular, pickup, 'jitter-140': jitter };

for (const [name, make] of Object.entries(GRIDS)) {
  test(`converter + clock file: (${name}): every beat heard within 1 ms of its grid time, with Beat This!'s bar position`, () => {
    const rows = make(), ref = parseRefBeats(tsv(rows));
    assert.equal(ref.length, rows.length);
    const side = toSidecar(ref);
    assert.equal(side.version, 2);
    assert.ok(side.beats.every(b => b.conf === 1), 'conf is 1.0 on every beat (Beat This! gives none)');
    side.beats.forEach((b, k) => { assert.ok(Math.abs(b.ms - rows[k][0] * 1000) < 0.001); assert.equal(b.pos, rows[k][1]); });
    const { ctx, c } = fileRig(JSON.parse(JSON.stringify(side)), rows.at(-1)[0] + 2);
    c.start();
    const seg = c.file.seg;
    let worst = 0;
    for (let k = 0; k < side.beats.length; k++) {
      worst = Math.max(worst, Math.abs(c.beatTime(k) - (seg.at + side.beats[k].ms / 1000)));
      ctx.currentTime = c.beatTime(k) + LAT + 0.004;   // 4 ms after beat k is heard
      const r = c.read({ raw: true });
      assert.equal(Math.floor(r.beats), k, `${name}: beat ${k}`);
      assert.equal(r.beatInBar, side.beats[k].pos, `${name}: beat ${k} bar position`);
    }
    assert.ok(worst < 0.001, `${name}: worst beat ${(worst * 1000).toFixed(4)} ms off its grid time`);
  });
}

test('edits: move, setOne and nudge replay on top; x2 is kept unapplied; an edit with no beat within ±60 ms is orphaned, never dropped', () => {
  const ref = parseRefBeats(tsv(steady(120, 20, 0)));   // beats every 500 ms from 0
  const edits = [
    { kind: 'move', atMs: 1010, value: 1030, by: 'user' },     // beat 2 (1000 ms) → 1030
    { kind: 'setOne', atMs: 3000, by: 'user' },                // beat 6 becomes a "1"
    { kind: 'nudge', atMs: 8000, value: -5, toMs: 9000, by: 'user' },   // beats 16–18 earlier by 5 ms
    { kind: 'x2', atMs: 5000, by: 'user' },                    // the grid editor's, not the converter's
    { kind: 'move', atMs: 2250, value: 2260, by: 'user' },     // 250 ms from any beat: orphaned
  ];
  const side = toSidecar(ref, { edits });
  assert.equal(side.beats[2].ms, 1030);
  assert.deepEqual(side.beats.slice(6, 11).map(b => b.pos), [1, 2, 3, 4, 1]);
  assert.deepEqual(side.beats.slice(15, 20).map(b => b.ms), [7500, 7995, 8495, 8995, 9500]);
  assert.equal(side.beats[10].ms, 5000, 'x2 not applied');
  assert.equal(side.edits.length, 5, 'every edit kept');
  assert.deepEqual(side.orphaned.map(e => e.atMs), [2250]);
  // a move may not pass a neighbour: kept, listed, not applied
  const bad = toSidecar(ref, { edits: [{ kind: 'move', atMs: 1000, value: 1600, by: 'user' }] });
  assert.equal(bad.beats[2].ms, 1000); assert.equal(bad.orphaned.length, 1);
  assert.deepEqual(replayEdits([], [{ kind: 'setOne', atMs: 0 }]).length, 1);
});

test('re-conversion keeps the sidecar\'s edits; ensureGrids converts only missing or older sidecars', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatgrid-'));
  try {
    const ref = path.join(dir, 'darude-sandstorm.ref.beats'), out = path.join(dir, 'darude-sandstorm.beatgrid.json');
    fs.writeFileSync(ref, tsv(steady(136.4, 30)));
    assert.deepEqual(ensureGrids(dir).map(r => r.name), ['darude-sandstorm']);
    assert.deepEqual(ensureGrids(dir), [], 'up to date: nothing converted');
    const side = JSON.parse(fs.readFileSync(out, 'utf8'));
    side.edits.push({ kind: 'setOne', atMs: side.beats[5].ms, by: 'user' });
    fs.writeFileSync(out, JSON.stringify(side));
    const t = new Date(Date.now() + 5000); fs.utimesSync(ref, t, t);   // a newer Beat This! run
    assert.equal(ensureGrids(dir).length, 1);
    const again = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(again.edits.length, 1, 'the user edit survived the re-conversion');
    assert.equal(again.beats[5].pos, 1, 'and was replayed');
    assert.equal(again.source.from, 'beat-this');
    assert.deepEqual(fs.readdirSync(dir).sort(), ['darude-sandstorm.beatgrid.json', 'darude-sandstorm.ref.beats'], 'no temp files left');
    assert.equal(convertFile(ref).beats.length, again.beats.length);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
