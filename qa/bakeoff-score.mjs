#!/usr/bin/env node
// beatd task 1, the scorer (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 1, docs/CELLULAR_VIZ_BRIEF_BEAT_BAKEOFF.md):
// every candidate's beats over one recording against the Beat This! reference, report only. Pure functions, node-tested
// in qa/runner/test/bakeoff.test.mjs; the CLI is what qa/bakeoff.sh calls.
//
//   node qa/bakeoff-score.mjs --row wired-1 --ref <ref.beats> --dir <bakeoff out dir> [--log <session.jsonl>
//        --wavjson <session.wav.json>] [--md <report.md>] [--json <result.json>]
//   node qa/bakeoff-score.mjs --summary <result.json>... [--md <summary.md>]
//
// Candidates: every <id>.json in --dir written by qa/bakeoff_run.py ({ tracker, status, why?, beats: [[t, at]...],
// cpuPerAudioS }), plus, from the conductor's session log, "ours alone" (the shadow tracker's beats) and "ours + hand"
// (the clock's output beats, with the user's taps and holds). The log's ctx times go onto the recording's timeline with
// the .wav.json's startCtx (qa/conduct-rec.mjs: sample = (ctx - startCtx) * sampleRate).
//
// Per candidate (the brief's four measures):
//   in      share of played time (reference beats weighted by their period) with the nearest beat inside +-35 ms;
//           raw, and after one constant shift per candidate and recording (the median error of its near beats: the
//           "stated delay constant" of the brief's task 2, here read from the recording itself, never per track)
//   side    half a beat off (|phase| >= 0.375); octave: the candidate's local tempo at 2x or 1/2; tempo: any other
//           wrong tempo; lost: no beat within half a period
//   delay   for the trackers: how much audio they had read when they reported a beat, after that beat (median, p90);
//           a tracker right but 200 ms late needs a predictor in front of it. n/a for ours (the log has no report times)
//   recovery seconds from each mix point (a tempo change or a phase break in the reference) to the first 4 reference
//           beats in a row that are `in` (after the shift); "not within 60 s" counts apart
//   cost    CPU seconds per second of audio on the box (the runner's process time)
// Privacy (R9): rows are named by the caller (wired-1, mix-1); no file, track or person names in any output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyBeat, median, pctile, W_MS } from './conduct-score.mjs';

export const GAP_S = 2.0, MIN_P = 0.2;           // a reference period over 2 s is a gap (silence, a stop), not played time
export const TEMPO_WIN_S = 4;                    // the candidate's local tempo: median spacing of its beats within +-4 s
export const NEAR_PHI = 0.25;                    // beats this close (in phase) count for the constant shift
export const MIX = { win: 8, tempoRel: 0.02, breakRel: 0.2, mergeS: 16 };
export const RECOVER = { run: 4, maxS: 60 };
export const OURS = { shadow: 'ours-alone', clock: 'ours-hand' };

const num = x => typeof x === 'number' && Number.isFinite(x);
const rnd = (x, d = 1) => (num(x) ? Math.round(x * 10 ** d) / 10 ** d : null);
const pct = x => (num(x) ? rnd(100 * x, 1) : null);

/** the reference: sorted beat times (s) -> [{ t, P }] with P the period to the next beat (the last one keeps the one
 *  before); beats whose period is a gap or nonsense are marked gap (not played time) */
export function refBeats(times) {
  const t = times.filter(num).sort((a, b) => a - b), out = [];
  for (let i = 0; i < t.length; i++) {
    const P = i + 1 < t.length ? t[i + 1] - t[i] : (i > 0 ? t[i] - t[i - 1] : NaN);
    out.push({ t: t[i], P, gap: !(P >= MIN_P && P <= GAP_S) });
  }
  return out;
}
/** Beat This! / Sonic Visualiser TSV (time<TAB>beat-in-bar) -> times */
export const readBeatsTsv = text => String(text).split('\n').map(l => parseFloat(l.split('\t')[0])).filter(num);

/** the candidate's local tempo (bpm) around t: median spacing of its beats within +-win s; null with fewer than 3 */
export function localBpm(times, t, win = TEMPO_WIN_S) {
  let lo = 0, hi = times.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] < t - win) lo = m + 1; else hi = m; }
  const near = [];
  for (let i = lo; i < times.length && times[i] <= t + win; i++) near.push(times[i]);
  if (near.length < 3) return null;
  const d = [];
  for (let i = 1; i < near.length; i++) d.push(near[i] - near[i - 1]);
  const m = median(d);
  return m > 0 ? 60 / m : null;
}

/** classify every played reference beat against sorted candidate times (shifted by -shiftS) */
export function classify(refs, times, shiftS = 0) {
  const ts = shiftS ? times.map(x => x - shiftS) : times;
  return refs.filter(r => !r.gap).map(r => ({ ...r, ...classifyBeat(ts, r.t, r.P, localBpm(ts, r.t)) }));
}
/** the share of played time per class */
export function shares(beats) {
  const tot = beats.reduce((s, b) => s + b.P, 0), out = { in: 0, loose: 0, side: 0, octave: 0, tempo: 0, lost: 0 };
  if (!(tot > 0)) return { ...out, playedS: 0 };
  for (const b of beats) out[b.cls] += b.P / tot;
  return { ...out, playedS: tot };
}
/** the one constant shift (s) for a candidate: the median error of its beats near a reference beat; 0 with none */
export function constantShift(beats) {
  const e = beats.filter(b => num(b.e) && num(b.phi) && Math.abs(b.phi) < NEAR_PHI).map(b => b.e / 1000);
  return e.length ? median(e) : 0;
}

/** delay: for each reported beat [t, at] near a reference beat (within half its period), at - that reference beat (ms) */
export function delays(refs, beats) {
  const R = refs.filter(r => !r.gap), rt = R.map(r => r.t), out = [];
  if (!rt.length) return out;
  for (const [t, at] of beats) {
    if (!num(t) || !num(at)) continue;
    let lo = 0, hi = rt.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (rt[m] <= t) lo = m; else hi = m; }
    const i = Math.abs(rt[lo] - t) <= Math.abs(rt[hi] - t) ? lo : hi;
    if (Math.abs(rt[i] - t) <= R[i].P / 2) out.push((at - rt[i]) * 1000);
  }
  return out;
}

/** mix points in the reference: the first beat after a gap (a stop and a restart), or where the median period of the
 *  next `win` beats differs from the last `win` by more than tempoRel, or one period breaks from the local median by
 *  more than breakRel (a phase jump); points closer than mergeS keep the first. -> indexes into refs */
export function mixPoints(refs, o = MIX) {
  const pts = [];
  for (let i = 1; i < refs.length; i++) {
    let hit = refs[i - 1].gap && !refs[i].gap;
    if (!hit && i >= o.win && i + o.win <= refs.length) {
      const before = refs.slice(i - o.win, i), after = refs.slice(i, i + o.win);
      if (!before.some(r => r.gap) && !after.some(r => r.gap)) {
        const mb = median(before.map(r => r.P)), ma = median(after.map(r => r.P));
        hit = Math.abs(ma / mb - 1) > o.tempoRel || Math.abs(refs[i].P / mb - 1) > o.breakRel;
      }
    }
    if (hit && (!pts.length || refs[i].t - refs[pts[pts.length - 1]].t >= o.mergeS)) pts.push(i);
  }
  return pts;
}
/** seconds from each mix point to the first `run` reference beats in a row that are `in`; null when not within maxS */
export function recoveries(classified, points, refs, o = RECOVER) {
  const byT = new Map(classified.map(b => [b.t, b]));
  return points.map(i => {
    const t0 = refs[i].t;
    let run = 0;
    for (let j = i; j < refs.length && refs[j].t - t0 <= o.maxS; j++) {
      const b = byT.get(refs[j].t);
      run = b && b.cls === 'in' ? run + 1 : 0;
      if (run === o.run) return refs[j - o.run + 1].t - t0;
    }
    return null;
  });
}

/** the session log, leniently: only the beat records are used, so a line of a newer record type (or a cut last line)
 *  does not stop the comparison; -> { records, skipped } */
export function readLogLenient(text) {
  const records = []; let skipped = 0;
  for (const l of String(text).split('\n')) {
    if (!l.trim()) continue;
    try { const r = JSON.parse(l); if (r && typeof r === 'object') records.push(r); else skipped++; } catch { skipped++; }
  }
  return { records, skipped };
}

/** the conductor's log -> { shadow: [s], clock: [s] } on the recording's timeline (startCtx from the .wav.json) */
export function oursFromLog(records, startCtx) {
  const out = { shadow: [], clock: [] };
  if (!num(startCtx)) return out;
  for (const r of records) {
    if (r.type !== 'beat' || !num(r.ctx) || !(r.src in out)) continue;
    const t = r.ctx - startCtx;
    if (t >= 0) out[r.src].push(t);
  }
  out.shadow.sort((a, b) => a - b); out.clock.sort((a, b) => a - b);
  return out;
}

/** one candidate's numbers. cand: { id, status, why?, times (s, sorted), reports ([t, at] or null), cpu } */
export function scoreCandidate(refs, cand, points) {
  if (cand.status !== 'ok') return { id: cand.id, status: cand.status || 'failed', why: cand.why || null };
  const raw = classify(refs, cand.times), shift = constantShift(raw), fixed = shift ? classify(refs, cand.times, shift) : raw;
  const sr = shares(raw), sf = shares(fixed), rec = recoveries(fixed, points, refs), ok = rec.filter(num);
  const d = cand.reports ? delays(refs, cand.reports) : null;
  return {
    id: cand.id, status: 'ok', beats: cand.times.length,
    inRaw: pct(sr.in), in: pct(sf.in), shiftMs: rnd(shift * 1000, 1),
    side: pct(sf.side), octave: pct(sf.octave), tempo: pct(sf.tempo), lost: pct(sf.lost), loose: pct(sf.loose),
    delayMs: d && d.length ? { median: rnd(median(d), 1), p90: rnd(pctile(d, 0.9), 1), n: d.length } : null,
    recovery: { points: points.length, medianS: ok.length ? rnd(median(ok), 1) : null, notIn60s: rec.length - ok.length },
    cpuPerAudioS: num(cand.cpu) ? rnd(cand.cpu, 3) : null,
  };
}

/** a whole recording. runs: the runner's JSONs; log/wavjson optional (ours) */
export function scoreRecording({ row, refTimes, runs = [], records = null, startCtx = null }) {
  const refs = refBeats(refTimes), points = mixPoints(refs), cands = [];
  if (records) {
    const o = oursFromLog(records, startCtx);
    if (!num(startCtx)) cands.push({ id: OURS.shadow, status: 'failed', why: 'no startCtx (.wav.json): the log cannot be placed on the recording' }, { id: OURS.clock, status: 'failed', why: 'no startCtx (.wav.json)' });
    else {
      cands.push(o.shadow.length ? { id: OURS.shadow, status: 'ok', times: o.shadow } : { id: OURS.shadow, status: 'failed', why: 'no shadow beats in the log' });
      cands.push(o.clock.length ? { id: OURS.clock, status: 'ok', times: o.clock } : { id: OURS.clock, status: 'failed', why: 'no clock beats in the log' });
    }
  }
  for (const r of runs) {
    const beats = Array.isArray(r.beats) ? r.beats.filter(b => Array.isArray(b) && num(b[0])) : [];
    cands.push(r.status === 'ok'
      ? { id: r.tracker, status: 'ok', times: beats.map(b => b[0]).sort((a, b) => a - b), reports: beats.map(b => [b[0], num(b[1]) ? b[1] : b[0]]), cpu: r.cpuPerAudioS }
      : { id: r.tracker, status: r.status || 'failed', why: r.why || null });
  }
  const played = shares(refs.filter(r => !r.gap).map(r => ({ ...r, cls: 'in' }))).playedS;
  return { version: 1, row, refBeats: refs.length, playedS: rnd(played, 1), mixPoints: points.length, candidates: cands.map(c => scoreCandidate(refs, c, points)) };
}

const cell = x => (x === null || x === undefined ? '-' : String(x));
/** the markdown table for one recording (no names: the row id only) */
export function renderRecording(res) {
  const L = [`### ${res.row}`, '', `Reference: Beat This! (${res.refBeats} beats, ${res.playedS} s played, ${res.mixPoints} mix points). ` +
    `"in": nearest beat inside +-${W_MS} ms after one constant shift per candidate (shown); "raw": without the shift.`, '',
    '| candidate | in % | raw % | shift ms | side % | octave % | tempo % | lost % | delay ms (median / p90) | recovery s (median; not in 60 s) | CPU s per s |',
    '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const c of res.candidates) {
    if (c.status !== 'ok') { L.push(`| ${c.id} | ${c.status}: ${cell(c.why)} | | | | | | | | | |`); continue; }
    const d = c.delayMs ? `${c.delayMs.median} / ${c.delayMs.p90}` : 'n/a';
    L.push(`| ${c.id} | ${cell(c.in)} | ${cell(c.inRaw)} | ${cell(c.shiftMs)} | ${cell(c.side)} | ${cell(c.octave)} | ${cell(c.tempo)} | ${cell(c.lost)} | ${d} | ${cell(c.recovery.medianS)}; ${c.recovery.notIn60s} | ${cell(c.cpuPerAudioS)} |`);
  }
  return L.join('\n') + '\n';
}
/** the summary over several recordings: in % weighted by played time, the rest listed per row */
export function summarize(results) {
  const ids = [...new Set(results.flatMap(r => r.candidates.map(c => c.id)))], out = [];
  for (const id of ids) {
    let w = 0, s = 0; const rows = [];
    for (const r of results) {
      const c = r.candidates.find(x => x.id === id);
      if (c && c.status === 'ok' && num(c.in)) { w += r.playedS; s += r.playedS * c.in; rows.push(`${r.row} ${c.in}`); }
      else rows.push(`${r.row} ${c ? c.status : 'absent'}`);
    }
    out.push({ id, in: w > 0 ? rnd(s / w, 1) : null, rows });
  }
  return out.sort((a, b) => (b.in ?? -1) - (a.in ?? -1));
}
export function renderSummary(sum) {
  return ['| candidate | in % (weighted by played time) | per recording |', '|---|---|---|',
    ...sum.map(s => `| ${s.id} | ${cell(s.in)} | ${s.rows.join('; ')} |`)].join('\n') + '\n';
}

function main(argv) {
  const args = argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--summary')) {
    const files = args.slice(args.indexOf('--summary') + 1).filter(a => !a.startsWith('--') && a !== opt('--md'));
    const md = renderSummary(summarize(files.map(f => JSON.parse(fs.readFileSync(f, 'utf8')))));
    if (opt('--md')) fs.writeFileSync(opt('--md'), md); else process.stdout.write(md);
    return;
  }
  const row = opt('--row'), dir = opt('--dir'), ref = opt('--ref');
  if (!row || !/^[a-z][a-z0-9-]{0,23}$/.test(row) || !dir || !ref) throw new Error('usage: --row <id like wired-1> --ref <ref.beats> --dir <out dir> [--log x.jsonl --wavjson x.wav.json] [--md] [--json]');
  const runs = fs.readdirSync(dir).filter(f => /^[a-z0-9-]+\.json$/.test(f) && !/^(result|ref)\b/.test(f))
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).filter(r => r && typeof r.tracker === 'string');
  let records = null, startCtx = null;
  if (opt('--log')) records = readLogLenient(fs.readFileSync(opt('--log'), 'utf8')).records;
  if (opt('--wavjson')) startCtx = JSON.parse(fs.readFileSync(opt('--wavjson'), 'utf8')).startCtx;
  const res = scoreRecording({ row, refTimes: readBeatsTsv(fs.readFileSync(ref, 'utf8')), runs, records, startCtx });
  const md = renderRecording(res);
  if (opt('--json')) fs.writeFileSync(opt('--json'), JSON.stringify(res, null, 1) + '\n');
  if (opt('--md')) fs.writeFileSync(opt('--md'), md);
  process.stdout.write(md);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv); } catch (e) { console.error(`bakeoff-score: ${e.message}`); process.exit(1); }
}
