// The live tracker's truths on the box (clock PR 3c, #173; brief task 4; #95 comment 6560018120).
//   (a) the metronome rendered to a WAV here, so every onset is known to the sample: phase p90 ≤ 15 ms and latency
//       p90 ≤ 40 ms, hard; R3: the onset bias after ANALYSIS_DELAY_MS within ±5 ms; R4: visual offset 0 and +60 give
//       the same latency numbers within 1 ms.
//   (b) the four tracks against their Beat This! references (<track>.ref.beats): Sandstorm hard (phase p90 ≤ 35 ms),
//       the other three report-only; octave results reported against the predictions, never gated.
//   (c) a tempo step: an excerpt, then the same excerpt resampled by 1.067, concatenated: re-lock and the confidence
//       dip are printed.
// Every excerpt starts with a marker (MARK_S: a 20 ms 2 kHz burst after silence) and its music at LEAD_S. The page's
// rise probe (clock-tracker.js) reports the marker's first sample on the AudioContext clock, so the references map
// onto the clock's booked hits to the sample (experiments/clock-truth.html logs both in __qa.truth). Pure functions
// only: exp-run.mjs reads and writes the files, and truth.test.mjs checks the maths with synthetic logs.

export const LEAD_S = 3, MARK_S = 1.5, MARK_LEN_S = 0.02, MARK_HZ = 2000, MARK_AMP = 0.8;
export const TAU_KICK = 0.15;   // the clock's kick decay (clock.js TAU.kick), so (a) sounds like the metronome

/** a mono Float32Array → interleaved Int16 stereo */
export function toInt16Stereo(mono) {
  const out = new Int16Array(mono.length * 2);
  for (let i = 0; i < mono.length; i++) { const v = Math.round(Math.max(-1, Math.min(1, mono[i])) * 32767); out[2 * i] = v; out[2 * i + 1] = v; }
  return out;
}
/** interleaved Int16 (ch channels) → mono Float32Array (the channels averaged) */
export function toMono(pcm, ch) {
  const n = Math.floor(pcm.length / ch), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < ch; c++) s += pcm[i * ch + c]; out[i] = s / ch / 32768; }
  return out;
}

/** the marker lead: LEAD_S seconds of silence with the burst at MARK_S (raised-cosine edges of 2 ms) */
export function markerLead(sr) {
  const out = new Float32Array(Math.round(LEAD_S * sr)), a0 = Math.round(MARK_S * sr), n = Math.round(MARK_LEN_S * sr), e = Math.round(0.002 * sr);
  for (let i = 0; i < n; i++) {
    const env = i < e ? 0.5 - 0.5 * Math.cos(Math.PI * i / e) : i > n - e ? 0.5 - 0.5 * Math.cos(Math.PI * (n - i) / e) : 1;
    out[a0 + i] = MARK_AMP * env * Math.sin(2 * Math.PI * MARK_HZ * i / sr);
  }
  // the burst starts at sample a0 with sin(0) = 0; its first sample ≥ the probe's 0.05 comes a few samples later.
  // markerRise() is that sample's time, the number the page's first rise is compared with.
  return out;
}
/** the excerpt time (s) of the marker's first sample with |x| ≥ level: what the page's rise probe reports */
export function markerRise(sr, level = 0.05) {
  const lead = markerLead(sr);
  for (let i = 0; i < lead.length; i++) if (Math.abs(lead[i]) >= level) return i / sr;
  return MARK_S;
}

/**
 * truth (a): the clock's kick (150 → 60 Hz in 80 ms, 3 ms attack, decay τ 0.15 s) on every beat at bpm for len
 * seconds, after the marker lead → { mono, refs (excerpt s: each click's first sample ≥ level, the true onset) }
 */
export function synthMetronome(sr, bpm, len, { vel = 0.7, accent = 1, bpb = 4, level = 0.05 } = {}) {
  const lead = markerLead(sr), n = Math.round(len * sr), out = new Float32Array(lead.length + n);
  out.set(lead);
  const period = 60 / bpm, dur = TAU_KICK * 4, refs = [];
  for (let k = 0; k * period < len - dur; k++) {
    const a0 = lead.length + Math.round(k * period * sr), v = k % bpb === 0 ? accent : vel;
    let phase = 0, onset = null;
    for (let i = 0; i < Math.round(dur * sr) && a0 + i < out.length; i++) {
      const t = i / sr, f = t < 0.08 ? 150 * Math.pow(60 / 150, t / 0.08) : 60;
      phase += 2 * Math.PI * f / sr;
      const env = (t < 0.003 ? t / 0.003 : 1) * Math.exp(-t / TAU_KICK) * v;
      const x = env * Math.sin(phase);
      out[a0 + i] += x;
      if (onset === null && Math.abs(out[a0 + i]) >= level) onset = (a0 + i) / sr;
    }
    if (onset !== null) refs.push(onset);
  }
  return { mono: out, refs };
}

/** linear-interpolation resampling: factor > 1 plays faster (shorter); pitch moves too, irrelevant for tempo truth */
export function resample(mono, factor) {
  const n = Math.floor(mono.length / factor), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * factor, a = Math.floor(x), f = x - a; out[i] = a + 1 < mono.length ? mono[a] * (1 - f) + mono[a + 1] * f : mono[a] || 0; }
  return out;
}

/**
 * truth (b)/(c) layout from a decoded track excerpt (mono, sr) and its Beat This! beats [{t}] in track seconds:
 * marker lead, the excerpt [from, from+len), and with step the same excerpt resampled by step after it →
 * { mono, refs (excerpt s), stepAt (excerpt s of the step, or null) }
 */
export function trackTruth(cut, sr, refBeats, from, len, step = null) {
  const lead = markerLead(sr), parts = [lead, cut], refs = [];
  for (const b of refBeats) if (b.t >= from && b.t < from + len) refs.push(LEAD_S + (b.t - from));
  let stepAt = null;
  if (step) {
    const fast = resample(cut, step);
    parts.push(fast); stepAt = LEAD_S + cut.length / sr;
    for (const b of refBeats) if (b.t >= from && b.t < from + len) refs.push(stepAt + (b.t - from) / step);
  }
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return { mono: out, refs, stepAt };
}

// ---------- the numbers from the page's log ----------
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const med = a => q(a, 0.5);
const r1 = x => (x === null || !Number.isFinite(x) ? null : +x.toFixed(1));
const r2 = x => (x === null || !Number.isFinite(x) ? null : +x.toFixed(2));

/** the nearest value of sorted xs to t, or null when none is within tol */
function nearest(xs, t, tol) {
  let lo = 0, hi = xs.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (xs[m] < t) lo = m + 1; else hi = m; }
  let best = null;
  for (const i of [lo - 1, lo]) if (i >= 0 && i < xs.length && Math.abs(xs[i] - t) <= tol && (best === null || Math.abs(xs[i] - t) < Math.abs(best - t))) best = xs[i];
  return best;
}

/**
 * From __qa.truth (rises, onsets, samples, hits, jumps, delayMs; all on the AudioContext clock) and the excerpt's
 * refs (excerpt s), markerAt (excerpt s of the marker's first sample ≥ the probe level) and stepAt:
 *   anchored        the marker was seen (the first rise); offset = rise − markerAt maps excerpt time onto the clock
 *   lockS           seconds from the music's start to the tracker's first 'locked' sample
 *   phase*Ms        hit − ref at each reference beat from lock on (to the end, or to the step), nearest kick hit within
 *                   ±½ period: p50 signed, p90 of |err|; matched = refs with a hit / refs after lock
 *   latencyP90Ms    p90 of the signed hit − ref (late is positive): the "≤ 40 ms" in raw audio time (#95 MUST 4)
 *   biasP50Ms       median of (detected onset − true onset), the tracker's onsets after ANALYSIS_DELAY_MS (R3)
 *   rawDelayMs      biasP50Ms + delayMs: the value ANALYSIS_DELAY_MS should hold
 *   bpm / refBpm / octave   the tracker's median bpm after lock, the references' tempo, round(log2(bpm / refBpm))
 *   relockBeats     after the step: beats until 4 reference beats in a row sit within 25 ms (null: never)
 *   confMinStep / confAfterStep  confidence: the lowest within 8 s after the step, the median of the last 4 s
 */
export function truthMetrics(T, { refs, markerAt, stepAt = null, lead = LEAD_S } = {}) {
  const out = { anchored: false, rises: T && T.rises ? T.rises.length : 0, hits: 0, onsets: 0, lockS: null, matched: null,
    phaseP50Ms: null, phaseP90Ms: null, latencyP90Ms: null, biasP50Ms: null, rawDelayMs: null, delayMs: T ? T.delayMs ?? null : null,
    bpm: null, refBpm: null, octave: null, relockBeats: null, confMinStep: null, confAfterStep: null, jumps: {} };
  if (!T || !Array.isArray(T.rises) || !T.rises.length || !Array.isArray(refs) || refs.length < 2) return out;
  out.anchored = true;
  const offset = T.rises[0] - markerAt, at = x => x + offset;
  const R = refs.map(at), musicAt = at(lead), stepT = stepAt === null ? null : at(stepAt);
  const hits = (T.hits || []).filter(h => h.lane === 'kick').map(h => h.time).sort((a, b) => a - b);
  out.hits = hits.length; out.onsets = (T.onsets || []).length;
  for (const j of T.jumps || []) out.jumps[j.kind] = (out.jumps[j.kind] || 0) + 1;
  const S = (T.samples || []).filter(s => s.t >= musicAt);
  const lock = S.find(s => s.state === 'locked');
  const periods = R.slice(1).map((x, i) => x - R[i]).filter(d => d > 0.2 && d < 2);
  const P = med(periods);
  out.refBpm = P ? r2(60 / P) : null;
  if (!lock) return out;
  out.lockS = r2(lock.t - musicAt);
  // phase and latency: from lock to the end, or to the step (the step's numbers are relock and confidence)
  const until = stepT === null ? Infinity : stepT;
  const errs = [], lastHit = hits.length ? hits[hits.length - 1] : -Infinity;
  let due = 0;
  for (const r of R) {
    if (r < lock.t || r >= until || r > lastHit) continue;
    due++;
    const h = nearest(hits, r, (P || 0.5) / 2);
    if (h !== null) errs.push(1000 * (h - r));
  }
  out.matched = due ? r2(errs.length / due) : null;
  out.phaseP50Ms = r1(med(errs)); out.phaseP90Ms = r1(q(errs.map(Math.abs), 0.9)); out.latencyP90Ms = r1(q(errs, 0.9));
  // R3: the detected onsets (already minus delayMs) against the true onsets within 60 ms
  const Rs = R.slice().sort((a, b) => a - b), bias = [];
  for (const o of T.onsets || []) { const r = nearest(Rs, o.t, 0.06); if (r !== null) bias.push(1000 * (o.t - r)); }
  out.biasP50Ms = r1(med(bias));
  out.rawDelayMs = out.biasP50Ms === null || !Number.isFinite(out.delayMs) ? null : r1(out.biasP50Ms + out.delayMs);
  const after = S.filter(s => s.t >= lock.t && s.t < until && s.bpm > 0).map(s => s.bpm);
  out.bpm = r2(med(after));
  if (out.bpm && out.refBpm) out.octave = Math.round(Math.log2(out.bpm / out.refBpm));
  if (stepT !== null) {
    const R2 = R.filter(r => r >= stepT && r <= lastHit);
    let run = 0;
    for (let i = 0; i < R2.length; i++) {
      const h = nearest(hits, R2[i], 0.2);
      run = h !== null && Math.abs(h - R2[i]) <= 0.025 ? run + 1 : 0;
      if (run === 4) { out.relockBeats = i - 3; break; }
    }
    const win = (T.samples || []).filter(s => s.t >= stepT && s.t <= stepT + 8);
    out.confMinStep = win.length ? Math.min(...win.map(s => s.conf)) : null;
    const last = T.samples && T.samples.length ? T.samples[T.samples.length - 1].t : null;
    out.confAfterStep = last === null ? null : med(T.samples.filter(s => s.t >= last - 4).map(s => s.conf));
  }
  return out;
}

/** the gate metrics (experiment.mjs METRICS 'truth.*') */
export function truthGateMetrics(m) {
  const o = {};
  for (const k of ['anchored', 'lockS', 'matched', 'phaseP50Ms', 'phaseP90Ms', 'latencyP90Ms', 'biasP50Ms', 'rawDelayMs', 'bpm', 'refBpm', 'octave', 'relockBeats', 'confMinStep', 'confAfterStep'])
    o['truth.' + k] = typeof m[k] === 'boolean' ? (m[k] ? 1 : 0) : m[k];
  o['truth.absBiasP50Ms'] = m.biasP50Ms === null ? null : Math.abs(m.biasP50Ms);
  return o;
}
