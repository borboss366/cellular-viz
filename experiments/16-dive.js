// 16b · Hodge Kaleidoscope: the dive, the burst and the glints (the user's Saturday upgrades, 19 Nov 22:07).
// Pure state and arithmetic, no GL: the page (16-hodge-kaleidoscope.html) and node (qa/runner/test/dive16.test.mjs) run
// the same code. <script src="16-dive.js"></script> gives window.Dive; node: require('./16-dive.js').
//
// The dive (?diveKnob=N, the set: 2): the knob is the dive depth. The depth follows it through a low-pass (DIVE_TAU) with
//   a rate cap (DIVE_RATE), so a slammed knob still flies in smoothly; depth d zooms the camera into the centre of the
//   fundamental cell (the gold middle column) by zoomOf(d) = DIVE_MAX^-smoothstep(d): the tiling streams outward past
//   the frame edges. That is the build-up.
// The burst (the drop): the knob turned down fast, from above HI to under LO within WINDOW beats, books one burst on
//   the next beat (once per turn-down: it re-arms only when the knob goes above HI again). The burst pushes the tiling
//   outward from the centre (up to 1 + BURST_PUSH times closer) and streaks the oil trails outward, rising over
//   BURST_ATTACK s (no strobe) and settling over BURST_BARS bars. Key D: hold = dive in (to full in 2 s), release =
//   a burst on the next beat. ?autoDrop=1: a burst when the low band comes back after QUIET_BARS or more quiet bars.
// The glints (?glint=0..1 or ?glintKnob=N, the set: 3): on each hat a specular band sweeps across the gems' facets
//   (SWEEP_S), on each snare a prism split (R and B offset by up to PRISM_PX px at 1080p) decays with PRISM_TAU; both
//   scale with glint. Every envelope has a tail of 120 ms or more.
// At rest (no knob, no key, ?dive 0, glint 0) every output is the page's old constant: zoom × 1, trail zoom 1.002,
// glint 0, prism 0, so the look and the truths are unchanged.
(function (root) {
  'use strict';
  const C = {
    DIVE_MAX: 12, DIVE_TAU: 0.2, DIVE_RATE: 0.8,
    HI: 0.6, LO: 0.2, WINDOW: 1,
    BURST_ATTACK: 0.25, BURST_BARS: 1.5, BURST_PUSH: 1.5, BURST_FB: 0.02, FB_REST: 1.002,
    KEY_RATE: 0.5,
    QUIET_BARS: 4, QUIET_REL: 0.4, LOW_REF_TAU: 20,
    HAT_TAU: 0.14, SWEEP_S: 0.2, PRISM_TAU: 0.18, PRISM_PX: 4,
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), clamp01 = x => clamp(x, 0, 1);
  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  // depth 0..1 → the zoom multiplier (1 at rest, 1 / DIVE_MAX at full depth)
  const zoomOf = depth => Math.exp(-Math.log(C.DIVE_MAX) * smooth(clamp01(depth)));
  // the burst's envelope, s after it fired: a smoothstep rise over BURST_ATTACK, then e^-3 over BURST_BARS bars
  function burstEnv(sinceS, barS) {
    if (!(sinceS >= 0)) return 0;
    const tau = Math.max(0.05, C.BURST_BARS * (barS > 0 ? barS : 2) / 3);
    return smooth(sinceS / C.BURST_ATTACK) * Math.exp(-Math.max(0, sinceS - C.BURST_ATTACK) / tau);
  }
  // the controller's knob n (1..8) on the shared clock (#268: clock.knob(n), 0..1, or null until it moves), or null
  function knobOf(clock, n) {
    const k = Math.round(+n);
    if (!(k >= 1 && k <= 8) || !clock || typeof clock.knob !== 'function') return null;
    let v = null; try { v = clock.knob(k); } catch (e) { v = null; }
    return v !== null && v !== undefined && Number.isFinite(+v) ? clamp01(+v) : null;
  }
  function create() {
    return { depth: 0, hist: [], armed: false, pending: null, bursts: [], lastBurstT: null, keyTarget: 0, keyWas: false,
      quietBars: 0, lowRef: null, lastBeats: null, env: 0 };
  }
  // book a burst on the next beat (one at a time)
  function schedule(s, beats, cause) {
    if (s.pending) return false;
    s.pending = { beat: Math.floor(beats + 1e-6) + 1, cause, at: beats };
    return true;
  }
  // one frame. i: { t (s), dt (s), beats, bpb, barS (s), knob (0..1 or null), keyHeld, fixed (?dive), low (0..1, the low
  // band, for autoDrop), autoDrop } → { depth, zoom (× uZoom), env, fbZoom (the trail zoom), fired (the burst that went
  // live this frame, or null) }
  function step(s, i) {
    const dt = clamp(Number.isFinite(i.dt) ? i.dt : 0, 0, 0.1), beats = Number.isFinite(i.beats) ? i.beats : 0, bpb = i.bpb > 0 ? i.bpb : 4;
    // key D: hold dives in, release books a burst
    if (i.keyHeld) { s.keyTarget = Math.min(1, s.keyTarget + C.KEY_RATE * dt); s.keyWas = true; }
    else if (s.keyWas) { s.keyWas = false; s.keyTarget = 0; schedule(s, beats, 'key'); }
    const knob = i.knob === null || i.knob === undefined || !Number.isFinite(+i.knob) ? null : clamp01(+i.knob);
    const target = knob !== null ? knob : s.keyWas ? s.keyTarget : clamp01(+i.fixed || 0);
    // the depth: a low-pass with a rate cap
    const want = s.depth + (target - s.depth) * (1 - Math.exp(-dt / C.DIVE_TAU)), cap = C.DIVE_RATE * dt;
    s.depth = clamp(s.depth + clamp(want - s.depth, -cap, cap), 0, 1);
    // the turn-down (a knob only): from above HI to under LO within WINDOW beats
    if (knob !== null) {
      s.hist.push([beats, knob]);
      while (s.hist.length && s.hist[0][0] < beats - C.WINDOW) s.hist.shift();
      if (knob > C.HI) s.armed = true;
      if (s.armed && knob < C.LO && s.hist.some(h => h[1] > C.HI)) { s.armed = false; schedule(s, beats, 'knob'); }
    }
    // ?autoDrop: the low band back after QUIET_BARS or more quiet bars (quiet: under QUIET_REL of its usual level)
    if (i.autoDrop && Number.isFinite(i.low)) {
      const db = s.lastBeats === null ? 0 : clamp(beats - s.lastBeats, 0, bpb);
      if (s.lowRef === null) s.lowRef = i.low;
      const quiet = s.lowRef > 0 && i.low < C.QUIET_REL * s.lowRef;
      if (quiet) s.quietBars += db / bpb;
      else {
        if (s.quietBars >= C.QUIET_BARS) schedule(s, beats, 'autoDrop');
        s.quietBars = 0;
        s.lowRef += (i.low - s.lowRef) * (1 - Math.exp(-dt / C.LOW_REF_TAU));
      }
    }
    s.lastBeats = beats;
    // the booked burst goes live on its beat
    let fired = null;
    if (s.pending && beats >= s.pending.beat - 1e-9) {
      fired = { ...s.pending, t: i.t, firedBeats: beats };
      s.bursts.push(fired); if (s.bursts.length > 64) s.bursts.shift();
      s.lastBurstT = i.t; s.pending = null;
    }
    const env = s.lastBurstT === null ? 0 : burstEnv(i.t - s.lastBurstT, i.barS);
    s.env = env;
    return { depth: s.depth, zoom: zoomOf(s.depth) / (1 + C.BURST_PUSH * env), env, fbZoom: C.FB_REST + C.BURST_FB * env, fired };
  }
  // the glints this frame: amount 0..1 (?glint or the knob), the hat and snare envelopes (0..1), s since the last hat
  function glints(amount, hatEnv, sinceHatS, prismEnv) {
    const a = clamp01(+amount || 0);
    if (a <= 0) return { glint: 0, sweep: 0, prism: 0 };
    return { glint: a * clamp01(hatEnv), sweep: clamp01((Number.isFinite(sinceHatS) ? sinceHatS : 1e9) / C.SWEEP_S), prism: a * clamp01(prismEnv) };
  }
  const api = { C, create, step, schedule, zoomOf, burstEnv, knobOf, glints, smooth };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Dive = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
