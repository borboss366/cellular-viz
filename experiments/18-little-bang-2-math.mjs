// 18 · Little Bang 2: the maths, apart from the drawing (node runs this file; qa/runner/test/littlebang2.test.mjs checks
// it). The scene (18-little-bang-2.mjs) draws what these say: the camera's speed and wander, the kick's light rings and
// the ray's pulse, the beat gain's caps, the collisions at the far end (tracks as helices in the solenoid's field), the
// section palettes (mixed in Oklab), the no-beat activity and the knobs. No clock or unseeded random source here: every
// value comes from the seed, the beat or the arguments.

const TAU = 2 * Math.PI;
export const clamp01 = x => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------- the tube (units: the tube's radius R = 1)
export const TUBE = {
  OFF: [0.3, -0.24],    // the camera sits off the axis, so the ray on the axis reads as a line to the far end
  FOCAL: 1.55,          // screen half-height = 1 at this focal length
  WIRES: 16,            // neon wires along the wall
  WIRE_W: 0.035,        // a wire's core, in wire spacings
  WIRE_GLOW: 0.16,      // its halo, in wire spacings
  TWIST: 0.018,         // the wires wind slowly round the tube (radians per R)
  HOOP_L: 4,            // ring magnets every 4 R
  FOG: 15,              // light falls off along the tube (e-folding length, R)
  Z_IP: 14,             // the interaction point (where the bunches cross) this far ahead
  RAY_START: 1.2,       // the ray starts this far ahead of the camera
};

// ---------------------------------------------------------------- the speed knob (2; slot B 6) and the camera
// speed = V_MAX · knob^1.5 (0 stops), followed through a low-pass of TAU s with at most ACCEL R/s²: a turned knob never
// jumps the camera. Ring magnets pass at speed / HOOP_L a second; above 2 a second they dim (hoopAmp), so the
// periphery never flickers.
export const SPEED = { V_MAX: 10, POW: 1.5, DEFAULT: 0.5, TAU: 0.5, ACCEL: 10 };
export const speedOf = k => SPEED.V_MAX * Math.pow(clamp01(k), SPEED.POW);
export function speedStep(v, target, dt) {
  const d = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0)), x = Number.isFinite(v) ? v : target;
  const want = (target - x) * (1 - Math.exp(-d / SPEED.TAU)), cap = SPEED.ACCEL * d;
  return x + clampN(want, -cap, cap);
}
// the camera's travel s as the shader's phases: each wraps where its pattern repeats (no precision loss, no pop)
const wrap = (x, m) => ((x % m) + m) % m;
export const PANEL = { SCALE: 0.7, PERIOD: 14 };   // the wall's panel noise: lattice cells per R, and its period in cells
export function travelPhases(s) {
  const x = Number.isFinite(s) ? s : 0;
  return { twist: wrap(x * TUBE.TWIST, TAU), band: wrap(x / 7, 1), rainbow: wrap(x / 22, 1), hoop: wrap(x, TUBE.HOOP_L), panel: wrap(x, PANEL.PERIOD / PANEL.SCALE) };
}
export const hoopRate = v => Math.max(0, v) / TUBE.HOOP_L;
export const hoopAmp = v => 1 / (1 + (hoopRate(v) / 2) ** 2);
// the far end wanders by itself: the camera turns toward a target over tens of bars (periods in beats, seeded phases)
export const WANDER = { YAW: [0.09, 0.035], PITCH: [0.06, 0.025], PERIODS: [92, 148, 116, 164] };
export function wander(tauBeats, ph) {
  const s = (i, p) => Math.sin(TAU * tauBeats / WANDER.PERIODS[i] + p);
  return { yaw: WANDER.YAW[0] * s(0, ph[0]) + WANDER.YAW[1] * s(1, ph[1]), pitch: WANDER.PITCH[0] * s(2, ph[2]) + WANDER.PITCH[1] * s(3, ph[3]) };
}
// the camera's frame from yaw and pitch (y up, looking down +z)
export function cameraFrame(yaw, pitch) {
  const f = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const rl = Math.hypot(f[2], f[0]), r = [f[2] / rl, 0, -f[0] / rl];   // cross((0,1,0), f), normalised
  const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];   // cross(f, r)
  return { f, r, u };
}
// a point (x, y on the tube's cross-section, z ahead of the camera) → screen q (half-height 1, y up) and depth
export function project(cam, p) {
  const v = [p[0] - TUBE.OFF[0], p[1] - TUBE.OFF[1], p[2]];
  const z = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2];
  if (!(z > 0.2)) return null;
  return [(v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2]) / z * TUBE.FOCAL, (v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2]) / z * TUBE.FOCAL, z];
}

// ---------------------------------------------------------------- the beat gain, the kick's light rings and the ray
// g = clock.beatGain(?beatKnob) (1 untouched, 0 the knob down, 3 its top) or ?beatGain. It scales the kick's terms only:
// the light ring's brightness (0.8 at g 1), the ray's kick brightness (0.5) and thickness (0.6). Each cap limits the
// coefficient and the envelope multiplies it, so every pulse rises and falls (no flat top); g 1 is the look as designed.
export const BEAT = { G_MAX: 3, RING: 0.8, RING_CAP: 1.6, RAY: 0.5, RAY_CAP: 1.1, RAY_W: 0.6, RAY_W_CAP: 1.2 };
const clampG = g => clampN(g, 0, BEAT.G_MAX);
export function beatGainOf(clock, n, fixed) {   // fixed (?beatGain, a number) wins, else clock.beatGain(n), else 1
  if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clampG(+fixed);
  if (!clock || typeof clock.beatGain !== 'function') return 1;
  let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
  return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clampG(+g);
}
export function beatTerms(g) {
  const gg = Number.isFinite(g) ? clampG(g) : 1;
  return { g: gg, ring: Math.min(BEAT.RING_CAP, BEAT.RING * gg), ray: Math.min(BEAT.RAY_CAP, BEAT.RAY * gg), rayW: Math.min(BEAT.RAY_W_CAP, BEAT.RAY_W * gg) };
}
// a light ring leaves the camera on the kick and runs down the tube to the far end in about a beat; the ray brightens
// and thickens with it (fast attack, slow release, peak 1). The ray pulses at most 3 times a second.
export const KICK = { Z0: 3.5, V: 21, ATTACK_S: 0.03, RELEASE_S: 0.4, RAY_ATTACK_S: 0.02, RAY_RELEASE_S: 0.2, RAY_GAP_S: 1 / 3, MAX: 6,
  ENERGY_ON: 0.45, ENERGY_GAP_S: 0.2 };
const peakOf = (a, b) => { const t = a * Math.log((a + b) / a); return (1 - Math.exp(-t / a)) * Math.exp(-t / b); };
const RING_PEAK = peakOf(KICK.ATTACK_S, KICK.RELEASE_S), RAY_PEAK = peakOf(KICK.RAY_ATTACK_S, KICK.RAY_RELEASE_S);
export const ringEnv = age => (age >= 0 && Number.isFinite(age) ? (1 - Math.exp(-age / KICK.ATTACK_S)) * Math.exp(-age / KICK.RELEASE_S) / RING_PEAK : 0);
export const rayEnv = age => (age >= 0 && Number.isFinite(age) ? (1 - Math.exp(-age / KICK.RAY_ATTACK_S)) * Math.exp(-age / KICK.RAY_RELEASE_S) / RAY_PEAK : 0);
export const ringZ = age => KICK.Z0 + KICK.V * Math.max(0, Number.isFinite(age) ? age : 0);
export const kicksCreate = () => ({ list: [], started: 0, fromEnergy: 0, rayAt: -1e9, rayAmp: 0, rayTimes: [], prevKick: 0, lastEnergyAt: -1e9 });
// a kick at t0 (s, the frame clock) with amplitude amp 0..1 (beat path: the beat weight; no-beat: the heard kick)
export function kickAdd(K, t0, amp) {
  const a = clamp01(amp);
  if (!(a > 0.02) || !Number.isFinite(t0)) return false;
  K.list.push({ t0, amp: a }); K.started++;
  while (K.list.length > KICK.MAX) K.list.shift();
  if (t0 - K.rayAt >= KICK.RAY_GAP_S) { K.rayAt = t0; K.rayAmp = a; K.rayTimes.push(t0); if (K.rayTimes.length > 16) K.rayTimes.shift(); }
  return true;
}
export function energyOnset(K, kick, t) {   // no-beat mode: the music's own kick crossing ENERGY_ON upwards
  const k = Number.isFinite(kick) ? kick : 0, on = k > KICK.ENERGY_ON && K.prevKick <= KICK.ENERGY_ON && t - K.lastEnergyAt >= KICK.ENERGY_GAP_S;
  K.prevKick = k;
  if (on) K.lastEnergyAt = t;
  return on;
}
// the rings as the shader reads them (MAX × [z ahead, brightness, 0, 0]), the ray's kick now, and the peaks so far
export function kickUniforms(K, t, terms, out = new Float32Array(4 * KICK.MAX)) {
  K.list = K.list.filter(k => ringZ(t - k.t0) < TUBE.Z_IP + 4);
  out.fill(0);
  let ring = 0;
  K.list.forEach((k, i) => { const age = Math.max(0, t - k.t0), e = terms.ring * ringEnv(age) * k.amp; out[4 * i] = ringZ(age); out[4 * i + 1] = e; ring = Math.max(ring, e); });
  const re = rayEnv(t - K.rayAt) * K.rayAmp;
  return { u: out, ring, ray: terms.ray * re, rayW: terms.rayW * re, n: K.list.length };
}
export const rayPeaksIn = (K, t, s = 2) => K.rayTimes.filter(x => t - x <= s && t >= x).length;

// ---------------------------------------------------------------- collisions at the far end, on every downbeat
// The bunches cross at the interaction point on each bar: a small fireball and charged tracks that curl in the
// solenoid's field (helices round the beam axis: radius ∝ pT, some come back toward the camera). Seeded per bar.
export const COLL = { TRACKS: 20, TRACKS_DROP: 34, VT: 1.4, VZ: 5, LIFE_S: 1.8, TRAIL_S: 0.45, FIRE: 0.7, FIRE_DROP: 1.0, FIRE_R: 0.32,
  FIRE_ATTACK_S: 0.05, FIRE_RELEASE_S: 0.7, WALL: 0.94 };
export function mulberry32(a) {
  let s = a >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash3 = (a, b, c) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
export function collision(seed, bar, drop) {
  const r = mulberry32(hash3(seed, bar, 4099)), n = drop ? COLL.TRACKS_DROP : COLL.TRACKS, psi = r() * TAU, v2 = 0.12;
  const tracks = [];
  for (let i = 0; i < n; i++) {
    let phi = r() * TAU;
    phi += v2 * Math.sin(2 * (phi - psi));   // elliptic flow: more tracks along the reaction plane
    const pT = 0.15 + 1.6 * r() * r(), q = r() < 0.5 ? -1 : 1, eta = (r() - 0.5) * 2.4, hue = r();
    tracks.push({ phi, pT, q, eta, hue, rh: 0.12 + 0.55 * pT });
  }
  return { bar, drop: !!drop, psi, tracks };
}
// a track's point at age s after the crossing (x, y across the tube, z along it from the interaction point)
export function trackPoint(tr, age) {
  const t = Math.max(0, age), w = COLL.VT / tr.rh, th = tr.phi + tr.q * w * t;
  const x = tr.q * tr.rh * (Math.sin(th) - Math.sin(tr.phi)), y = -tr.q * tr.rh * (Math.cos(th) - Math.cos(tr.phi));
  return [x, y, COLL.VZ * Math.tanh(tr.eta) * t];
}
// the time a track reaches the wall (COLL.WALL), or Infinity when it curls inside (2 rh < WALL)
export function trackWallTime(tr) {
  if (2 * tr.rh < COLL.WALL) return Infinity;
  const half = Math.asin(COLL.WALL / (2 * tr.rh));   // the chord from the axis: |p| = 2 rh sin(Δθ / 2)
  return (2 * half) / (COLL.VT / tr.rh);
}
export const fireEnv = age => (age >= 0 && Number.isFinite(age) ? (1 - Math.exp(-age / COLL.FIRE_ATTACK_S)) * Math.exp(-age / COLL.FIRE_RELEASE_S) / peakOf(COLL.FIRE_ATTACK_S, COLL.FIRE_RELEASE_S) : 0);

// ---------------------------------------------------------------- the song: 16-bar sections, the drop in bars 12-15
export const SECTION_BARS = 16, DROP_BAR = 12, PAL_EASE_BARS = 2;
export const isDrop = bars => { const b = ((Math.floor(bars) % SECTION_BARS) + SECTION_BARS) % SECTION_BARS; return b >= DROP_BAR; };
// the wires' two colours per section (neon, as the house likes them); the ray and the collision light stay gold
export const PALETTES = [
  ['#1f4bff', '#ff1f8e'],   // cobalt, magenta
  ['#36d6ff', '#9b5bff'],   // cyan, violet
  ['#ff1f8e', '#ff8c1a'],   // magenta, tangerine
  ['#b6ff1a', '#1f4bff'],   // acid green, cobalt
];
export const GOLD = '#ffc83d', RING_HEX = '#fff1c9', HOOP_HEX = '#7fe8ff', PANEL_HEX = '#3a4cff';
export const hexToSrgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const srgbToLinear = c => c.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
export const lin = h => srgbToLinear(hexToSrgb(h));
export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklabToLinear([L, A, B]) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3, m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3, s = (L - 0.0894841775 * A - 1.2914855480 * B) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s].map(v => Math.max(0, v));
}
const LAB = PALETTES.map(p => p.map(h => linearToOklab(lin(h))));
const mixLab = (a, b, t) => oklabToLinear(a.map((v, j) => v + (b[j] - v) * t));
// the wires' colours at this point of the song: the section's pair, eased from the last section's over 2 bars
export function paletteAt(bars) {
  const b = Number.isFinite(bars) ? Math.max(0, bars) : 0, sec = Math.floor(b / SECTION_BARS), into = b - sec * SECTION_BARS;
  const cur = LAB[sec % LAB.length], prev = LAB[(sec + LAB.length - 1) % LAB.length];
  const x = clamp01(into / PAL_EASE_BARS), t = sec === 0 ? 1 : x * x * (3 - 2 * x);
  return [mixLab(prev[0], cur[0], t), mixLab(prev[1], cur[1], t)];
}

// ---------------------------------------------------------------- silence and no-beat mode
// activity 0..1: 1 on a confident beat, else the music's loudness. Dark, never empty: silence leaves the tube at 45 %
// light (the wires and the far glow stay), the ray steady and dim. Fast-ish attack, slow release.
export const ACT = { ENERGY_K: 1.6, ATTACK_S: 0.4, RELEASE_S: 3.0, GLOW_MIN: 0.45 };
export const activityTarget = (w, level) => clamp01(w) + (1 - clamp01(w)) * clamp01((Number.isFinite(level) ? level : 0) * ACT.ENERGY_K);
export function activityStep(a, target, dt) {
  const x = clamp01(a), tg = clamp01(target), d = Math.max(0, Number.isFinite(dt) ? dt : 0);
  return x + (tg - x) * (1 - Math.exp(-d / (tg > x ? ACT.ATTACK_S : ACT.RELEASE_S)));
}
export const glowOf = a => ACT.GLOW_MIN + (1 - ACT.GLOW_MIN) * clamp01(a);

// ---------------------------------------------------------------- knobs through the pick-up (as 18-travel.js)
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
export function seedPhases(seed) { const r = mulberry32(hash3(seed, 7919, 31)); return [r() * TAU, r() * TAU, r() * TAU, r() * TAU]; }
