#!/usr/bin/env node
// The conductor scorer (#188 Task 2; docs/CELLULAR_VIZ_BRIEF_CONDUCTOR.md, rulings R2–R8, A1–A7, R5′, R14, R15).
// A session JSONL from the conductor page plus each track's reference grid (the Beat This! sidecar) → per-track and
// session numbers for the CONDUCTED clock (with the user's fixes) and the TRACKER ALONE (the shadow, R3), the error
// episodes and the verdict on every fix, the crossfade windows, and the gate (R7). Pure functions, node-tested in
// qa/runner/test/conduct-score.test.mjs; the CLI writes a markdown report.
//
//   node qa/conduct-score.mjs <session.jsonl> [--grids <tracks dir>] [--out <report.md>] [--json <result.json>]
//
// Privacy (R9): the report names tracks by corpus id (qa/corpus.json via the box's corpus-map.json) or "track N",
// never by file name. Timelines (R2): one scoring timeline, render time (ctx.currentTime). Output beats are the clock's
// booked beat times (render time); the 100 ms samples sit on the heard timeline, so clock.latency() is added back to
// them; the visual offset never enters. Reference beats come from the grid through a per-segment fit of the logged
// (position, audioTime) pairs; the fit residual is reported, so drift stays visible.
//
// Session log schema v1, one JSON object per line, each with `type` and `ctx` (AudioContext seconds):
//   session  { v: 1, id, startedAt, input: 'line:page' | 'line' }
//   latency  { outputLatency, baseLatency, clockLatency (s), visualOffsetMs, analysisDelayMs, sampleRate }
//   track    { idx, event: 'load' | 'loadError' | 'play' | 'pause' | 'resume' | 'end', file?, id?, posMs?, error? }   id: the corpus id (R9)
//   pair     { idx, posMs }                                  every 5 s while a track plays
//   xfade    { from, to, event: 'start' | 'end', mode?: 'A' | 'B' }   a page crossfade (unmatched: mode B by default)
//   beat     { src: 'clock' | 'shadow', beatInBar? }         an output beat (clock) or a shadow-tracker beat
//   sample   { clock: { bpm, conf, state }, shadow: { bpm, conf, state } }   every 100 ms (heard timeline)
//   fix      { id, kind, arg?, origin, idx?, landedCtx? }    kind: tap | half | x2 | flip | nudge | set1 | reset
//   jump     { kind, origin, fromBeats, toBeats }            every clock.jumps entry
//   state    { src?, from, to }
//   mark     { idx, name, trackMs, beat?, atMs?, rawMs?, markSource? }   key M (R13), e.g. kickIn, transition1, bar1:
//            snapped to reference beat `beat` (qa/marks.mjs), trackMs = atMs; rawMs the press; qa/marks-apply.mjs applies them
//   key      { shown }                                       the answer-key lamp (R7: the gate run needs 0 s)
//   wheel    { kind, hint, medianMs, sixShare, driftDegPerBar, state, idx?, id?, posMs }   v2: the phase-wheel hint once it
//            held 0.5 s (ctx = when it began); kind on | nudge | flip | tap | grey | none. Reported, never scored
//   sample.wheel { kind, ms } (v2): the wheel's hint kind and marker ms at that sample
// v1 and v2 logs both parse (v2 only adds the wheel fields).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const W_MS = 35, W70_MS = 70, FRAME_S = 1 / 60;
export const RHO_IN = [0.97, 1.03], RHO_OCTAVE = [[1.94, 2.06], [0.485, 0.515]], SIDE_PHI = 0.375;
export const EPISODE_MIN = 5;        // R6: more than 4 consecutive reference beats not `in`
export const CLEAN_RUN = 4, LOCK_RUN = 8, CATCH_BEATS = 8, VERDICT_AFTER = 2, VERDICT_EPS = 0.1;
export const GATE = { inPct: 90, falsePerTrack: 1, djFixes: 1, keyShownS: 0 };
export const XFADE = { exclBeats: 1, aInPct: 90, aConf: 0.8, bRelockBeats: 8, bConfDrop: 0.7, bConfBack: 0.9, bBackBeats: 8, c0S: 30 };
export const BACKBEAT_CAP = 16, LOW_CONF = 0.5, FREERUN_DRIFT_PCT = 0.5, FLAG_DRIFT = 20, OCTAVE_WINDOW = 16;
export const CLASSES = ['in', 'loose', 'side', 'octave', 'tempo', 'lost'];

const num = x => typeof x === 'number' && Number.isFinite(x);
const sortNum = a => a.filter(num).sort((x, y) => x - y);
export function median(a) { const s = sortNum(a); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
export function pctile(a, q) { const s = sortNum(a); if (!s.length) return null; const x = (s.length - 1) * q, i = Math.floor(x); return i + 1 < s.length ? s[i] + (s[i + 1] - s[i]) * (x - i) : s[i]; }
const rnd = (x, d = 3) => (num(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const wrapHalf = x => { let y = x - Math.round(x); if (y <= -0.5) y += 1; return y; };   // (−½, ½]
function nearestIdx(a, t) {
  if (!a.length) return -1;
  let lo = 0, hi = a.length - 1;
  if (t <= a[lo]) return lo;
  if (t >= a[hi]) return hi;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] <= t) lo = m; else hi = m; }
  return t - a[lo] <= a[hi] - t ? lo : hi;
}
function firstAtOrAfter(a, t) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < t) lo = m + 1; else hi = m; } return lo; }

// ---------- the log ----------
export const RECORD_FIELDS = {
  session: ['v'], latency: [], track: ['idx', 'event'], pair: ['idx', 'posMs'], xfade: ['from', 'to', 'event'], beat: ['src'],
  sample: [], fix: ['id', 'kind'], jump: ['fromBeats', 'toBeats'], state: ['to'], mark: ['idx', 'name', 'trackMs'], key: ['shown'],
  wheel: ['kind'],
};
export const SCHEMA_VERSIONS = [1, 2];
/** every jump kind a session can log (Q9: each clock.jumps entry appears once): the tracker's own (acquire, override,
 *  side, flip, octave: #214's evidence release of a wrong octave hold, and relative: #214's re-acquire after a 4:3 /
 *  3:2 tempo move; both booked on a bar line, forward only), the
 *  hand fixes clock.js books as jumps, a file seek. Any other kind is counted under session.jumps.unknown (reported,
 *  never a parse error, so a new kind never breaks a real run's scoring). */
export const JUMP_KINDS = ['acquire', 'override', 'side', 'flip', 'octave', 'relative', 'nudge', 'x2', 'half', 'setOne', 'reset', 'tap', 'seek', 'bar'];
/** the problems with one record (empty when it fits schema v1) */
export function checkRecord(r) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return ['not an object'];
  if (!RECORD_FIELDS[r.type]) return [`unknown type ${r.type}`];
  const errs = [];
  if (!num(r.ctx)) errs.push(`${r.type}: ctx missing`);
  for (const k of RECORD_FIELDS[r.type]) if (!(k in r)) errs.push(`${r.type}: ${k} missing`);
  if (r.type === 'session' && !SCHEMA_VERSIONS.includes(r.v)) errs.push(`session: v is not ${SCHEMA_VERSIONS.join(' or ')}`);
  if (r.type === 'beat' && r.src !== 'clock' && r.src !== 'shadow') errs.push(`beat: src ${r.src}`);
  return errs;
}
/** JSONL → records; throws on a line that doesn't parse or doesn't fit the schema, naming the line */
export function parseLog(text) {
  return String(text).split('\n').map((l, n) => [l, n]).filter(([l]) => l.trim()).map(([l, n]) => {
    let r;
    try { r = JSON.parse(l); } catch (e) { throw new Error(`line ${n + 1}: not JSON (${e.message})`); }
    const errs = checkRecord(r);
    if (errs.length) throw new Error(`line ${n + 1}: ${errs.join('; ')}`);
    return r;
  });
}
export const toJsonl = recs => recs.map(r => JSON.stringify(r)).join('\n') + '\n';

function fitSegment(pairs) {   // ctx = a + b · posMs / 1000, least squares over the pairs of one play segment
  const p = pairs.filter(x => num(x.posMs) && num(x.ctx));
  if (!p.length) return null;
  const xs = p.map(x => x.posMs / 1000), ys = p.map(x => x.ctx), n = p.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
  const b = sxx > 1e-9 ? sxy / sxx : 1, a = my - b * mx;
  let ss = 0;
  for (let i = 0; i < n; i++) ss += ((ys[i] - (a + b * xs[i])) * 1000) ** 2;
  return { a, b, n, residualMs: Math.sqrt(ss / n) };
}

/** records → the session's timelines: output and shadow beats, samples, tracks with their play segments, fades … */
export function readSession(records) {
  const recs = records.map((r, i) => [r, i]).sort((x, y) => x[0].ctx - y[0].ctx || x[1] - y[1]).map(x => x[0]);
  const head = recs.find(r => r.type === 'session') || { v: 1, input: 'line:page' };
  const latency = recs.find(r => r.type === 'latency') || {};
  const clockLatency = num(latency.clockLatency) ? latency.clockLatency : 0;
  const clock = { t: [], bib: [] }, shadow = [];
  for (const r of recs) {
    if (r.type !== 'beat') continue;
    if (r.src === 'shadow') shadow.push(r.ctx);
    else { clock.t.push(r.ctx); clock.bib.push(num(r.beatInBar) ? r.beatInBar : null); }
  }
  const samples = recs.filter(r => r.type === 'sample').map(r => ({ t: r.ctx + clockLatency, clock: r.clock || {}, shadow: r.shadow || {} }));
  const endCtx = recs.length ? recs[recs.length - 1].ctx : 0;
  const tracks = new Map(), get = idx => {
    if (!tracks.has(idx)) tracks.set(idx, { idx, file: null, segs: [], open: null, pauses: [], marks: [] });
    return tracks.get(idx);
  };
  for (const r of recs) {
    if (r.type === 'track') {
      const tr = get(r.idx), pair = num(r.posMs) ? { posMs: r.posMs, ctx: r.ctx } : null;
      if (r.file) tr.file = r.file;
      if (r.event === 'play' || r.event === 'resume') {
        if (r.event === 'resume' && tr.pauses.length && tr.pauses[tr.pauses.length - 1].to === null) tr.pauses[tr.pauses.length - 1].to = r.ctx;
        if (!tr.open) tr.open = { startCtx: r.ctx, endCtx: null, pairs: pair ? [pair] : [] };
      } else if ((r.event === 'pause' || r.event === 'end') && tr.open) {
        if (pair) tr.open.pairs.push(pair);
        tr.open.endCtx = r.ctx; tr.segs.push(tr.open); tr.open = null;
        if (r.event === 'pause') tr.pauses.push({ from: r.ctx, to: null });
      }
    } else if (r.type === 'pair') {
      const tr = get(r.idx);
      if (tr.open) tr.open.pairs.push({ posMs: r.posMs, ctx: r.ctx });
    } else if (r.type === 'mark') get(r.idx).marks.push({ name: r.name, trackMs: r.trackMs });
  }
  const xfades = [];
  for (const r of recs.filter(x => x.type === 'xfade')) {
    if (r.event === 'start') xfades.push({ from: r.from, to: r.to, start: r.ctx, end: null, mode: r.mode === 'A' ? 'A' : 'B' });
    else { const x = xfades.find(f => f.from === r.from && f.to === r.to && f.end === null); if (x) x.end = r.ctx; }
  }
  for (const x of xfades) { if (x.end === null) x.end = x.start; x.mid = (x.start + x.end) / 2; }
  for (const tr of tracks.values()) {
    if (tr.open) {   // still playing at the end of the log, or stopped by a crossfade
      const out = xfades.find(x => x.from === tr.idx);
      tr.open.endCtx = out ? out.end : endCtx; tr.segs.push(tr.open); tr.open = null;
    }
    for (const p of tr.pauses) if (p.to === null) p.to = endCtx;
    for (const s of tr.segs) {
      s.fit = fitSegment(s.pairs);
      if (s.fit) { s.fromPos = s.pairs[0].posMs; s.toPos = (s.endCtx - s.fit.a) / s.fit.b * 1000; }
    }
    tr.segs = tr.segs.filter(s => s.fit);
  }
  let keyShownS = 0, shownAt = null;
  for (const r of recs.filter(x => x.type === 'key')) {
    if (r.shown && shownAt === null) shownAt = r.ctx;
    else if (!r.shown && shownAt !== null) { keyShownS += r.ctx - shownAt; shownAt = null; }
  }
  if (shownAt !== null) keyShownS += endCtx - shownAt;
  return { head, input: head.input || 'line:page', latency, clockLatency, clock, shadow, samples, sampleT: samples.map(s => s.t),
    tracks, xfades, fixes: recs.filter(r => r.type === 'fix'), jumps: recs.filter(r => r.type === 'jump'), keyShownS, endCtx };
}
/** a position in the track (ms) → render time, through the play segment that covers it; null when it never played */
function posToCtx(tr, ms) {
  for (const s of tr.segs) if (ms >= s.fromPos - 1e-6 && ms < s.toPos - 1e-9) return s.fit.a + s.fit.b * ms / 1000;
  return null;
}

// ---------- R4 classes ----------
function column(S, src) {
  const times = src === 'shadow' ? S.shadow : S.clock.t;
  const sampleAt = t => { const i = nearestIdx(S.sampleT, t); return i >= 0 && Math.abs(S.sampleT[i] - t) <= 0.3 ? S.samples[i][src] || {} : null; };
  const bpmAt = (t, P) => {
    const s = sampleAt(t);
    if (s && num(s.bpm) && s.bpm > 0) return s.bpm;
    const a = firstAtOrAfter(times, t - 2.5 * P), b = firstAtOrAfter(times, t + 2.5 * P + 1e-12), per = [];
    for (let j = a + 1; j < b; j++) per.push(times[j] - times[j - 1]);
    const mp = median(per);
    return mp > 0 ? 60 / mp : null;
  };
  return { src, times, bib: src === 'clock' ? S.clock.bib : null, bpmAt, sampleAt };
}
/**
 * one reference beat r (render s) with period P against the column's beats: e = nearest output beat − r, φ = e / P
 * wrapped to ±½, ρ = output bpm / reference bpm → { cls, e (ms), phi, rho, size, i } (R4; size is R6's error size)
 */
export function classifyBeat(times, r, P, bpm) {
  const rho = num(bpm) && bpm > 0 ? bpm * P / 60 : null;
  const i = nearestIdx(times, r), has = i >= 0 && Math.abs(times[i] - r) <= P / 2 + 1e-9;
  const e = has ? (times[i] - r) * 1000 : null, phi = has ? wrapHalf((times[i] - r) / P) : null;
  let cls;
  if (rho !== null && RHO_OCTAVE.some(([lo, hi]) => rho >= lo && rho <= hi)) cls = 'octave';
  else if (rho !== null && (rho < RHO_IN[0] || rho > RHO_IN[1])) cls = 'tempo';
  else if (!has) cls = 'lost';
  else if (Math.abs(phi) >= SIDE_PHI) cls = 'side';
  else if (Math.abs(e) > W_MS) cls = 'loose';
  else cls = 'in';
  const size = cls === 'octave' || cls === 'tempo' || cls === 'lost' ? 1 : 2 * Math.abs(phi);
  return { cls, e, phi, rho, size, i: has ? i : -1 };
}
// A1: an octaveFree track is scored against the reference period × the factor (2: the half-beats join; ½: every
// other beat) that gives the most `in` time — the factor under which the octave holds; picked once per track.
function variantRefs(refs, m, parity) {
  if (m === 1) return refs;
  if (m === 2) {
    const out = [];
    refs.forEach((r, j) => {
      out.push({ ...r, P: r.P / 2 });
      const n = refs[j + 1];
      if (n && n.k === r.k + 1) out.push({ k: r.k + 0.5, t: (r.t + n.t) / 2, P: r.P / 2, P0: r.P0, pos: null, excl: r.excl || n.excl });
    });
    return out;
  }
  return refs.filter(r => r.k % 2 === parity).map(r => ({ ...r, P: r.P * 2 }));
}
function classifyColumn(col, refs) {
  return refs.map(r => ({ ...r, ...classifyBeat(col.times, r.t, r.P, col.bpmAt(r.t, r.P0)) }));
}
const scored = beats => beats.filter(b => !b.excl);
function inShare(beats) {
  const s = scored(beats), tot = s.reduce((x, b) => x + b.P, 0);
  return tot > 0 ? s.filter(b => b.cls === 'in').reduce((x, b) => x + b.P, 0) / tot : 0;
}
function pickFactor(col, refs, octaveFree) {
  const options = octaveFree ? [[1, 0], [2, 0], [0.5, 0], [0.5, 1]] : [[1, 0]];
  let best = null;
  for (const [m, parity] of options) {
    const beats = classifyColumn(col, variantRefs(refs, m, parity)), share = inShare(beats);
    if (!best || share > best.share + 1e-12) best = { m, parity, beats, share };
  }
  return best;
}
// A1: octaveFlips = changes of the octave the output sits at (median ρ per 16-beat window: ½, 1 or 2) over the track
function octaveFlips(col, refs) {
  const bands = [];
  for (let i = 0; i + OCTAVE_WINDOW <= refs.length; i += OCTAVE_WINDOW) {
    const w = refs.slice(i, i + OCTAVE_WINDOW), rho = median(w.map(r => { const b = col.bpmAt(r.t, r.P0); return num(b) ? b * r.P0 / 60 : null; }));
    if (rho === null) continue;
    const band = rho >= 1.94 && rho <= 2.06 ? 2 : rho >= 0.485 && rho <= 0.515 ? 0.5 : rho >= RHO_IN[0] && rho <= RHO_IN[1] ? 1 : null;
    if (band !== null) bands.push(band);
  }
  let flips = 0;
  for (let i = 1; i < bands.length; i++) if (bands[i] !== bands[i - 1]) flips++;
  return flips;
}

// ---------- R6 episodes, A4 lock, R5′ re-lock ----------
/** index (into list) of the first beat of the first run of n `in` beats at or after `from`; -1 when none */
function firstRun(list, from, n) {
  let run = 0;
  for (let i = from; i < list.length; i++) { run = list[i].cls === 'in' ? run + 1 : 0; if (run === n) return i - n + 1; }
  return -1;
}
export function findEpisodes(S) {   // S: scored beats in reference order
  const eps = [];
  let i = 0;
  while (i < S.length) {
    if (S[i].cls === 'in') { i++; continue; }
    let j = i;
    while (j < S.length && S[j].cls !== 'in') j++;
    if (j - i >= EPISODE_MIN) {
      const c = firstRun(S, j, CLEAN_RUN), span = S.slice(i, c < 0 ? S.length : c).filter(b => b.cls !== 'in'), counts = {};
      for (const b of span) counts[b.cls] = (counts[b.cls] || 0) + 1;
      const cls = CLASSES.filter(k => counts[k]).sort((a, b) => counts[b] - counts[a])[0];
      eps.push({ startIdx: i, cleanIdx: c < 0 ? null : c, startT: S[i].t, cleanT: c < 0 ? null : S[c].t, P: S[i].P, cls,
        timeToCleanBeats: c < 0 ? null : c - i });
      i = c < 0 ? S.length : c;
    } else i = j;
  }
  return eps;
}
const LAND_NEXT_BEAT = ['x2', 'half'], LAND_BAR = ['flip'];
/** when a fix takes effect (R6): the next output beat for ×2 / ÷2, the bar line for flip, the next frame otherwise */
export function landing(fix, col) {
  if (num(fix.landedCtx)) return fix.landedCtx;
  const i = firstAtOrAfter(col.times, fix.ctx + 1e-9);
  if (LAND_NEXT_BEAT.includes(fix.kind) && !fix.release) return i < col.times.length ? col.times[i] : fix.ctx + FRAME_S;
  if (LAND_BAR.includes(fix.kind) || fix.release) {   // D4: a second x2 / half press releases the hold at the bar line
    for (let j = i; j < col.times.length; j++) if (col.bib && col.bib[j] === 1) return col.times[j];
    return fix.ctx + FRAME_S;
  }
  return fix.ctx + FRAME_S;
}
/** R6: right / false / noEffect from the error size just before the press and 2 reference beats after landing */
export function verdict(before, after) {
  if (!before || !after) return 'unjudged';
  if (after.size < before.size - VERDICT_EPS || after.cls === 'in') return 'right';
  if (after.size > before.size + VERDICT_EPS || (before.cls === 'in' && after.cls !== 'in')) return 'false';
  return 'noEffect';
}

function columnStats(beats, t0) {
  const S = scored(beats), tot = S.reduce((x, b) => x + b.P, 0);
  const w = pred => (tot > 0 ? 100 * S.filter(pred).reduce((x, b) => x + b.P, 0) / tot : null);
  const absE = S.filter(b => num(b.e) && (b.cls === 'in' || b.cls === 'loose' || b.cls === 'side')).map(b => Math.abs(b.e));
  const i0 = t0 === null ? -1 : S.findIndex(b => b.t >= t0 - 1e-9), run = i0 < 0 ? -1 : firstRun(S, i0, LOCK_RUN);
  const classes = {};
  for (const b of S) classes[b.cls] = (classes[b.cls] || 0) + 1;
  return { S, playedS: rnd(tot, 2), inPct: rnd(w(b => b.cls === 'in'), 2),
    in70Pct: rnd(w(b => (b.cls === 'in' || b.cls === 'loose') && Math.abs(b.e) <= W70_MS), 2),
    absE: { p50: rnd(pctile(absE, 0.5), 1), p90: rnd(pctile(absE, 0.9), 1), p95: rnd(pctile(absE, 0.95), 1) },
    lockBeats: run < 0 ? null : run - i0, classes };
}
// A2: on a backbeatOk track the side span from acquisition (the first beat that isn't lost) is excluded, ≤ 16 beats
function backbeatSpan(beats) {
  const S = scored(beats), a = S.findIndex(b => b.cls !== 'lost');
  if (a < 0) return { beats: 0, capped: false };
  let n = 0;
  while (a + n < S.length && S[a + n].cls === 'side') n++;
  for (let j = 0; j < Math.min(n, BACKBEAT_CAP); j++) S[a + j].excl = 'sideSpan';
  return { beats: n, capped: n > BACKBEAT_CAP };
}

// ---------- one track ----------
function scoreTrack(S, tr, info, cols) {
  const row = info.row || null, grid = info.grid || null, idx = tr.idx;
  const base = { idx, id: info.id || null, label: info.id || `track ${idx + 1}`, slot: row ? row.slot : null };
  const xfIn = S.xfades.find(x => x.to === idx) || null, xfOut = S.xfades.find(x => x.from === idx) || null;
  const segStart = tr.segs.length ? tr.segs[0].startCtx : null, segEnd = tr.segs.length ? tr.segs[tr.segs.length - 1].endCtx : null;
  const spanStart = xfIn ? xfIn.mid : segStart, spanEnd = xfOut ? xfOut.mid : segEnd;
  const flagged = grid && (grid.gridSuspect === true || (num(grid.driftCore) && grid.driftCore > FLAG_DRIFT));
  const reason = !tr.segs.length ? 'never played' : S.input === 'line' ? 'mic input' : !grid || !Array.isArray(grid.beats) || grid.beats.length < 4 ? 'no grid'
    : flagged ? 'grid flagged' : null;
  if (reason) {
    return { ...base, scored: false, reason, playedS: rnd(segEnd - segStart, 2), gridFlags: grid ? gridFlags(grid) : null };
  }
  // the reference beats on the render timeline (R14: a lossy twin plays with its FLAC's grid moved by alignLag)
  const shiftMs = row && row.lossy && num(row.alignLagMs) ? row.alignLagMs : 0;
  const gb = grid.beats.filter(b => num(b.ms)), endAtMs = num(grid.endAtMs) ? grid.endAtMs : Infinity;
  const mix = grid.mix && num(grid.mix.midMs) ? grid.mix : null;
  const mixMid = mix ? posToCtx(tr, mix.midMs + shiftMs) : null;
  const refs = [];
  let afterEndAt = 0;
  gb.forEach((b, k) => {
    const t = posToCtx(tr, b.ms + shiftMs);
    if (t === null || t < spanStart - 1e-9 || t >= spanEnd - 1e-9) return;
    if (b.ms > endAtMs) { afterEndAt++; return; }
    const prev = gb[k - 1], next = gb[k + 1];
    const P = (prev && next ? (next.ms - prev.ms) / 2 : next ? next.ms - b.ms : prev ? b.ms - prev.ms : NaN) / 1000;
    if (!(P > 0)) return;
    const near = m => m !== null && Math.abs(t - m) <= XFADE.exclBeats * P + 1e-9;
    refs.push({ k, t, P, P0: P, pos: num(b.pos) ? b.pos : null, excl: near(xfIn && xfIn.mid) || near(xfOut && xfOut.mid) || near(mixMid) ? 'xfade' : null });
  });
  const octaveFree = !!(row && row.octaveFree);
  const lockMark = row && row.lockFrom === 'mark'
    ? (tr.marks.find(m => m.name === (row.lockMark || 'kickIn')) || [...tr.marks].sort((a, b) => a.trackMs - b.trackMs)[0] || null) : null;
  const t0 = row && row.lockFrom === 'mark' ? (lockMark ? posToCtx(tr, lockMark.trackMs) : null) : spanStart;
  const per = {};
  for (const src of ['clock', 'shadow']) {
    const col = cols[src], pick = pickFactor(col, refs, octaveFree);
    const side = row && row.backbeatOk ? backbeatSpan(pick.beats) : null;
    const st = columnStats(pick.beats, t0), eps = findEpisodes(st.S);
    per[src] = { col, pick, side, st, eps, flips: octaveFree ? octaveFlips(col, refs) : null };
  }
  // the user's fixes on this track (the shadow takes none): verdicts, episodes caught / late / missed
  const C = per.clock, SC = C.st.S;
  // D4: a rejected tap (uneven, the page flashed red) changed nothing, so it is not a fix (neither right nor false);
  // it is counted in rejectedTaps
  const mineAll = S.fixes.filter(f => (num(f.idx) ? f.idx === idx : f.ctx >= spanStart && f.ctx < spanEnd));
  const rejectedTaps = mineAll.filter(f => f.rejected).length;
  const fixes = mineAll.filter(f => !f.rejected).sort((a, b) => a.ctx - b.ctx).map(f => {
    const land = landing(f, C.col);
    let before = null;
    for (const b of SC) { if (b.t <= f.ctx + 1e-9) before = b; else break; }
    const ai = SC.findIndex(b => b.t > land + 1e-9), after = ai < 0 ? null : SC[ai + VERDICT_AFTER - 1] || null;
    return { id: f.id, kind: f.kind, origin: f.origin || null, pressS: rnd(f.ctx, 3), landS: rnd(land, 3), land, ctx: f.ctx,
      verdict: verdict(before, after), before: before ? rnd(before.size, 3) : null, after: after ? rnd(after.size, 3) : null };
  });
  const episodes = C.eps.map((ep, n) => {
    const until = ep.cleanT === null ? spanEnd : ep.cleanT, mine = fixes.filter(f => f.ctx >= ep.startT - 1e-9 && f.ctx < until);
    const firstRight = mine.find(f => f.verdict === 'right');
    const landIdx = firstRight ? SC.findIndex(b => b.t >= firstRight.land - 1e-9) : -1;
    const landBeats = firstRight ? (landIdx < 0 ? SC.length : landIdx) - ep.startIdx : null;
    return { n: n + 1, startS: rnd(ep.startT, 3), cls: ep.cls, timeToCleanBeats: ep.timeToCleanBeats,
      fixes: mine.map(f => f.id), reactionBeats: mine.length ? rnd((mine[0].ctx - ep.startT) / ep.P, 2) : null,
      landBeats, outcome: !mine.length ? 'missed' : landBeats !== null && landBeats <= CATCH_BEATS ? 'caught' : 'late' };
  });
  // A5–A7, R5′ inputs: confidence, jumps in low confidence, free-run drift, bar moves after set 1, rewinds
  const inSpan = t => t >= spanStart && t < spanEnd;
  const smp = S.samples.filter(s => inSpan(s.t));
  const confOf = src => median(smp.map(s => (s[src] || {}).conf));
  const jumps = S.jumps.filter(j => inSpan(j.ctx));
  const confAt = t => { const s = C.col.sampleAt(t); return s && num(s.conf) ? s.conf : null; };
  let freeRunDrift = null, run = [];
  const flushRun = () => { if (run.length > 1) { const m = run.reduce((x, y) => x + y, 0) / run.length, d = 100 * (Math.max(...run) - Math.min(...run)) / m; freeRunDrift = Math.max(freeRunDrift ?? 0, d); } run = []; };
  for (const s of smp) { if ((s.clock || {}).state === 'freerun' && num(s.clock.bpm)) run.push(s.clock.bpm); else flushRun(); }
  flushRun();
  const set1 = fixes.find(f => f.kind === 'set1');
  const inBeats = SC.filter(b => b.cls === 'in' && num(b.pos) && b.i >= 0 && C.col.bib && num(C.col.bib[b.i]));
  const gridBarOk = grid.barOk === true;
  const djTransitions = tr.marks.filter(m => /^transition/.test(m.name)).map(m => posToCtx(tr, m.trackMs)).filter(num);
  const isDj = !!(row && typeof row.slot === 'string' && /^T6\b/.test(row.slot));
  let djFixesMax = null;
  if (isDj) {
    if (djTransitions.length) {
      const perT = djTransitions.map(() => 0);
      for (const f of fixes) { let best = 0; djTransitions.forEach((t, i) => { if (Math.abs(f.ctx - t) < Math.abs(f.ctx - djTransitions[best])) best = i; }); perT[best]++; }
      djFixesMax = Math.max(...perT);
    } else djFixesMax = fixes.length;
  }
  const colOut = src => {
    const p = per[src];
    return { inPct: p.st.inPct, in70Pct: p.st.in70Pct, absE: p.st.absE, lockBeats: p.st.lockBeats, classes: p.st.classes,
      episodes: p.eps.length, octave: octaveFree ? { factor: p.pick.m, parity: p.pick.m === 0.5 ? p.pick.parity : null, flips: p.flips } : null,
      sideSpan: p.side, confMedian: rnd(confOf(src), 3) };
  };
  return { ...base, scored: true, reason: null, playedS: C.st.playedS, segs: tr.segs.length,
    timelineResidualMs: rnd(Math.max(...tr.segs.map(s => s.fit.residualMs)), 2), shiftMs: shiftMs || 0,
    conducted: colOut('clock'), alone: colOut('shadow'),
    deltaInPct: rnd(C.st.inPct - per.shadow.st.inPct, 2),
    lockFrom: row && row.lockFrom === 'mark' ? (lockMark ? `mark ${lockMark.name}` : 'mark (none logged)') : 'start',
    fixes: fixes.map(({ land, ctx, ...f }) => f), episodes, rejectedTaps,
    falseFixes: fixes.filter(f => f.verdict === 'false').length,
    jumpsLowConf: jumps.filter(j => { const c = confAt(j.ctx); return c !== null && c < LOW_CONF; }).length,
    freeRunDriftPct: rnd(freeRunDrift, 3), freeRunHeld: freeRunDrift === null ? null : freeRunDrift <= FREERUN_DRIFT_PCT,
    barMoves: set1 ? jumps.filter(j => j.ctx >= set1.ctx && j.origin === 'tracker' && j.kind === 'bar').length : null,
    barPct: inBeats.length ? rnd(100 * inBeats.filter(b => (C.col.bib[b.i] === 1) === (b.pos === 1)).length / inBeats.length, 2) : null,
    barReportOnly: !gridBarOk, rewinds: jumps.filter(j => j.toBeats < j.fromBeats).length, jumpKinds: kindCounts(jumps),
    isDj, djFixesMax, gridFlags: gridFlags(grid), afterEndAtBeats: afterEndAt,
    _beats: C.pick.beats, _shadowBeats: per.shadow.pick.beats, _span: [spanStart, spanEnd], _mix: mix, _mixMid: mixMid };
}
function kindCounts(jumps) { const c = {}; for (const j of jumps) { const k = String(j.kind); c[k] = (c[k] || 0) + 1; } return c; }
function gridFlags(g) {
  return { gridSuspect: typeof g.gridSuspect === 'boolean' ? g.gridSuspect : null, driftCore: num(g.driftCore) ? g.driftCore : null,
    barOk: g.barOk === true, fields: num(g.fields) ? g.fields : null };
}

// ---------- R5′ transition windows ----------
function windowStats(S, w, beats, cols) {
  const B = beats.filter(b => b.t >= w.start - 1e-9 && b.t <= w.end + 1e-9 && !b.excl);
  const tot = B.reduce((x, b) => x + b.P, 0), inPct = tot > 0 ? 100 * B.filter(b => b.cls === 'in').reduce((x, b) => x + b.P, 0) / tot : null;
  const after = t0 => { const L = beats.filter(b => !b.excl && b.t >= t0 - 1e-9), r = firstRun(L, 0, LOCK_RUN); return r < 0 ? null : r; };
  const conf = (a, b) => S.samples.filter(s => s.t >= a && s.t < b).map(s => (s.clock || {}).conf).filter(num);
  const c0 = median(conf(w.start - XFADE.c0S, w.start)), within = conf(w.start, w.end + 1e-9);
  const minConf = within.length ? Math.min(...within) : null;
  const Pin = median(beats.filter(b => b.t >= w.mid).map(b => b.P)) || 0.5;
  const back = S.samples.find(s => s.t >= w.end && num((s.clock || {}).conf) && c0 !== null && s.clock.conf >= XFADE.bConfBack * c0);
  const backBeats = back ? rnd((back.t - w.end) / Pin, 2) : null;
  const rewinds = S.jumps.filter(j => j.ctx >= w.start && j.ctx <= w.end && j.toBeats < j.fromBeats).length;
  const relockFromEnd = after(w.end), relockFromMid = after(w.mid);
  const out = { mode: w.mode, from: w.from, to: w.to, startS: rnd(w.start, 3), endS: rnd(w.end, 3), overlapS: rnd(w.end - w.start, 3),
    overlapInPct: rnd(inPct, 2), relockFromMid, relockFromEnd, minConf: rnd(minConf, 3), c0: rnd(c0, 3), confBackBeats: backBeats, rewinds,
    reportOnly: !!w.reportOnly };
  if (w.mode === 'A') {
    out.gated = { inOk: inPct !== null && inPct >= XFADE.aInPct - 1e-9, rewindsOk: rewinds === 0 };
    out.confRow = { ok: minConf !== null && c0 !== null && minConf >= XFADE.aConf * c0, reportOnly: true };
  } else {
    out.gated = { relockOk: relockFromEnd !== null && relockFromEnd <= XFADE.bRelockBeats, rewindsOk: rewinds === 0 };
    out.confRow = { ok: minConf !== null && c0 !== null && minConf <= XFADE.bConfDrop * c0 && backBeats !== null && backBeats <= XFADE.bBackBeats, reportOnly: true };
  }
  out.pass = w.reportOnly ? null : Object.values(out.gated).every(Boolean);
  return out;
}

// ---------- the session ----------
/**
 * records (parsed log) + info per track index { id, row (corpus row), grid (sidecar) } → the full result. Only the
 * grid's beats (ms, pos), barOk, gridSuspect, driftCore, endAtMs and mix are read; never a bpm field (A1′).
 */
export function scoreSession(records, info = {}) {
  const S = readSession(records), cols = { clock: column(S, 'clock'), shadow: column(S, 'shadow') };
  const infoOf = idx => (info instanceof Map ? info.get(idx) : info[idx]) || {};
  const tracks = [...S.tracks.values()].sort((a, b) => a.idx - b.idx).map(tr => scoreTrack(S, tr, infoOf(tr.idx), cols));
  const byIdx = new Map(tracks.map(t => [t.idx, t]));
  const windows = [];
  for (const x of S.xfades) {
    const a = byIdx.get(x.from), b = byIdx.get(x.to);
    const beats = [...(a && a.scored ? a._beats : []), ...(b && b.scored ? b._beats : [])].sort((p, q) => p.t - q.t);
    windows.push(windowStats(S, { ...x, from: a ? a.label : null, to: b ? b.label : null, reportOnly: !(a && a.scored && b && b.scored) }, beats, cols));
  }
  for (const t of tracks) {
    if (!t.scored || !t._mix) continue;
    const tr = S.tracks.get(t.idx), m = t._mix;
    const start = posToCtx(tr, m.overlapStartMs + t.shiftMs), end = posToCtx(tr, m.overlapEndMs + t.shiftMs);
    if (start === null || end === null) continue;
    windows.push(windowStats(S, { from: t.label, to: t.label, start, end, mid: t._mixMid, mode: m.mode === 'A' ? 'A' : 'B',
      reportOnly: m.mode === 'A' && m.align === 'beat' }, t._beats, cols));
  }
  const sc = tracks.filter(t => t.scored);
  const all = sc.flatMap(t => scored(t._beats)), allA = sc.flatMap(t => scored(t._shadowBeats));
  const share = B => { const tot = B.reduce((x, b) => x + b.P, 0); return tot > 0 ? 100 * B.filter(b => b.cls === 'in').reduce((x, b) => x + b.P, 0) / tot : null; };
  const eps = sc.flatMap(t => t.episodes), react = eps.map(e => e.reactionBeats).filter(num);
  const inPct = share(all);
  const findings = [];
  if (!(inPct !== null && inPct >= GATE.inPct - 1e-9)) findings.push(`inside the gate ${rnd(inPct, 2)} % < ${GATE.inPct} %`);
  for (const t of sc) for (const e of t.episodes) if (e.outcome !== 'caught') findings.push(`${t.label}: episode ${e.n} at ${e.startS} s ${e.outcome}`);
  for (const t of sc) if (t.falseFixes > GATE.falsePerTrack) findings.push(`${t.label}: ${t.falseFixes} false fixes`);
  for (const t of sc) if (t.isDj && t.djFixesMax > GATE.djFixes) findings.push(`${t.label}: ${t.djFixesMax} fixes on one transition`);
  for (const t of sc) if (t.conducted.octave && t.conducted.octave.flips > 0) findings.push(`${t.label}: octaveFlips ${t.conducted.octave.flips}`);
  for (const w of windows) if (w.pass === false) findings.push(`transition ${w.from} → ${w.to} (mode ${w.mode}) fails ${Object.entries(w.gated).filter(([, v]) => !v).map(([k]) => k).join(', ')}`);
  if (S.keyShownS > GATE.keyShownS + 1e-9) findings.push(`answer key shown ${rnd(S.keyShownS, 1)} s`);
  if (!sc.length) findings.push('no scored track');
  const fixes = sc.reduce((x, t) => x + t.fixes.length, 0);
  const session = {
    id: S.head.id ?? null, startedAt: S.head.startedAt ?? null, input: S.input,
    latency: { clockLatency: S.latency.clockLatency ?? null, outputLatency: S.latency.outputLatency ?? null, baseLatency: S.latency.baseLatency ?? null,
      visualOffsetMs: S.latency.visualOffsetMs ?? null, analysisDelayMs: S.latency.analysisDelayMs ?? null, sampleRate: S.latency.sampleRate ?? null },
    inPct: rnd(inPct, 2), alonePct: rnd(share(allA), 2), deltaPct: inPct === null ? null : rnd(inPct - share(allA), 2),
    in70Pct: rnd((() => { const tot = all.reduce((x, b) => x + b.P, 0); return tot > 0 ? 100 * all.filter(b => (b.cls === 'in' || b.cls === 'loose') && Math.abs(b.e) <= W70_MS).reduce((x, b) => x + b.P, 0) / tot : null; })(), 2),
    episodes: { total: eps.length, caught: eps.filter(e => e.outcome === 'caught').length, late: eps.filter(e => e.outcome === 'late').length,
      missed: eps.filter(e => e.outcome === 'missed').length },
    falseFixes: sc.reduce((x, t) => x + t.falseFixes, 0), reactionBeats: { p50: rnd(pctile(react, 0.5), 2), p90: rnd(pctile(react, 0.9), 2) },
    fixes, rejectedTaps: sc.reduce((x, t) => x + t.rejectedTaps, 0), fixesPerTrack: sc.length ? rnd(fixes / sc.length, 3) : null, tracksWithoutFixes: sc.filter(t => !t.fixes.length).length,
    scoredTracks: sc.length, keyShownS: rnd(S.keyShownS, 2),
    unscored: tracks.filter(t => !t.scored).map(t => ({ label: t.label, reason: t.reason })),
    jumps: { total: S.jumps.length, byKind: kindCounts(S.jumps), unknown: [...new Set(S.jumps.map(j => String(j.kind)).filter(k => !JUMP_KINDS.includes(k)))],
      octave: S.jumps.filter(j => j.kind === 'octave').length, rewinds: S.jumps.filter(j => j.toBeats < j.fromBeats).length },
    pass: findings.length === 0, findings,
  };
  return { session, tracks: tracks.map(({ _beats, _shadowBeats, _span, _mix, _mixMid, ...t }) => t), windows, _beats: Object.fromEntries(sc.map(t => [t.label, t._beats])) };
}

// ---------- the report ----------
const CH = { in: '.', loose: 'l', side: 's', octave: 'o', tempo: 't', lost: 'x' };
/** one character per reference beat, 64 to a line: . in, l loose, s side, o octave, t tempo, x lost, | excluded */
export function timeline(beats, width = 64, maxLines = 40) {
  const lines = [];
  for (let i = 0; i < beats.length && lines.length < maxLines; i += width) {
    const part = beats.slice(i, i + width);
    lines.push(`${String(part[0].t.toFixed(1)).padStart(7)} s  ${part.map(b => (b.excl ? '|' : CH[b.cls] || '?')).join('')}`);
  }
  if (beats.length > width * maxLines) lines.push(`  … ${beats.length - width * maxLines} more beats`);
  return lines.join('\n');
}
const v = x => (x === null || x === undefined ? 'n/a' : String(x));
export function renderReport(res) {
  const s = res.session, L = [];
  L.push(`# Conductor report ${v(s.id)}`, '', `Started ${v(s.startedAt)} · input \`${s.input}\` · clock.latency ${v(s.latency.clockLatency)} s · output ${v(s.latency.outputLatency)} s · base ${v(s.latency.baseLatency)} s · visual offset ${v(s.latency.visualOffsetMs)} ms (not scored)`, '');
  L.push(`## The gate (R7): ${s.pass ? 'PASS' : 'FAIL'}`, '');
  L.push('| | conducted | tracker alone | Δ |', '|---|---|---|---|', `| inside ±35 ms, % of played time | ${v(s.inPct)} | ${v(s.alonePct)} | ${v(s.deltaPct)} |`, `| inside ±70 ms (report) | ${v(s.in70Pct)} | | |`, '');
  L.push(`Episodes ${s.episodes.total}: caught ${s.episodes.caught}, late ${s.episodes.late}, missed ${s.episodes.missed} · reaction p50 ${v(s.reactionBeats.p50)} / p90 ${v(s.reactionBeats.p90)} beats · false fixes ${s.falseFixes} · fixes ${s.fixes} (${v(s.fixesPerTrack)} per track, ${s.tracksWithoutFixes} tracks with none) · rejected taps ${s.rejectedTaps} (uneven, not fixes) · answer key ${v(s.keyShownS)} s`, '');
  L.push(`Jumps ${s.jumps.total}: ${Object.entries(s.jumps.byKind).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'} · rewinds ${s.jumps.rewinds}${s.jumps.unknown.length ? ` · unknown kinds ${s.jumps.unknown.join(', ')}` : ''}`, '');
  if (s.findings.length) { L.push('Findings:'); s.findings.forEach((f, i) => L.push(`${i + 1}. ${f}`)); L.push(''); }
  L.push('## Tracks', '', '| track | slot | played s | in % | alone % | Δ | ±70 % | |e| p50/p90/p95 ms | lock beats | episodes | fixes right/false/none | rejected taps | octave | side span | conf | flags |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const t of res.tracks) {
    if (!t.scored) { L.push(`| ${t.label} | ${v(t.slot)} | ${v(t.playedS)} | UNSCORED: ${t.reason} | | | | | | | | | | | | |`); continue; }
    const c = t.conducted, a = t.alone, f = k => t.fixes.filter(x => x.verdict === k).length;
    const oct = c.octave ? `×${c.octave.factor}, flips ${c.octave.flips}` : '';
    const side = c.sideSpan ? `${c.sideSpan.beats}${c.sideSpan.capped ? ' (over 16)' : ''}` : '';
    const flags = [t.barReportOnly ? 'bar report-only' : null, t.rewinds ? `rewinds ${t.rewinds}` : null, t.barMoves ? `barMoves ${t.barMoves}` : null,
      t.jumpsLowConf ? `jumps in low conf ${t.jumpsLowConf}` : null, t.freeRunHeld === false ? `free-run drift ${t.freeRunDriftPct} %` : null,
      t.shiftMs ? `grid shift ${t.shiftMs} ms` : null].filter(Boolean).join(', ');
    L.push(`| ${t.label} | ${v(t.slot)} | ${t.playedS} | ${v(c.inPct)} | ${v(a.inPct)} | ${v(t.deltaInPct)} | ${v(c.in70Pct)} | ${v(c.absE.p50)}/${v(c.absE.p90)}/${v(c.absE.p95)} | ${v(c.lockBeats)} (${t.lockFrom}) | ${t.episodes.length} | ${f('right')}/${f('false')}/${f('noEffect')} | ${t.rejectedTaps} | ${oct} | ${side} | ${v(c.confMedian)} | ${flags} |`);
  }
  if (res.windows.length) {
    L.push('', '## Transitions (R5′)', '', '| from → to | mode | overlap s | overlap in % | relock from mid / end | minConf / C₀ | conf back (beats) | rewinds | gated | conf row (report) |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const w of res.windows) {
      const g = w.pass === null ? 'report-only' : w.pass ? 'pass' : 'FAIL';
      L.push(`| ${v(w.from)} → ${v(w.to)} | ${w.mode} | ${v(w.overlapS)} | ${v(w.overlapInPct)}${w.mode === 'B' ? ' (report)' : ''} | ${v(w.relockFromMid)} / ${v(w.relockFromEnd)} | ${v(w.minConf)} / ${v(w.c0)} | ${v(w.confBackBeats)} | ${w.rewinds} | ${g} | ${w.confRow.ok ? 'ok' : 'no'} |`);
    }
  }
  const eps = res.tracks.filter(t => t.scored && t.episodes.length);
  if (eps.length) {
    L.push('', '## Episodes (R6)', '');
    for (const t of eps) for (const e of t.episodes) L.push(`- ${t.label} #${e.n} at ${e.startS} s: ${e.cls}, ${e.outcome}; reaction ${v(e.reactionBeats)} beats, landed ${v(e.landBeats)}, clean after ${v(e.timeToCleanBeats)} beats; fixes ${e.fixes.join(', ') || 'none'}`);
  }
  if (s.unscored.length) { L.push('', '## Unscored (R8)', ''); for (const u of s.unscored) L.push(`- ${u.label}: ${u.reason}`); }
  L.push('', '## Timelines (conducted; . in, l loose, s side, o octave, t tempo, x lost, | excluded)', '');
  for (const [label, beats] of Object.entries(res._beats)) L.push(`### ${label}`, '```', timeline(beats), '```');
  return L.join('\n') + '\n';
}

// ---------- R14: grid alignment of a lossy twin, measured once by cross-correlation ----------
/** onset envelope: mean |x| per hop (1 ms), half-wave rectified difference */
export function onsetEnvelope(x, rate, hopMs = 1) {
  const hop = Math.max(1, Math.round(rate * hopMs / 1000)), n = Math.floor(x.length / hop), env = new Float64Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) s += Math.abs(x[j]);
    s /= hop; env[i] = Math.max(0, s - prev); prev = s;
  }
  return { env, hop };
}
function bestLag(a, b, from, to, a0 = 0, n = a.length) {   // argmax over L of Σ a[i] b[i + L], i in [a0, a0 + n)
  let best = -Infinity, lag = 0;
  for (let L = from; L <= to; L++) {
    let s = 0;
    const i0 = Math.max(a0, -L), i1 = Math.min(a0 + n, a.length, b.length - L);
    for (let i = i0; i < i1; i++) s += a[i] * b[i + L];
    if (s > best + 1e-12) { best = s; lag = L; }
  }
  return lag;
}
/**
 * the lag of `lossy` behind `ref` (both mono Float32Array at `rate`): coarse on the 1 ms onset envelopes over ±maxMs,
 * then fine on the samples ±fineMs around it, over a window of windowS from `startS` → { lagSamples, lagMs } (+ = later)
 */
export function alignLag(ref, lossy, rate, { maxMs = 60, fineMs = 2, windowS = 10, startS = 0 } = {}) {
  const ea = onsetEnvelope(ref, rate), eb = onsetEnvelope(lossy, rate), hop = ea.hop;
  const e0 = Math.floor(startS * 1000), en = Math.floor(windowS * 1000);
  const coarse = bestLag(ea.env, eb.env, -maxMs, maxMs, e0, en) * hop, fine = Math.ceil(rate * fineMs / 1000);
  const lagSamples = bestLag(ref, lossy, coarse - fine, coarse + fine, Math.floor(startS * rate), Math.floor(windowS * rate));
  return { lagSamples, lagMs: rnd(lagSamples / rate * 1000, 3) };
}
/** R14 expectation: measured at the start and at the end of the file; constant within ±2 ms, |lag| ≤ 30 ms (report-only) */
export function alignLagCheck(ref, lossy, rate, { windowS = 10 } = {}) {
  const dur = Math.min(ref.length, lossy.length) / rate, w = Math.min(windowS, dur / 2);
  const a = alignLag(ref, lossy, rate, { windowS: w, startS: 0 }), b = alignLag(ref, lossy, rate, { windowS: w, startS: Math.max(0, dur - w - 0.1) });
  const driftMs = rnd(b.lagMs - a.lagMs, 3);
  return { lagSamples: a.lagSamples, lagMs: a.lagMs, endLagMs: b.lagMs, driftMs, constant: Math.abs(driftMs) <= 2, within30: Math.abs(a.lagMs) <= 30 };
}
/** the corpus.json fields for a measured lag; re-measure only when either file's sha256 changed */
export function alignFields({ lagSamples, rate, shaRef, shaLossy }) {
  return { alignLagMs: rnd(lagSamples / rate * 1000, 3), alignLagSamples: lagSamples, alignLagRate: rate, alignLagMethod: 'xcorr', alignSha: { ref: shaRef, lossy: shaLossy } };
}
export const alignNeeded = (row, shaRef, shaLossy) => !(row && row.alignLagMethod === 'xcorr' && row.alignSha && row.alignSha.ref === shaRef && row.alignSha.lossy === shaLossy);

// ---------- CLI ----------
async function main(argv) {
  const args = argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const file = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
  if (!file) { console.error('usage: node qa/conduct-score.mjs <session.jsonl> [--grids <tracks dir>] [--out <report.md>] [--json <result.json>]'); process.exit(2); }
  const C = await import('./corpus.mjs');
  let dir = opt('--grids');
  if (!dir) { const A = await import('./runner/audio.mjs'); dir = A.audioDir(); }
  const records = parseLog(fs.readFileSync(file, 'utf8')), S = readSession(records);
  const rows = new Map(C.loadCorpus().map(r => [r.id, r])), map = C.loadMap(dir), byStem = new Map(Object.entries(map.tracks).map(([id, stem]) => [stem, id]));
  const info = {};
  for (const tr of S.tracks.values()) {
    const stem = tr.file ? path.basename(String(tr.file)).replace(/\.[^.]+$/, '') : null, id = stem ? byStem.get(stem) || null : null;
    const row = id ? rows.get(id) || null : null, gridStem = row && row.twinOf ? map.tracks[row.twinOf] || stem : stem;
    let grid = null;
    try { grid = gridStem ? JSON.parse(fs.readFileSync(path.join(dir, gridStem + '.beatgrid.json'), 'utf8')) : null; } catch { grid = null; }
    info[tr.idx] = { id, row, grid };
  }
  const res = scoreSession(records, info), md = renderReport(res);
  const out = opt('--out'), json = opt('--json');
  if (out) fs.writeFileSync(out, md); else process.stdout.write(md);
  if (json) { const { _beats, ...rest } = res; fs.writeFileSync(json, JSON.stringify(rest, null, 1) + '\n'); }
  process.exit(res.session.pass ? 0 : 1);
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main(process.argv);
export const _internal = { readSession, posToCtx, variantRefs, firstRun, fileURLToPath };
