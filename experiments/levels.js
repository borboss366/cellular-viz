// The levels message (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 3; the rules: docs/BEAT_RELAY_PROTOCOL.md). The
// conductor listens to the music; it publishes what audio-in's energy holds, 30 times a second, so a scene in OBS's
// browser (no audio input there) runs its no-beat effects with ?audio=shared. For INTENSITY ONLY: no page works out
// tempo, phase or the bar from levels or kicks (the owner's call B, 23 Nov; the off-beat bass problem, #188).
//   { type: 'levels', v: 1, t, broadband, low, bands: [8 x 0..1, audio-in's BANDS order], kicks: [{ t, vel }],
//     phase, side }
//   t: the conductor's wall time (performance.timeOrigin + performance.now(), ms) of the reading. Each kick carries
//   its own wall time, so a scene ages it from when it happened, never from when the message arrived. kicks: the
//   low-band onsets of the last KICK_KEEP_MS (a kick is in several messages; receivers keep each t once). phase / side:
//   the conductor's own beat phase and side, as it chose them (NaN when it has none); carried for the record, never
//   for a scene's beat (the clock messages carry the beat).
// On the socket a levels message is one BINARY frame (VIZ research note 4), little-endian:
//   u8 'L' (0x4c), u8 version 1, u8 kick count n (0-8), u8 0, f64 t, f32 broadband, f32 low, f32 phase, f32 side,
//   8 x f32 bands, then n x (f64 kick t, f32 vel)  -> 60 + 12 n bytes. On the BroadcastChannel it is the object.
//   LevelsLib.encode(msg) -> ArrayBuffer; decode(buffer) -> msg | null; RATE_HZ 30
//   LevelsLib.createMeter({ ctx, node, epochNow }) -> { sample(extra) -> msg }: an analyser on the conductor's input
//     node (bands as audio-in's bandLevels), broadband = their mean, low = mean(sub, kick), low-band onsets as kicks
(function (root) {
  'use strict';
  const MAGIC = 0x4c, VERSION = 1, BANDS = 8, MAX_KICKS = 8, HEAD = 60, KICK_BYTES = 12;
  const RATE_HZ = 30, KICK_KEEP_MS = 400;
  const EDGES = [20, 60, 120, 250, 500, 2000, 4000, 8000, 16000], DB_FLOOR = -90, DB_SPAN = 70;
  const num = x => (Number.isFinite(x) ? x : NaN);

  function encode(m) {
    const kicks = Array.isArray(m && m.kicks) ? m.kicks.filter(k => k && Number.isFinite(k.t)).slice(-MAX_KICKS) : [];
    const buf = new ArrayBuffer(HEAD + KICK_BYTES * kicks.length), dv = new DataView(buf);
    dv.setUint8(0, MAGIC); dv.setUint8(1, VERSION); dv.setUint8(2, kicks.length); dv.setUint8(3, 0);
    dv.setFloat64(4, num(m.t), true);
    dv.setFloat32(12, num(m.broadband), true); dv.setFloat32(16, num(m.low), true);
    dv.setFloat32(20, num(m.phase), true); dv.setFloat32(24, num(m.side), true);
    for (let i = 0; i < BANDS; i++) dv.setFloat32(28 + 4 * i, num(m.bands && m.bands[i]), true);
    kicks.forEach((k, i) => { dv.setFloat64(HEAD + KICK_BYTES * i, k.t, true); dv.setFloat32(HEAD + KICK_BYTES * i + 8, num(k.vel), true); });
    return buf;
  }
  function decode(buf) {
    let dv;
    try {
      const ab = buf instanceof ArrayBuffer ? buf : buf && buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : null;
      if (!ab || ab.byteLength < HEAD) return null;
      dv = new DataView(ab);
    } catch (e) { return null; }
    if (dv.getUint8(0) !== MAGIC || dv.getUint8(1) !== VERSION) return null;
    const n = dv.getUint8(2);
    if (n > MAX_KICKS || dv.byteLength !== HEAD + KICK_BYTES * n) return null;
    const m = { type: 'levels', v: 1, t: dv.getFloat64(4, true), broadband: dv.getFloat32(12, true), low: dv.getFloat32(16, true),
      phase: dv.getFloat32(20, true), side: dv.getFloat32(24, true), bands: [], kicks: [] };
    for (let i = 0; i < BANDS; i++) m.bands.push(dv.getFloat32(28 + 4 * i, true));
    for (let i = 0; i < n; i++) m.kicks.push({ t: dv.getFloat64(HEAD + KICK_BYTES * i, true), vel: dv.getFloat32(HEAD + KICK_BYTES * i + 8, true) });
    if (!Number.isFinite(m.t)) return null;
    return m;
  }

  // the 8 band levels 0..1 from a dB spectrum (audio-in's bandLevels, so the numbers are the same)
  function bandsOf(db, sampleRate) {
    const n = db.length, hzPerBin = sampleRate / 2 / n, out = [];
    for (let i = 0; i < BANDS; i++) {
      const a = Math.max(1, Math.floor(EDGES[i] / hzPerBin)), b = Math.min(n - 1, Math.ceil(EDGES[i + 1] / hzPerBin));
      let s = 0, c = 0;
      for (let k = a; k <= b; k++) { const v = db[k]; s += Number.isFinite(v) ? v : DB_FLOOR; c++; }
      out.push(c ? Math.max(0, Math.min(1, ((s / c) - DB_FLOOR) / DB_SPAN)) : 0);
    }
    return out;
  }
  // low-band onsets (audio-in's onset rule: positive flux over a running mean + 1.5 sigma, 100 ms apart)
  function onsets() {
    return { prev: 0, mean: 0, varr: 0.0004, last: -1e9,
      step(level, t) {
        const flux = Math.max(0, level - this.prev); this.prev = level;
        const thr = this.mean + 1.5 * Math.sqrt(this.varr) + 0.02, k = 0.03;
        this.mean += k * (flux - this.mean); this.varr += k * ((flux - this.mean) ** 2 - this.varr);
        if (flux > thr && t - this.last >= 0.1) { this.last = t; return Math.max(0.3, Math.min(1, flux / (thr * 2))); }
        return 0;
      } };
  }
  function createMeter({ ctx, node, epochNow, fftSize = 2048 } = {}) {
    const wall = epochNow || (() => (root.performance ? (root.performance.timeOrigin || 0) + root.performance.now() : Date.now()));
    const an = ctx.createAnalyser(); an.fftSize = fftSize; an.smoothingTimeConstant = 0.5;
    if (node) node.connect(an);
    const db = new Float32Array(an.frequencyBinCount), det = onsets(), kicks = [];
    return {
      analyser: an,
      sample(extra) {
        an.getFloatFrequencyData(db);
        const bands = bandsOf(db, ctx.sampleRate), t = wall(), at = ctx.currentTime;
        const low = (bands[0] + bands[1]) / 2, vel = det.step(low, at);
        if (vel > 0) kicks.push({ t: t - Math.max(0, (ctx.currentTime - at) * 1000), vel });
        while (kicks.length && t - kicks[0].t > KICK_KEEP_MS) kicks.shift();
        const e = extra || {};
        return { type: 'levels', v: 1, t, broadband: bands.reduce((s, x) => s + x, 0) / BANDS, low, bands, kicks: kicks.slice(),
          phase: Number.isFinite(e.phase) ? e.phase : NaN, side: Number.isFinite(e.side) ? e.side : NaN };
      },
      disconnect() { try { if (node) node.disconnect(an); } catch (e) { /* gone */ } },
    };
  }

  const api = { MAGIC, VERSION, RATE_HZ, KICK_KEEP_MS, MAX_KICKS, encode, decode, bandsOf, createMeter };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LevelsLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
