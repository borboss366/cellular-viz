// The clock corpus (#188, VIZ research 6728399131): qa/corpus.json is what the scorer reads, qa/CLOCK_CORPUS.md is
// for people. R9: neither may name a private file or folder; the id → file link lives only on the box
// (data/qa-audio/corpus-map.json, never in git).
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const C = await import('../../corpus.mjs');
const A = await import('../audio.mjs');

const QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rows = JSON.parse(fs.readFileSync(path.join(QA, 'corpus.json'), 'utf8'));
const STATUS = ['gate', 'provisional', 'report', 'missing'];

test('corpus.json: one row per short id, every field the scorer reads, of the right kind', () => {
  assert.ok(Array.isArray(rows) && rows.length >= 20, `${rows.length} rows`);
  const ids = rows.map(r => r.id);
  assert.equal(new Set(ids).size, ids.length, 'ids are unique');
  for (const r of rows) {
    const w = `row ${r.id}`;
    assert.match(r.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${w}: short id`);
    assert.match(r.slot, /^T\d+(?:-[a-z]+|-control)?$/, `${w}: slot`);
    assert.ok(STATUS.includes(r.status), `${w}: status ${r.status}`);
    assert.ok(r.bpm === null || (typeof r.bpm === 'number' && r.bpm > 40 && r.bpm < 250), `${w}: bpm`);
    assert.equal(typeof r.bpmSource, 'string', `${w}: bpmSource`);
    for (const k of ['octaveFree', 'backbeatOk', 'lossy']) assert.equal(typeof r[k], 'boolean', `${w}: ${k}`);
    assert.ok(['start', 'mark'].includes(r.lockFrom), `${w}: lockFrom`);
    assert.ok(Array.isArray(r.marks) && r.marks.every(m => typeof m === 'string'), `${w}: marks`);
    if (r.lockFrom === 'mark') assert.ok(r.marks.length > 0, `${w}: lockFrom "mark" needs a mark to lock from`);
    assert.ok(typeof r.expect === 'string' && r.expect.length > 10, `${w}: expect`);
    if (r.twinOf !== undefined) {
      assert.ok(ids.includes(r.twinOf), `${w}: twinOf names a corpus id`);
      assert.equal(r.lossy, true, `${w}: a twin is the lossy copy`);
    }
    if (r.markAt !== undefined) {   // R13: marks by ear, snapped to a reference beat (qa/marks-apply.mjs)
      assert.ok(r.markAt && typeof r.markAt === 'object' && !Array.isArray(r.markAt), `${w}: markAt is an object`);
      for (const [name, m] of Object.entries(r.markAt)) {
        assert.ok(Number.isInteger(m.beat) && m.beat >= 0 && typeof m.atMs === 'number' && m.atMs >= 0, `${w}: markAt.${name} beat / atMs`);
        assert.ok(['key', 'typed'].includes(m.markSource), `${w}: markAt.${name}.markSource`);
      }
    }
    if (r.alignLagMethod !== undefined) {   // R14: what mix-make measured (alignFields), with both files' sha256
      assert.equal(r.alignLagMethod, 'xcorr', `${w}: alignLagMethod`);
      assert.ok(Number.isInteger(r.alignLagSamples) && Number.isInteger(r.alignLagRate) && r.alignLagRate > 0, `${w}: alignLagSamples / alignLagRate`);
      assert.ok(Math.abs(r.alignLagMs - r.alignLagSamples / r.alignLagRate * 1000) < 0.001, `${w}: alignLagMs matches samples / rate`);
      assert.ok(Math.abs(r.alignLagMs) <= 30, `${w}: |alignLag| <= 30 ms`);
      assert.ok(r.alignSha && /^[0-9a-f]{64}$/.test(r.alignSha.ref) && /^[0-9a-f]{64}$/.test(r.alignSha.lossy), `${w}: alignSha.ref / .lossy are sha256`);
      assert.ok(r.twinOf, `${w}: alignLag is only for a twin`);
    }
  }
});

test('the id map: read from beside tracks/, missing is empty, resolve lists the reasons', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'corpus-')), tracks = path.join(root, 'tracks');
  fs.mkdirSync(tracks);
  try {
    assert.deepEqual(C.loadMap(tracks).tracks, {}, 'no map yet');
    fs.writeFileSync(path.join(root, 'corpus-map.json'), JSON.stringify({ version: 1, tracks: { a: 'artist-a', b: 'artist-b' } }));
    fs.writeFileSync(path.join(tracks, 'artist-a.beatgrid.json'), JSON.stringify({ version: 2, beats: [], bpmFit: 120 }));
    const map = C.loadMap(tracks);
    assert.equal(map.missing, false);
    const got = C.resolve([{ id: 'a' }, { id: 'b' }, { id: 'c' }], map, tracks).map(x => [x.id, x.stem, !!x.grid, x.reason]);
    assert.deepEqual(got, [['a', 'artist-a', true, null], ['b', 'artist-b', false, 'no grid'], ['c', null, false, 'not in the map']]);
    fs.writeFileSync(path.join(root, 'corpus-map.json'), JSON.stringify({ tracks: {} }));
    assert.throws(() => C.loadMap(tracks), /version/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('checkBpm: gate rows within 1 % of the corpus BPM, bpmFitCore first, never medianBpm, skips say why', () => {
  const rows = [
    { id: 'ok', status: 'gate', bpm: 126 }, { id: 'edge', status: 'gate', bpm: 100 }, { id: 'off', status: 'gate', bpm: 100 },
    { id: 'core', status: 'gate', bpm: 126 }, { id: 'median', status: 'gate', bpm: 120 }, { id: 'set', status: 'gate', bpm: null },
    { id: 'rep', status: 'report', bpm: 78 }, { id: 'gone', status: 'gate', bpm: 117 },
  ];
  const g = grid => ({ grid, reason: null });
  const resolved = [
    { id: 'ok', ...g({ bpmFit: 126.5 }) }, { id: 'edge', ...g({ bpmFit: 101 }) }, { id: 'off', ...g({ bpmFit: 101.2 }) },
    { id: 'core', ...g({ bpmFit: 131, bpmFitCore: 126.2 }) }, { id: 'median', ...g({ medianBpm: 120 }) },
    { id: 'set', ...g({ bpmFit: 128 }) }, { id: 'gone', grid: null, reason: 'not in the map' },
  ];
  const r = Object.fromEntries(C.checkBpm(rows, resolved).map(x => [x.id, x]));
  assert.equal(r.ok.ok, true);
  assert.equal(r.edge.ok, true, 'exactly 1 % passes');
  assert.equal(r.off.ok, false, '1.2 % fails');
  assert.equal(r.core.field, 'bpmFitCore');
  assert.equal(r.core.ok, true, 'the core fit, not the polluted start-to-end fit');
  assert.equal(r.median.skipped, true, 'medianBpm is never read');
  assert.equal(r.set.reason, 'no corpus BPM');
  assert.equal(r.gone.reason, 'not in the map');
  assert.equal(r.rep, undefined, 'report rows are not checked');
});

// on the QA box, once the map is in place and the grids carry bpmFit: the real corpus, ids and numbers only.
// HARD again (user, 10 Nov 12:15): every test-pr since #195 read "13 checked, 1 skipped, 0 off, 3 grid flagged" on
// the robust-fit converter (R15, #188 6736333312). Flagged grids stay "grid flagged" and never fail; octaveFree rows
// fold their fit to the nearest octave of the corpus BPM first; 1 % stays 1 %.
const REAL_CORPUS_HARD = true;
test('the real corpus on the box: every gate track with a fitted tempo against 1 % (hard; flagged grids n/a; skips without the map)', (t) => {
  const tracks = A.audioDir();
  if (!fs.existsSync(tracks)) { t.skip('no tracks folder here'); return; }
  const map = C.loadMap(tracks);
  if (map.missing) { t.skip('no corpus-map.json beside the tracks yet'); return; }
  const res = C.checkBpm(rows, C.resolve(rows, map, tracks)), checked = res.filter(x => !x.skipped);
  for (const line of C.reportLines(res)) t.diagnostic(line);   // test-pr.sh prints these even on a pass
  const bad = checked.filter(x => x.ok === false);
  if (!REAL_CORPUS_HARD) { t.diagnostic(`corpus: report-only (R15): ${bad.length} off, not failing`); return; }
  assert.deepEqual(bad.map(x => `${x.id} ${x.field} ${x.fit} vs ${x.bpm}`), [], 'gate tracks off their corpus BPM by more than 1 %');
});

test('octave folding: an octaveFree row folds its fit by x2 or /2 to the corpus BPM before the 1 % check; others never fold', () => {
  assert.deepEqual([C.octaveFold(140, 70), C.octaveFold(70, 140), C.octaveFold(35, 140), C.octaveFold(560, 140), C.octaveFold(1100, 137), C.octaveFold(126, 126)],
    [0.5, 2, 4, 0.25, 0.25, 1], 'nearest octave, at most two steps');
  const rows = [
    { id: 'free-hi', status: 'gate', bpm: 78, octaveFree: true }, { id: 'free-lo', status: 'gate', bpm: 150, octaveFree: true },
    { id: 'free-ok', status: 'gate', bpm: 120, octaveFree: true }, { id: 'free-off', status: 'gate', bpm: 78, octaveFree: true },
    { id: 'strict', status: 'gate', bpm: 78, octaveFree: false }, { id: 'free-flag', status: 'gate', bpm: 97, octaveFree: true },
  ];
  const resolved = [
    { id: 'free-hi', grid: { bpmFitCore: 156.4 }, reason: null }, { id: 'free-lo', grid: { bpmFitCore: 75.3 }, reason: null },
    { id: 'free-ok', grid: { bpmFitCore: 120.5 }, reason: null }, { id: 'free-off', grid: { bpmFitCore: 160 }, reason: null },
    { id: 'strict', grid: { bpmFitCore: 156.4 }, reason: null }, { id: 'free-flag', grid: { bpmFitCore: 300, gridSuspect: true }, reason: null },
  ];
  const res = C.checkBpm(rows, resolved), r = Object.fromEntries(res.map(x => [x.id, x]));
  assert.equal(r['free-hi'].fold, 0.5); assert.equal(r['free-hi'].ok, true, '156.4 / 2 = 78.2 is within 1 % of 78');
  assert.equal(r['free-lo'].fold, 2); assert.equal(r['free-lo'].ok, true, '75.3 x 2 = 150.6');
  assert.equal(r['free-ok'].fold, 1); assert.equal(r['free-ok'].ok, true);
  assert.equal(r['free-off'].ok, false, '160 / 2 = 80 is 2.6 % off: folding never hides a wrong tempo');
  assert.equal(r.strict.fold, 1); assert.equal(r.strict.ok, false, 'not octaveFree: never folded');
  assert.equal(r['free-flag'].flagged, true); assert.equal(r['free-flag'].ok, null, 'a flagged grid stays n/a (R15), folded or not');
  assert.equal(r['free-hi'].fit, 156.4, 'fit stays the grid number');
  const lines = C.reportLines(res);
  assert.equal(lines[0], 'corpus: bpm 6 checked, 0 skipped, 2 off, 1 grid flagged');
  assert.match(lines.find(l => l.startsWith('corpus: free-hi ')), /^corpus: free-hi bpmFitCore 156\.40 folded \/2 = 78\.20 vs 78 \(0\.26 %\) ok; /);
  assert.match(lines.find(l => l.startsWith('corpus: free-lo ')), /bpmFitCore 75\.30 folded x2 = 150\.60 vs 150 /);
  assert.match(lines.find(l => l.startsWith('corpus: strict ')), /^corpus: strict bpmFitCore 156\.40 vs 78 \(100\.51 %\) OFF; /);
  assert.ok(lines.every(l => /^[\x20-\x7e]+$/.test(l)), 'ASCII lines');
});

test('R9: the corpus: lines test-pr prints carry ids and numbers, never a stem or file name', () => {
  const rows = [{ id: 'ok', status: 'gate', bpm: 126 }, { id: 'off', status: 'gate', bpm: 100 },
    { id: 'nogrid', status: 'gate', bpm: 120 }, { id: 'unmapped', status: 'gate', bpm: 117 }, { id: 'set', status: 'gate', bpm: null }];
  const resolved = [
    { id: 'ok', stem: 'secret-artist-ok-track', grid: { bpmFitCore: 126.2 }, reason: null },
    { id: 'off', stem: 'secret-artist-off-track', grid: { bpmFit: 103 }, reason: null },
    { id: 'nogrid', stem: 'secret-artist-nogrid-track', grid: null, reason: 'no grid' },
    { id: 'unmapped', stem: null, grid: null, reason: 'not in the map' },
    { id: 'set', stem: 'secret-dj-set', grid: { bpmFit: 127 }, reason: null },
  ];
  const lines = C.reportLines(C.checkBpm(rows, resolved));
  assert.equal(lines[0], 'corpus: bpm 2 checked, 3 skipped, 1 off, 0 grid flagged');
  assert.equal(lines.length, 1 + rows.length);
  assert.ok(lines.every(l => l.startsWith('corpus: ')), 'every line has the prefix test-pr.sh greps for');
  assert.equal(lines.find(l => l.startsWith('corpus: ok ')),
    'corpus: ok bpmFitCore 126.20 vs 126 (0.16 %) ok; gridSuspect n/a, inlierFrac n/a, extraFrac n/a, longFrac n/a, driftCore n/a %');
  assert.match(lines.find(l => l.startsWith('corpus: off ')), / OFF; /);
  const text = lines.join('\n');
  assert.doesNotMatch(text, /secret|\.(flac|wav|mp3|m4a|aiff?|ogg)\b|beatgrid|qa-audio|\w\/[\w.-]+\/|(^|\s)\//im, text);   // no path ("n/a" is fine)
});

test('R15: gridSuspect or driftCore over 20 % reads "grid flagged" (no tempo verdict), never a failed track', () => {
  const rows = ['sus', 'wild', 'fine', 'calm'].map(id => ({ id, status: 'gate', bpm: 120 }));
  const resolved = [
    { id: 'sus', grid: { bpmFitCore: 131, gridSuspect: true, inlierFrac: 0.82, driftCore: 4 }, reason: null },
    { id: 'wild', grid: { bpmFitCore: 133, driftCore: 111.5 }, reason: null },
    { id: 'fine', grid: { bpmFitCore: 120.3, gridSuspect: false, inlierFrac: 0.987, extraFrac: 0.004, longFrac: 0.009, driftCore: 0.4 }, reason: null },
    { id: 'calm', grid: { bpmFitCore: 125, gridSuspect: false, inlierFrac: 0.99, driftCore: 20 }, reason: null },
  ];
  const res = C.checkBpm(rows, resolved), r = Object.fromEntries(res.map(x => [x.id, x]));
  assert.equal(r.sus.flagged, true); assert.equal(r.sus.ok, null, 'gridSuspect: no verdict on the track');
  assert.equal(r.wild.flagged, true); assert.equal(r.wild.ok, null, 'driftCore 111 %: no verdict');
  assert.equal(r.fine.ok, true); assert.equal(r.fine.flagged, false);
  assert.equal(r.calm.flagged, false, 'exactly 20 % is not over 20 %'); assert.equal(r.calm.ok, false, 'and its 4 % error counts');
  const lines = C.reportLines(res);
  assert.equal(lines[0], 'corpus: bpm 4 checked, 0 skipped, 1 off, 2 grid flagged');
  assert.equal(lines[1], 'corpus: sus bpmFitCore 131.00 vs 120 (9.17 %) grid flagged; gridSuspect true, inlierFrac 0.820, extraFrac n/a, longFrac n/a, driftCore 4.00 %');
  assert.match(lines[3], /\) ok; gridSuspect false, inlierFrac 0\.987, extraFrac 0\.004, longFrac 0\.009, driftCore 0\.40 %$/);
});

test('R9: no private file names or folders in corpus.json or CLOCK_CORPUS.md', () => {
  for (const f of ['corpus.json', 'CLOCK_CORPUS.md']) {
    const text = fs.readFileSync(path.join(QA, f), 'utf8');
    assert.doesNotMatch(text, /\.(flac|wav|mp3|m4a|aiff?|ogg)\b/i, `${f}: an audio file name`);
    assert.doesNotMatch(text, /qa-audio|pi-durable-worker|\/tracks\/|\.beatgrid\.json|\.ref\.beats/, `${f}: a private folder or grid file`);
  }
});
