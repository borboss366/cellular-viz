// 06 · Lenia + effects: beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"; VIZ research's shared
// beat gain). Pure arithmetic, no GL: the page (06-lenia-effects.html) and node (qa/runner/test/beat06.test.mjs) run the
// same code. <script src="06-beat.js"></script> gives window.LeniaBeat; node: require('./06-beat.js').
//
// g comes from clock.beatGain(?beatKnob, default 1) (null/untouched or no getter = 1, today), or ?beatGain fixed
// (stills); here g is at most 2. It scales only the lanes' terms where they are used: the kick's bulge (fxBulge·kick·0.02),
// bloom pump (1.5·kick), trail zoom (2·kick), the snare's light swing (1.2·snare) and flash (uSnare: ×(1 + 0.5·snare) and
// its glow), the hat's shimmer and sheen (uHat) with g at most 1 there (hats come 4 a second, so never above today).
// Not the fxBloom base, fxZoom/fxDecay, μ (kick → μ), the blobs and cuts, the pad or the sim rate. At g = 1 every term
// is bit-for-bit today's (each is today's product with g in it, and no cap binds at g <= 1).
(function (root) {
  'use strict';
  const C = { G_MAX: 2, HAT_G_MAX: 1, BULGE: 0.02, BLOOM: 1.5, LIGHT: 1.2, ZOOM: 2, BLOOM_CAP: 3.0, SNARE_CAP: 2.0 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // g: fixed (?beatGain, a number) wins, else clock.beatGain(n) (VIZ dev's PR A), else 1
  function beatGainOf(clock, n, fixed) {
    if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clamp(+fixed, 0, C.G_MAX);
    if (!clock || typeof clock.beatGain !== 'function') return 1;
    let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
    return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clamp(+g, 0, C.G_MAX);
  }
  // the beat terms at gain g for this frame's lane levels (0..1)
  function beatTerms(g, kick, snare, hat) {
    const gg = Number.isFinite(g) ? clamp(g, 0, C.G_MAX) : 1, hg = Math.min(C.HAT_G_MAX, gg);
    const k = Number.isFinite(kick) ? kick : 0, s = Number.isFinite(snare) ? snare : 0, h = Number.isFinite(hat) ? hat : 0;
    return {
      g: gg,
      bulge: gg,                                           // the bulge: fxBulge * kick * 0.02 * bulge
      bloomKick: Math.min(C.BLOOM_CAP, C.BLOOM * gg * k),  // bloom × (1 + bloomKick) when fxBloomBeat
      light: C.LIGHT * gg * s,                             // light angle 0.8 + light + drift
      zoomKick: C.ZOOM * gg * k,                           // trail zoom 1 + (fxZoom − 1)(1 + zoomKick)
      snare: Math.min(C.SNARE_CAP, s * gg),                // uSnare: col × (1 + 0.5 uSnare) + glow, so at most 2× (+1.0)
      hat: h * hg,                                         // uHat: shimmer and sheen, never above today
    };
  }
  // Beat lights (?lights=1 or the page's switch; off in the set): on each kick onset a soft neon spot lights the mass.
  // Flash safety is here, not in the shader: at most one flash per 334 ms (3 a second), and each flash's brightness
  // jump (the spot colour's luma × its peak) at most JUMP_MAX. The spot lights only the mass, never the dark ground, so
  // the frame never goes white. g (the beat knob) scales the peak, g = 0 gives no light.
  const LIGHTS = {
    MIN_GAP_MS: 334, ATTACK_MS: 25, DECAY_MS: 170, PEAK: 0.7, JUMP_MAX: 0.35,
    COLS: [[1.0, 0.1, 0.8], [0.1, 0.9, 1.0], [0.6, 1.0, 0.1], [1.0, 0.5, 0.05]],   // magenta, cyan, lime, orange
    SPOTS: [[0.3, 0.35], [0.7, 0.65], [0.7, 0.35], [0.3, 0.65]],
  };
  const luma = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  function lightsNew(on) { return { on: !!on, last: -1e9, t0: -1e9, peak: 0, k: -1, fired: 0, skipped: 0, times: [], maxPerSec: 0, maxJump: 0, amp: 0 }; }
  // one frame: onset = a fresh kick this frame; returns { amp, x, y, col } (amp 0 when off or between flashes)
  function lightsStep(s, now, onset, g) {
    const gg = Number.isFinite(g) ? clamp(g, 0, C.G_MAX) : 1;
    if (s.on && onset && gg > 0) {
      if (now - s.last >= LIGHTS.MIN_GAP_MS) {
        s.last = now; s.t0 = now; s.k = (s.k + 1) % LIGHTS.COLS.length; s.fired++;
        s.peak = Math.min(LIGHTS.PEAK * gg / 2, LIGHTS.JUMP_MAX / luma(LIGHTS.COLS[s.k]));
        s.maxJump = Math.max(s.maxJump, s.peak * luma(LIGHTS.COLS[s.k]));
        s.times.push(now); while (s.times.length && now - s.times[0] >= 1000) s.times.shift();
        s.maxPerSec = Math.max(s.maxPerSec, s.times.length);
      } else s.skipped++;
    }
    const t = now - s.t0, e = !s.on || s.k < 0 || t < 0 ? 0 : t < LIGHTS.ATTACK_MS ? t / LIGHTS.ATTACK_MS : Math.exp(-(t - LIGHTS.ATTACK_MS) / LIGHTS.DECAY_MS);
    const k = Math.max(0, s.k), amp = e < 1e-3 ? 0 : s.peak * e;
    s.amp = amp;
    return { amp, x: LIGHTS.SPOTS[k][0], y: LIGHTS.SPOTS[k][1], col: LIGHTS.COLS[k] };
  }
  const api = { C, beatGainOf, beatTerms, LIGHTS, luma, lightsNew, lightsStep };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LeniaBeat = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
