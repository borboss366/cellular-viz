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

// on the QA box, once the map is in place and the grids carry bpmFit: the real corpus, counts only in the messages
test('the real corpus on the box: every gate track with a fitted tempo is within 1 % (skips without the map)', (t) => {
  const tracks = A.audioDir();
  if (!fs.existsSync(tracks)) { t.skip('no tracks folder here'); return; }
  const map = C.loadMap(tracks);
  if (map.missing) { t.skip('no corpus-map.json beside the tracks yet'); return; }
  const res = C.checkBpm(rows, C.resolve(rows, map, tracks)), checked = res.filter(x => !x.skipped);
  t.diagnostic(`corpus bpm: ${checked.length} checked, ${res.length - checked.length} skipped`);
  const bad = checked.filter(x => !x.ok);
  assert.deepEqual(bad.map(x => `${x.id} ${x.field} ${x.fit} vs ${x.bpm}`), [], 'gate tracks off their corpus BPM by more than 1 %');
});

test('R9: no private file names or folders in corpus.json or CLOCK_CORPUS.md', () => {
  for (const f of ['corpus.json', 'CLOCK_CORPUS.md']) {
    const text = fs.readFileSync(path.join(QA, f), 'utf8');
    assert.doesNotMatch(text, /\.(flac|wav|mp3|m4a|aiff?|ogg)\b/i, `${f}: an audio file name`);
    assert.doesNotMatch(text, /qa-audio|pi-durable-worker|\/tracks\/|\.beatgrid\.json|\.ref\.beats/, `${f}: a private folder or grid file`);
  }
});
