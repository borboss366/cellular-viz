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
// beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"; VIZ research's shared beat gain): g from
//   clock.beatGain(?beatKnob, default 1) (untouched or no getter = 1, today), or ?beatGain fixed, at most BEAT_G_MAX
//   (2: the wires' kick glow 0.55(1 + 0.5 kick) then peaks at 2x, the FOV kick at 0.12 under its 0.15 cap). The page
//   draws from beatLanes(g, L): kick x g; snare and hat x min(g, 1) (the dipoles' snare light 0.8 + 2.4 snare is
//   already 4x today, and hats come 4 a second: turning up never flashes harder than today). The 0.6-a-kick glows (string
//   sprites, the wires' glow width) scale by lightScale(g) = min(1, BEAT_LIGHT_MAX / g) (at most 2x), the halo width by
//   1 / max(1, g) (at most today's +0.25): scaled, never clamped, so they peak with the kick and have no flat top. The
//   travel speed (its knob), the clock, audio-in's lanes, the bunch crossings and the sync log are untouched. At g = 1
//   every level is today's.
// pick-up (the user's Mac session, 20 Nov: a knob left up by the last scene in the slot acted at once on the next one):
//   knobOf(clock, n) reads through pickup(p, n, clock.knobs), as 16-dive.js: a knob whose value was already there when
//   the first knob values reached the page is ignored until it moves by more than PICK_EPS (so knob 2 left at 0 by
//   Hodge's dive does not stop the camera on arrival); a knob unknown then is live once it gets a value. A clock without
//   a knobs list (tests, older clocks) reads as before. QA: ?qaClockKnobs=2:0 stands in for the stored knobs.
(function (root) {
  'use strict';
  const C = {
    TAU: 0.5, ACCEL: 1.0, MIN_RATE: 0.3, SPEED_POW: 1.5, SPEED_DEFAULT: 0.5,
    TARGET_X: 0.3, TARGET_Y: 0.2, PERIODS: [23, 37, 29, 41], BEND_D: 6,
    RAY_BASE: 0.45, RAY_BASS: 0.2, RAY_KICK: 0.35, RAY_CAP: 1.0, RAY_TAU_K: 0.12, RAY_MIN_GAP: 1 / 3,
    RAY_W_KICK: 0.35, RAY_W_BASS: 0.1, RAY_LEN: 45,
    BEAT_G_MAX: 2, BEAT_HAT_G_MAX: 1, BEAT_SNARE_G_MAX: 1, BEAT_LIGHT_MAX: 1 / 0.6,
    PICK_EPS: 0.02,
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), clamp01 = x => clamp(x, 0, 1);
  // pick-up (see the header): one state per clock (= per page load); QA's stand-in for the stored knobs
  const pickupCreate = () => ({ snap: null, live: {} }), picks = new WeakMap();
  const QA_KNOBS = (() => {
    try {
      const m = /[?&]qaClockKnobs=([^&#]*)/.exec(String((root.location && root.location.search) || ''));
      if (!m) return null;
      const a = new Array(8).fill(null);
      for (const kv of decodeURIComponent(m[1]).split(',')) { const [n, v] = kv.split(':').map(Number); if (n >= 1 && n <= 8 && Number.isFinite(v)) a[n - 1] = clamp01(v); }
      return a;
    } catch (e) { return null; }
  })();
  function pickup(p, n, knobs) {
    const k = Math.round(+n);
    if (!p || !(k >= 1 && k <= 8) || !Array.isArray(knobs)) return null;
    const val = x => (x !== null && x !== undefined && Number.isFinite(+x) ? clamp01(+x) : null);
    if (p.snap === null) {   // the values the page found on arrival: the last scene's knobs
      if (!knobs.some(x => val(x) !== null)) return null;
      p.snap = Array.from({ length: 8 }, (_, i) => val(knobs[i]));
    }
    const v = val(knobs[k - 1]);
    if (p.live[k]) return v;
    if (v === null) return null;
    const v0 = p.snap[k - 1];
    if (v0 === null || Math.abs(v - v0) > C.PICK_EPS) { p.live[k] = true; return v; }
    return null;
  }
  const pickupState = clock => { const p = clock && picks.get(clock); return p ? { snap: p.snap ? p.snap.slice() : null, live: Object.keys(p.live).map(Number) } : null; };
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
    let all = QA_KNOBS;
    if (!all) { try { all = Array.isArray(clock.knobs) ? clock.knobs : null; } catch (e) { all = null; } }
    if (all) {   // through the pick-up
      let p = picks.get(clock);
      if (!p) { p = pickupCreate(); picks.set(clock, p); }
      return pickup(p, k, all);
    }
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
  // the beat gain g: fixed (?beatGain, a number) wins, else clock.beatGain(n) (VIZ dev's PR A), else 1
  function beatGainOf(clock, n, fixed) {
    if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clamp(+fixed, 0, C.BEAT_G_MAX);
    if (!clock || typeof clock.beatGain !== 'function') return 1;
    let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
    return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clamp(+g, 0, C.BEAT_G_MAX);
  }
  // the lanes the page draws from at gain g: a copy of L with kick x g, snare and hat x min(g, 1) (L itself untouched)
  function beatLanes(g, L) {
    const gg = Number.isFinite(g) ? clamp(g, 0, C.BEAT_G_MAX) : 1, hg = Math.min(C.BEAT_HAT_G_MAX, gg), sg = Math.min(C.BEAT_SNARE_G_MAX, gg);
    const v = x => (Number.isFinite(x) ? x : 0), out = Object.assign({}, L);
    out.kick = v(L && L.kick) * gg; out.snare = v(L && L.snare) * sg; out.hat = v(L && L.hat) * hg;
    out.beat = { g: gg, kick: out.kick, snare: out.snare, hat: out.hat };
    return out;
  }
  // the glow caps at gain g (scaled, not clamped: the shape of the envelope and its peak frame stay the kick's; at g <= 1
  // every value is today's bit for bit): lightScale for the 0.6-a-kick glows, haloOf / glowOf the wires' bass terms
  const gOf = g => (Number.isFinite(g) ? clamp(g, 0, C.BEAT_G_MAX) : 1);
  const lightScale = g => Math.min(1, C.BEAT_LIGHT_MAX / gOf(g));
  const haloOf = (bass, g) => 0.9 + 0.25 * bass / Math.max(1, gOf(g));
  const glowOf = (bass, g) => 0.7 + 0.6 * bass * lightScale(g);
  const api = { C, pcg, knobOf, speedCreate, speedStep, targetAt, rayCreate, rayStep, beatGainOf, beatLanes, lightScale, haloOf, glowOf, pickupCreate, pickup, pickupState };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Travel = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
