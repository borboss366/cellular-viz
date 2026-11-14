// The side trap (the half-beat error; VIZ research's ruling, the user's go 14 Nov 17:21). On trance / garage / techno
// the off-beat bass sits in the low lane and is often louder than the kick, so the low lane's phases are bimodal and
// the side chosen at the first lock can land on the bass, half a beat off. Synthetic tracks (no real audio), one
// tracker run each, the phase measured at every true beat after the lock:
//   a. 128, kick on every beat (60 Hz burst + a 2 ms broadband click), off-beat bass +6 dB (55 Hz, low-passed at
//      150 Hz, a 25 ms attack: no transient), closed hats on the eighths at -12 dB       REPORT-ONLY (for now)
//   b. the same with the bass at +12 dB                                                    REPORT-ONLY (for now)
//   c. backbeat guard: kick on 1 and 3, a bright snare on 2 and 4, no off-beat bass        HARD
// Rows: |phase - truth| <= 35 ms for >= 95 % of the beats after the lock; side moves (a: <= 1, c: 0).
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
function kick(rnd, g = 1) {   // a 60 Hz burst (120 ms decay) with a 2 ms broadband click on top
  const n = Math.round(0.35 * SR), x = new Float64Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; x[i] = g * Math.min(1, t / 0.001) * Math.exp(-t / 0.12) * Math.sin(2 * Math.PI * 60 * t); }
  for (let i = 0; i < Math.round(0.002 * SR); i++) x[i] += g * 0.6 * (rnd() * 2 - 1);
  return x;
}
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
      add(out, t, kick(rnd));
      add(out, t + P / 2, bass(db(bassDb)));
      for (const h of [0, 0.5]) add(out, t + h * P, noiseHit(rnd, db(-12), 'hp', 8000, 0.7, 0.03, 0.12, 1.5));   // closed hats on the eighths
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
  const P = 60 / s.bpm, errs = [];
  let lockT = null, bi = 0;
  for (const f of frames) {
    tr.push(f);
    if (lockT === null && tr.state === 'locked') lockT = f.t;
    while (bi < s.beats.length && s.beats[bi] <= f.t) {
      if (lockT !== null) errs.push(frac(tr.beatsAt(s.beats[bi])) * P * 1000);
      bi++;
    }
  }
  const inGate = errs.filter(e => Math.abs(e) <= GATE_MS).length, offSide = errs.filter(e => Math.abs(e) >= P * 1000 * 0.375).length;
  const sideMoves = tr.notes.filter(n => n.kind === 'side').length, lane = tr.snapshot().lane;
  const med = errs.length ? [...errs].sort((a, b) => a - b)[errs.length >> 1] : null;
  return { tr, lockT, errs, inPct: errs.length ? 100 * inGate / errs.length : 0, offSide, sideMoves, side: lane.side, med };
}
const line = (s, r) => `side trap ${s.name}: lock ${r.lockT === null ? 'never' : r.lockT.toFixed(2) + ' s'}, ${r.inPct.toFixed(1)} % of ${r.errs.length} beats within ${GATE_MS} ms, ${r.offSide} on the off-beat side, median error ${r.med === null ? '-' : r.med.toFixed(1)} ms, side moves ${r.sideMoves}; at lock ${JSON.stringify(r.side.atLock)}`;

test('side trap a: off-beat bass +6 dB at 128: on the kick within 35 ms for >= 95 % after the lock, <= 1 side move (report-only for now)', (t) => {
  const s = sideTrap({ bassDb: 6 }), r = runSide(s), ok = r.lockT !== null && r.inPct >= 95 && r.sideMoves <= 1;
  report(t, `${line(s, r)} | ${ok ? 'would pass' : 'would FAIL'} [report-only]`);
  assert.ok(r.lockT !== null, 'locks');
});

test('side trap b: off-beat bass +12 dB at 128: on the kick within 35 ms for >= 95 % after the lock, <= 1 side move (report-only for now)', (t) => {
  const s = sideTrap({ bassDb: 12 }), r = runSide(s), ok = r.lockT !== null && r.inPct >= 95 && r.sideMoves <= 1;
  report(t, `${line(s, r)} | ${ok ? 'would pass' : 'would FAIL'} [report-only]`);
  assert.ok(r.lockT !== null, 'locks');
});

test('side trap c: backbeat guard (kick 1 and 3, bright snare 2 and 4, no off-beat bass): no side move, within 35 ms (hard)', (t) => {
  const s = sideTrap({ variant: 'backbeat' }), r = runSide(s);
  report(t, `${line(s, r)} [hard]`);
  assert.ok(r.lockT !== null, 'locks');
  assert.equal(r.sideMoves, 0, 'no side move');
  assert.ok(r.inPct >= 95, `${r.inPct.toFixed(1)} % within ${GATE_MS} ms`);
});
