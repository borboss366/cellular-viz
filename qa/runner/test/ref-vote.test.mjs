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
import os from 'node:os';
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

test('ref-beats-vote.sh: madmom-prebuilt metadata fix in .venv-vote, the import check before any voting, and DEGRADED 2 trackers without madmom', () => {
  const sh = fs.readFileSync(path.join(QA, 'ref-beats-vote.sh'), 'utf8');
  assert.match(sh, /^mm_fix\(\) \{/m, 'the fix is a function');
  assert.match(sh, /'madmom-' \+ ver \+ '\.dist-info'/, 'a madmom-<version>.dist-info beside the package');
  assert.match(sh, /Name: madmom\\n/, 'METADATA says Name: madmom');
  assert.match(sh, /realpath\(sys\.prefix\)/, 'only inside the venv');
  const code = sh.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  const fix = code.indexOf('\nmm_fix\n'), check = code.indexOf('import madmom, essentia, beat_this'), run = code.indexOf('ref_beats_vote.py" --dir');
  assert.ok(fix > 0 && check > fix && run > check, 'fix, then the import check, then the vote');
  assert.match(code, /"\$PY" -c "\$CORE" \|\| die "STOP:/, 'Beat This! and essentia missing: stop before any voting');
  assert.match(code, /DEGRADED: madmom is off/, 'a madmom failure says so, loudly');
  assert.match(code, /--trackers "\$VOTE_MODE"/);
  const py = fs.readFileSync(path.join(QA, 'ref_beats_vote.py'), 'utf8');
  assert.match(py, /choices=\(2, 3\)/);
  assert.match(py, /if row\.get\('refTool'\) == 'vote' and not degraded:/, 'no .ref.beats from a 2-tracker vote');
  assert.match(py, /'trackerSet': tset, 'degraded': degraded/, 'every .vote.json says which trackers voted');
  assert.match(py, /old\.get\('trackerSet', SETS\[3\]\) == tset/, 'a degraded result is redone once madmom works');
  assert.match(py, /Postprocessor\(type='minimal'/, 'A0 is Beat This! without the madmom DBN');
});

test('the madmom fix, run for real: a fake madmom-prebuilt in a throwaway venv imports after mm_fix (box, 10 Nov PackageNotFoundError)', (t) => {
  const py = spawnSync('python3', ['-c', 'import sys; print(sys.version_info >= (3, 9))'], { encoding: 'utf8' });
  if (py.error) { t.skip('no python3 here'); return; }
  const sh = fs.readFileSync(path.join(QA, 'ref-beats-vote.sh'), 'utf8');
  const body = sh.split("<<'EOF' || echo \"madmom-fix")[1];
  assert.ok(body, 'the mm_fix heredoc');
  const src = body.slice(body.indexOf('\n') + 1, body.indexOf('\nEOF\n'));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmfix-'));
  try {
    const venv = path.join(dir, 'venv');
    const mk = spawnSync('python3', ['-m', 'venv', '--without-pip', venv], { encoding: 'utf8' });
    if (mk.status !== 0) { t.skip(`python3 -m venv --without-pip: ${mk.stderr}`); return; }
    const PY = path.join(venv, 'bin', 'python');
    const site = spawnSync(PY, ['-c', "import sysconfig; print(sysconfig.get_paths()['purelib'])"], { encoding: 'utf8' }).stdout.trim();
    fs.mkdirSync(path.join(site, 'madmom'), { recursive: true });
    // the same two lines as madmom/__init__.py upstream
    fs.writeFileSync(path.join(site, 'madmom', '__init__.py'), 'from importlib.metadata import distribution\n__version__ = distribution("madmom")  .version\n');
    const di = path.join(site, 'madmom_prebuilt-0.17.post1.dist-info');
    fs.mkdirSync(di);
    fs.writeFileSync(path.join(di, 'METADATA'), 'Metadata-Version: 2.1\nName: madmom-prebuilt\nVersion: 0.17.post1\n');
    const before = spawnSync(PY, ['-c', 'import madmom'], { encoding: 'utf8' });
    assert.notEqual(before.status, 0, 'the fake reproduces the box failure');
    assert.match(before.stderr, /PackageNotFoundError/);
    const run = spawnSync(PY, ['-'], { input: src, encoding: 'utf8' });
    assert.equal(run.status, 0, `mm_fix: ${run.stdout} ${run.stderr}`);
    assert.match(run.stdout, /wrote madmom-0\.17\.post1\.dist-info/);
    const after = spawnSync(PY, ['-c', 'import madmom; print(madmom.__version__)'], { encoding: 'utf8' });
    assert.equal(after.status, 0, `import madmom after the fix: ${after.stderr}`);
    assert.equal(after.stdout.trim(), '0.17.post1');
    const again = spawnSync(PY, ['-'], { input: src, encoding: 'utf8' });
    assert.equal(again.status, 0);
    assert.equal(again.stdout.trim(), '', 'idempotent: a second run does nothing');
    assert.equal(fs.readFileSync(path.join(site, 'madmom', '__init__.py'), 'utf8').includes('try:'), false, 'the dist-info was enough: __init__.py untouched');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
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
