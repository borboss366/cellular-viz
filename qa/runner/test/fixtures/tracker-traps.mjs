// The side-trap and house-trap generators of tracker-sidetrap.test.mjs, copied verbatim for the hand-held mode tests
// (tracker-hold.test.mjs; importing a test file would register its tests a second time). Synthetic audio only, no
// tracker: sideTrap (kick + off-beat bass), sideBreakdown (8 bars bass + pad only), houseTrap (126 BPM, kick and the
// on-beat hat out for dropBars bars at each drop, a snare build in the last). Keep in step with the test file.
import { mulberry32 } from './tracker-scenarios.mjs';

export const SR = 44100, LEAD = 0.5;
export const frac = x => x - Math.round(x);
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
function bass(g, att = 0.025) {   // 55 Hz + its octave, a raised-cosine attack (25 ms: no transient), 180 ms long, low-passed at 150 Hz
  const n = Math.round(0.2 * SR), x = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR, a = t < att ? 0.5 - 0.5 * Math.cos(Math.PI * t / att) : Math.exp(-(t - att) / 0.15);
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
export function houseTrap({ bpm = 126, secs = 120, bassDb = 8, bassAttack = 0.007, drops = [30, 75], dropBars = 8, build = true } = {}) {
  const P = 60 / bpm, n = Math.floor(secs / P), out = new Float64Array(Math.round((LEAD + secs + 1) * SR));
  const rnd = mulberry32(126126), beats = [];
  const spans = drops.map(at => { const k0 = Math.ceil(at / P); return [k0, k0 + 4 * dropBars]; });   // kick out for k0 .. k1 - 1
  const kickOut = k => spans.some(([k0, k1]) => k >= k0 && k < k1);
  for (let k = 0; k < n; k++) {
    const t = LEAD + k * P;
    beats.push(t);
    const out_ = kickOut(k);
    if (!out_) add(out, t, kick(rnd));
    add(out, t + P / 2, bass(db(bassDb), bassAttack));
    for (const h of out_ ? [0.5] : [0, 0.5]) add(out, t + h * P, noiseHit(rnd, db(-12), 'hp', 8000, 0.7, 0.03, 0.12, 1.5));
    const [b0, b1] = spans[spans.length - 1];
    if (build && spans.length > 1 && k >= b0 && k < b1) {   // the build in the last drop: a bright snare, rising
      const x = (k - b0) / (b1 - b0), sub = k >= b1 - 16 ? 4 : 2;
      for (let j = 0; j < sub; j++) add(out, t + j * P / sub, noiseHit(rnd, db(-18 + 12 * x), 'bp', 2000, 1.0, 0.06, 0.2, 4));
    }
  }
  let m = 0; for (const v of out) m = Math.max(m, Math.abs(v));
  const samples = new Float32Array(out.length); for (let i = 0; i < out.length; i++) samples[i] = out[i] * 0.8 / m;
  return { samples, beats, bpm, P, name: `house-trap-${bpm}`, drops: spans.map(([k0, k1]) => [LEAD + k0 * P, LEAD + k1 * P]) };
}
