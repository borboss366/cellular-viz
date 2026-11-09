// The mix tool (#188 T7/T13, qa/mix-make.mjs): window fits (A1′/R15), the mode A and B plans, the derived truth (R12),
// the ≤ 1 ms self-check, the render on synthetic clicks, and the recipes/names. No audio files, no browser.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as M from '../../mix-make.mjs';
import { isRender, isSourceTrack, RENDER_FILE_RE } from '../audio.mjs';

const q20 = t => Math.round(t / 0.02) * 0.02;
/** reference beats (ms) at bpm from 0.25 s to lenS; q: on 20 ms frames; every: an extra off-beat after every n-th beat */
function beatsMs(bpm, lenS, { q = true, every = 0 } = {}) {
  const out = [], P = 60 / bpm;
  let i = 0;
  for (let t = 0.25; t < lenS; t += P, i++) {
    out.push((q ? q20(t) : t) * 1000);
    if (every && i % every === every - 1) out.push((q ? q20(t + P / 2) : t + P / 2) * 1000);
  }
  return out;
}
/** a tempo ramp from b0 to b1 over [t0, t1] (constant outside), unquantised */
function rampMs(b0, b1, t0, t1, lenS) {
  const out = [];
  for (let t = 0.25; t < lenS;) { out.push(t * 1000); const x = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); t += 60 / (b0 + (b1 - b0) * x); }
  return out;
}
const grid = ms => ({ beats: ms.map(m => ({ ms: m })) });
const near = (a, b, rel) => Math.abs(a - b) / Math.abs(b) <= rel;
const RECIPE_A = { name: 'mix-a-b-a', mode: 'A', fadeBars: 16, out: { id: 'one-more-time', from: 60, to: 150, bar1At: null }, in: { id: 'opus', from: 300, to: 390, bar1At: null } };
const RECIPE_B = { name: 'mix-a-b-b', mode: 'B', fadeS: 8, out: { id: 'one-more-time', from: 60, to: 150 }, in: { id: 'opus', from: 300, to: 390 } };
const OUT = grid(beatsMs(123, 200)), IN = grid(beatsMs(126, 450));

test('windowFit: a fitted line, never a median (A1′); extra off-beats dropped (R15); a drifting window fits piecewise', () => {
  const f = M.windowFit(OUT.beats, 60, 150);
  assert.ok(near(f.bpm, 123, 5e-4), `bpm ${f.bpm}`);
  assert.equal(f.fitMode, 'linear', `rms ${f.rmsMs} ms, drift ${f.driftPct} %`);
  assert.ok(f.rmsMs < 7 && f.maxMs <= 10.5, `frame noise only: ${f.rmsMs} / ${f.maxMs} ms`);
  const x = M.windowFit(beatsMs(126, 450, { every: 5 }), 300, 390);
  assert.ok(near(x.bpm, 126, 5e-4), `with 20 % extra beats: ${x.bpm}`);
  assert.equal(x.fitMode, 'linear');
  assert.ok(x.total - x.n >= 30, `extras dropped: ${x.total - x.n}`);
  const ramp = rampMs(120, 123, 60, 150, 200), d = M.windowFit(ramp, 60, 150);
  assert.equal(d.fitMode, 'piecewise', `drift ${d.driftPct} %`);
  assert.ok(d.driftPct > 0.3);
  const inWin = ramp.map(m => m / 1000).filter(t => t >= 60 && t <= 150);
  const worst = Math.abs(d.at(50) - inWin[50]) * 1000;
  assert.ok(worst < 1, `the piecewise fit follows the drift: ${worst} ms at beat 50`);
  assert.throws(() => M.windowFit(OUT.beats, 60, 62), /too few reference beats/);
});

test('mode A: ratio from the window fits, a 16-bar fade on the outgoing grid, the incoming on an outgoing beat, one tempo through', () => {
  const p = M.planMix(RECIPE_A, OUT, IN);
  assert.ok(near(p.ratio, 123 / 126, 2e-4), `ratio ${p.ratio}`);
  assert.equal(p.stretch, 'resample');
  assert.equal(p.overlap.endBeat - p.overlap.startBeat, 64, '16 bars');
  assert.equal(p.overlap.midBeat - p.overlap.startBeat, 32, 'the midpoint on a bar line');
  assert.ok(Math.abs(p.overlap.midS - (p.overlap.startS + p.overlap.endS) / 2) < 1e-9);
  const P = 60 / p.out.fit.bpm, ibis = p.beats.slice(1).map((b, i) => b.t - p.beats[i].t);
  assert.ok(ibis.every(d => Math.abs(d - P) < 0.001), `beat-matched: every interval within 1 ms of ${P}`);
  assert.ok(p.beats.slice(0, p.overlap.midBeat).every(b => b.side === 'out') && p.beats.slice(p.overlap.midBeat).every(b => b.side === 'in'), 'the grid switches at the midpoint (R5′)');
  assert.equal(p.beats[p.overlap.startBeat].n, 1, 'beat-in-bar 1 where the fade starts');
  assert.deepEqual([p.align, p.alignReason, p.reportOnly], ['beat', 'no bar1At', true], 'no bar1At yet: beats aligned, flagged, report-only (R13)');
  const side = M.mixSidecar(p);
  assert.deepEqual([side.version, side.gridSuspect, side.derived, side.barOk, side.barOkCleared, side.mix.mode, side.mix.align], [2, false, true, false, 'mix', 'A', 'beat']);
  assert.ok(Math.abs(side.mix.midMs - p.overlap.midS * 1000) < 0.001);
  assert.equal(M.selfCheck(p, side.beats.map(b => b.ms)).ok, true);

  // bar1At for both (R13): the fade starts on an outgoing downbeat and the incoming starts on its own downbeat
  const bar1Out = q20(0.25 + 2 * 60 / 123), bar1In = q20(0.25 + 3 * 60 / 126);
  const b = M.planMix({ ...RECIPE_A, out: { ...RECIPE_A.out, bar1At: bar1Out }, in: { ...RECIPE_A.in, bar1At: bar1In } }, OUT, IN);
  const fo = b.fits.out, fi = b.fits.in, mod4 = x => ((x % 4) + 4) % 4;
  assert.deepEqual([b.align, b.alignReason, b.reportOnly], ['bar1At', null, false]);
  assert.equal(mod4(b.beats[b.overlap.startBeat].k - Math.round((bar1Out - fo.a) / fo.b)), 0, 'the fade starts on an outgoing "1"');
  assert.equal(mod4(Math.round((b.in.s0 - fi.a) / fi.b) - Math.round((bar1In - fi.a) / fi.b)), 0, 'the incoming starts on its "1"');
  assert.equal(M.mixSidecar(b, { barOkOut: true, barOkIn: true }).barOk, true, 'barOk only when both inputs are confirmed');
  assert.equal(M.mixSidecar(b, { barOkOut: true, barOkIn: false }).barOk, false);
});

test('mode A refuses an incoming window that drifts; mode B takes it', () => {
  const drifting = grid(rampMs(126, 130, 300, 390, 450));
  assert.throws(() => M.planMix(RECIPE_A, OUT, drifting), /mode A needs a constant-tempo incoming window/);
  assert.equal(M.planMix(RECIPE_B, OUT, drifting).in.fit.fitMode, 'piecewise');
  assert.throws(() => M.planMix({ ...RECIPE_A, fadeBars: 15 }, OUT, IN), /even/);
});

test('mode B: no resample, an 8 s fade ending at the outgoing window end, two tempos, fadeBars null', () => {
  const p = M.planMix(RECIPE_B, OUT, IN);
  assert.deepEqual([p.ratio, p.stretch, p.fadeBars, p.align], [1, 'none', null, 'none']);
  assert.ok(Math.abs(p.fadeS - 8) < 1e-9 && Math.abs(p.overlap.midS - p.overlap.startS - 4) < 1e-9);
  assert.ok(Math.abs(p.overlap.endS + p.out.fromS - 150) < 1e-4, 'the fade ends at the window end');
  const before = p.beats.filter(b => b.side === 'out'), after = p.beats.filter(b => b.side === 'in');
  const gap = arr => arr.slice(1).map((b, i) => b.t - arr[i].t);
  assert.ok(gap(before).every(d => Math.abs(d - 60 / p.out.fit.bpm) < 0.001), 'outgoing tempo until the midpoint');
  assert.ok(gap(after).every(d => Math.abs(d - 60 / p.in.fit.bpm) < 0.001), 'incoming tempo after it (no resample)');
  assert.ok(near(p.out.fit.bpm, 123, 5e-4) && near(p.in.fit.bpm, 126, 5e-4));
  assert.ok(after[0].t >= p.overlap.midS - 1e-9 && before[before.length - 1].t < p.overlap.midS);
  assert.equal(M.selfCheck(p, M.mixSidecar(p).beats.map(b => b.ms)).ok, true);
});

test('self-check: a beat 2 ms off its fitted grid fails the build (≤ 1 ms, 6728321330)', () => {
  const p = M.planMix(RECIPE_A, OUT, IN), ms = M.mixSidecar(p).beats.map(b => b.ms);
  assert.ok(M.selfCheck(p, ms).maxDevMs < 0.01);
  const j = p.overlap.midBeat + 10, bad = ms.map((m, i) => (i === j ? m + 2 : m));
  const r = M.selfCheck(p, bad);
  assert.equal(r.ok, false);
  assert.ok(r.maxDevMs > 1.5, `${r.maxDevMs}`);
});

test('renderMix: outgoing untouched before the fade, the resampled incoming clicks land on the derived beats', () => {
  const sr = 8000, recipe = { name: 'mix-c-d-a', mode: 'A', fadeBars: 4, out: { id: 'x', from: 10, to: 40, bar1At: null }, in: { id: 'y', from: 20, to: 50, bar1At: null } };
  const gOut = grid(beatsMs(123, 60, { q: false })), gIn = grid(beatsMs(126, 60, { q: false }));
  const p = M.planMix(recipe, gOut, gIn, { sr });
  const clicks = (ms, startS, lenS) => {
    const d = new Float32Array(Math.ceil(lenS * sr));
    for (const m of ms) { const i = Math.round((m / 1000 - startS) * sr); if (i >= 0 && i < d.length) d[i] = 0.5; }
    return d;
  };
  const outLen = p.out.toS - p.out.fromS + 0.05, inStart = p.in.s0 - 0.05, inLen = (p.mixLenS - p.m0) * p.ratio + 0.2;
  const outCut = { startS: p.out.fromS, data: [clicks(gOut.beats.map(b => b.ms), p.out.fromS, outLen)] };
  const inCut = { startS: inStart, data: [clicks(gIn.beats.map(b => b.ms), inStart, inLen)] };
  const pcm = M.renderMix(p, outCut, inCut, sr);
  assert.equal(pcm.length, Math.round(p.mixLenS * sr) * 2);
  for (let i = 0; i < Math.floor(p.overlap.startS * sr); i += 97) assert.equal(pcm[i * 2], Math.round(outCut.data[0][i] * 32767), `sample ${i}`);
  const late = p.beats.filter(b => b.side === 'in' && b.t > p.overlap.endS + 0.1);
  assert.ok(late.length > 10);
  for (const b of late) {
    const c = Math.round(b.t * sr);
    let best = c, bv = -1;
    for (let i = c - 40; i <= c + 40; i++) { const v = Math.abs(pcm[i * 2]); if (v > bv) { bv = v; best = i; } }
    assert.ok(Math.abs(best - b.t * sr) <= 1.5, `click at ${best} for a beat at ${(b.t * sr).toFixed(2)}`);
  }
});

test('recipes and names: qa/mixes.json by corpus id, mix- names are renders (never gridded), served from renders/ only', () => {
  const mixes = M.loadMixes();
  assert.deepEqual(mixes.map(m => [m.name, m.mode, m.slot]), [['mix-one-more-time-opus-a', 'A', 'T13'], ['mix-one-more-time-opus-b', 'B', 'T7']]);
  assert.deepEqual([mixes[0].fadeBars, mixes[1].fadeS], [16, 8]);
  for (const n of ['mix-one-more-time-opus-a.wav', 'mix-one-more-time-opus-a.beatgrid.json', 'mix-one-more-time-opus-b.mix.json']) {
    assert.equal(isRender(n), true, n);
    assert.equal(isSourceTrack(n), false, n);
    assert.equal(RENDER_FILE_RE.test(n), true, n);
  }
  assert.equal(isSourceTrack('my-playlist-mix.flac'), true, 'a user file with "mix" inside its name is still a track');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mixes-'));
  try {
    const bad = (m, re) => { const f = path.join(dir, 'm.json'); fs.writeFileSync(f, JSON.stringify({ version: 1, mixes: [m] })); assert.throws(() => M.loadMixes(f), re); };
    bad({ ...mixes[0], out: { ...mixes[0].out, id: 'no-such-id' } }, /not a corpus\.json id/);
    bad({ ...mixes[0], fadeBars: 7 }, /even fadeBars/);
    bad({ ...mixes[0], name: 'one-more-time-opus' }, /must start with "mix-"/);
    bad({ ...mixes[1], fadeS: undefined }, /mode B needs fadeS/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
