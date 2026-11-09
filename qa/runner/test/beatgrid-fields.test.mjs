// #188 (VIZ research 6728364399): the converter's grid summary fields. Every tempo a ruling reads is a line fit,
// never the median of 20 ms-quantised intervals; drift is measured over the core; bar counts are checked; barOk
// survives a re-conversion of the same Beat This! output and a fields bump re-converts old sidecars.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fitLine, gridFields, toSidecar, ensureGrids, FIELDS, FRAME_MS } from '../../beatgrid.mjs';

const q20 = t => Math.round(t / 0.02) * 0.02;   // Beat This!'s 20 ms frames
const steady = (bpm, seconds, t0 = 0) => { const p = 60 / bpm, out = []; for (let t = t0; t < t0 + seconds; t += p) out.push(t); return out; };
const beatsOf = (ts, bpb = 4) => ts.map((t, i) => ({ ms: Math.round(t * 1e6) / 1e3, pos: (i % bpb) + 1 }));
const near = (a, b, rel) => Math.abs(a - b) / b <= rel;

test('fitLine: an exact grid gives its tempo with no residual; a missed beat skips an index, not the line', () => {
  const ts = steady(125, 60), f = fitLine(ts);
  assert.ok(near(f.bpm, 125, 1e-9), `${f.bpm}`);
  assert.ok(f.rmsMs < 1e-6 && f.maxMs < 1e-6);
  const gap = ts.filter((_, i) => i !== 40), g = fitLine(gap);
  assert.ok(near(g.bpm, 125, 1e-9), `missed beat: ${g.bpm}`);
  assert.equal(fitLine([0, 1, 2]), null, 'too few beats');
});

test('A1′: on 20 ms frames the line fit is within 0.05 % where the median of intervals is off by up to 2 %', () => {
  const ts = steady(123, 300).map(q20), f = gridFields(beatsOf(ts));
  assert.ok(near(f.bpmFit, 123, 5e-4), `bpmFit ${f.bpmFit}`);
  assert.ok(near(f.bpmFitCore, 123, 5e-4), `bpmFitCore ${f.bpmFitCore}`);
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b), median = 60 / gaps[gaps.length >> 1];
  assert.ok(Math.abs(median - 123) / 123 > 0.015, `the median reads ${median.toFixed(2)}: the reason it is never used`);
  assert.equal(f.frameMs, FRAME_MS);
  assert.ok(f.fitResidualRms < 7 && f.fitResidualMax <= 10.5, `residual ${f.fitResidualRms} / ${f.fitResidualMax} ms: frame noise only`);
  assert.ok(f.driftCore < 1.5, `driftCore ${f.driftCore} %: frame noise must not read as drifting`);
});

test('A1″: a beatless-intro artefact pollutes bpmFit but not bpmFitCore; driftCore is ~0 on a constant core', () => {
  const intro = steady(140, 30), body = steady(125, 270, intro[intro.length - 1] + 60 / 125);
  const f = gridFields(beatsOf([...intro, ...body]));
  assert.ok(near(f.bpmFitCore, 125, 5e-4), `core ${f.bpmFitCore}`);
  assert.ok(Math.abs(f.bpmFit - 125) > Math.abs(f.bpmFitCore - 125) * 5, `whole-track ${f.bpmFit} is the polluted one`);
  assert.ok(f.driftCore < 0.01, `driftCore ${f.driftCore} on an exact constant core`);
});

test('A1″: a real tempo wander shows in driftCore (120 → 126 over the core reads about 5 %)', () => {
  const ts = []; let t = 0;
  for (let i = 0; t < 300; i++) { const bpm = 120 + 6 * Math.min(1, Math.max(0, (t - 30) / 240)); ts.push(t); t += 60 / bpm; }
  const f = gridFields(beatsOf(ts));
  assert.ok(f.driftCore > 3 && f.driftCore < 6, `driftCore ${f.driftCore}`);
});

test('A7c: beatsPerBar and barSuspect; short grids have no core', () => {
  const ok = gridFields(beatsOf(steady(128, 120)));
  assert.equal(ok.beatsPerBar, 4);
  assert.equal(ok.barSuspect, false);
  const restarts = gridFields(beatsOf(steady(128, 120), 3));   // the gridder restarting its count: more "1"s than bars
  assert.equal(restarts.barSuspect, true);
  const none = gridFields(steady(128, 120).map(t => ({ ms: t * 1000 })));
  assert.equal(none.beatsPerBar, null);
  assert.equal(none.barSuspect, true, 'no downbeats: not trusted');
  const short = gridFields(beatsOf(steady(128, 50)));
  assert.equal(short.bpmFitCore, null);
  assert.equal(short.driftCore, null);
  assert.ok(near(short.bpmFit, 128, 1e-9));
});

test('the sidecar carries the fields, barOk false and barOkCleared null; FIELDS re-converts old sidecars, edits kept', () => {
  const side = toSidecar(steady(125, 90).map((t, i) => ({ t, n: (i % 4) + 1 })));
  assert.equal(side.version, 2, 'still v2: clock.js reads it as before');
  assert.equal(side.fields, FIELDS);
  assert.equal(side.barOk, false);
  assert.equal(side.barOkCleared, null);
  assert.ok(near(side.bpmFit, 125, 1e-6));

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beatgrid-fields-'));
  try {
    const ref = path.join(dir, 'a-track.ref.beats'), out = path.join(dir, 'a-track.beatgrid.json');
    fs.writeFileSync(ref, steady(125, 90).map((t, i) => `${t.toFixed(4)}\t${(i % 4) + 1}`).join('\n') + '\n');
    assert.equal(ensureGrids(dir).length, 1);
    const made = JSON.parse(fs.readFileSync(out, 'utf8'));
    // an old sidecar: no fields, a hand edit and a user-confirmed bar, newer than its .ref.beats
    const { fields: _f, bpmFit: _b, ...old } = made;
    old.edits = [{ kind: 'setOne', atMs: made.beats[5].ms, by: 'user' }];
    old.barOk = true;
    fs.writeFileSync(out, JSON.stringify(old));
    assert.equal(ensureGrids(dir).length, 1, 'no fields: converted again');
    const again = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(again.fields, FIELDS);
    assert.equal(again.edits.length, 1, 'the hand edit survived');
    assert.equal(again.beats[5].pos, 1, 'and was replayed');
    assert.equal(again.barOk, true, 'the same Beat This! output: the confirmed bar stays confirmed');
    assert.equal(again.barOkCleared, null);
    assert.deepEqual(ensureGrids(dir), [], 'current fields and newer than the ref: nothing to do');

    const later = new Date(Date.now() + 5000); fs.utimesSync(ref, later, later);   // Beat This! ran again
    assert.equal(ensureGrids(dir).length, 1);
    const regrid = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(regrid.barOk, false, 'a new grid clears the confirmation');
    assert.equal(regrid.barOkCleared, 'regrid');
    assert.equal(regrid.edits.length, 1, 'the edit is still kept');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
