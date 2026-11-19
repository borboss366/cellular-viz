// 27 · EQ calibrate: the arithmetic (the page 27-eq-calibrate.html and node's qa/runner/test/eq27.test.mjs run it).
// <script src="27-eq.js"></script> gives window.EQ; node: require('./27-eq.js').
//   bands(db, sampleRate)      16 log-spaced bands, 30 Hz - 16 kHz, from an AnalyserNode's dB spectrum: the mean power
//                              of each band's bins, in dB (floor FLOOR_DB)
//   heightOf(dB)               0..1 bar height on the scale SCALE_DB (-72) .. 0 dB
//   follow(state, bandsDb, dt) the bars (attack at once, RELEASE_DB_S fall) and their peak caps (held PEAK_HOLD_S, then
//                              falling PEAK_FALL_DB_S)
//   levelOf(wave)              the input's RMS and sample peak, dBFS
//   clipStep(state, peakDb, t) the red clip marker: on when the sample peak reaches CLIP_DB (-1 dBFS), held CLIP_HOLD_S
//   flashOf(read)              the beat flash from the clock's read(): { env, strong, beat } with env 1 on the 1 and
//                              WEAK on the other beats at the beat's visual time, decaying with FLASH_TAU, 0 from
//                              FLASH_CUT_S on (crisp, ~90 ms). Flash safety: at most MAX_PER_S flashes a second; above
//                              180 bpm only every other beat flashes (the 1 always does)
(function (root) {
  'use strict';
  const N = 16, F_LO = 30, F_HI = 16000, FLOOR_DB = -120, SCALE_DB = -72;
  const EDGES = Array.from({ length: N + 1 }, (_, i) => F_LO * Math.pow(F_HI / F_LO, i / N));
  const RELEASE_DB_S = 40, PEAK_HOLD_S = 1.0, PEAK_FALL_DB_S = 20, CLIP_DB = -1, CLIP_HOLD_S = 1.5;
  const FLASH_TAU = 0.03, FLASH_CUT_S = 0.09, WEAK = 0.55, MAX_PER_S = 3;

  function bands(db, sampleRate, out = new Array(N)) {
    const n = db.length, hzPerBin = sampleRate / 2 / n;
    for (let b = 0; b < N; b++) {
      const i0 = Math.max(1, Math.floor(EDGES[b] / hzPerBin)), i1 = Math.max(i0 + 1, Math.min(n, Math.ceil(EDGES[b + 1] / hzPerBin)));
      let p = 0, c = 0;
      for (let i = i0; i < i1; i++) { const v = db[i]; p += Number.isFinite(v) ? Math.pow(10, v / 10) : 0; c++; }
      out[b] = c ? Math.max(FLOOR_DB, 10 * Math.log10(p / c + 1e-30)) : FLOOR_DB;
    }
    return out;
  }
  const heightOf = d => Math.max(0, Math.min(1, (d - SCALE_DB) / -SCALE_DB));
  const create = () => ({ level: new Array(N).fill(FLOOR_DB), peak: new Array(N).fill(FLOOR_DB), peakAt: new Array(N).fill(-1e9), t: 0, clipUntil: -1e9 });
  function follow(s, bandsDb, dt) {
    const d = Math.max(0, Math.min(0.25, dt || 0)); s.t += d;
    for (let b = 0; b < N; b++) {
      const v = Number.isFinite(bandsDb[b]) ? bandsDb[b] : FLOOR_DB;
      s.level[b] = v >= s.level[b] ? v : Math.max(v, s.level[b] - RELEASE_DB_S * d);
      if (s.level[b] >= s.peak[b]) { s.peak[b] = s.level[b]; s.peakAt[b] = s.t; }
      else if (s.t - s.peakAt[b] > PEAK_HOLD_S) s.peak[b] = Math.max(s.level[b], s.peak[b] - PEAK_FALL_DB_S * d);
    }
    return s;
  }
  function levelOf(wave) {
    if (!wave || !wave.length) return { rmsDb: FLOOR_DB, peakDb: FLOOR_DB };
    let s = 0, p = 0;
    for (let i = 0; i < wave.length; i++) { const v = wave[i]; s += v * v; const a = Math.abs(v); if (a > p) p = a; }
    return { rmsDb: Math.max(FLOOR_DB, 10 * Math.log10(s / wave.length + 1e-30)), peakDb: Math.max(FLOOR_DB, 20 * Math.log10(p + 1e-30)) };
  }
  function clipStep(s, peakDb, t) { if (peakDb >= CLIP_DB) s.clipUntil = t + CLIP_HOLD_S; return t < s.clipUntil; }
  // read: { beats, bpm, beatInBar } (clock.read(): beats at the visual time, the conductor's offset included)
  function flashOf(read) {
    const none = { env: 0, strong: false, beat: null };
    if (!read || !(read.beats >= 0) || !(read.bpm > 0)) return none;
    const beat = Math.floor(read.beats + 1e-9), age = (read.beats - beat) * 60 / read.bpm, strong = read.beatInBar === 1;
    if (60 / read.bpm < 1 / MAX_PER_S - 1e-9 && !strong && beat % 2 !== 0) return { ...none, beat };   // > 180 bpm: every other beat
    if (age >= FLASH_CUT_S) return { env: 0, strong, beat };
    return { env: (strong ? 1 : WEAK) * Math.exp(-age / FLASH_TAU), strong, beat };
  }
  const api = { N, EDGES, FLOOR_DB, SCALE_DB, CLIP_DB, PEAK_HOLD_S, FLASH_CUT_S, WEAK, MAX_PER_S, bands, heightOf, create, follow, levelOf, clipStep, flashOf };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EQ = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
