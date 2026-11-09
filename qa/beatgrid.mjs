#!/usr/bin/env node
// Beat This! grids → the clock's sidecar v2 (#173; #95 comment 6564285787). Beat This! (qa/ref-beats.sh) is the
// gridder: no other beat tracker is ported. Its <track>.ref.beats (time<TAB>beat-in-bar, 1 = downbeat) becomes
// <track>.beatgrid.json, which experiments/clock.js reads for `file:` sources, so the truth (b) reference and the
// rehearsal grid are one file.
//
//   { version: 2, fields: 2, beats: [{ ms, pos, conf }], edits: [...], source: {...}, orphaned: [...],
//     bpmFit, bpmFitCore, bpmTheilSen, inlierFrac, extraFrac, longFrac, gridSuspect, suspectWhy, driftCore,
//     fitResidualRms, fitResidualMax, beatsPerBar, barSuspect, frameMs: 20,
//     barOk: false, barOkCleared: null }          (the summary fields: gridFields below; #188, R15)
//
// - ms: the Beat This! time in milliseconds (3 decimals); pos: its beat-in-bar, as given (irregular bars kept).
// - conf: 1.0 on every beat. Beat This! gives no per-beat confidence (Audio2Beats returns beat and downbeat times
//   only), and none is invented (VIZ research ruling, 1 Nov).
// - edits: hand fixes from the grid editor ({ kind, atMs, value?, toMs?, by }). They live in the sidecar, survive
//   every re-conversion and are replayed on top of the fresh Beat This! beats. An edit anchors to the nearest beat
//   within ±60 ms of its atMs; if none is there any more, it is kept, not applied, and listed in `orphaned`. User
//   edits are never dropped.
//   move   { atMs, value: newMs }          the beat moves to value (order kept: it may not pass a neighbour)
//   setOne { atMs }                        this beat is a "1"; pos counts on in 4s (bpb) up to the next setOne
//   nudge  { atMs, value: ms, toMs? }      beats from atMs (to toMs, else to the end) shift by value ms
//   x2 / half / tap                        kept for the grid editor; the converter does not apply them
//
// CLI:  node qa/beatgrid.mjs <track>.ref.beats [--out <track>.beatgrid.json]
//       node qa/beatgrid.mjs --dir <folder>     every *.ref.beats whose sidecar is missing or older
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ANCHOR_MS = 60;
const round3 = x => Math.round(x * 1000) / 1000;

// ---- grid summary fields (#188; VIZ research R15, #188 6736333312) ----
// Beat This! places beats on 20 ms frames, and its beat list can carry extra beats (a double-time run, a spurious
// off-beat) or miss some. A line through time against beat index bends with every extra or missing beat (the
// fields-1 bug: Sandstorm read 149.9 for 136), so the tempo is the mean of the INLIER inter-beat intervals (IBIs):
// those within ±12.5 % of the median IBI. Doubled runs, missed beats and gaps contribute nothing, and averaging n
// quantised IBIs keeps the resolution (σ ≈ 20 ms / √(12 n)). Bumping FIELDS makes ensureGrids convert every
// sidecar again (hand edits are kept), so the fields reach grids made before them.
export const FIELDS = 2, FRAME_MS = 20, CORE_TRIM_S = 30, DRIFT_WINDOW = 16, BAR_OK_RANGE = [3.95, 4.05];
export const INLIER_TOL = 0.125;     // an IBI within ±12.5 % of the median is an inlier
export const INLIER_MIN = 0.9;       // inlierFrac below this → gridSuspect
export const EXTRA_MAX = 0.02;       // more than 2 % of IBIs SHORTER than the inlier band (extra beats) → gridSuspect
export const TS_AGREE = 0.005;       // Theil–Sen and the inlier mean more than 0.5 % apart → gridSuspect
export const GAP_X = 1.8;            // an IBI over 1.8 × median is a gap: no drift window spans it
export const WINDOW_OUT_MAX = 0.25;  // a drift window with more than 25 % outlier IBIs is masked
export const CONF_MIN = 0.5;         // a beat under this confidence masks its drift windows (Beat This! writes 1.0)
const TS_MIN_SPAN = 4, TS_MAX_SPAN = 256;   // Theil–Sen pairs 4–256 beats apart inside one inlier run

const median = xs => {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  return n ? (n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN;
};
const quantile = (sorted, q) => {
  const x = (sorted.length - 1) * q, i = Math.floor(x);
  return i + 1 < sorted.length ? sorted[i] + (sorted[i + 1] - sorted[i]) * (x - i) : sorted[i];
};

/**
 * the robust tempo of beat times ts (s, ascending) → null under 4 beats, else
 *   { bpm, period, medIbi, lo, hi, n, inlierFrac, extraFrac, longFrac, bpmTheilSen, rmsMs, maxMs, suspect, why }
 * - bpm = 60 / mean of the inlier IBIs (within ±INLIER_TOL of the median IBI).
 * - inlierFrac: inlier IBIs / all IBIs. extraFrac: IBIs shorter than the band / all IBIs, i.e. beats that should not
 *   be there (doubled runs, spurious off-beats). longFrac: IBIs longer than the band / all IBIs (missed beats, gaps,
 *   beatless intros and breakdowns): legitimate, so report-only (#188 6736790656), never part of gridSuspect.
 * - bpmTheilSen: the median of pairwise slopes inside the inlier runs (consecutive beats whose IBIs are all
 *   inliers, so the index inside a run is exact), pairs 4–256 beats apart; null when no run is long enough.
 * - rmsMs / maxMs: residuals of every inlier run against its own least-squares line.
 * - suspect (gridSuspect): inlierFrac < INLIER_MIN, extraFrac > EXTRA_MAX, or Theil–Sen and the mean more than
 *   TS_AGREE apart; why lists which.
 */
export function robustTempo(ts) {
  if (ts.length < 4) return null;
  const ibis = ts.slice(1).map((t, i) => t - ts[i]), medIbi = median(ibis);
  if (!(medIbi > 0)) return null;
  const lo = medIbi * (1 - INLIER_TOL), hi = medIbi * (1 + INLIER_TOL), inl = ibis.map(d => d >= lo && d <= hi);
  const kept = ibis.filter((_, i) => inl[i]);
  if (!kept.length) return null;
  const period = kept.reduce((s, d) => s + d, 0) / kept.length;
  const runs = [];                 // [first beat, last beat] with every IBI between them an inlier
  let a = null;
  for (let i = 0; i < ibis.length; i++) {
    if (inl[i]) { if (a === null) a = i; } else if (a !== null) { runs.push([a, i]); a = null; }
  }
  if (a !== null) runs.push([a, ibis.length]);
  const slopes = [];
  let ss = 0, cnt = 0, maxMs = 0;
  for (const [s, e] of runs) {
    for (let i = s; i < e; i++) {
      for (let j = i + TS_MIN_SPAN; j <= Math.min(e, i + TS_MAX_SPAN); j++) slopes.push((ts[j] - ts[i]) / (j - i));
    }
    const L = e - s + 1;
    if (L < 3) continue;
    const kx = (L - 1) / 2;
    let my = 0, sxx = 0, sxy = 0;
    for (let k = 0; k < L; k++) my += ts[s + k];
    my /= L;
    for (let k = 0; k < L; k++) { sxx += (k - kx) ** 2; sxy += (k - kx) * (ts[s + k] - my); }
    const p = sxy / sxx;
    for (let k = 0; k < L; k++) {
      const r = Math.abs(ts[s + k] - (my + p * (k - kx))) * 1000;
      ss += r * r; cnt++; maxMs = Math.max(maxMs, r);
    }
  }
  const tsPeriod = slopes.length ? median(slopes) : NaN, bpm = 60 / period, bpmTheilSen = tsPeriod > 0 ? 60 / tsPeriod : null;
  const inlierFrac = kept.length / ibis.length, why = [];
  const extraFrac = ibis.filter(d => d < lo).length / ibis.length, longFrac = ibis.filter(d => d > hi).length / ibis.length;
  if (inlierFrac < INLIER_MIN) why.push('inlierFrac');
  if (extraFrac > EXTRA_MAX) why.push('extra beats');
  if (bpmTheilSen !== null && Math.abs(bpm - bpmTheilSen) / bpmTheilSen > TS_AGREE) why.push('Theil-Sen');
  return { bpm, period, medIbi, lo, hi, n: ts.length, inlierFrac, extraFrac, longFrac, bpmTheilSen,
    rmsMs: cnt ? Math.sqrt(ss / cnt) : null, maxMs: cnt ? maxMs : null, suspect: why.length > 0, why };
}

/**
 * driftCore (%): 16-IBI moving tempo over the core from inlier IBIs only. A window is masked when more than
 * WINDOW_OUT_MAX of its IBIs are outliers, a gap (> GAP_X × median) sits inside it, or a beat in it is under
 * CONF_MIN confidence. driftCore = p95 − p5 of the window tempos, % of the core tempo (max − min let one bad window
 * decide). null when no window survives.
 */
function driftOf(ts, confs, fit) {
  const tempos = [];
  for (let i = 0; i + DRIFT_WINDOW < ts.length; i++) {
    let sum = 0, nIn = 0, masked = false;
    for (let k = i; k < i + DRIFT_WINDOW; k++) {
      const d = ts[k + 1] - ts[k];
      if (d > GAP_X * fit.medIbi || confs[k] < CONF_MIN || confs[k + 1] < CONF_MIN) { masked = true; break; }
      if (d >= fit.lo && d <= fit.hi) { sum += d; nIn++; }
    }
    if (masked || DRIFT_WINDOW - nIn > WINDOW_OUT_MAX * DRIFT_WINDOW || !nIn) continue;
    tempos.push(60 * nIn / sum);
  }
  if (!tempos.length) return null;
  tempos.sort((x, y) => x - y);
  return +(100 * (quantile(tempos, 0.95) - quantile(tempos, 0.05)) / fit.bpm).toFixed(3);
}

/**
 * the summary fields from the beats ([{ ms, pos?, conf? }]):
 *   bpmFit          robustTempo over every beat
 *   bpmFitCore      robustTempo over the core: the track minus its first and last CORE_TRIM_S seconds (beatless
 *                   intros and fade-outs make the gridder invent tempo), null when the core has < 16 beats
 *   bpmTheilSen, inlierFrac, extraFrac, longFrac (report-only), gridSuspect, suspectWhy   of the core fit (the
 *                   whole track without a core)
 *   driftCore       see driftOf; gridSuspect or driftCore > 20 % makes the tempo n/a for gating (qa/corpus.mjs)
 *   fitResidualRms/Max  ms, the inlier runs against their own lines (core, else whole)
 *   beatsPerBar     beats / downbeats (pos 1), null without downbeats; barSuspect outside 3.95–4.05
 *   frameMs         20: the gridder's quantisation, so every consumer knows it
 */
export function gridFields(beats) {
  const ts = beats.map(b => b.ms / 1000), all = robustTempo(ts);
  const t0 = ts[0], t1 = ts[ts.length - 1], coreIdx = [];
  ts.forEach((t, i) => { if (t >= t0 + CORE_TRIM_S && t <= t1 - CORE_TRIM_S) coreIdx.push(i); });
  const core = coreIdx.map(i => ts[i]), coreFit = core.length >= DRIFT_WINDOW ? robustTempo(core) : null;
  const driftCore = coreFit ? driftOf(core, coreIdx.map(i => (Number.isFinite(beats[i].conf) ? beats[i].conf : 1)), coreFit) : null;
  const res = coreFit || all, downs = beats.filter(b => b.pos === 1).length;
  const beatsPerBar = downs ? +(beats.length / downs).toFixed(3) : null;
  const r3 = x => (x === null || x === undefined ? null : +x.toFixed(3));
  return {
    bpmFit: all ? r3(all.bpm) : null,
    bpmFitCore: coreFit ? r3(coreFit.bpm) : null,
    bpmTheilSen: res ? r3(res.bpmTheilSen) : null,
    inlierFrac: res ? +res.inlierFrac.toFixed(4) : null,
    extraFrac: res ? +res.extraFrac.toFixed(4) : null,
    longFrac: res ? +res.longFrac.toFixed(4) : null,
    gridSuspect: res ? res.suspect : true,
    suspectWhy: res ? res.why : ['too few beats'],
    driftCore,
    fitResidualRms: res && res.rmsMs !== null ? +res.rmsMs.toFixed(2) : null,
    fitResidualMax: res && res.maxMs !== null ? +res.maxMs.toFixed(2) : null,
    beatsPerBar,
    barSuspect: beatsPerBar === null || beatsPerBar < BAR_OK_RANGE[0] || beatsPerBar > BAR_OK_RANGE[1],
    frameMs: FRAME_MS,
  };
}

/** Beat This! TSV text → [{ t (s), n (beat-in-bar or NaN) }], sorted, junk lines skipped */
export function parseRefBeats(text) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const [a, b] = s.split(/\s+/), t = Number(a), n = Number(b);
    if (Number.isFinite(t)) out.push({ t, n: Number.isInteger(n) && n >= 1 ? n : NaN });
  }
  out.sort((x, y) => x.t - y.t);
  return out.filter((x, i) => i === 0 || x.t > out[i - 1].t);
}

/** the index of the beat nearest ms, if within ANCHOR_MS, else -1 */
function anchor(beats, ms) {
  let best = -1, d = Infinity;
  for (let i = 0; i < beats.length; i++) { const e = Math.abs(beats[i].ms - ms); if (e < d) { d = e; best = i; } }
  return d <= ANCHOR_MS ? best : -1;
}

/** replay edits on beats (in place, in the order given) → the edits that found no beat */
export function replayEdits(beats, edits, bpb = 4) {
  const orphaned = [];
  for (const e of edits || []) {
    if (!e || typeof e !== 'object') continue;
    if (!['move', 'setOne', 'nudge'].includes(e.kind)) continue;   // x2, half, tap: the grid editor's
    const i = anchor(beats, Number(e.atMs));
    if (i < 0) { orphaned.push(e); continue; }
    if (e.kind === 'move') {
      const lo = i ? beats[i - 1].ms : -Infinity, hi = i < beats.length - 1 ? beats[i + 1].ms : Infinity, v = Number(e.value);
      if (Number.isFinite(v) && v > lo && v < hi) beats[i].ms = round3(v); else orphaned.push(e);
    } else if (e.kind === 'setOne') {
      let j = i, k = 0;
      do { beats[j].pos = (k % bpb) + 1; j++; k++; } while (j < beats.length && !beats[j].one);
      beats[i].one = true;
    } else if (e.kind === 'nudge') {
      const v = Number(e.value), to = e.toMs == null ? Infinity : Number(e.toMs);
      if (!Number.isFinite(v)) { orphaned.push(e); continue; }
      for (let j = i; j < beats.length && beats[j].ms <= to; j++) beats[j].ms = round3(beats[j].ms + v);
    }
  }
  for (const b of beats) delete b.one;
  return orphaned;
}

/** parsed ref beats (+ the edits to keep) → sidecar v2 */
export function toSidecar(ref, { edits = [], source = {} } = {}) {
  const beats = ref.map(r => ({ ms: round3(r.t * 1000), pos: Number.isInteger(r.n) ? r.n : undefined, conf: 1 }));
  for (let i = 0; i < beats.length; i++) if (beats[i].pos === undefined) delete beats[i].pos;   // clock.js counts on
  const orphaned = replayEdits(beats, edits);
  for (let i = 1; i < beats.length; i++) if (!(beats[i].ms > beats[i - 1].ms)) throw new Error(`beat ${i} not after beat ${i - 1} after the edits`);
  // barOk (A7b): only a Shift+S save with the bar lamp shown sets it true (the conductor page); a new conversion
  // starts false. barOkCleared says why a true went false ("regrid" | "setone"), null otherwise (convertFile).
  return { version: 2, fields: FIELDS, beats, edits: [...edits], orphaned, ...gridFields(beats), barOk: false, barOkCleared: null,
    source: { from: 'beat-this', ...source } };
}

/** convert one .ref.beats file, keeping the edits already in its sidecar; written atomically. Returns the sidecar. */
export function convertFile(refPath, outPath) {
  const out = outPath || refPath.replace(/\.ref\.beats$/, '') + '.beatgrid.json';
  let edits = [], old = null;
  try { old = JSON.parse(fs.readFileSync(out, 'utf8')); if (Array.isArray(old.edits)) edits = old.edits; } catch {}
  const st = fs.statSync(refPath), refMtime = st.mtime.toISOString();
  const side = toSidecar(parseRefBeats(fs.readFileSync(refPath, 'utf8')),
    { edits, source: { ref: path.basename(refPath), refMtime } });
  // barOk survives a re-conversion of the same Beat This! output (a FIELDS bump); a new .ref.beats clears it
  // ("regrid"), since its bar positions may have moved. Replayed saved Shift+1 fixes don't clear it.
  if (old && old.barOk === true) {
    if (old.source && old.source.refMtime === refMtime) side.barOk = true;
    else side.barOkCleared = 'regrid';
  } else if (old && (old.barOkCleared === 'regrid' || old.barOkCleared === 'setone')) side.barOkCleared = old.barOkCleared;
  const tmp = `${out}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(side) + '\n');
  fs.renameSync(tmp, out);
  return side;
}

/** every <name>.ref.beats in dir whose <name>.beatgrid.json is missing or older → converted. Returns [{ name, beats, orphaned }]. */
export function ensureGrids(dir) {
  const done = [];
  let names = [];
  try { names = fs.readdirSync(dir).filter(f => f.endsWith('.ref.beats')); } catch { return done; }
  for (const f of names) {
    const ref = path.join(dir, f), out = path.join(dir, f.replace(/\.ref\.beats$/, '.beatgrid.json'));
    let stale = true;
    try {   // missing, older than its .ref.beats, or made before the current summary fields
      stale = fs.statSync(out).mtimeMs < fs.statSync(ref).mtimeMs || JSON.parse(fs.readFileSync(out, 'utf8')).fields !== FIELDS;
    } catch {}
    if (!stale) continue;
    try { const s = convertFile(ref, out); done.push({ name: f.replace(/\.ref\.beats$/, ''), beats: s.beats.length, orphaned: s.orphaned.length }); }
    catch (e) { done.push({ name: f, error: String(e.message || e) }); }
  }
  return done;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), at = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (at('--dir')) {
    for (const r of ensureGrids(at('--dir'))) console.log(r.error ? `${r.name}: ${r.error}` : `${r.name}: ${r.beats} beats${r.orphaned ? `, ${r.orphaned} orphaned edits` : ''}`);
  } else if (a[0] && !a[0].startsWith('--')) {
    const s = convertFile(a[0], at('--out'));
    console.log(`${s.beats.length} beats, ${s.edits.length} edits (${s.orphaned.length} orphaned)`);
  } else {
    console.error('usage: node qa/beatgrid.mjs <track>.ref.beats [--out file] | --dir <folder>');
    process.exit(2);
  }
}
