// Marks by ear (#188 R13): qa/marks.mjs snaps a key-M press to the nearest reference beat (its fitted time, the raw
// press kept), [ / ] step it; qa/marks-apply.mjs merges a session's last marks into qa/corpus.json (markAt) and
// qa/mixes.json (bar1 → bar1At), line by line, ids only (R9), never committing. No audio, no browser.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as K from '../../marks.mjs';
import * as A from '../../marks-apply.mjs';
import { parseLog, toJsonl } from '../../conduct-score.mjs';
import { loadMixes } from '../../mix-make.mjs';

const QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let seed = 4242;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
/** a 120 BPM grid from 0.25 s, each beat jittered by up to ±jit ms (Beat This!-like) */
const grid = (n = 200, jit = 0, P = 500) => ({ beats: Array.from({ length: n }, (_, k) => ({ ms: 250 + k * P + (rnd() * 2 - 1) * jit })) });
const truth = k => 250 + k * 500;

test('snapMark: a press ±150 ms lands on the nearest beat at its fitted time; the raw press is kept; typed takes the same path', () => {
  const g = grid(200, 15);
  for (const [k, off] of [[10, 140], [57, -160], [120, 30]]) {
    const m = K.snapMark(g, 'kickIn', truth(k) + off);
    assert.equal(m.beat, k, `press ${off} ms off beat ${k}`);
    assert.ok(Math.abs(m.atMs - truth(k)) < 8, `fitted time ${m.atMs} vs ${truth(k)}: the ±15 ms jitter averages down`);
    assert.equal(m.rawMs, Math.round((truth(k) + off) * 10) / 10);
    assert.equal(m.markSource, 'key');
  }
  assert.deepEqual(K.snapMark(g, 'bar1', truth(40) + 90, 'typed').beat, 40, 'a typed time is snapped the same way');
  assert.equal(K.snapMark(g, 'kickIn', -5000).beat, 0, 'before the first beat: beat 0');
  assert.equal(K.snapMark({ beats: [] }, 'kickIn', 1000), null);
  assert.throws(() => K.snapMark(g, 'Kick In', 1000), /mark name/);
  assert.throws(() => K.snapMark(g, 'kickIn', 1000, 'guess'), /markSource/);
  assert.equal(K.fittedBeatMs(K.beatTimes(grid(5)), 2), truth(2), 'an exact grid fits exactly');
});

test('stepMark: ] and [ move bar1 one beat at a time, clamped to the grid, raw press unchanged', () => {
  const g = grid(20), m = K.snapMark(g, 'bar1', truth(5) + 40);
  const next = K.stepMark(g, m, +1), prev = K.stepMark(g, K.stepMark(g, m, -1), -1);
  assert.deepEqual([next.beat, next.atMs, next.rawMs], [6, truth(6), m.rawMs]);
  assert.deepEqual([prev.beat, prev.atMs], [3, truth(3)]);
  assert.equal(K.stepMark(g, { ...m, beat: 0 }, -1).beat, 0);
  assert.equal(K.stepMark(g, { ...m, beat: 19 }, +1).beat, 19);
});

test('marksFromLog: schema v1 records, the last mark of each name per corpus id wins; ids from the log or the map, never a file name', () => {
  const g = grid(100), mk = (ctx, idx, name, ms) => K.markRecord(ctx, idx, K.snapMark(g, name, ms));
  const recs = [
    { type: 'session', ctx: 0, v: 1, id: 's1', input: 'line:page' },
    { type: 'track', ctx: 1, idx: 0, event: 'load', id: 'opus' },
    { type: 'track', ctx: 2, idx: 1, event: 'load', file: '/private/tracks/some-artist-secret-title.flac' },
    { type: 'track', ctx: 3, idx: 2, event: 'load', file: '/private/tracks/unmapped.flac' },
    mk(10, 0, 'kickIn', truth(30) + 100), mk(20, 0, 'kickIn', truth(31) - 60), mk(21, 0, 'bar1', truth(32) + 20),
    mk(30, 1, 'bar1', truth(8) - 120), mk(40, 2, 'kickIn', truth(3)),
  ];
  const parsed = parseLog(toJsonl(recs));   // the page's records pass the scorer's schema check
  const { marks, problems } = A.marksFromLog(parsed, { idOfStem: { 'some-artist-secret-title': 'one-more-time' } });
  const by = Object.fromEntries(marks.map(m => [`${m.id}/${m.name}`, m]));
  assert.deepEqual(Object.keys(by).sort(), ['one-more-time/bar1', 'opus/bar1', 'opus/kickIn']);
  assert.equal(by['opus/kickIn'].beat, 31, 'the later press wins');
  assert.equal(by['opus/kickIn'].atMs, truth(31));
  assert.equal(by['one-more-time/bar1'].beat, 8);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /track 2: no corpus id/);
  assert.ok(!JSON.stringify(marks).includes('secret'), 'no file name in the marks (R9)');
  const refit = A.refit(marks, id => (id === 'opus' ? grid(100, 0) : null));
  assert.equal(refit.find(m => m.id === 'opus' && m.name === 'kickIn').beat, 31, 'refit keeps the beat');
});

test('applyToCorpus: markAt on the one row, every other line byte-identical, warnings for unknown ids and unlisted names', () => {
  const text = fs.readFileSync(path.join(QA, 'corpus.json'), 'utf8');
  const marks = [
    { id: 'opus', name: 'kickIn', beat: 412, atMs: 196321.4, rawMs: 196402, markSource: 'key' },
    { id: 'opus', name: 'dropIn', beat: 600, atMs: 285700, rawMs: 285650, markSource: 'key' },
    { id: 'no-such-track', name: 'kickIn', beat: 1, atMs: 1000, rawMs: 990, markSource: 'key' },
    { id: 'one-more-time', name: 'bar1', beat: 3, atMs: 1700, rawMs: 1690, markSource: 'key' },
  ];
  const r = A.applyToCorpus(text, marks);
  const before = text.split('\n'), after = r.text.split('\n');
  assert.equal(after.length, before.length);
  const changed = before.map((l, i) => (l === after[i] ? null : i)).filter(i => i !== null);
  assert.equal(changed.length, 1, 'only the opus row changes');
  const row = JSON.parse(r.text).find(x => x.id === 'opus');
  assert.deepEqual(row.markAt.kickIn, { beat: 412, atMs: 196321.4, rawMs: 196402, markSource: 'key' });
  assert.equal(row.markAt.dropIn.beat, 600);
  assert.equal(r.changes.length, 2);
  assert.ok(r.warnings.some(w => /no-such-track: not a corpus.json row/.test(w)));
  assert.ok(r.warnings.some(w => /opus: dropIn is not in its marks list/.test(w)));
  assert.ok(!r.changes.some(c => /bar1/.test(c)), 'bar1 belongs to the mixes');
  const again = A.applyToCorpus(r.text, [{ ...marks[0], beat: 413, atMs: 196797 }]);
  assert.match(again.changes[0], /196321\.4 ms \(beat 412\) → 196797 ms \(beat 413/);
});

test('applyToMixes: bar1 → bar1At (s) on every mode A side of that id; mode B lines untouched; the recipes still load', () => {
  const text = fs.readFileSync(path.join(QA, 'mixes.json'), 'utf8');
  const marks = [
    { id: 'one-more-time', name: 'bar1', beat: 3, atMs: 61734.56, rawMs: 61800, markSource: 'key' },
    { id: 'opus', name: 'bar1', beat: 7, atMs: 300456.7, rawMs: 300400, markSource: 'key' },
    { id: 'sandstorm', name: 'bar1', beat: 1, atMs: 1000, rawMs: 1000, markSource: 'key' },
    { id: 'opus', name: 'kickIn', beat: 2, atMs: 900, rawMs: 900, markSource: 'key' },
  ];
  const r = A.applyToMixes(text, marks);
  const before = text.split('\n'), after = r.text.split('\n');
  assert.equal(before.map((l, i) => l === after[i]).filter(x => !x).length, 2, 'two lines: the mode A out and in');
  const doc = JSON.parse(r.text), a = doc.mixes.find(m => m.mode === 'A'), b = doc.mixes.find(m => m.mode === 'B');
  assert.deepEqual([a.out.bar1At, a.in.bar1At], [61.7346, 300.4567]);
  assert.ok(!('bar1At' in b.out) && !('bar1At' in b.in), 'mode B has no bar1At and gets none');
  assert.ok(r.warnings.some(w => /sandstorm: no mix side with a bar1At/.test(w)));
  assert.equal(r.changes.length, 2);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'marks-mixes-'));
  try {
    const f = path.join(tmp, 'mixes.json');
    fs.writeFileSync(f, r.text);
    assert.equal(loadMixes(f).find(m => m.mode === 'A').in.bar1At, 300.4567, 'mix-make still loads the recipes');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('the CLI: a dry run prints the changes and writes nothing; no file name in its output', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'marks-cli-'));
  try {
    const g = grid(400), log = path.join(tmp, 'session.jsonl');
    fs.writeFileSync(log, toJsonl([
      { type: 'session', ctx: 0, v: 1, id: 's', input: 'line:page' },
      { type: 'track', ctx: 1, idx: 0, event: 'load', id: 'opus', file: '/private/secret-file.flac' },
      K.markRecord(2, 0, K.snapMark(g, 'kickIn', truth(100) + 70)),
      K.markRecord(3, 0, K.snapMark(g, 'bar1', truth(120) - 50)),
    ]));
    const corpus = fs.readFileSync(path.join(QA, 'corpus.json'), 'utf8'), mixes = fs.readFileSync(path.join(QA, 'mixes.json'), 'utf8');
    const out = execFileSync(process.execPath, [path.join(QA, 'marks-apply.mjs'), log], { encoding: 'utf8' });
    assert.match(out, /corpus opus\.markAt\.kickIn: 50250 ms \(beat 100/);
    assert.match(out, /mixes opus bar1At: null → 60\.25 s \(beat 120/);
    assert.match(out, /dry run/);
    assert.ok(!/secret/.test(out), 'no file name (R9)');
    assert.equal(fs.readFileSync(path.join(QA, 'corpus.json'), 'utf8'), corpus, 'corpus.json untouched');
    assert.equal(fs.readFileSync(path.join(QA, 'mixes.json'), 'utf8'), mixes, 'mixes.json untouched');
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
