// #188 (VIZ research 6728364399): the converter's grid summary fields. Every tempo a ruling reads is a line fit,
// never the median of 20 ms-quantised intervals; drift is measured over the core; bar counts are checked; barOk
// survives a re-conversion of the same Beat This! output and a fields bump re-converts old sidecars.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { robustTempo, gridFields, toSidecar, ensureGrids, FIELDS, FRAME_MS } from '../../beatgrid.mjs';

const q20 = t => Math.round(t / 0.02) * 0.02;   // Beat This!'s 20 ms frames
const steady = (bpm, seconds, t0 = 0) => { const p = 60 / bpm, out = []; for (let t = t0; t < t0 + seconds; t += p) out.push(t); return out; };
const beatsOf = (ts, bpb = 4) => ts.map((t, i) => ({ ms: Math.round(t * 1e6) / 1e3, pos: (i % bpb) + 1 }));
const near = (a, b, rel) => Math.abs(a - b) / b <= rel;

test('robustTempo: an exact grid gives its tempo with no residual; a missed beat drops one IBI, not the tempo', () => {
  const ts = steady(125, 60), f = robustTempo(ts);
  assert.ok(near(f.bpm, 125, 1e-9), `${f.bpm}`);
  assert.ok(near(f.bpmTheilSen, 125, 1e-9), `Theil-Sen ${f.bpmTheilSen}`);
  assert.ok(f.rmsMs < 1e-6 && f.maxMs < 1e-6);
  assert.equal(f.inlierFrac, 1); assert.equal(f.suspect, false);
  const gap = ts.filter((_, i) => i !== 40), g = robustTempo(gap);
  assert.ok(near(g.bpm, 125, 1e-9), `missed beat: ${g.bpm}`);
  assert.equal(g.extraFrac, 0, 'a missed beat is a long IBI, not an extra beat');
  assert.equal(robustTempo([0, 1, 2]), null, 'too few beats');
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
  assert.equal(f.gridSuspect, false, `suspect: ${f.suspectWhy}`);
  assert.ok(near(f.bpmTheilSen, 123, 1e-3), `Theil-Sen ${f.bpmTheilSen}`);
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

// R15 (#188 6736333312): fields 1 fitted time against beat index, so every extra beat moved the line (Sandstorm read
// 149.9 for 136). The robust fit must recover a synthetic 120.00 grid within 0.1 % under each defect, and flag the
// grid (gridSuspect) for the ones that put beats where none belong: (b) and (d), not (a) or (c).
const rng = seed => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (r, from, to, k) => { const s = new Set(); while (s.size < k) s.add(from + Math.floor(r() * (to - from))); return s; };

test('R15: 120.00 within 0.1 % with (a) 5 % deleted, (b) 5 % inserted, (c) a 3 s gap, (d) a 32-beat double-time span', () => {
  const base = steady(120, 300).map(q20), N = base.length, r = rng(188);
  const del = pick(r, 1, N - 1, Math.round(0.05 * N));
  const ins = pick(r, 0, N - 1, Math.round(0.05 * N));
  const cases = {
    a: base.filter((_, i) => !del.has(i)),
    b: base.flatMap((t, i) => (ins.has(i) ? [t, q20(t + (base[i + 1] - t) * (0.4 + 0.2 * r()))] : [t])),   // spurious off-beats
    c: base.filter(t => t < 150 || t >= 153),
    d: base.flatMap((t, i) => (i >= 200 && i < 232 ? [t, q20((t + base[i + 1]) / 2)] : [t])),                // the gridder doubling up
  };
  const want = { a: false, b: true, c: false, d: true };
  for (const [k, ts] of Object.entries(cases)) {
    const f = gridFields(beatsOf(ts));
    assert.ok(near(f.bpmFit, 120, 1e-3), `(${k}) bpmFit ${f.bpmFit}`);
    assert.ok(near(f.bpmFitCore, 120, 1e-3), `(${k}) bpmFitCore ${f.bpmFitCore}`);
    assert.equal(f.gridSuspect, want[k], `(${k}) gridSuspect ${f.gridSuspect} (${f.suspectWhy}; inlierFrac ${f.inlierFrac}, extraFrac ${f.extraFrac})`);
    assert.ok(f.driftCore !== null && f.driftCore < 0.05, `(${k}) driftCore ${f.driftCore}: outliers and gaps are masked`);
    // longFrac (#188 6736790656): long IBIs are legitimate (intros, breakdowns, misses), report-only, never a flag
    if (k === 'a' || k === 'c') assert.ok(f.longFrac > 0 && f.extraFrac === 0, `(${k}) longFrac ${f.longFrac}, extraFrac ${f.extraFrac}`);
    else assert.ok(f.extraFrac > 0.02 && f.longFrac === 0, `(${k}) extraFrac ${f.extraFrac}, longFrac ${f.longFrac}`);
  }
});

test('R15: a tempo change the inlier mean blurs (400 beats at 120, 200 at 130) is flagged by the Theil-Sen cross-check', () => {
  const head = steady(120, 200), tail = steady(130, 200 * 60 / 130, head[head.length - 1] + 60 / 130);
  const f = robustTempo([...head, ...tail]);
  assert.equal(f.inlierFrac, 1, 'every IBI is inside ±12.5 %');
  assert.equal(f.extraFrac, 0);
  assert.ok(Math.abs(f.bpm - f.bpmTheilSen) / f.bpmTheilSen > 0.005, `mean ${f.bpm} vs Theil-Sen ${f.bpmTheilSen}`);
  assert.deepEqual(f.why, ['Theil-Sen']);
  assert.equal(f.suspect, true);
});

test('R15: driftCore masks gaps and low-confidence beats, and p95 - p5 ignores one bad window', () => {
  const ts = steady(124, 300);
  const beats = beatsOf(ts).map((b, i) => (i >= 300 && i < 310 ? { ...b, conf: 0.2 } : b));
  const wobble = ts.map((t, i) => (i === 320 ? t + 0.03 : t));                      // one beat 30 ms late: one window
  assert.ok(gridFields(beats).driftCore < 1e-6, 'low-confidence beats masked');
  assert.ok(gridFields(beatsOf(wobble)).driftCore < 0.01, `one late beat: ${gridFields(beatsOf(wobble)).driftCore}`);
});
