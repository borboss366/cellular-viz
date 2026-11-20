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
  const api = { C, beatGainOf, beatTerms };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LeniaBeat = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
