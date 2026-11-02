// Synthetic test tracks for the live beat tracker (clock PR 3a, #173). Pure ESM, no dependencies, deterministic
// (one mulberry32 seed per scenario, from its name). Each scenario is mono audio with its true beat grid.
//
//   scenarios({ sr }) → [{ name, sr, duration, samples, beats, downbeats, bpm, events?, expect?, onsets?, hits }]
//   render(name, { sr }) → one of them
//   NAMES                 → the scenario names, in order
//   renderHits(hits, duration, sr, seed) → the drum synth on its own (the fixture test calibrates its detector on it)
//
// Fields beyond the contract (#173, VIZ dev): `duration` (s, samples.length === round(duration·sr)) and `hits`
// ([{ t, lane, vel }], every drum hit as rendered, lane kick|snare|hat), so a test can tell which beats carry a kick
// (81-stomp-clap has the stomp on 1 and 3 only). `onsets` (humanize-10ms) holds the shifted kick time of each beat,
// index-aligned with `beats`.
//
// Sounds: kick = sine swept 60 → 45 Hz with a 120 ms exponential decay; snare (and the clap) = noise band-passed at
// 1.8 kHz, 100 ms decay; hat = noise high-passed at 8 kHz, 30 ms decay; pad = A-major chord (220, 277.18, 329.63 Hz)
// with 2 s raised-cosine swells, no transients. Every scenario is scaled so its peak is 0.8.
//
// Breakdown scenarios: 16 bars of drums at 128, a 16-bar pad-only breakdown whose beat interval shortens linearly
// (the tempo speeds up), then 16 bars of drums at the final tempo, held steady. At the return, a clock that free-runs
// at 128 from the last pre-breakdown beat is behind the true beat by exactly freeRunErrBeats (0.10, 0.20, 0.40):
// with intervals P·(1 − ε·k/64), k = 1..64, the 65 intervals from the last drum beat to the return sum to
// 65P − 32.5εP, so ε = X / 32.5.

const TAU = { kick: 0.12, snare: 0.10, hat: 0.03 };
const LEN = { kick: 0.8, snare: 0.6, hat: 0.2 };
const GAIN = { kick: 1.0, snare: 0.5, hat: 0.25 };
const PEAK = 0.8, LEAD = 0.5;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const seedOf = name => { let h = 0x811C9DC5; for (const c of name) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; };

// RBJ biquad, applied in place (causal); used only to shape the noise of single hits
function biquad(x, sr, type, f0, q) {
  f0 = Math.min(f0, 0.45 * sr);   // a low sr (the cheap listing at 8 kHz) must not put the hat's 8 kHz past Nyquist
  const w = 2 * Math.PI * f0 / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2;
  if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; } else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; } else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
  return x;
}

function addHit(out, sr, h, rnd) {
  const i0 = Math.round(h.t * sr), n = Math.min(Math.round(LEN[h.lane] * sr), out.length - i0);
  if (n <= 0 || i0 < 0) return;
  const g = GAIN[h.lane] * (h.vel ?? 1);
  if (h.lane === 'kick') {
    for (let i = 0; i < n; i++) {
      const t = i / sr, ph = 2 * Math.PI * (45 * t + 15 * 0.04 * (1 - Math.exp(-t / 0.04)));
      out[i0 + i] += g * Math.min(1, t / 0.001) * Math.exp(-t / TAU.kick) * Math.sin(ph);
    }
    return;
  }
  const nz = new Float64Array(n); for (let i = 0; i < n; i++) nz[i] = rnd() * 2 - 1;
  if (h.lane === 'snare') { biquad(nz, sr, 'bp', 1800, 1.2); biquad(nz, sr, 'bp', 1800, 1.2); }
  else biquad(nz, sr, 'hp', 8000, 0.7);
  const norm = h.lane === 'snare' ? 4 : 1.5;   // the filters take energy out; roughly back to unit level
  for (let i = 0; i < n; i++) { const t = i / sr; out[i0 + i] += g * norm * Math.min(1, t / 0.0005) * Math.exp(-t / TAU[h.lane]) * nz[i]; }
}

export function renderHits(hits, duration, sr = 44100, seed = 1) {
  const out = new Float32Array(Math.round(duration * sr)), rnd = mulberry32(seed);
  for (const h of hits) addHit(out, sr, h, rnd);
  return out;
}

function addPad(out, sr, t0, t1) {   // 3 sines with 2 s raised-cosine swells in and out, all inside [t0, t1]
  const f = [220, 277.18, 329.63], a = 0.07, sw = 2;
  for (let i = Math.max(0, Math.round(t0 * sr)); i < Math.min(out.length, Math.round(t1 * sr)); i++) {
    const t = i / sr, u = Math.min(1, (t - t0) / sw, (t1 - t) / sw), env = u <= 0 ? 0 : 0.5 - 0.5 * Math.cos(Math.PI * u);
    let s = 0; for (const fk of f) s += Math.sin(2 * Math.PI * fk * t);
    out[i] += a * env * s;
  }
}

function normalise(x) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m > 0) { const k = PEAK / m; for (let i = 0; i < x.length; i++) x[i] *= k; } return x; }

// beat times from a list of intervals starting at LEAD; exact sums kept in float64
const gridFrom = intervals => { const b = [LEAD]; for (const d of intervals) b.push(b[b.length - 1] + d); return b; };
const steadyBeats = (bpm, until) => { const P = 60 / bpm, b = []; for (let k = 0; LEAD + k * P < until; k++) b.push(LEAD + k * P); return b; };
const bars = beats => beats.filter((_, i) => i % 4 === 0);
// drum hits for a list of beats: kick on every beat (or on 1 and 3), snare on 2 and 4, hats on 8ths
function groove(beats, { kickEvery = true, hats = true, from = 0, to = Infinity } = {}) {
  const hits = [];
  beats.forEach((t, i) => {
    if (i < from || i >= to) return;
    const inBar = i % 4, vel = inBar === 0 ? 1 : 0.8;
    if (kickEvery || inBar === 0 || inBar === 2) hits.push({ t, lane: 'kick', vel, beat: i });
    if (inBar === 1 || inBar === 3) hits.push({ t, lane: 'snare', vel, beat: i });
    if (hats) {
      hits.push({ t, lane: 'hat', vel: 0.9, beat: i });
      const next = beats[i + 1]; if (next !== undefined) hits.push({ t: (t + next) / 2, lane: 'hat', vel: 0.7, beat: i + 0.5 });
    }
  });
  return hits.sort((a, b) => a.t - b.t);
}

function make(name, sr, { duration, beats, downbeats = bars(beats), bpm, hits, events, expect, onsets, pad, silence }) {
  const samples = renderHits(hits, duration, sr, seedOf(name));
  if (pad) for (const [t0, t1] of pad) addPad(samples, sr, t0, t1);
  if (silence) for (const [t0, t1] of silence) samples.fill(0, Math.round(t0 * sr), Math.round(t1 * sr));
  normalise(samples);
  const s = { name, sr, duration, samples, beats, downbeats, bpm, hits: hits.map(({ t, lane, vel }) => ({ t, lane, vel })) };
  if (events) s.events = events;
  if (expect) s.expect = expect;
  if (onsets) s.onsets = onsets;
  return s;
}

function breakdown(name, sr, X) {
  const P = 60 / 128, eps = X / 32.5, ivals = [];
  for (let i = 0; i < 64; i++) ivals.push(P);                               // beats 0..64: 16 bars of drums, then the breakdown starts
  for (let k = 1; k <= 64; k++) ivals.push(P * (1 - eps * k / 64));         // beats 64..128: the ramp (pad only)
  const Pend = P * (1 - eps);
  for (let k = 0; k < 64; k++) ivals.push(Pend);                            // beats 128..192: drums at the final tempo
  const beats = gridFrom(ivals).slice(0, 192), tB = beats[64], tR = beats[128], duration = beats[191] + Pend + 1;
  const hits = [...groove(beats, { to: 64 }), ...groove(beats, { from: 128 })];
  return make(name, sr, { duration, beats, bpm: [128, +(60 / Pend).toFixed(6)], hits, pad: [[tB, tR]],
    events: [{ t: tB, kind: 'breakdown' }, { t: tR, kind: 'return', freeRunErrBeats: X, bpm: 60 / Pend }] });
}

const BUILD = {
  '128-steady': sr => { const beats = steadyBeats(128, 40 - 0.6); return make('128-steady', sr, { duration: 40, beats, bpm: 128, hits: groove(beats) }); },
  '128-bursty': sr => {
    const s = BUILD['128-steady'](sr), events = [];
    for (let t = 2; t < s.duration; t += 2) events.push({ t, kind: 'gap', ms: 150 });
    return { ...s, name: '128-bursty', events };
  },
  '127.3-steady': sr => { const beats = steadyBeats(127.3, 40 - 0.6); return make('127.3-steady', sr, { duration: 40, beats, bpm: 127.3, hits: groove(beats) }); },
  '81-stomp-clap': sr => {
    const beats = steadyBeats(81, 40 - 0.8);
    return make('81-stomp-clap', sr, { duration: 40, beats, bpm: 81, hits: groove(beats, { kickEvery: false, hats: false }), expect: { octave: 'double' } });
  },
  'step-120-128': sr => {
    const ivals = []; for (let k = 0; k < 59; k++) ivals.push(0.5);          // 0.5 … 30.0 at 120
    for (let k = 0; 30 + (k + 1) * 0.46875 < 60 - 0.6; k++) ivals.push(0.46875);
    const beats = gridFrom(ivals);
    return make('step-120-128', sr, { duration: 60, beats, bpm: [120, 128], hits: groove(beats), events: [{ t: 30, kind: 'step', from: 120, to: 128 }] });
  },
  'dropout-2s': sr => {
    const beats = steadyBeats(128, 40 - 0.6);
    return make('dropout-2s', sr, { duration: 40, beats, bpm: 128, hits: groove(beats), silence: [[20, 22]], events: [{ t: 20, kind: 'dropout', ms: 2000 }] });
  },
  'humanize-10ms': sr => {
    const name = 'humanize-10ms', beats = steadyBeats(128, 40 - 0.6), rnd = mulberry32(seedOf(name) ^ 0x9E3779B9);
    const hits = groove(beats).map(h => ({ ...h, t: h.t + (rnd() * 2 - 1) * 0.010 }));
    const onsets = beats.map((_, i) => hits.find(h => h.lane === 'kick' && h.beat === i).t);
    return make(name, sr, { duration: 40, beats, bpm: 128, hits: hits.sort((a, b) => a.t - b.t), onsets });
  },
  'breakdown-0.10': sr => breakdown('breakdown-0.10', sr, 0.10),
  'breakdown-0.20': sr => breakdown('breakdown-0.20', sr, 0.20),
  'breakdown-0.40': sr => breakdown('breakdown-0.40', sr, 0.40),
};
export const NAMES = Object.keys(BUILD);

export function render(name, { sr = 44100 } = {}) {
  const b = BUILD[name]; if (!b) throw new Error(`no tracker scenario ${name}`);
  return b(sr);
}
export function scenarios({ sr = 44100 } = {}) { return NAMES.map(n => render(n, { sr })); }
