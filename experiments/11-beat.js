// 11 · Riemann, the show: beat strength (the user, 20 Nov: "all scenes react too weakly to the beat"; VIZ research's
// shared beat gain). Pure arithmetic, no GL: the page (11-riemann-show.html) and node (qa/runner/test/beat11.test.mjs)
// run the same code. <script src="11-beat.js"></script> gives window.RiemannBeat; node: require('./11-beat.js').
//
// g comes from clock.beatGain(?beatKnob, default 1) (null/untouched or no getter = 1, today), or ?beatGain fixed
// (stills); here g is at most 2. The scenes draw from one lane object (S.L); beatLanes(g, L) is that object with its
// drum levels scaled where the pictures read them: kick × g (the ribbon's shake, roll and light, the canyon's breath,
// pit glow and drone bob, the rings and dots), snare × g, hat × min(g, 1) (hats come 4 a second: never above today).
// The clock and audio-in's own lanes, the hit log, the zero flash and every scene's motion are untouched. At g = 1
// each level is today's, bit for bit (level × 1).
(function (root) {
  'use strict';
  const C = { G_MAX: 2, HAT_G_MAX: 1, JUMP_BARS: 1 };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  // g: fixed (?beatGain, a number) wins, else clock.beatGain(n) (VIZ dev's PR A), else 1
  function beatGainOf(clock, n, fixed) {
    if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clamp(+fixed, 0, C.G_MAX);
    if (!clock || typeof clock.beatGain !== 'function') return 1;
    let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
    return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clamp(+g, 0, C.G_MAX);
  }
  // the lanes the scenes draw from at gain g: a copy of L with kick, snare and hat scaled (L itself is left alone)
  function beatLanes(g, L) {
    const gg = Number.isFinite(g) ? clamp(g, 0, C.G_MAX) : 1, hg = Math.min(C.HAT_G_MAX, gg);
    const v = x => (Number.isFinite(x) ? x : 0);
    const out = Object.assign({}, L);
    out.kick = v(L && L.kick) * gg; out.snare = v(L && L.snare) * gg; out.hat = v(L && L.hat) * hg;
    out.beat = { g: gg, kick: out.kick, snare: out.snare, hat: out.hat };
    return out;
  }
  // a clock jump (the Mac session, 20 Nov: after a slot switch the ribbon shook hard): a slot scene's first frames run on
  // the page's own count until the shared clock's arrives (~470 bars later); the chase camera then eased from the old
  // spot to the new one (8 % a frame) and the zero flash fired. jumped(st, bars) is true when bars moved by more than
  // JUMP_BARS since the last frame (a seek or that switch, never 60 fps playback: 0.05 bar a frame at 180 BPM); the page
  // then snaps the camera and takes the new zero without a flash.
  const jumpState = () => ({ last: null, jumps: 0 });
  function jumped(st, bars) {
    if (!st || !Number.isFinite(bars)) return false;
    const j = st.last !== null && Math.abs(bars - st.last) > C.JUMP_BARS;
    st.last = bars; if (j) st.jumps++;
    return j;
  }
  const api = { C, beatGainOf, beatLanes, jumpState, jumped };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RiemannBeat = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
