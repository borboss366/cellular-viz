#!/usr/bin/env node
// The mix tool (#188 T7/T13; VIZ research 6728251745 R12 + R5′, 6728321330, 6728364399 A1′/A7c, R13, R14, R15).
// Two corpus tracks by id, two cut windows, a fade and a mode → a mixed WAV, its derived beat grid and a mix.json, in
// <QA_AUDIO_DIR>/renders/ with the `mix-` prefix (qa/render-names.json keeps them away from ref_beats.py). Node only,
// no ffmpeg: Chromium's own decoder at 48 kHz (decodeAudioData in an OfflineAudioContext, sample-accurate cuts), the
// resample and the equal-power fade are done here.
//
//   node qa/mix-make.mjs [--dir <tracks dir>] [--only <name>] [--plan] [--verify] [--force]   (qa/mix-make.sh: no args)
//
// R12: the truth of a mix is derived, never detected. Per cut window the reference beats get a fitted grid (A1′,
// never a median): `linear` when the tempo drifts < 0.3 % over the window (R17: drift only; excessRms is reported), else
// `piecewise` (an 8-beat moving linear fit, only for a side marked allowDrift). The mix's beats are those grids mapped through the cut, the
// resample and the start time; ref_beats.py never sees a mix.
//   mode A (T13, beat-matched): the incoming track is resampled by ratio = bpmFit(out window) / bpmFit(in window)
//     (`asetrate`-style: every time scales, nothing else moves) and started on an outgoing beat; its window must be
//     constant-tempo (linear). The fade is fadeBars bars (even) of the outgoing grid, so the midpoint is a bar line.
//     With bar1At set for both tracks in qa/mixes.json (R13, by ear with key M) the fade starts on an outgoing downbeat
//     and the incoming starts on its downbeat (`align: "bar1At"`); without, the beats align and the mix says so
//     (`align: "beat"`, `alignReason: "no bar1At"`), and the scorer's mode A rows stay report-only.
//   mode B (T7, unmatched): no resample, a fadeS-second fade (8) ending at the outgoing window's end, incoming from its
//     window start, `fadeBars: null`.
// The grid switches at the fade midpoint (R5′). Hard self-check (6728321330): the written beats are mapped back to
// each source and fitted again with the same mode; any beat more than 1 ms off fails the build, nothing is written.
// R14: T12's alignLag (a lossy twin against its FLAC) is measured with the same decoder as part of the run, when
// corpus.json's alignSha doesn't match the files; it writes renders/align-<id>.json with the corpus.json fields for
// the user to commit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { robustTempo, toSidecar } from './beatgrid.mjs';
import { wavBytes, writeAtomic } from './runner/audiocheck.mjs';
import { audioDir, sourceTracks, sha256 } from './runner/audio.mjs';
import { loadCorpus, loadMap } from './corpus.mjs';
import { alignLagCheck, alignFields, alignNeeded } from './conduct-score.mjs';

export const SR = 48000, RENDERS = 'renders', PREFIX = 'mix-';
// R16 (#188 6738446518): excessRms is the misfit ON TOP of the gridder's frame noise (uniform on frameMs: σ =
// frameMs/√12, 5.77 ms at 20 ms): excessRms = √(max(0, rms² − frameMs²/12)). A window is refused with fewer than 64
// inlier beats, any masked span (R15's mask: a 16-IBI window with > 25 % outlier IBIs, a gap > 1.8 × the median IBI,
// or a beat under 0.5 confidence), drift ≥ 0.3 %, and mode A's incoming window also when it is gridSuspect (R15's
// rules over the window's own beats). A side with allowDrift: true in mixes.json (never mode A's incoming) skips the
// drift refusal and is fitted piecewise (6728321330: drifting sources are welcome as mode A's outgoing side and in B).
// R17 (#188 6740153327): Beat This!'s own localisation jitter is ~8 ms on top of the frame (One More Time reads rms 10.0
// ms, excessRms 8.19), so a residual limit measures the detector, not the music. excessRms is REPORTED only (and an
// excessFloor across the run's windows); steadiness is tested in the tempo domain: drift < 0.3 %, ≥ 64 inliers, no
// masked span, extraFrac ≤ 2 %, inlierFrac ≥ 0.9 (over the window's own beats), mode A's incoming gridSuspect false,
// and one crude guard: residual rms > 25 ms refuses as `jitter`. Drift is the second half's tempo against the first
// (~0.011 % noise at σ 10 ms over 90 s) and, R17a (6740224377), the range of the 64-beat block tempos when the window
// holds ≥ 2 full blocks (~0.023 % noise; catches curvature the halves miss). The 16-beat block range (blockDriftPct16,
// ~0.35 % noise) is reported only, and driftNoisePct (the halves test's noise from the window's own rms and count)
// sits beside every drift number. Without allowDrift a window that fails drift is refused, so `piecewise` is only ever
// the allowDrift escape hatch (R16a).
export const LINEAR_DRIFT_PCT = 0.3, MIN_INLIERS = 64, FRAME_MS_DEFAULT = 20, JITTER_RMS_MS = 25, EXTRA_FRAC_MAX = 0.02, INLIER_FRAC_MIN = 0.9;
export const BLOCK_REPORT = 16, BLOCK_GATE = 64;
/** max − min of the fitted tempos of consecutive `size`-beat blocks, % of the period b (null with < 2 full blocks) */
export function blockRangePct(kept, size, b) {
  const bpms = [];
  for (let i = 0; i + size <= kept.length; i += size) bpms.push(60 / lsq(kept.slice(i, i + size)).b);
  return bpms.length >= 2 ? 100 * (Math.max(...bpms) - Math.min(...bpms)) / (60 / b) : null;
}
/** the halves test's 1σ noise, % of the period: √2 · σ / √Σ(k−k̄)² per half (n/2 beats), σ = the residual rms */
export function driftNoisePct(rmsMs, n, b) {
  const m = n >> 1, s = m * (m * m - 1) / 12;
  return s > 0 ? 100 * Math.SQRT2 * (rmsMs / 1000) / Math.sqrt(s) / b : null;
}
export const MASK = { window: 16, outlierMax: 0.25, tol: 0.125, gapX: 1.8, confMin: 0.5 };
export const PIECE_HALF = 4, SELF_CHECK_MS = 1;
/** R16: the residual RMS above the frame-quantisation floor (ms) */
export const excessRms = (rmsMs, frameMs = FRAME_MS_DEFAULT) => Math.sqrt(Math.max(0, rmsMs * rmsMs - frameMs * frameMs / 12));
export const MIXES_FILE = fileURLToPath(new URL('./mixes.json', import.meta.url));
const num = x => typeof x === 'number' && Number.isFinite(x);
const r3 = x => (num(x) ? Math.round(x * 1000) / 1000 : null);
const r6 = x => (num(x) ? Math.round(x * 1e6) / 1e6 : null);
const r4 = x => (num(x) ? Math.round(x * 1e4) / 1e4 : null);

function lsq(pts) {   // t = a + b·k over [{k, t}]
  const n = pts.length, mk = pts.reduce((s, p) => s + p.k, 0) / n, mt = pts.reduce((s, p) => s + p.t, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.k - mk) ** 2; sxy += (p.k - mk) * (p.t - mt); }
  const b = sxx > 0 ? sxy / sxx : NaN;
  return { a: mt - b * mk, b };
}

/**
 * the fitted grid of one cut window: reference beats (ms) in [fromS, toS] → { a, b (period s), bpm, kMax, kept, at(k),
 * rmsMs, maxMs, driftPct, fitMode }. Beats are indexed one after the other with a local period that starts at the
 * robust tempo (R15) and follows a drift: a beat that isn't within ¼ beat of a whole number of beats after the last kept
 * one is an extra (a doubled run, an off-beat) and is dropped; a missed beat skips an index. k = 0 is the first kept
 * beat. A linear window then also drops beats more than ⅛ beat off its line. driftPct: the tempo of the window's second
 * half against its first, % of the whole.
 */
export function windowFit(beatsMs, fromS, toS, { frameMs = FRAME_MS_DEFAULT } = {}) {
  const inWin = beatsMs.map(b => (num(b) ? { t: b / 1000, conf: 1 } : { t: b.ms / 1000, conf: num(b.conf) ? b.conf : 1 }))
    .filter(b => b.t >= fromS - 1e-9 && b.t <= toS + 1e-9).sort((x, y) => x.t - y.t);
  const ts = inWin.map(b => b.t);
  const rt = ts.length >= 16 ? robustTempo(ts) : null;
  if (!rt) throw new Error(`window ${fromS}–${toS} s: too few reference beats (${ts.length})`);
  let P = rt.period, s = 0;
  const near = d => Math.abs(d - P) <= 0.25 * P;
  while (s + 2 < ts.length && !(near(ts[s + 1] - ts[s]) && near(ts[s + 2] - ts[s + 1]))) s++;
  let kept = [{ k: 0, t: ts[s] }];
  for (let i = s + 1; i < ts.length; i++) {
    const last = kept[kept.length - 1], d = ts[i] - last.t, n = Math.round(d / P);
    if (n < 1 || Math.abs(d - n * P) > 0.25 * P) continue;
    kept.push({ k: last.k + n, t: ts[i] });
    if (kept.length >= 9) { const o = kept[kept.length - 9]; P = (ts[i] - o.t) / (last.k + n - o.k); }
  }
  if (kept.length < 16) throw new Error(`window ${fromS}–${toS} s: only ${kept.length} beats on a grid`);
  let { a, b } = lsq(kept);
  const stats = () => {
    const res = kept.map(p => (p.t - (a + b * p.k)) * 1000), half = kept.length >> 1, f1 = lsq(kept.slice(0, half)), f2 = lsq(kept.slice(half));
    return { rmsMs: Math.sqrt(res.reduce((x, r) => x + r * r, 0) / res.length), maxMs: Math.max(...res.map(Math.abs)), driftPct: 100 * Math.abs(60 / f2.b - 60 / f1.b) / (60 / b),
      blockDrift64Pct: blockRangePct(kept, BLOCK_GATE, b) };
  };
  let st = stats();
  const fitMode = st.driftPct < LINEAR_DRIFT_PCT && !(st.blockDrift64Pct >= LINEAR_DRIFT_PCT) ? 'linear' : 'piecewise';
  if (fitMode === 'linear') {
    const all = kept;
    kept = kept.filter(p => Math.abs(p.t - (a + b * p.k)) <= b / 8);
    if (kept.length < 16) kept = all;
    ({ a, b } = lsq(kept));
    st = stats();
  }
  const { driftPct, blockDrift64Pct } = st;
  let { rmsMs, maxMs } = st;
  const kMax = kept[kept.length - 1].k;
  const at = fitMode === 'linear' ? k => a + b * k : k => {
    let w = PIECE_HALF, around;
    do { around = kept.filter(p => Math.abs(p.k - k) <= w); w *= 2; } while (around.length < 3 && w < 64);
    const f = lsq(around);
    return f.a + f.b * k;
  };
  if (fitMode === 'piecewise') {   // the residual is against the fit actually used: a drift is not jitter (R17's 25 ms guard)
    const res = kept.map(p => (p.t - at(p.k)) * 1000);
    rmsMs = Math.sqrt(res.reduce((x, r) => x + r * r, 0) / res.length); maxMs = Math.max(...res.map(Math.abs));
  }
  const blockDriftPct16 = blockRangePct(kept, BLOCK_REPORT, b), noisePct = driftNoisePct(rmsMs, kept.length, b);   // report only (R17a)
  // R15's mask over the window's raw beats: 16-IBI spans with > 25 % outlier IBIs, a gap, or a low-confidence beat
  const ibis = ts.slice(1).map((t, i) => t - ts[i]), med = rt.medIbi, out = d => d < med * (1 - MASK.tol) || d > med * (1 + MASK.tol);
  const masked = [];
  for (let i = 0; i + MASK.window <= ibis.length; i++) {
    const w = ibis.slice(i, i + MASK.window), why = [];
    if (w.filter(out).length > MASK.outlierMax * MASK.window) why.push('outliers');
    if (w.some(d => d > MASK.gapX * med)) why.push('gap');
    if (inWin.slice(i, i + MASK.window + 1).some(x => x.conf < MASK.confMin)) why.push('low confidence');
    if (!why.length) continue;
    const last = masked[masked.length - 1], from = ts[i], to = ts[i + MASK.window];
    if (last && from <= last.toS + 1e-9) { last.toS = to; for (const y of why) if (!last.why.includes(y)) last.why.push(y); }
    else masked.push({ fromS: from, toS: to, why });
  }
  return { a, b, bpm: 60 / b, kMax, kept, at, rmsMs, maxMs, excessRms: excessRms(rmsMs, frameMs), frameMs, driftPct, blockDrift64Pct, blockDriftPct16, driftNoisePct: noisePct, fitMode, n: kept.length, total: ts.length,
    masked, inlierFrac: rt.inlierFrac, extraFrac: rt.extraFrac, windowSuspect: rt.suspect, windowSuspectWhy: rt.why };
}
const fitSummary = f => ({ bpm: r3(f.bpm), fitMode: f.fitMode, fitResidualRms: r3(f.rmsMs), fitResidualMax: r3(f.maxMs), excessRms: r3(f.excessRms), frameMs: f.frameMs,
  driftPct: r3(f.driftPct), blockDrift64Pct: r3(f.blockDrift64Pct), blockDriftPct16: r3(f.blockDriftPct16), driftNoisePct: r4(f.driftNoisePct), inlierFrac: r3(f.inlierFrac), extraFrac: r3(f.extraFrac), beats: f.n, dropped: f.total - f.n,
  masked: f.masked.map(m => ({ fromS: r3(m.fromS), toS: r3(m.toS), why: m.why })), windowSuspect: f.windowSuspect,
  limits: { driftPct: LINEAR_DRIFT_PCT, driftBlockBeats: BLOCK_GATE, minInliers: MIN_INLIERS, jitterRmsMs: JITTER_RMS_MS, extraFracMax: EXTRA_FRAC_MAX, inlierFracMin: INLIER_FRAC_MIN, excessRms: 'report-only (R17)' } });
/** R16 + R17: why a window is refused ([] when it is fine). strict: the drift refusal applies (off for an allowDrift side) */
export function windowRefusals(f, { strict = true, suspectCheck = false } = {}) {
  const no = [];
  if (f.n < MIN_INLIERS) no.push(`inlier beats ${f.n} < ${MIN_INLIERS}`);
  for (const m of f.masked) no.push(`masked span ${r3(m.fromS)}–${r3(m.toS)} s (${m.why.join(', ')})`);
  if (num(f.extraFrac) && f.extraFrac > EXTRA_FRAC_MAX) no.push(`extraFrac ${r3(f.extraFrac)} > ${EXTRA_FRAC_MAX}`);
  if (num(f.inlierFrac) && f.inlierFrac < INLIER_FRAC_MIN) no.push(`inlierFrac ${r3(f.inlierFrac)} < ${INLIER_FRAC_MIN}`);
  if (f.rmsMs > JITTER_RMS_MS) no.push(`jitter: rms ${r3(f.rmsMs)} ms > ${JITTER_RMS_MS}`);
  const noise = num(f.driftNoisePct) ? ` (noise ${r4(f.driftNoisePct)} %)` : '';
  if (strict && f.driftPct >= LINEAR_DRIFT_PCT) no.push(`drift ${r3(f.driftPct)} % ≥ ${LINEAR_DRIFT_PCT} (halves)${noise}`);
  if (strict && num(f.blockDrift64Pct) && f.blockDrift64Pct >= LINEAR_DRIFT_PCT) no.push(`drift ${r3(f.blockDrift64Pct)} % ≥ ${LINEAR_DRIFT_PCT} (64-beat blocks)${noise}`);
  if (suspectCheck && f.windowSuspect) no.push(`gridSuspect over the window (${f.windowSuspectWhy.join(', ')})`);
  return no;
}

/**
 * a recipe + the two grids → the plan: the cuts, ratio, fade, alignment and the derived beats on the mix timeline
 * ({ t (s), n (1–4), side: 'out' | 'in', k }). Pure: no audio. Throws on a recipe it must refuse.
 */
export function planMix(recipe, gridOut, gridIn, { sr = SR } = {}) {
  const mode = recipe.mode;
  if (mode !== 'A' && mode !== 'B') throw new Error(`${recipe.name}: mode must be "A" or "B"`);
  const snap = s => Math.round(s * sr) / sr;
  const whyErr = driftWhyProblems(recipe);
  if (whyErr.length) throw new Error(`${recipe.name}: refused: ${whyErr.join('; ')}`);
  const fo = windowFit(gridOut.beats, recipe.out.from, recipe.out.to, { frameMs: num(gridOut.frameMs) ? gridOut.frameMs : FRAME_MS_DEFAULT });
  const fi = windowFit(gridIn.beats, recipe.in.from, recipe.in.to, { frameMs: num(gridIn.frameMs) ? gridIn.frameMs : FRAME_MS_DEFAULT });
  const refusals = [
    ...windowRefusals(fo, { strict: recipe.out.allowDrift !== true }).map(x => `out ${recipe.out.id} ${recipe.out.from}–${recipe.out.to} s: ${x}`),
    ...windowRefusals(fi, { strict: mode === 'A' || recipe.in.allowDrift !== true, suspectCheck: mode === 'A' }).map(x => `in ${recipe.in.id} ${recipe.in.from}–${recipe.in.to} s: ${x}`),
  ];
  if (refusals.length) throw new Error(`${recipe.name}: refused: ${refusals.join('; ')}`);
  if (mode === 'A' && fi.fitMode !== 'linear') throw new Error(`${recipe.name}: refused: in ${recipe.in.id}: mode A needs a constant-tempo incoming window (fits ${fi.fitMode})`);
  const ratio = mode === 'A' ? fo.bpm / fi.bpm : 1;
  const barOut = recipe.out.bar1At, barIn = recipe.in.bar1At;
  const align = mode === 'A' ? (num(barOut) && num(barIn) ? 'bar1At' : 'beat') : 'none';
  const onBar = (fit, bar1At, k) => (((k - Math.round((bar1At - fit.a) / fit.b)) % 4) + 4) % 4 === 0;
  const outFrom = Math.floor(fo.at(0) * sr) / sr;   // the mix starts on the sample of the outgoing window's first fitted beat
  let fadeStart, fadeEnd, m0, s0, fadeBars = null, kS = null;
  if (mode === 'A') {
    fadeBars = recipe.fadeBars;
    if (!(Number.isInteger(fadeBars) && fadeBars > 0 && fadeBars % 2 === 0)) throw new Error(`${recipe.name}: fadeBars must be an even whole number`);
    let kEnd = fo.kMax;
    while (fo.at(kEnd) > recipe.out.to + 1e-9) kEnd--;
    if (align === 'bar1At') while (kEnd > 0 && !onBar(fo, barOut, kEnd)) kEnd--;
    kS = kEnd - fadeBars * 4;
    if (kS < 0) throw new Error(`${recipe.name}: the outgoing window is shorter than ${fadeBars} bars`);
    fadeStart = fo.at(kS) - outFrom; fadeEnd = fo.at(kEnd) - outFrom;
    let kIn = 0;
    while (fi.at(kIn) < recipe.in.from - 1e-9) kIn++;
    if (align === 'bar1At') while (!onBar(fi, barIn, kIn)) kIn++;
    if (kIn > fi.kMax) throw new Error(`${recipe.name}: no incoming beat in its window`);
    s0 = fi.at(kIn); m0 = fadeStart;
  } else {
    const fadeS = num(recipe.fadeS) ? recipe.fadeS : 8;
    fadeEnd = snap(recipe.out.to) - outFrom; fadeStart = fadeEnd - fadeS;
    if (fadeStart <= 0) throw new Error(`${recipe.name}: the outgoing window is shorter than the fade`);
    s0 = snap(recipe.in.from); m0 = fadeStart;
  }
  const mid = (fadeStart + fadeEnd) / 2, mixLenS = m0 + (recipe.in.to - s0) / ratio;
  const beats = [];
  for (let k = 0; k <= fo.kMax; k++) { const t = fo.at(k) - outFrom; if (t >= 0 && t < mid - 1e-9) beats.push({ t, side: 'out', k }); }
  for (let k = 0; k <= fi.kMax; k++) {
    const s = fi.at(k);
    if (s < s0 - 1e-9) continue;
    const t = m0 + (s - s0) / ratio;
    if (t >= mid - 1e-9 && t <= mixLenS + 1e-9) beats.push({ t, side: 'in', k });
  }
  // beat-in-bar runs on continuously across the midpoint, 1 on the beat the fade starts on
  const jS = mode === 'A' ? beats.findIndex(b => b.side === 'out' && b.k === kS) : Math.max(0, beats.findIndex(b => b.t >= fadeStart - 1e-9));
  beats.forEach((b, j) => { b.n = (((j - jS) % 4) + 4) % 4 + 1; });
  const idx = t => { const i = beats.findIndex(b => b.t >= t - 1e-6); return i < 0 ? beats.length : i; };
  const plan = {
    name: recipe.name, slot: recipe.slot || null, mode, ratio, stretch: mode === 'A' ? 'resample' : 'none', fadeBars, fadeS: fadeEnd - fadeStart,
    align, alignReason: align === 'beat' ? 'no bar1At' : null, reportOnly: mode === 'A' && align !== 'bar1At',
    out: { id: recipe.out.id, fromS: outFrom, toS: outFrom + fadeEnd, fit: fitSummary(fo), ...flags(fo, gridOut, recipe.out) },
    in: { id: recipe.in.id, s0, toS: recipe.in.to, fit: fitSummary(fi), ...flags(fi, gridIn, recipe.in) },
    m0, mixLenS, overlap: { startS: fadeStart, endS: fadeEnd, midS: mid, startBeat: idx(fadeStart), endBeat: idx(fadeEnd), midBeat: idx(mid) }, beats,
  };
  Object.defineProperty(plan, 'fits', { value: { out: fo, in: fi }, enumerable: false });
  return plan;
}

/**
 * R16a: a side with allowDrift needs a one-line why, and mode A's incoming side never takes it → the problems ([] if fine)
 */
export function driftWhyProblems(recipe) {
  const no = [];
  for (const side of ['out', 'in']) {
    const s = recipe[side] || {};
    if (s.allowDrift === undefined || s.allowDrift === false) continue;
    if (s.allowDrift !== true) { no.push(`${side}.allowDrift must be true or absent`); continue; }
    if (recipe.mode === 'A' && side === 'in') no.push('allowDrift is never allowed on mode A\'s incoming side');
    if (typeof s.why !== 'string' || !s.why.trim() || /\n/.test(s.why)) no.push(`${side}.allowDrift needs a one-line "why"`);
  }
  return no;
}
/** what mix.json reports beside each window: gridSuspect over the window (R16a) and the whole-file flag, allowDrift + why */
function flags(fit, grid, side) {
  return { gridSuspect: fit.windowSuspect, gridSuspectFile: typeof grid.gridSuspect === 'boolean' ? grid.gridSuspect : null,
    allowDrift: side.allowDrift === true, why: side.allowDrift === true ? side.why : null };
}

/**
 * the hard self-check: the written beats (ms, as the sidecar holds them) mapped back to their source and compared with
 * the window's fit (a straight-grid refit for linear windows, the same piecewise fit otherwise) → { maxDevMs, ok }
 */
export function selfCheck(plan, writtenMs) {
  let maxDev = 0;
  for (const side of ['out', 'in']) {
    const fit = plan.fits[side], pts = [];
    plan.beats.forEach((b, j) => {
      if (b.side !== side) return;
      const t = writtenMs[j] / 1000, s = side === 'out' ? t + plan.out.fromS : plan.in.s0 + (t - plan.m0) * plan.ratio;
      pts.push({ k: b.k, t: s });
    });
    if (!pts.length) continue;
    if (fit.fitMode === 'linear' && pts.length >= 2) {
      const f = lsq(pts);
      for (const p of pts) maxDev = Math.max(maxDev, Math.abs(p.t - (f.a + f.b * p.k)) * 1000, Math.abs(p.t - fit.at(p.k)) * 1000);
    } else for (const p of pts) maxDev = Math.max(maxDev, Math.abs(p.t - fit.at(p.k)) * 1000);
  }
  return { maxDevMs: r6(maxDev), ok: maxDev <= SELF_CHECK_MS };
}

/** the derived sidecar (v2, conf 1): R12 truth is arithmetic, so the detector flags don't apply (gridSuspect false) */
export function mixSidecar(plan, { barOkOut = false, barOkIn = false } = {}) {
  const g = toSidecar(plan.beats.map(b => ({ t: b.t, n: b.n })), { source: { from: 'mix', name: plan.name, mode: plan.mode } });
  const barOk = plan.align === 'bar1At' && barOkOut === true && barOkIn === true;
  g.barOk = barOk; g.barOkCleared = barOk ? null : 'mix';
  g.gridSuspect = false; g.suspectWhy = []; g.derived = true;
  g.mix = { mode: plan.mode, align: plan.align, ratio: r6(plan.ratio), fadeBars: plan.fadeBars,
    overlapStartMs: r3(plan.overlap.startS * 1000), overlapEndMs: r3(plan.overlap.endS * 1000), midMs: r3(plan.overlap.midS * 1000) };
  return g;
}

const cubic = (d, f) => {   // Catmull-Rom between d[i] and d[i+1]
  const i = Math.floor(f), x = f - i, p = j => (j >= 0 && j < d.length ? d[j] : 0);
  const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
  return p1 + 0.5 * x * (p2 - p0 + x * (2 * p0 - 5 * p1 + 4 * p2 - p3 + x * (3 * (p1 - p2) + p3 - p0)));
};
/**
 * the mix: outgoing (decoded from plan.out.fromS) then the incoming (decoded from inCut.startS) resampled by the ratio,
 * an equal-power fade (cos / sin) over the overlap → interleaved Int16 stereo at sr
 */
export function renderMix(plan, outCut, inCut, sr = SR) {
  const n = Math.round(plan.mixLenS * sr), out = new Int16Array(n * 2), { startS: f0, endS: f1 } = plan.overlap;
  const oShift = Math.round((plan.out.fromS - outCut.startS) * sr);
  for (let i = 0; i < n; i++) {
    const m = i / sr;
    let go = 0, gi = 0;
    if (m < f0) go = 1;
    else if (m < f1) { const x = (m - f0) / (f1 - f0); go = Math.cos(x * Math.PI / 2); gi = Math.sin(x * Math.PI / 2); }
    else gi = 1;
    const fIn = (plan.in.s0 + (m - plan.m0) * plan.ratio - inCut.startS) * sr;
    for (let c = 0; c < 2; c++) {
      let v = 0;
      if (go > 0) { const d = outCut.data[Math.min(c, outCut.data.length - 1)], j = i + oShift; v += go * (j >= 0 && j < d.length ? d[j] : 0); }
      if (gi > 0 && m >= plan.m0 - 1e-12) v += gi * cubic(inCut.data[Math.min(c, inCut.data.length - 1)], fIn);
      out[i * 2 + c] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
    }
  }
  return out;
}

/** qa/mixes.json → the recipes, checked against corpus.json ids */
export function loadMixes(file = MIXES_FILE, rows = loadCorpus()) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')), ids = new Set(rows.map(r => r.id)), names = new Set();
  if (doc.version !== 1 || !Array.isArray(doc.mixes)) throw new Error('mixes.json: expected {"version": 1, "mixes": [...]}');
  for (const m of doc.mixes) {
    const w = `mixes.json ${m.name}`;
    if (typeof m.name !== 'string' || !m.name.startsWith(PREFIX) || !/^[a-z0-9-]+$/.test(m.name)) throw new Error(`${w}: the name must start with "${PREFIX}" (lower case, digits, dashes)`);
    if (names.has(m.name)) throw new Error(`${w}: duplicate name`);
    names.add(m.name);
    for (const side of ['out', 'in']) {
      const s = m[side];
      if (!s || !ids.has(s.id)) throw new Error(`${w}: ${side}.id ${s && s.id} is not a corpus.json id`);
      if (!(num(s.from) && num(s.to) && s.to > s.from)) throw new Error(`${w}: ${side} window`);
      if (s.bar1At !== undefined && s.bar1At !== null && !num(s.bar1At)) throw new Error(`${w}: ${side}.bar1At must be seconds or null`);
    }
    const whyErr = driftWhyProblems(m);
    if (whyErr.length) throw new Error(`${w}: ${whyErr.join('; ')}`);
    if (m.mode !== 'A' && m.mode !== 'B') throw new Error(`${w}: mode must be "A" or "B"`);
    if (m.mode === 'A' && !(Number.isInteger(m.fadeBars) && m.fadeBars > 0 && m.fadeBars % 2 === 0)) throw new Error(`${w}: mode A needs an even fadeBars`);
    if (m.mode === 'B' && !(num(m.fadeS) && m.fadeS > 0)) throw new Error(`${w}: mode B needs fadeS`);
  }
  return doc.mixes;
}

// ---------- where Playwright is ----------
// The runner clone (RUNNER_HOME) has no node_modules: Playwright is installed in QA box's working copy,
// QA_HOME/qa/node_modules, which the runner symlinks into its work trees for exp-run. A bare import from qa/ in the
// runner clone can't see it (QA box, 9 Nov: "Cannot find package 'playwright'"), so look there first: PLAYWRIGHT_DIR
// (a folder whose node_modules has it), then QA_HOME/qa (qa/mix-make.sh gets QA_HOME from qa/runner/settings.sh),
// then beside this file.
const HERE_DIR = path.dirname(fileURLToPath(import.meta.url));
export function playwrightBases(env = process.env, here = HERE_DIR) {
  const out = [];
  if (env.PLAYWRIGHT_DIR) out.push(env.PLAYWRIGHT_DIR);
  if (env.QA_HOME) out.push(path.join(env.QA_HOME, 'qa'));
  out.push(here);
  return [...new Set(out.map(p => path.resolve(p)))];
}
/** Playwright's module, required from the first base whose node_modules has it; throws with every place it looked */
export function loadPlaywright(env = process.env, here = HERE_DIR) {
  const tried = [];
  for (const base of playwrightBases(env, here)) {
    const req = createRequire(path.join(base, 'mix-make-resolve.cjs'));
    let file;
    try { file = req.resolve('playwright'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; tried.push(base); continue; }
    return req(file);
  }
  throw new Error(`Cannot find package 'playwright' from ${tried.join(', ')} (QA_HOME must be QA box's working copy, whose qa/node_modules has it)`);
}

// ---------- the decoder: Chromium's decodeAudioData at 48 kHz, files handed to the page by request interception ----------
async function withDecoder(fn) {
  const { chromium } = loadPlaywright();
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], env });
  try {
    const page = await browser.newPage();
    let current = null;
    await page.route('http://mix.local/**', route => {
      const u = new URL(route.request().url());
      if (u.pathname === '/src' && current) return route.fulfill({ status: 200, path: current, contentType: 'application/octet-stream' });
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>mix-make</title>' });
    });
    await page.goto('http://mix.local/');
    /** the whole file decoded at SR → { sr, ch, length, durS, cut(fromS, lenS) → { startS, data: [Float32Array ×ch] } } */
    const open = async file => {
      current = file;
      const info = await page.evaluate(async rate => {
        const buf = await (await fetch('/src?' + Math.random())).arrayBuffer();
        window.__ab = await new OfflineAudioContext(2, 1, rate).decodeAudioData(buf);
        return { sr: window.__ab.sampleRate, ch: Math.min(2, window.__ab.numberOfChannels), length: window.__ab.length };
      }, SR);
      if (info.sr !== SR) throw new Error(`the decoder gave ${info.sr} Hz, not ${SR}`);
      const cut = async (fromS, lenS) => {
        const a0 = Math.max(0, Math.round(fromS * SR)), n = Math.max(0, Math.min(info.length - a0, Math.round(lenS * SR)));
        const data = Array.from({ length: info.ch }, () => new Float32Array(n)), CH = 1 << 18;
        for (let o = 0; o < n; o += CH) {
          const m = Math.min(CH, n - o);
          const parts = await page.evaluate(({ a, m, ch }) => {
            const out = [];
            for (let c = 0; c < ch; c++) {
              const u8 = new Uint8Array(window.__ab.getChannelData(c).slice(a, a + m).buffer);
              let s = '';
              for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000));
              out.push(btoa(s));
            }
            return out;
          }, { a: a0 + o, m, ch: info.ch });
          parts.forEach((b64, c) => { const raw = Buffer.from(b64, 'base64'); data[c].set(new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4), o); });
        }
        return { startS: a0 / SR, data };
      };
      return { ...info, durS: info.length / SR, cut };
    };
    return await fn({ open, version: `Chromium ${browser.version()}` });
  } finally { await browser.close(); }
}

// ---------- the box run ----------
function resolveTrack(dir, map, id) {
  const stem = map.tracks[id];
  if (!stem) return { error: `${id} is not in corpus-map.json` };
  const src = sourceTracks(dir).find(s => s.stem === stem);
  if (!src) return { error: `${id}: no audio file for it in the tracks folder` };
  let grid = null;
  try { grid = JSON.parse(fs.readFileSync(path.join(dir, stem + '.beatgrid.json'), 'utf8')); } catch { return { error: `${id}: no grid (qa/ref-beats.sh)` }; }
  return { file: path.join(dir, src.file), grid };
}
const shaOf = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function makeMix(recipe, dir, map, decoder, { force, verify }) {
  const outDir = path.join(dir, RENDERS), base = path.join(outDir, recipe.name);
  const A = resolveTrack(dir, map, recipe.out.id), B = resolveTrack(dir, map, recipe.in.id);
  if (A.error || B.error) return `${recipe.name}: skipped (${A.error || B.error})`;
  const plan = planMix(recipe, A.grid, B.grid);
  const shaA = await sha256(A.file), shaB = await sha256(B.file);
  let old = null;
  try { old = JSON.parse(fs.readFileSync(base + '.mix.json', 'utf8')); } catch { old = null; }
  const same = old && JSON.stringify(old.recipe) === JSON.stringify(recipe) && old.inputs.out.sha256 === shaA && old.inputs.in.sha256 === shaB && fs.existsSync(base + '.wav');
  if (same && !force && !verify) return `${recipe.name}: up to date (${old.sha256.slice(0, 12)})`;
  const side = mixSidecar(plan, { barOkOut: A.grid.barOk === true, barOkIn: B.grid.barOk === true });
  const check = selfCheck(plan, side.beats.map(b => b.ms));
  if (!check.ok) throw new Error(`${recipe.name}: self-check failed, a written beat is ${check.maxDevMs} ms off its fitted grid; nothing written`);
  const dA = await decoder.open(A.file), outCut = await dA.cut(plan.out.fromS, plan.out.toS - plan.out.fromS + 0.05);
  const dB = await decoder.open(B.file), inStart = Math.max(0, plan.in.s0 - 0.05), inCut = await dB.cut(inStart, (plan.mixLenS - plan.m0) * plan.ratio + 0.2);
  const wav = wavBytes(renderMix(plan, outCut, inCut), SR, 2), sha = shaOf(wav);
  if (verify && same) {
    if (sha === old.sha256) return `${recipe.name}: verify: same hash (${sha.slice(0, 12)})`;
    if (old.decoder === decoder.version) return `${recipe.name}: verify: FINDING: the hash differs with the same decoder (${old.sha256.slice(0, 12)} → ${sha.slice(0, 12)})`;
  }
  const { beats, overlap } = plan;
  const mixJson = { version: 1, name: recipe.name, slot: plan.slot, mode: plan.mode, recipe,
    inputs: { out: { id: plan.out.id, sha256: shaA, cut: [r6(plan.out.fromS), r6(plan.out.toS)], fit: plan.out.fit,
      gridSuspect: plan.out.gridSuspect, gridSuspectFile: plan.out.gridSuspectFile, allowDrift: plan.out.allowDrift, why: plan.out.why },
    in: { id: plan.in.id, sha256: shaB, cut: [r6(plan.in.s0), r6(plan.in.toS)], fit: plan.in.fit,
      gridSuspect: plan.in.gridSuspect, gridSuspectFile: plan.in.gridSuspectFile, allowDrift: plan.in.allowDrift, why: plan.in.why } },
    ratio: r6(plan.ratio), stretch: plan.stretch, fadeBars: plan.fadeBars, fadeS: r6(plan.fadeS), align: plan.align, alignReason: plan.alignReason,
    reportOnly: plan.reportOnly,
    overlap: { startS: r6(overlap.startS), endS: r6(overlap.endS), midS: r6(overlap.midS), startBeat: overlap.startBeat, endBeat: overlap.endBeat, midBeat: overlap.midBeat },
    mixLenS: r6(plan.mixLenS), beats: beats.length, sampleRate: SR, decoder: decoder.version, sha256: sha, selfCheck: check };
  fs.mkdirSync(outDir, { recursive: true });
  writeAtomic(base + '.beatgrid.json', JSON.stringify(side) + '\n');
  writeAtomic(base + '.wav', wav);
  writeAtomic(base + '.mix.json', JSON.stringify(mixJson, null, 1) + '\n');
  return `${recipe.name}: made (${plan.mode}, ratio ${r6(plan.ratio)}, ${plan.align}${plan.alignReason ? ` (${plan.alignReason})` : ''}, out ${plan.out.fit.bpm} ${plan.out.fit.fitMode}, in ${plan.in.fit.bpm} ${plan.in.fit.fitMode}, ${r3(plan.mixLenS)} s, self-check ${check.maxDevMs} ms, sha ${sha.slice(0, 12)})`;
}

// R14: a lossy twin (corpus row with lossy + twinOf) against its FLAC, both through the same decoder, measured once
async function measureAlign(row, dir, map, decoder, { force }) {
  const lossy = resolveTrack(dir, map, row.id), ref = resolveTrack(dir, map, row.twinOf);
  if (lossy.error || ref.error) return `${row.id}: alignLag skipped (${lossy.error || ref.error})`;
  const shaRef = await sha256(ref.file), shaLossy = await sha256(lossy.file);
  if (!force && !alignNeeded(row, shaRef, shaLossy)) return `${row.id}: alignLag up to date (${row.alignLagMs} ms)`;
  const mono = async file => {
    const d = await decoder.open(file), c = await d.cut(0, d.durS), m = new Float32Array(c.data[0].length);
    for (let i = 0; i < m.length; i++) { let s = 0; for (const ch of c.data) s += ch[i]; m[i] = s / c.data.length; }
    return m;
  };
  const a = await mono(ref.file), b = await mono(lossy.file), chk = alignLagCheck(a, b, SR);
  const fields = alignFields({ lagSamples: chk.lagSamples, rate: SR, shaRef, shaLossy });
  const out = { id: row.id, twinOf: row.twinOf, ...fields, check: { lagMs: chk.lagMs, endLagMs: chk.endLagMs, driftMs: chk.driftMs, constant: chk.constant, within30: chk.within30 }, decoder: decoder.version };
  fs.mkdirSync(path.join(dir, RENDERS), { recursive: true });
  writeAtomic(path.join(dir, RENDERS, `align-${row.id}.json`), JSON.stringify(out, null, 1) + '\n');
  return `${row.id}: alignLag ${chk.lagMs} ms (${chk.lagSamples} samples), end ${chk.endLagMs} ms, ${chk.constant ? 'constant' : 'NOT constant'}, ${chk.within30 ? '≤ 30 ms' : 'OVER 30 ms'}; corpus.json fields: ${JSON.stringify(fields)}`;
}

/** R17: the detector's jitter floor over a run's windows: { n, median, min, max } of their excessRms (ms), null if none */
export function excessFloor(values) {
  const v = values.filter(num).sort((x, y) => x - y);
  if (!v.length) return null;
  const m = v.length >> 1, median = v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  return { n: v.length, median: r3(median), min: r3(v[0]), max: r3(v[v.length - 1]) };
}
/** R17: one line per distinct window (ids and numbers only) and the excessFloor line, before any recipe runs */
function windowReport(recipes, dir, map) {
  const seen = new Map();
  for (const r of recipes) for (const s of [r.out, r.in]) {
    const key = `${s.id} ${s.from}–${s.to} s`;
    if (seen.has(key)) continue;
    const T = resolveTrack(dir, map, s.id);
    if (T.error) { seen.set(key, { line: `${key}: ${T.error}` }); continue; }
    try {
      const f = windowFit(T.grid.beats, s.from, s.to, { frameMs: num(T.grid.frameMs) ? T.grid.frameMs : FRAME_MS_DEFAULT });
      seen.set(key, { ex: f.excessRms, line: `window ${key}: bpm ${r3(f.bpm)} ${f.fitMode}, rms ${r3(f.rmsMs)} ms, excessRms ${r3(f.excessRms)} ms (report-only), drift ${r3(f.driftPct)} % (noise ${r4(f.driftNoisePct)} %), blockDrift64 ${r3(f.blockDrift64Pct)} %, blockDrift16 ${r3(f.blockDriftPct16)} % (report-only), inliers ${f.n}, inlierFrac ${r3(f.inlierFrac)}, extraFrac ${r3(f.extraFrac)}, masked ${f.masked.length}` });
    } catch (e) { seen.set(key, { line: `window ${key}: ${e.message}` }); }
  }
  const fl = excessFloor([...seen.values()].map(x => x.ex));
  return [...[...seen.values()].map(x => x.line), fl ? `excessFloor: median ${fl.median} ms over ${fl.n} window(s) (${fl.min}–${fl.max})` : 'excessFloor: no window fitted'];
}

async function main(argv) {
  const args = argv.slice(2), has = k => args.includes(k), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const dir = audioDir(opt('--dir') || undefined), rows = loadCorpus(), map = loadMap(dir);
  if (map.missing) { console.error(`mix-make: no corpus-map.json beside ${dir}`); return 2; }
  let recipes = loadMixes(MIXES_FILE, rows);
  if (opt('--only')) recipes = recipes.filter(r => r.name === opt('--only'));
  if (has('--plan')) {
    for (const line of windowReport(recipes, dir, map)) console.log(line);
    for (const r of recipes) {
      const A = resolveTrack(dir, map, r.out.id), B = resolveTrack(dir, map, r.in.id);
      if (A.error || B.error) { console.log(`${r.name}: ${A.error || B.error}`); continue; }
      try {
        const p = planMix(r, A.grid, B.grid);
        console.log(`${r.name}: ${JSON.stringify({ mode: p.mode, ratio: r6(p.ratio), align: p.align, alignReason: p.alignReason, out: p.out, in: p.in, overlap: p.overlap, mixLenS: r3(p.mixLenS), beats: p.beats.length })}`);
      } catch (e) { console.log(e.message); }
    }
    return 0;
  }
  let failed = 0;
  await withDecoder(async decoder => {
    console.log(`mix-make: ${decoder.version}, ${SR} Hz, ${recipes.length} recipe(s), out → ${path.join(dir, RENDERS)}`);
    for (const line of windowReport(recipes, dir, map)) console.log(line);
    for (const r of recipes) {
      try { console.log(await makeMix(r, dir, map, decoder, { force: has('--force'), verify: has('--verify') })); }
      catch (e) { failed++; console.log(`${r.name}: FAILED: ${e.message}`); }
    }
    if (!opt('--only')) for (const row of rows.filter(x => x.lossy && x.twinOf)) {
      try { console.log(await measureAlign(row, dir, map, decoder, { force: has('--force') })); }
      catch (e) { failed++; console.log(`${row.id}: alignLag FAILED: ${e.message}`); }
    }
  });
  console.log(`mix-make: ${failed ? `${failed} failed` : 'done'}`);
  return failed ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv).then(c => process.exit(c), e => { console.error(`mix-make: ${e.message}`); process.exit(1); });
}
