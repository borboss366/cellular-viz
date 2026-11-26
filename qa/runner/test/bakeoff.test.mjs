// beatd task 1, the offline tracker comparison (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 1): the scorer
// qa/bakeoff-score.mjs on synthetic grids, and the shape of the fixed script qa/bakeoff.sh and its runner. No audio,
// no Python here: the trackers run on the box (sh qa/bakeoff.sh <session> <row>).
//   node --test qa/runner/test/bakeoff.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as B from '../../bakeoff-score.mjs';

const QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const grid = (bpm, from, to, phase = 0) => { const P = 60 / bpm, out = []; for (let t = from + phase; t < to; t += P) out.push(+t.toFixed(6)); return out; };

test('bakeoff scorer: exact, shifted, half-beat off, double tempo and silence on a 120 bpm reference', () => {
  const ref = grid(120, 0, 60), refs = B.refBeats(ref);
  assert.equal(refs.filter(r => r.gap).length, 0);
  const res = B.scoreRecording({ row: 'test-1', refTimes: ref, runs: [
    { tracker: 'exact', status: 'ok', beats: ref.map(t => [t, t + 0.12]), cpuPerAudioS: 0.02 },
    { tracker: 'late60', status: 'ok', beats: ref.map(t => [t + 0.06, t + 0.06]) },
    { tracker: 'offbeat', status: 'ok', beats: ref.map(t => [t + 0.25, t + 0.25]) },
    { tracker: 'double', status: 'ok', beats: grid(240, 0, 60).map(t => [t, t]) },
    { tracker: 'dead', status: 'dropped', why: 'did not install within 3600 s: no compiler' },
  ] });
  const by = Object.fromEntries(res.candidates.map(c => [c.id, c]));
  assert.equal(by.exact.in, 100); assert.equal(by.exact.inRaw, 100); assert.equal(by.exact.shiftMs, 0);
  assert.deepEqual(by.exact.delayMs && [by.exact.delayMs.median, by.exact.delayMs.p90], [120, 120], 'reported 120 ms after the beat');
  assert.equal(by.exact.cpuPerAudioS, 0.02);
  // 60 ms late: outside +-35 raw, inside after the one constant shift (the brief's stated delay constant)
  assert.equal(by.late60.inRaw, 0); assert.equal(by.late60.in, 100); assert.equal(by.late60.shiftMs, 60);
  assert.equal(by.late60.delayMs.median, 60);
  // half a beat off: the wrong side, which no constant shift may hide (it is outside NEAR_PHI)
  assert.equal(by.offbeat.in, 0); assert.equal(by.offbeat.side, 100); assert.equal(by.offbeat.shiftMs, 0);
  // double tempo: the octave class, not in
  assert.equal(by.double.octave, 100); assert.equal(by.double.in, 0);
  assert.deepEqual(by.dead, { id: 'dead', status: 'dropped', why: 'did not install within 3600 s: no compiler' });
  // a stretch of silence in the candidate: lost, and the played time is the reference's
  const gap = B.scoreRecording({ row: 'test-2', refTimes: ref, runs: [{ tracker: 'gappy', status: 'ok', beats: ref.filter(t => t < 30).map(t => [t, t]) }] });
  assert.ok(Math.abs(gap.candidates[0].in - 50) < 1.5, `half the time in: ${gap.candidates[0].in}`);
  assert.ok(Math.abs(gap.candidates[0].lost - 50) < 1.5);
  assert.ok(Math.abs(gap.playedS - 60) < 1);
});

test('bakeoff scorer: gaps in the reference are not played time; mix points and the recovery after them', () => {
  const ref = [...grid(120, 0, 40), ...grid(126, 50, 90)];   // 10 s of silence, then a faster track
  const refs = B.refBeats(ref);
  assert.equal(refs.filter(r => r.gap).length, 1, 'the 10 s pause is one gap');
  const pts = B.mixPoints(refs);
  assert.ok(pts.length >= 1, 'the tempo change is a mix point');
  // a phase break inside one tempo: a jump of half a beat
  const brk = [...grid(120, 0, 30), ...grid(120, 30.25, 60)];
  assert.ok(B.mixPoints(B.refBeats(brk)).length >= 1, 'a phase jump is a mix point');
  // a candidate that keeps the old tempo for 8 s after the change, then locks: recovery about 8 s
  const cand = [...grid(120, 0, 40), ...grid(120, 50, 58), ...grid(126, 58, 90, 0)].map(t => [t, t]);
  const r = B.scoreRecording({ row: 'mix-x', refTimes: ref, runs: [{ tracker: 'slow', status: 'ok', beats: cand }] });
  const c = r.candidates[0];
  assert.ok(c.recovery.points >= 1);
  assert.ok(c.recovery.medianS === null || c.recovery.medianS >= 0, JSON.stringify(c.recovery));
});

test('bakeoff scorer: ours from the session log (shadow and clock beats onto the recording with startCtx), lenient read', () => {
  const ref = grid(120, 0, 30);
  const lines = [
    JSON.stringify({ type: 'session', v: 3, ctx: 0, id: 'x' }),
    ...ref.map(t => JSON.stringify({ type: 'beat', src: 'shadow', ctx: 100 + t })),
    ...ref.map(t => JSON.stringify({ type: 'beat', src: 'clock', ctx: 100 + t + 0.01 })),
    JSON.stringify({ type: 'someNewType', ctx: 1 }), '{"cut', '',
  ].join('\n');
  const { records, skipped } = B.readLogLenient(lines);
  assert.equal(skipped, 1, 'the cut line is skipped, the new type kept');
  const o = B.oursFromLog(records, 100);
  assert.equal(o.shadow.length, ref.length); assert.ok(Math.abs(o.clock[0] - 0.01) < 1e-9);
  const res = B.scoreRecording({ row: 'wired-1', refTimes: ref, runs: [], records, startCtx: 100 });
  const by = Object.fromEntries(res.candidates.map(c => [c.id, c]));
  assert.equal(by[B.OURS.shadow].in, 100); assert.equal(by[B.OURS.clock].in, 100);
  assert.equal(by[B.OURS.shadow].delayMs, null, 'no report times in the log: delay n/a');
  const none = B.scoreRecording({ row: 'wired-1', refTimes: ref, records, startCtx: null });
  assert.ok(none.candidates.every(c => c.status === 'failed' && /startCtx/.test(c.why)));
  // the report: the row id and numbers only (R9)
  const md = B.renderRecording(res);
  assert.match(md, /^### wired-1/);
  assert.match(md, /\| ours-alone \| 100 \|/);
  assert.doesNotMatch(md, /conductor-\d|\.wav|\.jsonl|qa-audio|sessions\//, 'no file names in the report');
  const sum = B.summarize([res, { ...res, row: 'mix-1', playedS: res.playedS }]);
  assert.equal(sum[0].in, 100);
  assert.match(B.renderSummary(sum), /wired-1 100; mix-1 100/);
});

test('bakeoff.sh: a fixed script for QA box (sh -n), named session and row only, the hour per install, the GPU lock, no names out', () => {
  const sh = fs.readFileSync(path.join(QA, 'bakeoff.sh'), 'utf8');
  const n = spawnSync('sh', ['-n', path.join(QA, 'bakeoff.sh')], { encoding: 'utf8' });
  assert.equal(n.status, 0, n.stderr);
  assert.match(sh, /\^conductor-\[0-9\]\{8\}-\[0-9\]\{6\}/, 'the session must look like a conductor session id');
  assert.match(sh, /\^\[a-z\]\[a-z0-9-\]\{0,23\}\$/, 'the row is a plain id like wired-1');
  assert.match(sh, /INSTALL_S=\$\{BAKEOFF_INSTALL_S:-3600\}/, 'an hour per install');
  assert.match(sh, /timeout "\$INSTALL_S"/);
  assert.match(sh, /gpu-lock\.sh" "bakeoff-ref-/); assert.match(sh, /gpu-lock\.sh" "bakeoff-\$id-/);
  assert.match(sh, /note "\$id" dropped/, 'a tracker that does not install is a row, not a stop');
  assert.match(sh, /\.venv-beatthis/, 'the reference uses the Beat This! venv of ref-beats.sh');
  assert.match(sh, /\.venv-vote\/bin\/python/, 'madmom reuses the vote venv when it imports there');
  assert.match(sh, /pip install -q --no-build-isolation -r "\$2"/, 'source builds against the venv numpy (pre list first)');
  assert.match(sh, /OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1/, 'one BLAS thread: CPU compares trackers, not BLAS builds');
  assert.match(sh, /sys\.modules\.setdefault\("pyaudio"/, 'BeatNet imports with the pyaudio stand-in');
  // the git installs are pinned to commits, Cython 3.0.x for madmom's build
  const pins = ['madmom.txt', 'beatnet.txt', 'beatnet.nodeps.txt'].map(f => fs.readFileSync(path.join(QA, 'bakeoff', f), 'utf8')).join('\n');
  for (const m of pins.matchAll(/git\+https:\/\/github\.com\/\S+/g)) assert.match(m[0], /@[0-9a-f]{40}$/, `pinned: ${m[0]}`);
  assert.match(fs.readFileSync(path.join(QA, 'bakeoff', 'madmom.pre.txt'), 'utf8'), /^Cython==3\.0\.\d+$/m);
  assert.doesNotMatch(sh, /\bapt(-get)?\b\s+install/, 'no apt');
  for (const id of ['aubio', 'madmom', 'beatnet']) assert.ok(fs.existsSync(path.join(QA, 'bakeoff', `${id}.txt`)), `qa/bakeoff/${id}.txt`);
  // a usage error: no session and row
  const u = spawnSync('sh', [path.join(QA, 'bakeoff.sh')], { encoding: 'utf8' });
  assert.notEqual(u.status, 0); assert.match(u.stderr, /usage/);
  const bad = spawnSync('sh', [path.join(QA, 'bakeoff.sh'), '../etc', 'wired-1'], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.match(bad.stderr, /not a session name/);
});

test('bakeoff runner: the three trackers in their online modes, beats as [t, at], no tuning knobs', () => {
  const py = fs.readFileSync(path.join(QA, 'bakeoff_run.py'), 'utf8');
  for (const id of ['aubio', 'madmom', 'beatnet']) assert.match(py, new RegExp(`'${id}': \\{'run': run_${id}`), id);
  assert.match(py, /RNNBeatProcessor\(online=True, nn_files=\[BEATS_LSTM\[0\]\], fps=fps\)/, 'madmom: the online program\'s one network');
  assert.match(py, /DBNBeatTrackingProcessor\(fps=fps, online=True\)/);
  assert.match(py, /process_online\(act\[i:i \+ 1\], reset=\(i == 0\)\)/, 'madmom fed one frame at a time, state kept');
  assert.match(py, /mode='realtime', inference_model='PF'/, 'BeatNet realtime, particle filter, frame by frame');
  assert.match(py, /activation_extractor_realtime\(path\)/);
  assert.match(py, /aubio\.tempo\('default', win, hop, rate\)/); assert.match(py, /win, hop = 512, 256/, 'aubio command line defaults');
  assert.match(py, /'build': numpy_build\(\)/, 'the numpy / BLAS build is recorded');
  assert.doesNotMatch(py, /argparse[\s\S]*add_argument\('--(threshold|bpm|tempo|min_bpm|max_bpm)/, 'no per-recording settings');
  const ref = fs.readFileSync(path.join(QA, 'bakeoff_ref.py'), 'utf8');
  assert.match(ref, /Audio2Beats\(checkpoint_path=a\.model, device='cpu', dbn=False\)/, 'the same Beat This! call as ref_beats.py');
});
