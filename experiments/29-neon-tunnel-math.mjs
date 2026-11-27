// 29 · Neon Tunnel: the maths, apart from the drawing (node runs this file; qa/runner/test/neontunnel29.test.mjs checks
// it). The scene (29-neon-tunnel.mjs) draws what these say: the bent tunnel (near rings stay round the viewer, far
// rings slide to the turn and the far end stays in sight), the eased target with its comfort caps, the
// banking roll and the view width, the rings locked to the beat at each speed, the kick's light running down the
// tunnel, the seeded path, the colour runs, the ring shapes and the knobs. No clock or unseeded random source here.
// Brief: docs/CELLULAR_VIZ_BRIEF_NEON_TUNNEL.md (#329), part 1 (the scene, its own path and the turn knob).

const TAU = 2 * Math.PI;
export const clamp01 = x => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
const clampN = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---------------------------------------------------------------- the tunnel (units: its radius R = 1)
export const TUN = {
  L: 2,            // ring spacing
  F0: 1.35,        // focal length (screen half-height 1)
  Z_MAX: 60,       // the depth search stops here (the hole at the far end)
  NEAR: [1.5, 5],  // rings fade in between these depths, so nothing sweeps the frame's edge brightly
  FOG: 16,
  RUN: 4,          // rings per colour run
};

// ---------------------------------------------------------------- comfort (the brief's limits, as numbers)
// The target (x, y in -1..1, screen half-widths and half-heights) moves at most TURN_RATE_MAX a second and changes
// speed by at most TURN_ACC_MAX a second², whatever the input does. The view rolls into the turn by at most ROLL_MAX
// (15 degrees) and at most ROLL_RATE_MAX a second. The view widens (the build) by at most WIDEN_MAX, at most
// WIDEN_RATE_MAX a second.
export const COMFORT = {
  TURN_RATE_MAX: 0.35, TURN_ACC_MAX: 0.6, TURN_TAU: 1.2,
  ROLL_MAX: 15 * Math.PI / 180, ROLL_RATE_MAX: 10 * Math.PI / 180, ROLL_GAIN: 0.3,
  WIDEN_MAX: 0.12, WIDEN_RATE_MAX: 0.06,
};
// one step of the eased target: s = { x, y, vx, vy }, goal { x, y }
export function easeTarget(s, goal, dt) {
  const d = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
  const gx = clampN(Number.isFinite(goal.x) ? goal.x : 0, -1, 1), gy = clampN(Number.isFinite(goal.y) ? goal.y : 0, -1, 1);
  let wx = (gx - s.x) / COMFORT.TURN_TAU, wy = (gy - s.y) / COMFORT.TURN_TAU;   // the velocity it would like
  const wl = Math.hypot(wx, wy);
  if (wl > COMFORT.TURN_RATE_MAX) { wx *= COMFORT.TURN_RATE_MAX / wl; wy *= COMFORT.TURN_RATE_MAX / wl; }
  let ax = wx - s.vx, ay = wy - s.vy;
  const al = Math.hypot(ax, ay), amax = COMFORT.TURN_ACC_MAX * d;
  if (al > amax) { ax *= amax / al; ay *= amax / al; }
  const vx = s.vx + ax, vy = s.vy + ay;
  return { x: clampN(s.x + vx * d, -1, 1), y: clampN(s.y + vy * d, -1, 1), vx, vy };
}
export const rollTarget = x => clampN(-COMFORT.ROLL_GAIN * (Number.isFinite(x) ? x : 0), -COMFORT.ROLL_MAX, COMFORT.ROLL_MAX);
export function stepToward(cur, target, rateMax, dt) {
  const d = Math.max(0, Number.isFinite(dt) ? dt : 0), m = rateMax * d;
  return cur + clampN(target - cur, -m, m);
}
export const rollStep = (roll, x, dt) => clampN(stepToward(roll, rollTarget(x), COMFORT.ROLL_RATE_MAX, dt), -COMFORT.ROLL_MAX, COMFORT.ROLL_MAX);
export const widenStep = (w, target, dt) => clampN(stepToward(w, clampN(target, 0, COMFORT.WIDEN_MAX), COMFORT.WIDEN_RATE_MAX, dt), 0, COMFORT.WIDEN_MAX);

// ---------------------------------------------------------------- the bend
// On screen (q units: x times the aspect, y as is) the ring at depth z is centred at c(z) = tq·f(z) with radius F·R/z.
// f(z) = 1 − 1/√(1 + u²), u = z·|tq| / (BEND_M·F): 0 at the viewer, rising smoothly to 1 far away, so the rings nest
// off-centre toward the turn and the far end sits on the target. It is also the least bend that keeps the far end in
// sight: |tq − c(z)| = |tq|/√(1 + u²) < BEND_M·F/z for every z, inside every ring (BEND_M < 1/1.155 keeps that true
// for the hexagon too). A straight bend into a corner would hide it behind the near wall.
export const BEND_M = 0.8;
export const toQ = (t, aspect) => [t.x * aspect, t.y];
export function bendF(z, tqLen, F) { const u = Math.max(0, z) * Math.max(0, tqLen) / (BEND_M * F); return 1 - 1 / Math.sqrt(1 + u * u); }
export const ringCentre = (tq, z, F) => { const f = bendF(z, Math.hypot(tq[0], tq[1]), F); return [tq[0] * f, tq[1] * f]; };
export const ringRadius = (z, F, R = 1) => F * R / Math.max(1e-6, z);
// the cross-section's norm (homogeneous of degree 1): 0 circle, 1 rounded square, 2 hexagon; morph mixes two
export const SHAPES = ['circle', 'rounded square', 'hexagon'];
export function shapeNorm(x, y, k) {
  const ax = Math.abs(x), ay = Math.abs(y);
  if (k === 1) return Math.pow(Math.pow(ax, 5) + Math.pow(ay, 5), 1 / 5);
  if (k === 2) return Math.max(ax * 0.8660254 + ay * 0.5, ay) / 0.8660254;
  return Math.hypot(ax, ay);
}
export const normMix = (x, y, a, b, m) => shapeNorm(x, y, a) * (1 - m) + shapeNorm(x, y, b) * m;
// the wall's depth for a pixel q (as the shader finds it): the first z where z·N(q − c(z)) reaches F·R
export function wallDepth(q, tq, F, R = 1, a = 0, b = 0, m = 0) {
  const h = z => { const c = ringCentre(tq, z, F); return z * normMix(q[0] - c[0], q[1] - c[1], a, b, m) - F * R; };
  let z0 = 0.3, prev = z0;
  if (h(z0) >= 0) return z0;
  for (let k = 1; k <= 15; k++) {
    const z = 0.3 * Math.pow(TUN.Z_MAX / 0.3, k / 15);
    if (h(z) >= 0) { let lo = prev, hi = z; for (let i = 0; i < 7; i++) { const mid = 0.5 * (lo + hi); if (h(mid) >= 0) hi = mid; else lo = mid; } return 0.5 * (lo + hi); }
    prev = z;
  }
  return TUN.Z_MAX;
}

// ---------------------------------------------------------------- where the target comes from (part 1: path and knob)
// The seeded path visits the centre, the sides, the top and the corners: one waypoint a section, a slow wobble inside
// it. The turn knob scales it: 0 a straight tunnel, 1 the corners. A pointer (part 2: { x, y, t }) younger than
// POINTER_STALE_S wins; older, the ride glides back to its own path (the easing above does the gliding).
export const WAYPOINTS = [[0, 0], [-0.85, 0], [0.85, 0], [0, 0.75], [0, -0.6], [-0.85, 0.75], [0.85, 0.75], [-0.85, -0.6], [0.85, -0.6]];
export const SECTION_BARS = 16, BUILD_BARS = 4, POINTER_STALE_S = 2;
export function mulberry32(a) {
  let s = a >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash3 = (a, b, c) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)) >>> 0;
export function sectionPlan(seed, n) {   // the section's waypoint, ring shape and colour seed
  const r = mulberry32(hash3(seed, n, 2711));
  const wp = n % 3 === 0 ? 0 : 1 + Math.floor(r() * (WAYPOINTS.length - 1));   // every third section comes back to the centre
  const shape = r() < 0.5 && n > 0 ? Math.floor(r() * SHAPES.length) : 0;
  return { wp, shape, colourSeed: Math.floor(r() * 1e6) };
}
export function pathTarget(seed, bars, turn) {
  const b = Number.isFinite(bars) ? Math.max(0, bars) : 0, n = Math.floor(b / SECTION_BARS), p = WAYPOINTS[sectionPlan(seed, n).wp];
  const k = clamp01(turn), wob = 0.08 * k;
  return { x: clampN(k * p[0] + wob * Math.sin(TAU * b / 7.3), -1, 1), y: clampN(k * p[1] + wob * Math.sin(TAU * b / 11.1 + 1.3), -1, 1) };
}
export function pickTarget(pointer, tNow, own) {
  if (pointer && Number.isFinite(pointer.x) && Number.isFinite(pointer.y) && Number.isFinite(pointer.t) && tNow - pointer.t <= POINTER_STALE_S && tNow >= pointer.t)
    return { x: clampN(pointer.x, -1, 1), y: clampN(pointer.y, -1, 1), from: 'pointer' };
  return { x: own.x, y: own.y, from: 'path' };
}
export const inBuild = bars => { const b = ((Math.floor(bars) % SECTION_BARS) + SECTION_BARS) % SECTION_BARS; return b >= SECTION_BARS - BUILD_BARS; };

// ---------------------------------------------------------------- the ride on the beat
// The speed knob picks rings per beat: 0.5, 1 or 2, so the ride stays on the grid. The ride's phase (rings travelled)
// follows the beats and is pulled back onto the grid (phase ≡ beats × rate) whenever the beat is confident; with no
// beat it drifts calmly in seconds.
export const RATES = [0.5, 1, 2];
export const rateOf = k => RATES[Math.min(2, Math.floor(clamp01(k) * 3))];
export const RIDE = { RATE_TAU: 0.4, ALIGN_TAU: 0.5, DRIFT: 0.6 };
const wrapHalf = x => x - Math.round(x);
export function rideStep(st, { dB, dt, beats, w, rateWant, act }) {
  const d = Math.max(0, Number.isFinite(dt) ? dt : 0), ww = clamp01(w);
  const rate = st.rate + (rateWant - st.rate) * (1 - Math.exp(-d / RIDE.RATE_TAU));
  let phase = st.phase + ww * rate * Math.max(0, dB) + (1 - ww) * RIDE.DRIFT * (0.3 + 0.7 * clamp01(act)) * d;
  // back onto the grid once the speed has settled (while it eases, beats × rate turns too fast to follow)
  if (ww > 0.5 && Number.isFinite(beats) && Math.abs(rate - rateWant) < 0.01) phase -= wrapHalf(phase - beats * rateWant) * Math.min(1, d / RIDE.ALIGN_TAU);
  return { rate, phase };
}

// ---------------------------------------------------------------- the beat gain and the kick's running light
// g = clock.beatGain(?beatKnob) (1 untouched, 0 the knob down, 3 its top) or ?beatGain: it scales the kick's light only
// (0.9 at g 1, capped at 1.8; the cap limits the coefficient, the envelope multiplies it: no flat top). The light starts
// on the nearest ring ahead and runs away down the tunnel at RUN_RATE rings a second.
export const BEAT = { G_MAX: 3, KICK: 0.9, KICK_CAP: 1.8 };
const clampG = g => clampN(g, 0, BEAT.G_MAX);
export function beatGainOf(clock, n, fixed) {
  if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clampG(+fixed);
  if (!clock || typeof clock.beatGain !== 'function') return 1;
  let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
  return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clampG(+g);
}
export const beatTerms = g => { const gg = Number.isFinite(g) ? clampG(g) : 1; return { g: gg, kick: Math.min(BEAT.KICK_CAP, BEAT.KICK * gg) }; };
export const KICK = { ATTACK_S: 0.025, RELEASE_S: 0.6, RUN_RATE: 10, MAX: 4, Z_START: 2.5, ENERGY_ON: 0.45, ENERGY_GAP_S: 0.2 };
const peakOf = (a, b) => { const t = a * Math.log((a + b) / a); return (1 - Math.exp(-t / a)) * Math.exp(-t / b); };
const KICK_PEAK = peakOf(KICK.ATTACK_S, KICK.RELEASE_S);
export const kickEnv = age => (age >= 0 && Number.isFinite(age) ? (1 - Math.exp(-age / KICK.ATTACK_S)) * Math.exp(-age / KICK.RELEASE_S) / KICK_PEAK : 0);
// the absolute index of the first ring ahead of the viewer beyond Z_START, at ride phase p (rings travelled)
export const firstRingAhead = p => Math.ceil(p + KICK.Z_START / TUN.L);
export const kicksCreate = () => ({ list: [], started: 0, fromEnergy: 0, prevKick: 0, lastEnergyAt: -1e9 });
export function kickAdd(K, t0, phase, amp, fixed = false) {
  const a = clamp01(amp);
  if (!(a > 0.02) || !Number.isFinite(t0)) return false;
  K.list.push({ t0, k0: firstRingAhead(phase), amp: a, fixed }); K.started++;
  while (K.list.length > KICK.MAX) K.list.shift();
  return true;
}
export function energyOnset(K, kick, t) {
  const k = Number.isFinite(kick) ? kick : 0, on = k > KICK.ENERGY_ON && K.prevKick <= KICK.ENERGY_ON && t - K.lastEnergyAt >= KICK.ENERGY_GAP_S;
  K.prevKick = k; if (on) K.lastEnergyAt = t;
  return on;
}
// the lights as the shader reads them: MAX × [ring index now (absolute, fractional), brightness, 0, 0]
export function kickUniforms(K, t, terms, out = new Float32Array(4 * KICK.MAX)) {
  K.list = K.list.filter(k => t - k.t0 < 2.5);
  out.fill(0);
  let peak = 0;
  K.list.forEach((k, i) => { const age = Math.max(0, t - k.t0), e = (k.fixed ? 1 : terms.kick) * kickEnv(age) * k.amp; out[4 * i] = k.k0 + KICK.RUN_RATE * age; out[4 * i + 1] = e; peak = Math.max(peak, e); });
  return { u: out, peak, n: K.list.length };
}

// ---------------------------------------------------------------- colour: runs of rings, the colour knob
// pink #ff2e88, cyan #22e6ff, orange #ff8a1f; accent white-blue #dff6ff (the far glow and the kick's ring); walls
// violet-black #07030f. Colour knob 0: pink and cyan only; 1: orange joins (a run is orange with probability k/3).
export const HEX = { pink: '#ff2e88', cyan: '#22e6ff', orange: '#ff8a1f', accent: '#dff6ff', wall: '#07030f' };
export const lin = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
export function runColour(colourSeed, run, colourKnob) {   // 0 pink, 1 cyan, 2 orange
  const r = mulberry32(hash3(colourSeed, run, 97)), a = r(), b = r();
  if (b < clamp01(colourKnob) / 3) return 2;
  return a < 0.5 ? 0 : 1;
}

// ---------------------------------------------------------------- silence, no-beat, knobs (as 28 and 18 b)
export const ACT = { ENERGY_K: 1.6, ATTACK_S: 0.4, RELEASE_S: 3.0, GLOW_MIN: 0.5 };
export const activityTarget = (w, level) => clamp01(w) + (1 - clamp01(w)) * clamp01((Number.isFinite(level) ? level : 0) * ACT.ENERGY_K);
export function activityStep(a, target, dt) {
  const x = clamp01(a), tg = clamp01(target), d = Math.max(0, Number.isFinite(dt) ? dt : 0);
  return x + (tg - x) * (1 - Math.exp(-d / (tg > x ? ACT.ATTACK_S : ACT.RELEASE_S)));
}
export const glowOf = a => ACT.GLOW_MIN + (1 - ACT.GLOW_MIN) * clamp01(a);
export const PICK_EPS = 0.02;
export const pickupCreate = () => ({ snap: null, live: {} });
export function pickup(p, n, knobs) {
  const k = Math.round(+n);
  if (!p || !(k >= 1 && k <= 8) || !Array.isArray(knobs)) return null;
  const val = x => (x !== null && x !== undefined && Number.isFinite(+x) ? clamp01(+x) : null);
  if (p.snap === null) { if (!knobs.some(x => val(x) !== null)) return null; p.snap = Array.from({ length: 8 }, (_, i) => val(knobs[i])); }
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
