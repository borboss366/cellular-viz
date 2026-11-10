// The three-tracker reference vote (#188, the user 10 Nov 17:27; VIZ research's ruling): qa/ref_beats_vote.py and its
// fixed script qa/ref-beats-vote.sh, and the unusual tempo / meter rows hc-01..hc-11 (the user 17:39: hard for the tracker,
// not a genre) in qa/corpus.json. The trackers themselves
// (torch, beat-this, madmom, essentia) only exist in the box's venv, so here: the vote rules (--selftest), the files
// parse, the old path for the 22 earlier tracks is untouched, and the rows are well formed. ids only (R9).
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rows = JSON.parse(fs.readFileSync(path.join(QA, 'corpus.json'), 'utf8'));
const HC = Array.from({ length: 11 }, (_, i) => `hc-${String(i + 1).padStart(2, '0')}`);

test('ref_beats_vote.py --selftest: 2-of-3 within 1 % after octave folding, 4:3 never folds, confidence 1.5 gates (3.5 after an octave fold), wide 60-260, meters 2-7, tempo curve', (t) => {
  const py = spawnSync('python3', ['-c', 'import sys; print(sys.version_info >= (3, 9))'], { encoding: 'utf8' });
  if (py.error) { t.skip('no python3 here'); return; }
  const r = spawnSync('python3', [path.join(QA, 'ref_beats_vote.py'), '--selftest'], { encoding: 'utf8' });
  assert.equal(r.status, 0, `selftest: ${r.stdout} ${r.stderr}`);
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(out.selftest, 'ok', JSON.stringify(out));
  assert.ok(out.cases >= 10, `${out.cases} cases`);
  for (const f of ['ref_beats_vote.py', 'ref_beats.py']) {
    const c = spawnSync('python3', ['-m', 'py_compile', path.join(QA, f)], { encoding: 'utf8' });
    assert.equal(c.status, 0, `${f} compiles: ${c.stderr}`);
  }
});

test('ref-beats-vote.sh: a fixed no-argument script, its own venv (the old .venv-beatthis untouched), madmom from git or the prebuilt wheel', () => {
  const sh = fs.readFileSync(path.join(QA, 'ref-beats-vote.sh'), 'utf8');
  const n = spawnSync('sh', ['-n', path.join(QA, 'ref-beats-vote.sh')], { encoding: 'utf8' });
  assert.equal(n.status, 0, `sh -n: ${n.stderr}`);
  assert.match(sh, /\[ \$# -eq 0 \] \|\| \{ echo "usage: sh qa\/ref-beats-vote\.sh   \(no arguments\)"/, 'refuses arguments (QA box types it the same way every time)');
  assert.match(sh, /VENV=\$DATA\/\.venv-vote/);
  // the code (not the comments, which say it is left alone) never names the old tool's venv
  const code = sh.split('\n').filter(l => !/^\s*#/.test(l)).map(l => l.replace(/\s+#.*$/, '')).join('\n');
  assert.ok(code.includes('VENV=$DATA/.venv-vote'), 'the comment filter keeps the code');
  assert.doesNotMatch(code, /venv-beatthis/, 'never touches the old tool\'s venv');
  assert.match(sh, /git\+https:\/\/github\.com\/CPJKU\/madmom/);
  assert.match(sh, /madmom-prebuilt/);
  assert.match(sh, /essentia/);
  assert.match(sh, /download\.pytorch\.org\/whl\/cpu/, 'CPU torch');
  assert.match(sh, /gpu-lock\.sh" ref-beats-vote/, 'holds the GPU lock');
  assert.match(sh, /beatgrid\.mjs" --dir/, 'then the grids');
});

test('the old ref_beats.py path: unchanged for the 22 earlier rows, and it leaves a vote-made reference alone', () => {
  const py = fs.readFileSync(path.join(QA, 'ref_beats.py'), 'utf8');
  assert.match(py, /get\('tool'\) == 'vote'/, 'ref_beats.py skips a .ref.json written by the vote, even with --force');
  const vote = fs.readFileSync(path.join(QA, 'ref_beats_vote.py'), 'utf8');
  assert.match(vote, /if row\.get\('refTool'\) == 'vote':/, 'the vote writes .ref.beats only for refTool "vote" rows');
  const others = rows.filter(r => !HC.includes(r.id));
  assert.ok(others.length >= 22, `${others.length} earlier rows`);
  assert.deepEqual(others.filter(r => r.refTool !== undefined).map(r => r.id), [], 'no earlier row moves to the vote');
});

test('corpus.json: hc-01..hc-11 by id, report-only, refTool vote; optional refMinBpm/refMaxBpm sane; R9 (no file names)', () => {
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  for (const id of HC) {
    const r = by[id];
    assert.ok(r, `${id} is a row`);
    assert.equal(r.status, 'report', `${id}: report-only for now`);
    assert.equal(r.refTool, 'vote', `${id}: reference from the vote`);
    if (r.refMinBpm !== undefined || r.refMaxBpm !== undefined) {
      assert.ok(r.refMinBpm >= 40 && r.refMaxBpm <= 300 && r.refMinBpm < r.refMaxBpm, `${id}: refMinBpm ${r.refMinBpm} .. refMaxBpm ${r.refMaxBpm}`);
    }
  }
  assert.deepEqual(['hc-01', 'hc-06', 'hc-07'].map(id => by[id].bpm), [122.9, 130, 128], 'the three slower ones the user named (why the range is wide)');
  const md = fs.readFileSync(path.join(QA, 'CLOCK_CORPUS.md'), 'utf8');
  for (const id of HC) assert.ok(md.includes(`| ${id} |`), `${id} in CLOCK_CORPUS.md`);
  assert.match(md, /60\u2013260 BPM/);
  assert.match(md, /2, 3, 4, 5, 6 or 7 beats a bar/);
  assert.doesNotMatch(md, /hardcore/i, "the batch is unusual tempo / meter, not a genre (the user, 17:39)");
  const py = fs.readFileSync(path.join(QA, "ref_beats_vote.py"), "utf8");
  assert.match(py, /beats_per_bar=METERS/, "the downbeat DBN may choose 2..7 beats a bar");
  assert.match(py, /^WIDE = \(60\.0, 260\.0\)/m);
});
