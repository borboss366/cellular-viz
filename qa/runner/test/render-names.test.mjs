// #188 PR1a: which files in the private tracks folder are source tracks (Beat This! grids them) and which are renders.
// One rule (qa/render-names.json), read by audio.mjs (isRender, sourceTracks) and qa/ref_beats.py (--list). Pinned on
// file names from the QA box's folder: renders skipped, every artist-title FLAC kept, and Python agrees with JS.
// Only names, never audio: the test folder holds empty files.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const A = await import('../audio.mjs');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

// source tracks: the 4 truth tracks and the corpus uploads (artist-title.flac)
const SOURCES = [
  'darude-sandstorm.flac', 'prodigy-voodoo-people.flac', 'massive-attack-teardrop.flac', 'james-brown.flac',
];
// shapes of artist-title names the corpus uploads use: digits, dots, feat., remix brackets, upper-case extension
const SOURCE_SHAPES = [
  'artist-title.flac', 'dj-name-track-name-original-mix.flac', 'artist-feat-other-title-2024.flac',
  'artist-title-(extended-mix).flac', 'a.b.c-title.flac', 'artist-title-128bpm.flac', 'artist-title-v2.flac',
  'other-artist-title.FLAC', 'live-drummer-session.wav', 'set-recording-part-1.mp3',
  'artist-title-1999-2001.flac', 'artist-title-remix.flac', 'another-artist-title.wav',   // a year span is not a .NN-NN. render
  // the user's own files to come (a crossfade mix, a DJ-set excerpt): kept as long as they have one dot and no
  // metronome-/playlist- prefix; the words may appear inside the name
  'crossfade-mix-124-128.flac', 'dj-set-excerpt-10min.wav', 'user-mix-2026-11-08.flac', 'my-playlist-mix.flac',
  'set-with-metronome-intro.flac',
];
// renders the runner and scripts made: excerpts (audiocheck v1/v2), truth clips (.t1, with .x<step>), synth truth,
// metronome/playlist renders, and the sidecars next to them
const RENDERS = [
  'darude-sandstorm.30-14.wav', 'darude-sandstorm.30-14.v2.wav', 'prodigy-voodoo-people.45-20.v2.wav',
  'darude-sandstorm.30-14.t1.wav', 'darude-sandstorm.30-14.x1.067.t1.wav', 'massive-attack-teardrop.60-30.t1.wav',
  'metronome-120-30.t1.wav', 'metronome-128-60.wav', 'playlist-120-128.wav', 'james-brown.12.5-20.wav',
  'darude-sandstorm.x1.067.wav',
];
// not audio at all: sidecars, grids, hidden and partial files
const OTHER = [
  'darude-sandstorm.ref.beats', 'darude-sandstorm.ref.json', 'darude-sandstorm.beatgrid.json',
  'darude-sandstorm.30-14.t1.json', '.hidden.flac', 'upload.flac.part', 'notes.txt', '.flac',
];

test('isRender: every render name is a render, no source name is', () => {
  for (const n of RENDERS) assert.equal(A.isRender(n), true, `${n} should be a render`);
  for (const n of [...SOURCES, ...SOURCE_SHAPES]) assert.equal(A.isRender(n), false, `${n} should be a source track`);
  for (const n of ['x.ref.beats', 'x.ref.json', 'x.beatgrid.json']) assert.equal(A.isRender(n), true, n);
});

test('isSourceTrack: sources kept; renders, sidecars, hidden and non-audio files skipped', () => {
  for (const n of [...SOURCES, ...SOURCE_SHAPES]) assert.equal(A.isSourceTrack(n), true, `${n} kept`);
  for (const n of [...RENDERS, ...OTHER]) assert.equal(A.isSourceTrack(n), false, `${n} skipped`);
});

function folder() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'render-names-'));
  for (const n of [...SOURCES, ...SOURCE_SHAPES, ...RENDERS, ...OTHER]) fs.writeFileSync(path.join(dir, n), '');
  fs.mkdirSync(path.join(dir, 'renders'));
  fs.writeFileSync(path.join(dir, 'renders', 'metronome-128-60.wav'), '');
  fs.writeFileSync(path.join(dir, 'renders', 'someone-else.flac'), '');   // subfolders are not read
  fs.writeFileSync(path.join(dir, 'james-brown.mp3'), '');                 // one stem, two files: the .flac wins
  return dir;
}
const stemOf = f => f.slice(0, -path.extname(f).length);
const EXPECTED = [...SOURCES, ...SOURCE_SHAPES].map(f => [stemOf(f), f]).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

test('sourceTracks: exactly the source files, one per stem, sorted, top level only', () => {
  const dir = folder();
  try {
    const got = A.sourceTracks(dir).map(t => [t.stem, t.file]);
    assert.deepEqual(got, EXPECTED);
    assert.equal(got.length, SOURCES.length + SOURCE_SHAPES.length);
    assert.equal(A.sourceTracks(dir).find(t => t.stem === 'james-brown').ext, '.flac');
    assert.deepEqual(A.sourceTracks(path.join(dir, 'missing')), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('ref_beats.py --list takes the same tracks as sourceTracks (Python and JS agree)', (t) => {
  const py = spawnSync('python3', ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)']);
  if (py.error && py.error.code === 'ENOENT') { t.skip('no python3 on PATH: the agreement is NOT checked here'); return; }
  assert.equal(py.status, 0, 'python3 must be 3.9+ (ref-beats.sh needs it too)');
  const dir = folder();
  try {
    const r = spawnSync('python3', [path.join(ROOT, 'qa', 'ref_beats.py'), '--dir', dir, '--list'], { encoding: 'utf8' });
    assert.equal(r.status, 0, `ref_beats.py --list failed: ${r.stderr}`);
    const got = r.stdout.split('\n').filter(Boolean).map(l => l.split('\t'));
    assert.deepEqual(got, EXPECTED, 'Python lists the same source tracks, in the same order, as audio.mjs');
    assert.deepEqual(got, A.sourceTracks(dir).map(x => [x.stem, x.file]));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// The real folder on the QA box (QA_AUDIO_DIR, else the default path): only when it exists, so it runs under test-pr
// on the box and skips anywhere else. It prints and asserts counts only: no file name reaches a log or git.
test('the real tracks folder: every .flac kept, every render and sidecar skipped, Python agrees (counts only)', (t) => {
  const dir = A.audioDir();
  let files;
  try { files = fs.readdirSync(dir, { withFileTypes: true }).filter(d => d.isFile()).map(d => d.name); }
  catch { t.skip('no tracks folder here (it exists only on the QA box)'); return; }
  const kept = A.sourceTracks(dir), keptFiles = new Set(kept.map(k => k.file));
  const flacs = files.filter(f => !f.startsWith('.') && path.extname(f).toLowerCase() === '.flac');
  const flacsDropped = flacs.filter(f => !keptFiles.has(f)).length;
  const rendersKept = kept.filter(k => A.isRender(k.file)).length;
  const sidecarsKept = kept.filter(k => /\.(ref|beatgrid)\./.test(k.file)).length;
  const skipped = files.length - kept.length;
  t.diagnostic(`real folder: kept ${kept.length} · skipped ${skipped} · flac ${flacs.length} · renders ${files.filter(A.isRender).length}`);
  assert.equal(flacsDropped, 0, `${flacsDropped} .flac file(s) not kept`);
  assert.equal(rendersKept, 0, `${rendersKept} render(s) kept`);
  assert.equal(sidecarsKept, 0, `${sidecarsKept} sidecar(s) kept`);
  const r = spawnSync('python3', [path.join(ROOT, 'qa', 'ref_beats.py'), '--dir', dir, '--list'], { encoding: 'utf8' });
  if (r.error && r.error.code === 'ENOENT') { t.diagnostic('no python3: the real-folder agreement is not checked'); return; }
  assert.equal(r.status, 0, 'ref_beats.py --list failed on the real folder');
  const py = r.stdout.split('\n').filter(Boolean).map(l => l.split('\t')[1]);
  const same = py.length === kept.length && py.every((f, i) => f === kept[i].file);
  assert.ok(same, `Python lists ${py.length} tracks, JS ${kept.length}, and they differ`);
});

test('the rule file: both sides read qa/render-names.json, and its patterns compile', () => {
  const rule = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa', 'render-names.json'), 'utf8'));
  assert.deepEqual(A.RENDER_RULE, rule);
  assert.deepEqual(rule.audioExts, A.EXTS, 'the same extensions, in the same order, as the truth tracks');
  for (const p of rule.renderPatterns) assert.doesNotThrow(() => new RegExp(p), p);
  assert.match(fs.readFileSync(path.join(ROOT, 'qa', 'ref_beats.py'), 'utf8'), /render-names\.json/);
});
