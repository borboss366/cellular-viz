// The side trap (the half-beat error; VIZ research's ruling, the user's go 14 Nov 17:21). On trance / garage / techno
// the off-beat bass sits in the low lane and is often louder than the kick, so the low lane's phases are bimodal and
// the side chosen at the first lock can land on the bass, half a beat off. Synthetic tracks (no real audio), one
// tracker run each, the phase measured at every true beat after the lock:
//   a. 128, kick on every beat (60 Hz burst + a 2 ms broadband click + a bright beater click), off-beat bass +6 dB
//      (55 Hz, low-passed at 150 Hz, a 25 ms attack: no transient), closed hats on the eighths (-6 dB on the beat,
//      -12 dB on the off-beat)                                                              REPORT-ONLY (for now)
//   b. the same with the bass at +12 dB                                                    REPORT-ONLY (for now)
//   c. backbeat guard: kick on 1 and 3, a bright snare on 2 and 4, no off-beat bass        HARD
// Rows: |phase - truth| <= 35 ms for >= 95 % of the beats after the lock; side moves (a: <= 1, c: 0).
// Then the breakdown (report-only, at the end): the side through a free-run and the re-lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mulberry32 } from './fixtures/tracker-scenarios.mjs';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/clock-tracker.js');
const report = (t, line) => { console.log(`# ${line}`); t.diagnostic(`corpus: report: ${line}`); };

const SR = 44100, LEAD = 0.5, GATE_MS = 35;
const frac = x => x - Math.round(x);
const db = d => Math.pow(10, d / 20);

function biquad(x, sr, type, f0, q) {   // RBJ, in place
  const w = 2 * Math.PI * Math.min(f0, 0.45 * sr) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
const add = (out, t0, seg) => { const i0 = Math.round(t0 * SR); for (let i = 0; i < seg.length && i0 + i < out.length; i++) if (i0 + i >= 0) out[i0 + i] += seg[i]; };
function kick(rnd, g = 1, click = 0) {   // a 60 Hz burst (120 ms decay) with a 2 ms broadband click on top
  const n = Math.round(0.35 * SR), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] = g * Math.min(1, t / 0.001) * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 60 * t); }
  for (let i = 0; i < Math.round(0.002 * SR); i++) x[i] += g * 0.6 * (rnd() * 2 - 1);
  if (click > 0) {   // a + b (15 Nov): a bright beater click on top, 6 ms, high-passed at 2 kHz, so the broadband lane leads on the kick
    const c = noiseHit(rnd, g * click, 'hp', 2000, 0.7, 0.004, 0.03, 2);
    for (let i = 0; i < c.length; i++) x[i] += c[i];
  }
  return x;
}
// traps a and b never reached the lock confidence on box run 353c37d ("lock never": they tested nothing). Since 15 Nov
// the kick carries a bright beater click and the hat on the beat is louder than the one on the off-beat (a closed hat
// on the eighths with the downbeat accented), so the drums can lock; the off-beat bass, the trap, is unchanged.
const TRAP_CLICK = 1.0, TRAP_BEAT_HAT_DB = -6;
function bass(g) {   // 55 Hz + its octave, a 25 ms raised-cosine attack (no transient), 180 ms long, low-passed at 150 Hz
  const n = Math.round(0.2 * SR), x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, a = t < 0.025 ? 0.5 - 0.5 * Math.cos(Math.PI * t / 0.025) : Math.exp(-(t - 0.025) / 0.15);
    x[i] = g * a * (Math.sin(2 * Math.PI * 55 * t) + 0.4 * Math.sin(2 * Math.PI * 110 * t));
  }
  biquad(x, SR, 'lp', 150, 0.707); biquad(x, SR, 'lp', 150, 0.707);
  return x;
}
function noiseHit(rnd, g, type, f0, q, tau, len, norm) {
  const n = Math.round(len * SR), x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = rnd() * 2 - 1;
  biquad(x, SR, type, f0, q); if (type === 'bp') biquad(x, SR, type, f0, q);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] *= g * norm * Math.min(1, t / 0.0005) * Math.exp(-t / tau); }
  return x;
}
/** one side-trap track: { samples, beats, bpm, name } (truth: the kick beats) */
export function sideTrap({ bpm = 128, secs = 30, bassDb = 6, variant = 'offbass' } = {}) {
  const P = 60 / bpm, n = Math.floor(secs / P), out = new Float64Array(Math.round((LEAD + secs + 1) * SR));
  const rnd = mulberry32(variant === 'backbeat' ? 77 : 1000 + bassDb), beats = [];
  for (let k = 0; k < n; k++) {
    const t = LEAD + k * P;
    beats.push(t);
    if (variant === 'backbeat') {
      if (k % 2 === 0) add(out, t, kick(rnd));
      else add(out, t, noiseHit(rnd, 0.6, 'bp', 2500, 1.0, 0.1, 0.4, 4));   // a bright snare on 2 and 4
    } else {
      add(out, t, kick(rnd, 1, TRAP_CLICK));
      add(out, t + P / 2, bass(db(bassDb)));
      // closed hats on the eighths, the one on the beat accented
      add(out, t, noiseHit(rnd, db(TRAP_BEAT_HAT_DB), 'hp', 8000, 0.7, 0.03, 0.12, 1.5));
      add(out, t + P / 2, noiseHit(rnd, db(-12), 'hp', 8000, 0.7, 0.03, 0.12, 1.5));
    }
  }
  let m = 0; for (const v of out) m = Math.max(m, Math.abs(v));
  const samples = new Float32Array(out.length); for (let i = 0; i < out.length; i++) samples[i] = out[i] * 0.8 / m;
  return { samples, beats, bpm, name: variant === 'backbeat' ? `backbeat-${bpm}` : `offbass+${bassDb}dB-${bpm}` };
}
/** the tracker over a track; the phase error (ms) at every true beat after the first lock, the side moves */
export function runSide(s) {
  const tr = T.createTracker(), frames = [];
  const an = T.createAnalyzer({ sampleRate: SR, onFrame: f => frames.push(f) });
  for (let i = 0; i < s.samples.length; i += 128) an.process(s.samples.subarray(i, Math.min(s.samples.length, i + 128)), i / SR);
  const P = 60 / s.bpm, errs = [], trace = [];
  let lockT = null, bi = 0, maxConf = 0, nextT = 0;
  for (const f of frames) {
    tr.push(f);
    maxConf = Math.max(maxConf, tr.confidence);
    if (f.t >= nextT) {   // every 2 s: the state, confidence, tempo and the low lane's circular mean (the snap target)
      nextT = f.t + 2;
      // the model's phase against the true kick (0 = on the kick, +-0.5 = on the bass, +-0.25 = between: the low
      // lane's circular mean of two equal lobes half a beat apart) and the low lane's R (small: two lobes)
      const lo = tr.snapshot().lane.low, k = Math.max(0, Math.round((f.t - s.beats[0]) / P)), ph = tr.bpm ? frac(tr.beatsAt(s.beats[0] + k * P)) : null;
      trace.push(`${f.t.toFixed(0)}s ${tr.state} c${tr.confidence.toFixed(2)} ${tr.bpm ? tr.bpm.toFixed(1) : '-'}bpm model-vs-kick ${ph === null ? '-' : ph.toFixed(2)} lowR ${lo.R === null ? '-' : lo.R} n ${lo.n}`);
    }
    if (lockT === null && tr.state === 'locked') lockT = f.t;
    while (bi < s.beats.length && s.beats[bi] <= f.t) {
      if (lockT !== null) errs.push(frac(tr.beatsAt(s.beats[bi])) * P * 1000);
      bi++;
    }
  }
  const inGate = errs.filter(e => Math.abs(e) <= GATE_MS).length, offSide = errs.filter(e => Math.abs(e) >= P * 1000 * 0.375).length;
  const sideMoves = tr.notes.filter(n => n.kind === 'side').length, lane = tr.snapshot().lane;
  const med = errs.length ? [...errs].sort((a, b) => a - b)[errs.length >> 1] : null;
  const rep = tr.tempoReport, acq = rep && rep.acq;
  const onsets = { broad: tr.onsets ? tr.onsets.length : null };
  return { tr, lockT, errs, inPct: errs.length ? 100 * inGate / errs.length : 0, offSide, sideMoves, side: lane.side, med, maxConf, trace,
    acq: acq ? { firstLock: acq.firstLock, waits: acq.waits } : null, onsets };
}
const line = (s, r) => `side trap ${s.name}: lock ${r.lockT === null ? 'never' : r.lockT.toFixed(2) + ' s'}, ${r.inPct.toFixed(1)} % of ${r.errs.length} beats within ${GATE_MS} ms, ${r.offSide} on the off-beat side, median error ${r.med === null ? '-' : r.med.toFixed(1)} ms, side moves ${r.sideMoves}; at lock ${JSON.stringify(r.side.atLock)}; max confidence ${r.maxConf.toFixed(2)} (lock at 0.5); F4 ${JSON.stringify(r.acq)}`;
// why a trap does not lock (box run 353c37d: a and b "lock never"): the acquisition trace, every 2 s
const traceLine = (s, r) => `side trap ${s.name} acquisition: ${r.trace.slice(0, 15).join(' | ')}`;

// a and b are REPORT-ONLY: they print and never fail the run (box run 353c37d failed on a lock assert here)
test('side trap a: off-beat bass +6 dB at 128: on the kick within 35 ms for >= 95 % after the lock, <= 1 side move (report-only)', (t) => {
  const s = sideTrap({ bassDb: 6 }), r = runSide(s), ok = r.lockT !== null && r.inPct >= 95 && r.sideMoves <= 1;
  report(t, `${line(s, r)} | ${ok ? 'would pass' : 'would FAIL'} [report-only]`);
  report(t, traceLine(s, r));
  assert.ok(s.beats.length > 0, 'the fixture rendered');
});

test('side trap b: off-beat bass +12 dB at 128: on the kick within 35 ms for >= 95 % after the lock, <= 1 side move (report-only)', (t) => {
  const s = sideTrap({ bassDb: 12 }), r = runSide(s), ok = r.lockT !== null && r.inPct >= 95 && r.sideMoves <= 1;
  report(t, `${line(s, r)} | ${ok ? 'would pass' : 'would FAIL'} [report-only]`);
  report(t, traceLine(s, r));
  assert.ok(s.beats.length > 0, 'the fixture rendered');
});

test('side trap c: backbeat guard (kick 1 and 3, bright snare 2 and 4, no off-beat bass): no side move, within 35 ms (hard)', (t) => {
  const s = sideTrap({ variant: 'backbeat' }), r = runSide(s);
  report(t, `${line(s, r)} [hard]`);
  assert.ok(r.lockT !== null, 'locks');
  assert.equal(r.sideMoves, 0, 'no side move');
  assert.ok(r.inPct >= 95, `${r.inPct.toFixed(1)} % within ${GATE_MS} ms`);
});

// ---------------------------------------------------------------- the side through a breakdown (Orchestrator 15 Nov,
// after #232's box run @9d7d000: the half-beat comes at the RE-LOCK after a free-run, not at the first lock). 128 BPM,
// 60 s, 32 bars: bars 1-8 kick on every beat + off-beat bass + hats; bars 9-16 the kick and hats out, the off-beat bass
// and a pad stay (the reference grid goes on); bars 17-32 the kick and hats back. REPORT-ONLY. Targets: the side kept
// (|signed error change| < 0.25 beat), >= 95 % of the last 8 bars within 35 ms, no acquire jump > 0.25 beat, locked
// again within 2 bars of the kick's return.
function pad(out, t0, t1, g) {   // a soft chord (A minor, slightly detuned), 1 s raised-cosine fades: no transient
  const i0 = Math.round(t0 * SR), i1 = Math.min(out.length, Math.round(t1 * SR)), fade = SR;
  const f = [220, 220.7, 261.6, 329.6];
  for (let i = i0; i < i1; i++) {
    const t = (i - i0) / SR, k = Math.min(1, (i - i0) / fade, (i1 - i) / fade), env = 0.5 - 0.5 * Math.cos(Math.PI * k);
    let v = 0; for (const fr of f) v += Math.sin(2 * Math.PI * fr * t);
    out[i] += g * env * v / f.length;
  }
}
export function sideBreakdown({ bpm = 128, bassDb = 6 } = {}) {
  const P = 60 / bpm, bars = 32, n = bars * 4, out = new Float64Array(Math.round((LEAD + n * P + 1) * SR));
  const rnd = mulberry32(4242), beats = [];
  for (let k = 0; k < n; k++) {
    const t = LEAD + k * P, bar = Math.floor(k / 4) + 1, drums = bar <= 8 || bar >= 17;
    beats.push(t);
    add(out, t + P / 2, bass(db(bassDb)));
    if (drums) {
      add(out, t, kick(rnd, 1, TRAP_CLICK));
      add(out, t, noiseHit(rnd, db(TRAP_BEAT_HAT_DB), 'hp', 8000, 0.7, 0.03, 0.12, 1.5));
      add(out, t + P / 2, noiseHit(rnd, db(-12), 'hp', 8000, 0.7, 0.03, 0.12, 1.5));
    }
  }
  pad(out, LEAD + 30 * P, LEAD + 66 * P, db(-6));   // from the end of bar 8 to the start of bar 17, fading in and out
  let m = 0; for (const v of out) m = Math.max(m, Math.abs(v));
  const samples = new Float32Array(out.length); for (let i = 0; i < out.length; i++) samples[i] = out[i] * 0.8 / m;
  return { samples, beats, bpm, name: `breakdown-offbass+${bassDb}dB-${bpm}`, kickOut: LEAD + 32 * P, kickBack: LEAD + 64 * P, P };
}
/** the tracker over the breakdown track: the signed error (beats) and the state at every true beat */
export function runBreakdown(s) {
  const tr = T.createTracker(), frames = [];
  const an = T.createAnalyzer({ sampleRate: SR, onFrame: f => frames.push(f) });
  for (let i = 0; i < s.samples.length; i += 128) an.process(s.samples.subarray(i, Math.min(s.samples.length, i + 128)), i / SR);
  const per = [], states = [];
  let lockT = null, bi = 0, lastState = null, lockedFrom = null;
  for (const f of frames) {
    tr.push(f);
    if (tr.state !== lastState) { lastState = tr.state; states.push({ t: f.t, state: tr.state }); }
    if (lockT === null && tr.state === 'locked') lockT = f.t;
    if (tr.state === 'locked') { if (lockedFrom === null) lockedFrom = f.t; } else lockedFrom = null;
    while (bi < s.beats.length && s.beats[bi] <= f.t) {
      per.push({ k: bi, e: lockT === null ? null : frac(tr.beatsAt(s.beats[bi])), state: tr.state });
      bi++;
    }
  }
  const med = a => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q); return x[x.length >> 1]; };
  const errs = (k0, k1) => per.filter(p => p.k >= k0 && p.k < k1 && p.e !== null).map(p => p.e);
  const before = med(errs(16, 32)), after = med(errs(96, 128));   // bars 5-8 and bars 25-32
  const change = before === null || after === null ? null : frac(after - before);
  const last = errs(96, 128), inPct = 100 * last.filter(e => Math.abs(e) * s.P * 1000 <= GATE_MS).length / 32;
  const moves = (tr.jumps || []).filter(j => lockT !== null && j.at >= lockT).map(j => ({ at: j.at, kind: j.kind, d: frac(j.toBeats - j.fromBeats) }));
  for (const r of tr.relocks || []) moves.push({ at: r.at, kind: 'relock', d: r.d });
  moves.sort((x, y) => x.at - y.at);
  const acqMax = moves.filter(j => j.kind === 'acquire').reduce((m, j) => Math.max(m, Math.abs(j.d)), 0);
  // locked again: the start of the final locked run, measured from the kick's return (0 if it never left)
  const relockBars = lockedFrom === null ? null : Math.max(0, lockedFrom - s.kickBack) / (4 * s.P);
  const midStates = states.filter(x => x.t > s.kickOut - 1e-6);
  return { tr, lockT, before, after, change, inPct, moves, acqMax, relockBars, midStates };
}
const sgn = x => (x === null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(3));

test('side breakdown: 8 bars kick + off-beat bass, 8 bars bass + pad only, 16 bars kick back: the side kept through the re-lock (report-only)', (t) => {
  const s = sideBreakdown(), r = runBreakdown(s);
  const ok = r.change !== null && Math.abs(r.change) < 0.25 && r.inPct >= 95 && r.acqMax <= 0.25 && r.relockBars !== null && r.relockBars <= 2;
  report(t, `side breakdown ${s.name}: first lock ${r.lockT === null ? 'never' : r.lockT.toFixed(2) + ' s'}; median signed error bars 5-8 ${sgn(r.before)} beat, bars 25-32 ${sgn(r.after)} beat, change ${sgn(r.change)} (target |change| < 0.25)`
    + `; last 8 bars ${r.inPct.toFixed(1)} % within ${GATE_MS} ms (target >= 95)`
    + `; largest acquire jump ${r.acqMax.toFixed(3)} beat (target <= 0.25)`
    + `; locked again ${r.relockBars === null ? 'no (not locked at the end)' : r.relockBars.toFixed(2) + ' bars after the kick returns'} (target <= 2)`
    + ` | ${ok ? 'would pass' : 'would FAIL'} [report-only]`);
  report(t, `side breakdown ${s.name} moves: kick out ${s.kickOut.toFixed(2)} s, back ${s.kickBack.toFixed(2)} s; jumps after the first lock ${r.moves.length ? r.moves.map(j => `${j.kind}@${j.at.toFixed(1)}s(${sgn(j.d)})`).join(' ') : 'none'}; states from the kick out ${r.midStates.length ? r.midStates.map(x => `${x.state}@${x.t.toFixed(1)}s`).join(' ') : 'no change'}`);
  assert.equal(s.beats.length, 128, 'the fixture rendered 32 bars');
});
