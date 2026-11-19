// 27 · EQ calibrate (the Sunday set's calibration scene, 19 Nov): the page's own arithmetic (experiments/27-eq.js) in
// node, and its wiring. The page in Chromium on the shared clock is eq27-smoke.test.mjs (box only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import * as A from '../../audition.mjs';
const require = createRequire(import.meta.url);
const EQ = require('../../../experiments/27-eq.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/27-eq-calibrate.html', import.meta.url), 'utf8');

// a fake clock's read() at time t: beats at bpm, the bar's beat 1..4
const fakeRead = (t, bpm) => { const beats = t * bpm / 60; return { beats, bpm, beatInBar: ((Math.floor(beats + 1e-9) % 4) + 4) % 4 + 1 }; };
function flashes(seconds, bpm, fps = 60) {
  const out = []; let last = null;
  for (let f = 0; f < seconds * fps; f++) {
    const F = EQ.flashOf(fakeRead(f / fps, bpm));
    if (F.beat !== null && F.env > 0 && F.beat !== last) { out.push({ t: f / fps, beat: F.beat, env: F.env, strong: F.strong }); last = F.beat; }
  }
  return out;
}

test('27 EQ: the flash fires on every beat of a fake clock, strongest on the 1, crisp (~90 ms), at most 3 a second', () => {
  const fl = flashes(4, 120);
  assert.deepEqual(fl.map(x => x.beat), [0, 1, 2, 3, 4, 5, 6, 7], 'one flash per beat');
  assert.deepEqual(fl.map(x => x.strong), [true, false, false, false, true, false, false, false], 'the 1 is strong');
  assert.equal(fl[0].env, 1); assert.equal(fl[1].env, EQ.WEAK);
  for (const x of fl) assert.ok(Math.abs(x.t - x.beat * 0.5) < 1e-9, 'on the beat');
  assert.equal(EQ.flashOf({ beats: 2 + 0.1 * 2, bpm: 120, beatInBar: 3 }).env, 0, 'dark 100 ms after the beat');
  assert.ok(EQ.flashOf({ beats: 2 + 0.05 * 2, bpm: 120, beatInBar: 3 }).env > 0.05, 'still lit at 50 ms');
  for (const bpm of [181, 200, 240]) {
    const f = flashes(6, bpm), perS = f.length / 6;
    assert.ok(perS <= EQ.MAX_PER_S + 1e-9, `${bpm} bpm: ${perS.toFixed(2)} flashes a second`);
    assert.ok(f.filter(x => x.strong).length >= Math.floor(6 * bpm / 60 / 4), `${bpm} bpm: every 1 still flashes`);
  }
  assert.equal(flashes(4, 180).length, 12, '180 bpm: every beat, 3 a second');
  assert.deepEqual(EQ.flashOf({ beats: -1, bpm: 120, beatInBar: 1 }), { env: 0, strong: false, beat: null }, 'no clock yet: dark');
});

test('27 EQ: the 16 bars follow fake band levels (log bands, dB), with peak caps that hold then fall', () => {
  const sr = 48000, bins = 4096, hz = sr / 2 / bins, db = new Float32Array(bins).fill(-110);
  const k = 7, i0 = Math.floor(EQ.EDGES[k] / hz), i1 = Math.ceil(EQ.EDGES[k + 1] / hz);
  for (let i = i0; i < i1; i++) db[i] = -20;
  const b = EQ.bands(db, sr);
  assert.equal(b.length, 16);
  assert.ok(Math.abs(b[k] + 20) < 0.5, `band ${k}: ${b[k]}`);
  assert.ok(b[k - 1] < b[k] - 10 && b[k + 1] < b[k] - 10, 'its neighbours well below');
  for (let j = 0; j < 16; j++) if (Math.abs(j - k) > 1) assert.ok(Math.abs(b[j] + 110) < 0.1, `band ${j}: ${b[j]}`);
  assert.ok(EQ.EDGES[0] === 30 && Math.abs(EQ.EDGES[16] - 16000) < 1e-6, '30 Hz - 16 kHz');
  assert.deepEqual([EQ.heightOf(0), EQ.heightOf(-36), EQ.heightOf(-72), EQ.heightOf(-100), EQ.heightOf(6)], [1, 0.5, 0, 0, 1]);
  const s = EQ.create(), floor = new Array(16).fill(EQ.FLOOR_DB);
  EQ.follow(s, b, 1 / 60);
  assert.ok(Math.abs(s.level[k] + 20) < 0.5 && Math.abs(s.peak[k] + 20) < 0.5, 'a bar rises at once');
  for (let f = 0; f < 30; f++) EQ.follow(s, floor, 1 / 60);   // 0.5 s of silence
  assert.ok(Math.abs(s.level[k] + 40) < 1, `then falls 40 dB/s (${s.level[k]})`);
  assert.ok(Math.abs(s.peak[k] + 20) < 0.5, 'the peak cap holds');
  for (let f = 0; f < 90; f++) EQ.follow(s, floor, 1 / 60);   // 2 s in all
  assert.ok(s.peak[k] < -35, `and falls after ${EQ.PEAK_HOLD_S} s (${s.peak[k]})`);
});

test('27 EQ: the input level in dBFS and the clip marker (sample peak at -1 dBFS, held 1.5 s)', () => {
  const sine = a => Float32Array.from({ length: 8192 }, (_, i) => a * Math.sin(2 * Math.PI * 441 * i / 44100));
  const quiet = EQ.levelOf(sine(0.1)), hot = EQ.levelOf(sine(0.99));
  assert.ok(Math.abs(quiet.rmsDb - 20 * Math.log10(0.1 / Math.SQRT2)) < 0.1, `rms ${quiet.rmsDb}`);
  assert.ok(Math.abs(quiet.peakDb + 20) < 0.1 && Math.abs(hot.peakDb - 20 * Math.log10(0.99)) < 0.01);
  const s = EQ.create();
  assert.equal(EQ.clipStep(s, quiet.peakDb, 10), false, '-20 dBFS: no clip');
  assert.equal(EQ.clipStep(s, hot.peakDb, 11), true, '-0.09 dBFS: clip');
  assert.equal(EQ.clipStep(s, quiet.peakDb, 12.4), true, 'held');
  assert.equal(EQ.clipStep(s, quiet.peakDb, 12.6), false, 'gone after 1.5 s');
  assert.deepEqual(EQ.levelOf(new Float32Array(0)), { rmsDb: EQ.FLOOR_DB, peakDb: EQ.FLOOR_DB });
});

test('27 EQ: the page is a scene (panic.js, the shared clock, audio-in); ?capture=1 leaves only the canvas (the panel is outside the stage)', () => {
  assert.equal(A.isScenePage('27-eq-calibrate.html', PAGE), true, 'audition lists it as a scene');
  for (const s of ['clock.js', 'audio-in.js', '27-eq.js', 'panic.js']) assert.ok(PAGE.includes(`<script src="${s}"></script>`), s);
  assert.match(PAGE, /<div id="wrap"><canvas id="c"><\/canvas><\/div>\s*<div id="panel">/, 'the stage holds only the canvas; the panel is its sibling, which capture hides');
  assert.match(PAGE, /Clock\.create\(\{ source: q\('clock'\) \|\| 'metronome', settings \}\)/, '?clock=shared');
  assert.match(PAGE, /AudioIn\.create\(\{ clock, source: AUDIO_SRC/, '?audio=line');
  assert.match(PAGE, /labels: q\('labels'\) !== '0', kick: q\('kick'\) === '1'/, 'labels on by default, the kick square off');
  assert.match(PAGE, /<button id="play">/, 'capture presses Play');
  assert.match(PAGE, /fakeBands: arr =>/);
  // __qa.eq is a live getter (Object.assign would copy a getter's value once: {} at load; box run 20 Nov)
  assert.match(PAGE, /Object\.defineProperty\(window\.__qa, 'eq', \{ get: \(\) => \(\{ \.\.\.view \}\)/);
  assert.doesNotMatch(PAGE, /Object\.assign\(window\.__qa \|\| \{\}, \{\s*errors, get eq\(\)/);
});
