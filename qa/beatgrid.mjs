#!/usr/bin/env node
// Beat This! grids → the clock's sidecar v2 (#173; #95 comment 6564285787). Beat This! (qa/ref-beats.sh) is the
// gridder: no other beat tracker is ported. Its <track>.ref.beats (time<TAB>beat-in-bar, 1 = downbeat) becomes
// <track>.beatgrid.json, which experiments/clock.js reads for `file:` sources, so the truth (b) reference and the
// rehearsal grid are one file.
//
//   { version: 2, fields: 1, beats: [{ ms, pos, conf }], edits: [...], source: {...}, orphaned: [...],
//     bpmFit, bpmFitCore, driftCore, fitResidualRms, fitResidualMax, beatsPerBar, barSuspect, frameMs: 20,
//     barOk: false, barOkCleared: null }          (the summary fields: gridFields below; #188)
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

// ---- grid summary fields (#188, VIZ research 6728364399: A1′, A1″, A7c) ----
// Beat This! places beats on 20 ms frames, so a median of beat intervals carries up to ±2 % (±½ frame a beat).
// Every tempo a ruling reads comes from a least-squares line instead. Bumping FIELDS makes ensureGrids convert every
// sidecar again (hand edits are kept), so the fields reach grids made before them.
export const FIELDS = 1, FRAME_MS = 20, CORE_TRIM_S = 30, DRIFT_WINDOW = 16, BAR_OK_RANGE = [3.95, 4.05];

/**
 * least-squares line through beat times (s) against their beat index → { bpm, period, n, rmsMs, maxMs } or null.
 * The index counts gap by gap (round(gap / median gap), at least 1), so a missed beat skips an index instead of
 * bending the line.
 */
export function fitLine(ts) {
  if (ts.length < 4) return null;
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b), med = gaps[gaps.length >> 1];
  if (!(med > 0)) return null;
  const idx = [0];
  for (let i = 1; i < ts.length; i++) idx.push(idx[i - 1] + Math.max(1, Math.round((ts[i] - ts[i - 1]) / med)));
  const n = ts.length, mx = idx.reduce((s, x) => s + x, 0) / n, my = ts.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (idx[i] - mx) ** 2; sxy += (idx[i] - mx) * (ts[i] - my); }
  const period = sxy / sxx, a = my - period * mx;
  if (!(period > 0)) return null;
  let ss = 0, mxr = 0;
  for (let i = 0; i < n; i++) { const r = Math.abs(ts[i] - (a + period * idx[i])) * 1000; ss += r * r; mxr = Math.max(mxr, r); }
  return { bpm: 60 / period, period, n, rmsMs: Math.sqrt(ss / n), maxMs: mxr };
}

/**
 * the summary fields from the beats ([{ ms, pos? }]):
 *   bpmFit          the line through every beat
 *   bpmFitCore      the line over the core: the track minus its first and last CORE_TRIM_S seconds of beats
 *                   (beatless intros and fade-outs make the gridder invent tempo), null when the core has < 16 beats
 *   driftCore       peak-to-peak bpm of a 16-beat moving fit over the core, % of bpmFitCore (A1″: constant ≤ 0.5,
 *                   drifting ≥ 1.5). Beat This! gives no per-beat confidence, so no low-confidence span is cut.
 *   fitResidualRms/Max  ms, the core fit's residuals (the whole-track fit when there is no core)
 *   beatsPerBar     beats / downbeats (pos 1), null without downbeats; barSuspect outside 3.95–4.05
 *   frameMs         20: the gridder's quantisation, so every consumer knows it
 */
export function gridFields(beats) {
  const ts = beats.map(b => b.ms / 1000), all = fitLine(ts);
  const t0 = ts[0], t1 = ts[ts.length - 1], core = ts.filter(t => t >= t0 + CORE_TRIM_S && t <= t1 - CORE_TRIM_S);
  const coreFit = core.length >= DRIFT_WINDOW ? fitLine(core) : null;
  let driftCore = null;
  if (coreFit) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i + DRIFT_WINDOW <= core.length; i++) {
      const f = fitLine(core.slice(i, i + DRIFT_WINDOW));
      if (f) { lo = Math.min(lo, f.bpm); hi = Math.max(hi, f.bpm); }
    }
    if (hi >= lo) driftCore = +(100 * (hi - lo) / coreFit.bpm).toFixed(3);
  }
  const res = coreFit || all, downs = beats.filter(b => b.pos === 1).length;
  const beatsPerBar = downs ? +(beats.length / downs).toFixed(3) : null;
  return {
    bpmFit: all ? +all.bpm.toFixed(3) : null,
    bpmFitCore: coreFit ? +coreFit.bpm.toFixed(3) : null,
    driftCore,
    fitResidualRms: res ? +res.rmsMs.toFixed(2) : null,
    fitResidualMax: res ? +res.maxMs.toFixed(2) : null,
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
