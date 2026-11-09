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
  assert.ok(f.excessRms < 2, `R16: frame noise is not misfit, excessRms ${f.excessRms} ms`);
  assert.deepEqual([f.masked, f.windowSuspect, M.windowRefusals(f)], [[], false, []]);
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

test('R16/R17: excessRms = √(rms² − frameMs²/12), reported; refusals: < 64 inliers, masked span, drift, mode A incoming gridSuspect', () => {
  assert.ok(Math.abs(M.excessRms(Math.sqrt(400 / 12 + 25), 20) - 5) < 1e-9, '7.63 ms at 20 ms frames is 5 ms of misfit');
  assert.equal(M.excessRms(5, 20), 0, 'under the frame floor: none');
  assert.ok(Math.abs(M.excessRms(5, 0) - 5) < 1e-12, 'unquantised: all of it');
  const drifting = grid(rampMs(126, 130, 300, 390, 450));
  assert.throws(() => M.planMix(RECIPE_A, OUT, drifting), /refused: .*in opus 300–390 s: drift [\d.]+ % ≥ 0\.3/);
  assert.throws(() => M.planMix(RECIPE_B, OUT, drifting), /refused: in opus .*drift/, 'R16: drift refused by default');
  const why = 'a live band, the drift is the test';
  assert.equal(M.planMix({ ...RECIPE_B, in: { ...RECIPE_B.in, allowDrift: true, why } }, OUT, drifting).in.fit.fitMode, 'piecewise', 'allowDrift: piecewise (6728321330)');
  assert.throws(() => M.planMix({ ...RECIPE_A, in: { ...RECIPE_A.in, allowDrift: true, why } }, OUT, drifting), /never allowed on mode A's incoming/);
  assert.throws(() => M.planMix({ ...RECIPE_A, out: { ...RECIPE_A.out, from: 60, to: 85 } }, OUT, IN), /out one-more-time 60–85 s: inlier beats \d+ < 64/);
  const gapped = grid(beatsMs(126, 450).filter(m => m < 340000 || m > 343000));
  assert.throws(() => M.planMix(RECIPE_B, OUT, gapped), /masked span [\d.]+–[\d.]+ s \([^)]*gap/);
  const extras = grid(beatsMs(126, 450, { every: 5 }));
  assert.throws(() => M.planMix(RECIPE_A, OUT, extras), /gridSuspect over the window/);
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

test('R16a: allowDrift needs a one-line why (else refused); mix.json reports gridSuspect over the window beside the whole-file gridSuspectFile', () => {
  const drifting = grid(rampMs(126, 130, 300, 390, 450));
  assert.throws(() => M.planMix({ ...RECIPE_B, in: { ...RECIPE_B.in, allowDrift: true } }, OUT, drifting), /in\.allowDrift needs a one-line "why"/);
  assert.throws(() => M.planMix({ ...RECIPE_B, in: { ...RECIPE_B.in, allowDrift: true, why: 'two\nlines' } }, OUT, drifting), /one-line "why"/);
  const p = M.planMix({ ...RECIPE_B, in: { ...RECIPE_B.in, allowDrift: true, why: 'drift on purpose' } }, OUT, drifting);
  assert.deepEqual([p.in.allowDrift, p.in.why, p.out.allowDrift, p.out.why], [true, 'drift on purpose', false, null]);
  const flaggedFile = { ...IN, gridSuspect: true };
  const q = M.planMix(RECIPE_A, OUT, flaggedFile);
  assert.deepEqual([q.in.gridSuspect, q.in.gridSuspectFile, q.out.gridSuspectFile], [false, true, null], 'the window is clean although the whole file is flagged (Opus\'s build)');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mixes-why-'));
  try {
    const f = path.join(dir, 'm.json'), m = M.loadMixes()[1];
    fs.writeFileSync(f, JSON.stringify({ version: 1, mixes: [{ ...m, in: { ...m.in, allowDrift: true } }] }));
    assert.throws(() => M.loadMixes(f), /one-line "why"/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
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
  const sr = 8000, recipe = { name: 'mix-c-d-a', mode: 'A', fadeBars: 4, out: { id: 'x', from: 10, to: 50, bar1At: null }, in: { id: 'y', from: 20, to: 60, bar1At: null } };
  const gOut = grid(beatsMs(123, 60, { q: false })), gIn = grid(beatsMs(126, 70, { q: false }));
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

// QA box, 9 Nov: qa/mix-make.sh failed at once in the runner clone ("Cannot find package 'playwright'"): Playwright is
// in QA_HOME/qa/node_modules (QA box's working copy), and a bare import from the runner clone's qa/ can't see it.
test('loadPlaywright: PLAYWRIGHT_DIR, then QA_HOME/qa, then beside mix-make.mjs; the error names every place', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mix-pw-'));
  try {
    const home = path.join(tmp, 'qa-home'), empty = path.join(tmp, 'runner-clone', 'qa');
    const pkg = path.join(home, 'qa', 'node_modules', 'playwright');
    fs.mkdirSync(pkg, { recursive: true }); fs.mkdirSync(empty, { recursive: true });
    fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: 'playwright', version: '0.0.0-fake', main: 'index.js' }));
    fs.writeFileSync(path.join(pkg, 'index.js'), "module.exports = { chromium: { fake: 'from QA_HOME' } };\n");
    assert.deepEqual(M.playwrightBases({ PLAYWRIGHT_DIR: '/pw', QA_HOME: home }, empty), ['/pw', path.join(home, 'qa'), empty]);
    assert.deepEqual(M.playwrightBases({}, empty), [empty]);
    assert.equal(M.loadPlaywright({ QA_HOME: home }, empty).chromium.fake, 'from QA_HOME', 'found through QA_HOME/qa/node_modules');
    assert.equal(M.loadPlaywright({ PLAYWRIGHT_DIR: path.join(home, 'qa') }, empty).chromium.fake, 'from QA_HOME');
    assert.throws(() => M.loadPlaywright({ QA_HOME: path.join(tmp, 'nowhere') }, empty),
      e => /Cannot find package 'playwright'/.test(e.message) && e.message.includes(path.join(tmp, 'nowhere', 'qa')) && e.message.includes(empty));
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('the box: Playwright resolves for qa/mix-make.sh from the runner settings\' QA_HOME (skips off the box)', (t) => {
  const files = [process.env.RUNNER_ENV, path.join(os.homedir(), '.config/cellular-viz-runner.env'), path.join(os.homedir(), '.cache/cellular-viz-runner/runner.env')].filter(Boolean);
  const file = files.find(f => fs.existsSync(f));
  if (!file) { t.skip('no runner settings here (not the box)'); return; }
  const line = fs.readFileSync(file, 'utf8').split('\n').filter(l => /^QA_HOME=/.test(l)).pop();
  if (!line) { t.skip(`no QA_HOME in ${path.basename(file)}`); return; }
  const home = line.slice('QA_HOME='.length).trim().replace(/^(['"])(.*)\1$/, '$2');
  const pw = M.loadPlaywright({ QA_HOME: home });   // only QA_HOME, as mix-make.sh sets it; never PLAYWRIGHT_DIR here
  assert.equal(typeof pw.chromium?.launch, 'function', 'playwright.chromium.launch');
});

// R17 (#188 6740153327): the first real run refused One More Time 60–150 s on excessRms 8.19 ms > 5 (rms 10.02 ms), the
// Beat This! jitter every clean grid shows. Steadiness is now tested in the tempo domain; excessRms is reported only.
test('R17: ~8 ms detector jitter is not refused (excessRms reported, excessFloor); refusals: extraFrac, inlierFrac, 25 ms jitter guard', () => {
  let seed = 12345;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;   // Park–Miller: exact in doubles
  const gauss = s => { let x = 0; for (let i = 0; i < 12; i++) x += rnd(); return (x - 6) * s; };
  const jittered = (bpm, lenS, sMs) => { const out = [], P = 60 / bpm; for (let t = 0.25; t < lenS; t += P) out.push(q20(t + gauss(sMs) / 1000) * 1000); return grid(out); };
  const OUTJ = jittered(123, 200, 8), INJ = jittered(126, 450, 8);
  const f = M.windowFit(OUTJ.beats, 60, 150);
  assert.ok(f.rmsMs > 8.5 && f.rmsMs < 11.5, `rms like One More Time's 10.0 ms: ${f.rmsMs}`);
  assert.ok(f.excessRms > 5, `excessRms over the old 5 ms limit: ${f.excessRms}`);
  assert.equal(f.fitMode, 'linear', `drift ${f.driftPct} % decides, not rms`);
  assert.ok(f.driftPct < 0.05, `halves drift sits far under 0.3 %: ${f.driftPct}`);
  assert.ok(typeof f.blockDriftPct16 === 'number' && f.blockDriftPct16 > 0, `16-beat block range reported only: ${f.blockDriftPct16}`);
  assert.ok(f.blockDrift64Pct < 0.1, `64-beat block range (R17a) sits under its limit: ${f.blockDrift64Pct}`);
  assert.ok(f.driftNoisePct > 0.005 && f.driftNoisePct < 0.03, `halves noise ~0.011 % from rms and count: ${f.driftNoisePct}`);
  assert.deepEqual(M.windowRefusals(f), [], 'nothing refuses a clean jittered window');
  for (const r of [RECIPE_A, RECIPE_B]) {
    const p = M.planMix(r, OUTJ, INJ);
    assert.equal(M.selfCheck(p, M.mixSidecar(p).beats.map(b => b.ms)).ok, true, `${r.mode}: the ≤ 1 ms self-check holds on a jittered source`);
    assert.ok(near(p.out.fit.bpm, 123, 5e-4) && near(p.in.fit.bpm, 126, 5e-4), `the fit averages the jitter: ${p.out.fit.bpm} / ${p.in.fit.bpm}`);
    assert.equal(p.out.fit.limits.excessRms, 'report-only (R17)');
  }
  const base = { n: 100, masked: [], rmsMs: 10, driftPct: 0.01, inlierFrac: 0.99, extraFrac: 0.01 };
  assert.deepEqual(M.windowRefusals(base), []);
  assert.match(M.windowRefusals({ ...base, rmsMs: 30 }).join('; '), /jitter: rms 30 ms > 25/);
  assert.match(M.windowRefusals({ ...base, extraFrac: 0.05 }).join('; '), /extraFrac 0\.05 > 0\.02/);
  assert.match(M.windowRefusals({ ...base, inlierFrac: 0.85 }).join('; '), /inlierFrac 0\.85 < 0\.9/);
  assert.deepEqual(M.windowRefusals({ ...base, driftPct: 0.5 }, { strict: false }), [], 'allowDrift skips only the drift test');
  assert.deepEqual(M.excessFloor([8.19, 7.9, null, 7.95]), { n: 3, median: 7.95, min: 7.9, max: 8.19 });
  assert.equal(M.excessFloor([]), null);
});

// R17a (6740224377): the halves test is blind to curvature; 64-beat blocks catch a window that speeds up and comes back.
test('R17a: a curved window (equal halves, ~0.55 % 64-beat block spread) refuses with drift; the noise floor is logged', () => {
  const curved = (bpm, amp, t0, t1, lenS) => {
    const out = [];
    for (let t = 0.25; t < lenS;) { out.push(t * 1000); const x = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); t += 60 / (bpm * (1 + amp * Math.sin(Math.PI * x))); }
    return grid(out);
  };
  const C = curved(123, 0.012, 60, 150, 200), f = M.windowFit(C.beats, 60, 150);
  assert.ok(f.driftPct < 0.1, `the halves see (almost) nothing: ${f.driftPct} %`);
  assert.ok(f.blockDrift64Pct >= 0.3, `64-beat blocks see the bulge: ${f.blockDrift64Pct} %`);
  assert.equal(f.fitMode, 'piecewise');
  assert.match(M.windowRefusals(f).join('; '), /drift [\d.]+ % ≥ 0\.3 \(64-beat blocks\) \(noise [\d.]+ %\)/);
  assert.throws(() => M.planMix(RECIPE_B, C, IN), /refused: out one-more-time 60–150 s: drift .*64-beat blocks/);
  assert.deepEqual(M.windowRefusals(f, { strict: false }), [], 'allowDrift (R16a) is the only way to a piecewise window');
  const short = M.windowFit(C.beats, 60, 110);
  assert.equal(short.blockDrift64Pct, null, `under 128 inliers (${short.n}) the halves test alone decides`);
  assert.equal(M.blockRangePct([{ k: 0, t: 0 }, { k: 1, t: 0.5 }], 64, 0.5), null);
  assert.ok(Math.abs(M.driftNoisePct(10, 184, 60 / 123) - 0.0113) < 0.0005, `halves noise at 10 ms, 184 beats, 123 BPM: ${M.driftNoisePct(10, 184, 60 / 123)}`);
});
