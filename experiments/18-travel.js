// 18 · Little Bang, beamline: travel mode (the user, 20 Nov: "I want the viewer to move along the tube ... a knob that
// defines the speed ... track a point on the scene, so the tube direction would point there ... a plasma ray along the
// tube that pulsates to the music. It should not be pouring like plasma from the sci-fi movies.")
// Pure state and arithmetic, no GL: the page (18-little-bang.html) and node (qa/runner/test/travel18.test.mjs) run the same
// code. <script src="18-travel.js"></script> gives window.Travel; node: require('./18-travel.js').
//
// speed: ?speedKnob=N (the set: 4) reads clock.knob(N), 0..1 (#268; null until it moves, then ?speed, default 0.5). The
//   speed is knob^1.5 of V_MAX (one lap of the ring a bar, today's mean pace); it follows through a TAU low-pass capped at
//   ACCEL of V_MAX a second and never slower than MIN_RATE, so a turned knob never jumps the camera. 0 stops it.
// target: a point (NDC) that wanders by itself: two slow sines a coordinate, periods of 23-41 bars, phases from the PCG
//   hash of the seed (no Math.random), |x| <= TARGET_X, |y| <= TARGET_Y. The page bends the view toward it in clip space,
//   more with depth (1 - exp(-w / BEND_D)), so the far end of the tunnel drifts there and nothing near the camera moves.
// ray: a thin steady beam on the tube's axis ahead of the camera. Its brightness env = BASE + BASS·breath + KICK·k, never
//   over CAP; k jumps to 1 on a kick (a rising edge of the kick envelope past 0.5) at most once every MIN_GAP s (<= 3
//   peaks a second) and decays with TAU_K; the width swells with k and the breath. No flow, no texture along it.
(function (root) {
  'use strict';
  const C = {
    TAU: 0.5, ACCEL: 1.0, MIN_RATE: 0.3, SPEED_POW: 1.5, SPEED_DEFAULT: 0.5,
    TARGET_X: 0.3, TARGET_Y: 0.2, PERIODS: [23, 37, 29, 41], BEND_D: 6,
    RAY_BASE: 0.45, RAY_BASS: 0.2, RAY_KICK: 0.35, RAY_CAP: 1.0, RAY_TAU_K: 0.12, RAY_MIN_GAP: 1 / 3,
    RAY_W_KICK: 0.35, RAY_W_BASS: 0.1, RAY_LEN: 45,
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), clamp01 = x => clamp(x, 0, 1);
  // the page's PCG (the same hash the shaders use)
  function pcg(v) {
    const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
    const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0;
    return ((w >>> 22) ^ w) >>> 0;
  }
  // the controller's knob n (1..8) on the shared clock, or null (no getter before #268, not moved yet, out of range)
  function knobOf(clock, n) {
    const k = Math.round(+n);
    if (!(k >= 1 && k <= 8) || !clock || typeof clock.knob !== 'function') return null;
    let v = null; try { v = clock.knob(k); } catch (e) { v = null; }
    return v !== null && v !== undefined && Number.isFinite(+v) ? clamp01(+v) : null;
  }
  // speed: { v (fraction of V_MAX, eased), target, knob }
  const speedCreate = (fallback = C.SPEED_DEFAULT) => ({ v: Math.pow(clamp01(fallback), C.SPEED_POW), target: Math.pow(clamp01(fallback), C.SPEED_POW), knob: null });
  function speedStep(s, knob, dt) {
    const d = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1);
    if (knob !== null && knob !== undefined && Number.isFinite(+knob)) { s.knob = clamp01(+knob); s.target = Math.pow(s.knob, C.SPEED_POW); }
    // a low-pass, but never slower than MIN_RATE (so 0 really stops: from full speed in about 1.5 s) nor faster than ACCEL
    const gap = s.target - s.v, lp = Math.abs(gap) * (1 - Math.exp(-d / C.TAU));
    s.v = clamp(s.v + Math.sign(gap) * Math.min(Math.abs(gap), Math.max(lp, C.MIN_RATE * d), C.ACCEL * d), 0, 1);
    return s.v;
  }
  // the wandering target at a bar position (smooth, bounded, the same for the same seed)
  function targetAt(bars, seed = 1) {
    const ph = k => 2 * Math.PI * pcg((seed >>> 0) * 16 + k + 0x51ed) / 4294967296, P = C.PERIODS, b = Number.isFinite(bars) ? bars : 0;
    const w = (p, k) => Math.sin(2 * Math.PI * b / p + ph(k));
    return { x: C.TARGET_X * (0.6 * w(P[0], 0) + 0.4 * w(P[1], 1)), y: C.TARGET_Y * (0.6 * w(P[2], 2) + 0.4 * w(P[3], 3)) };
  }
  // ray: { k, t, last, prev, peaks }
  const rayCreate = () => ({ k: 0, t: 0, last: -1e9, prev: 0, peaks: [] });
  function rayStep(s, kick, breath, dt) {
    const d = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.1), kv = Number.isFinite(kick) ? kick : 0, b = clamp01(Number.isFinite(breath) ? breath : 0);
    s.t += d;
    const edge = kv > 0.5 && s.prev <= 0.5; s.prev = kv;
    let peak = false;
    if (edge && s.t - s.last >= C.RAY_MIN_GAP - 1e-9) { s.k = 1; s.last = s.t; peak = true; s.peaks.push(s.t); if (s.peaks.length > 64) s.peaks.shift(); }
    else s.k *= Math.exp(-d / C.RAY_TAU_K);
    const env = Math.min(C.RAY_CAP, C.RAY_BASE + C.RAY_BASS * b + C.RAY_KICK * s.k);
    return { env, width: 1 + C.RAY_W_KICK * s.k + C.RAY_W_BASS * b, kick: s.k, peak };
  }
  const api = { C, pcg, knobOf, speedCreate, speedStep, targetAt, rayCreate, rayStep };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Travel = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
