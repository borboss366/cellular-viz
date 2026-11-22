// 28 · Aurora: the maths, apart from the drawing (node runs this file; qa/runner/test/aurora28.test.mjs checks it).
// The scene (28-aurora.mjs) draws what these functions say: the curtains' shape and fold brightness, the kick's
// ripple, the beat gain's caps, the no-beat activity, the section targets, the palette (mixed in Oklab) and the knobs.
// Nothing here reads a clock or an unseeded random source: every value comes from the seed, the beat or its arguments.

const TAU = 2 * Math.PI;
export const clamp01 = x => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------- the picture's layout (screen fractions, y up)
export const HORIZON = 0.28;              // the water line; the far shore's hills rise above it, the lake mirrors below
export const LAYERS = 3, COLS = 320, ROWS = 24;   // curtains (far, mid, near) and each one's grid
export const X0 = -0.18, XS = 1.36;       // a curtain runs from x0 to x0 + xs across the screen before its folds
// per layer, far → near: depth (scales size and fold amplitude), bottom edge, brightness share, lean (x per unit height)
export const LAYER = [
  { depth: 0.55, base: 0.355, bright: 0.45, lean: -0.025 },
  { depth: 0.78, base: 0.395, bright: 0.70, lean: 0.035 },
  { depth: 1.00, base: 0.440, bright: 1.00, lean: -0.045 },
];
// the folds: three sines along the curtain (cycles per curtain, amplitude in screen widths, travel in cycles per drift
// second); together their slope beats XS here and there, so the sheet turns back on itself (a real fold)
export const FOLDS = { freq: [1.3, 3.1, 6.7], amp: [0.10, 0.05, 0.018], speed: [0.021, -0.034, 0.055] };
export const FOLD_MIN = 0.5, FOLD_MAX = 2.6;   // the fold brightness (line of sight along the sheet) is clamped to this

// a curtain's x and slope at s (0..1) for amplitudes a[3], frequencies f[3] and phases p[3]
export function curtainX(s, a, f, p) {
  let x = X0 + XS * s;
  for (let k = 0; k < 3; k++) x += a[k] * Math.sin(TAU * f[k] * s + p[k]);
  return x;
}
export function curtainSlope(s, a, f, p) {
  let d = XS;
  for (let k = 0; k < 3; k++) d += a[k] * TAU * f[k] * Math.cos(TAU * f[k] * s + p[k]);
  return d;
}
// brightness where the sheet is seen edge-on: 1 where it runs straight across, up to FOLD_MAX in a fold
export const foldGain = slope => clampN(XS / Math.max(Math.abs(Number.isFinite(slope) ? slope : XS), 1e-3), FOLD_MIN, FOLD_MAX);

// ---------------------------------------------------------------- knobs: height and colour
export const HEIGHT_MIN = 0.16, HEIGHT_MAX = 0.62;   // the near curtain's height, screen fractions (knob 0 → 1)
export const heightOf = k => HEIGHT_MIN + (HEIGHT_MAX - HEIGHT_MIN) * clamp01(k);
export const DRIFT_MIN = 0.4, DRIFT_MAX = 1.8;       // macro 3: the folds' travel speed (×)
export const driftOf = k => DRIFT_MIN + (DRIFT_MAX - DRIFT_MIN) * clamp01(k);

// ---------------------------------------------------------------- colour: two palettes, mixed in Oklab
// each: the lower fringe (nitrogen), the curtain (oxygen green), the top (high oxygen); the background stays black
export const PALETTES = {
  classic: ['#7b5cff', '#2cff9a', '#ff3b6b'],   // colour knob 0: violet fringe, green curtain, crimson top
  violet: ['#ff5ad1', '#36d6ff', '#9b5bff'],    // colour knob 1: pink fringe, cyan curtain, violet top
};
export const hexToSrgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const srgbToLinear = c => c.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
// Björn Ottosson's Oklab (linear sRGB in, out)
export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklabToLinear([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(v => Math.max(0, v));
}
const LAB = Object.fromEntries(Object.entries(PALETTES).map(([k, hs]) => [k, hs.map(h => linearToOklab(srgbToLinear(hexToSrgb(h))))]));
// the three colours (linear sRGB) at colour knob k: classic at 0, violet at 1, Oklab in between (no muddy middle)
export function paletteAt(k) {
  const t = clamp01(k);
  return LAB.classic.map((a, i) => oklabToLinear(a.map((v, j) => v + (LAB.violet[i][j] - v) * t)));
}

// ---------------------------------------------------------------- the beat gain and the kick's ripple
// g = clock.beatGain(?beatKnob) (1 untouched, 0 knob down, 3 top) or ?beatGain. It scales only the kick's ripple: its
// brightness band (0.9 at g 1) and its sideways kink (0.6 % of the width at g 1). The caps limit the coefficient, then
// the envelope multiplies it, so the ripple always rises and falls (no flat top) and g 1 is the look as designed.
export const BEAT = { G_MAX: 3, RIPPLE: 0.9, RIPPLE_CAP: 1.8, KINK: 0.006, KINK_CAP: 0.014 };
const clampG = g => clampN(g, 0, BEAT.G_MAX);
export function beatGainOf(clock, n, fixed) {   // fixed (?beatGain, a number) wins, else clock.beatGain(n), else 1
  if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clampG(+fixed);
  if (!clock || typeof clock.beatGain !== 'function') return 1;
  let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
  return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clampG(+g);
}
export function beatTerms(g) {
  const gg = Number.isFinite(g) ? clampG(g) : 1;
  return { g: gg, ripple: Math.min(BEAT.RIPPLE_CAP, BEAT.RIPPLE * gg), kink: Math.min(BEAT.KINK_CAP, BEAT.KINK * gg) };
}
// one ripple: a band that climbs the curtain from its lower edge (v 0) to its top (v 1) in RISE_S, with a fast attack
// and a slow release (peak 1)
export const RIPPLE = { RISE_S: 0.6, ATTACK_S: 0.025, RELEASE_S: 0.45, LIFE_S: 1.6, MAX: 6, ENERGY_ON: 0.45, ENERGY_GAP_S: 0.2 };
const RIP_PEAK = (() => { const a = RIPPLE.ATTACK_S, b = RIPPLE.RELEASE_S, t = a * Math.log((a + b) / a); return (1 - Math.exp(-t / a)) * Math.exp(-t / b); })();
export const rippleEnv = age => (age >= 0 && Number.isFinite(age) ? (1 - Math.exp(-age / RIPPLE.ATTACK_S)) * Math.exp(-age / RIPPLE.RELEASE_S) / RIP_PEAK : 0);
export const rippleHeight = age => (Number.isFinite(age) ? Math.max(0, age) / RIPPLE.RISE_S : 0);
export const ripplesCreate = () => ({ list: [], started: 0, fromEnergy: 0, prevKick: 0, lastEnergyAt: -1e9 });
// a ripple born at t0 (seconds, the frame clock) with amplitude amp 0..1 (beat path: the beat weight; no-beat: the
// energy's kick); fixed: a performer's trigger, at g 1's coefficient whatever the beat knob says
export function rippleAdd(R, t0, amp, fixed = false) {
  const a = clamp01(amp);
  if (!(a > 0.02) || !Number.isFinite(t0)) return false;
  R.list.push({ t0, amp: a, fixed, phase: (R.started * 2.399963) % TAU }); R.started++;   // the golden angle: each kink bends its own way
  while (R.list.length > RIPPLE.MAX) R.list.shift();
  return true;
}
// no-beat mode: a ripple on the music's own kick (audio-in's energy.kick crossing ENERGY_ON upwards)
export function energyOnset(R, kick, t) {
  const k = Number.isFinite(kick) ? kick : 0, on = k > RIPPLE.ENERGY_ON && R.prevKick <= RIPPLE.ENERGY_ON && t - R.lastEnergyAt >= RIPPLE.ENERGY_GAP_S;
  R.prevKick = k;
  if (on) R.lastEnergyAt = t;
  return on;
}
// the ripples as the shader reads them: MAX × [height v, brightness, kink, phase]; drops the finished ones
export function rippleUniforms(R, t, terms, out = new Float32Array(4 * RIPPLE.MAX)) {
  R.list = R.list.filter(r => t - r.t0 < RIPPLE.LIFE_S);
  out.fill(0);
  let peak = 0;
  R.list.forEach((r, i) => {
    const age = Math.max(0, t - r.t0), e = rippleEnv(age) * r.amp;
    const cr = r.fixed ? BEAT.RIPPLE : terms.ripple, ck = r.fixed ? BEAT.KINK : terms.kink;
    out[4 * i] = rippleHeight(age); out[4 * i + 1] = cr * e; out[4 * i + 2] = ck * e; out[4 * i + 3] = r.phase;
    peak = Math.max(peak, cr * e);
  });
  return { u: out, peak, n: R.list.length };
}

// ---------------------------------------------------------------- silence and no-beat mode
// activity 0..1: 1 on a confident beat (beat weight w 1), else the music's loudness (audio-in's energy level). Silence
// leaves a faint slow glow: brightness GLOW_MIN and the drift at 35 % speed. Fast-ish attack, slow release.
export const ACT = { ENERGY_K: 1.6, ATTACK_S: 0.4, RELEASE_S: 3.0, GLOW_MIN: 0.28, DRIFT_MIN: 0.35 };
export const activityTarget = (w, level) => clamp01(w) + (1 - clamp01(w)) * clamp01((Number.isFinite(level) ? level : 0) * ACT.ENERGY_K);
export function activityStep(a, target, dt) {
  const x = clamp01(a), tg = clamp01(target), d = Math.max(0, Number.isFinite(dt) ? dt : 0);
  return x + (tg - x) * (1 - Math.exp(-d / (tg > x ? ACT.ATTACK_S : ACT.RELEASE_S)));
}
export const glowOf = a => ACT.GLOW_MIN + (1 - ACT.GLOW_MIN) * clamp01(a);
export const driftRate = a => ACT.DRIFT_MIN + (1 - ACT.DRIFT_MIN) * clamp01(a);

// ---------------------------------------------------------------- the section (16 bars): what changes slowly
export const SECTION_BARS = 16, SECTION_EASE_S = 6;
export function mulberry32(a) {
  let s = a >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash3 = (a, b, c) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
// per layer: a fold amplitude scale, a phase shift for each fold, and a brightness share; seeded by (seed, section)
export function sectionTarget(seed, n) {
  return LAYER.map((L, i) => {
    const r = mulberry32(hash3(seed, n, i + 1));
    return { amp: 0.75 + 0.5 * r(), shift: [0, 1, 2].map(() => (r() - 0.5) * TAU * 0.6), bright: 0.75 + 0.4 * r() };
  });
}
export const smoothTo = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-Math.max(0, dt) / tau));
// the layer's start phases from the seed (fixed for the page)
export function seedPhases(seed) {
  const r = mulberry32(hash3(seed, 7919, 13));
  return LAYER.map(() => [r() * TAU, r() * TAU, r() * TAU, r() * TAU, r() * 100]);   // 3 folds, the bottom edge, the rays
}

// ---------------------------------------------------------------- knobs through the pick-up (as 24-marble.mjs)
// A knob left by the last scene in the slot does nothing here until it moves by more than PICK_EPS.
export const PICK_EPS = 0.02;
export const pickupCreate = () => ({ snap: null, live: {} });
export function pickup(p, n, knobs) {
  const k = Math.round(+n);
  if (!p || !(k >= 1 && k <= 8) || !Array.isArray(knobs)) return null;
  const val = x => (x !== null && x !== undefined && Number.isFinite(+x) ? clamp01(+x) : null);
  if (p.snap === null) {
    if (!knobs.some(x => val(x) !== null)) return null;
    p.snap = Array.from({ length: 8 }, (_, i) => val(knobs[i]));
  }
  const v = val(knobs[k - 1]);
  if (p.live[k]) return v;
  if (v === null) return null;
  const v0 = p.snap[k - 1];
  if (v0 === null || Math.abs(v - v0) > PICK_EPS) { p.live[k] = true; return v; }
  return null;
}
// knob n (1..8) from the clock's knob list through pick-up p, else the fallback (the page's slider / ?macro)
export function knobOr(clock, p, n, fallback) {
  const k = Math.round(+n);
  if (k >= 1 && k <= 8 && clock) {
    let all = null;
    try { all = Array.isArray(clock.knobs) ? clock.knobs : null; } catch (e) { all = null; }
    const v = all ? pickup(p, k, all) : null;
    if (v !== null && v !== undefined) return v;
  }
  return clamp01(fallback);
}
