// The live beat tracker for ?clock=line: clock PR 3a (#173; docs/CELLULAR_VIZ_BRIEF_TRACKER.md D1, D2, D4; binding
// amendments #95 comment 6560018120). This file holds the analysis and the tracker only. clock.js wires it in as the
// `line` source in 3b (authority table, rebooking, octave lock, __qa.tracker); until then nothing loads it.
//
// Analysis (D1): runs on the audio thread in an AudioWorklet (WORKLET_SOURCE below, a Blob URL, so the QA servers keep
// serving one folder). Mono down-mix, 1024-point FFT with a Hann window, hop 512 (11.6 ms at 44.1 kHz). Per hop it
// posts { t, flux, bands }: t is the AudioContext time of the hop's end, flux the bass-weighted positive log-spectral
// flux over the bins up to ~14.7 kHz (processing-llm's 340 bins at 44.1 kHz), bands the 8 band levels in dB with
// audio-in's EDGES. The same createAnalyzer() runs in node for the tests, so the tests check the worklet's math.
//
// Tracker (D2): processing-llm's estimator and PLL, fed with the posted frames in order. A burst of late messages
// after a blocked frame is processed with each frame's own t, so heavy frames lose nothing.
//   - onsets: flux peaks over mean + 2 σ of the last ~1 s, an absolute floor of 0.15 × the slow peak envelope
//     (pads in a breakdown don't count), refractory 150 ms, sub-hop timing from a parabola through the peak.
//   - tempo: autocorrelation of ~4 s of onset strength over 60–180 BPM, log-normal prior at 120 (σ 0.7 octave),
//     half-lag override at 0.55, parabolic peak, period refined on the onsets of ~8 s, octave hysteresis around the
//     current tempo, EMA 0.7/0.3, re-estimated at ~6 Hz. Free-run keeps lastConfidentBpm.
//   - phase: PLL. Acquire (confidence < 0.4): window ½ beat, gain 1 (a jump). Tracking: window ¼ beat, gain 0.15,
//     applied as a bounded RATE change (≤ 3 % of the beat rate, never a step). Confidence = EMA of 1 − 2|err|; it
//     decays while no onset lands in the window.
//   - re-acquire after free-run (#95 MUST 1, truth R1): |e| ≤ ¼ beat slews under the 3 % rule; |e| > ¼ beat jumps on
//     the next bar line, logged as jump { kind: 'acquire' }.
//   - tap escape (#95 SHOULD 7, truth R5): after tap() the output follows the tap (phase nudged by the PLL, tempo
//     fixed); if the tracker's own model disagrees by > 3 % in tempo or > ¼ beat in phase for > 4 s at confidence
//     ≥ 0.7, the output switches back at the next bar line: jump { kind: 'override' }.
//   - ANALYSIS_DELAY_MS (#95 MUST 3): one constant for every track, subtracted from onset times. This value is a
//     placeholder; 3c measures it on truth (a) (median detected − true onset) and commits it (truth R3).
//
//   const tr = ClockTracker.createTracker();
//   const an = ClockTracker.createAnalyzer({ sampleRate, onFrame: f => tr.push(f) });   // node / tests
//   an.process(monoChunk, tOfFirstSample);
//   tr.read(t) → { beats, bpm, phase, bar, beatInBar, confidence, state, octaveLock, lastJump }
//   tr.beatsAt(t)   tr.tap({ t, bpm })   tr.jumps   tr.stateLog   tr.onsets   tr.state   tr.confidence   tr.bpm
(function (root) {
  'use strict';

  const EDGES = [20, 60, 120, 250, 500, 2000, 4000, 8000, 16000];   // Hz, as audio-in.js
  const BANDS = ['sub', 'kick', 'low', 'lowMid', 'mid', 'upperMid', 'presence', 'air'];
  // the one definition (R3). Measured by 3c's truth run viz-183-1 (2 Nov): raw delay 11.3 ms on truth (a)'s metronome,
  // 12.8–16 ms on the four tracks; 12 keeps truth (a)'s bias near 0 and the tracks' within +1 … +4 ms.
  const ANALYSIS_DELAY_MS = 12;

  const DEFAULTS = {
    minBpm: 60, maxBpm: 180, priorBpm: 120, priorOct: 0.7, halfLag: 0.55,
    acWindow: 4, refineWindow: 8, estHz: 6,
    onsetK: 2, onsetWin: 1, refractory: 0.15, floorRel: 0.15, peakTau: 10, strongRel: 0.4,
    acqConf: 0.4, lockConf: 0.5, lostConf: 0.3, acqWindow: 0.5, trackWindow: 0.25, trackGain: 0.15, driftOnsets: 4, driftMin: 0.02, confAlpha: 0.15,
    confTau: 1.0, maxRate: 0.03, refRel: 0.3, reacqJump: 0.25, reacqOnsets: 3, bpb: 4,
    escapeTempo: 0.03, escapePhase: 0.25, escapeSecs: 4, escapeConf: 0.7,
    offbeatBeats: 8, offbeatWin: 0.12, offbeatRatio: 1.5,
  };

  // ---------------------------------------------------------------- analysis (worklet and node)
  function fftInPlace(re, im) {   // iterative radix-2, n a power of two
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let x = re[i]; re[i] = re[j]; re[j] = x; x = im[i]; im[i] = im[j]; im[j] = x; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }

  // rise probe (truths a/b/c, 3c): the time of the first sample with |x| ≥ riseLevel after ≥ riseQuiet s below
  // riseLevel / 4, to the sample. It needs no window, so it is the waveform's own clock: the QA excerpts start with a
  // marker burst after silence, and truth (a)'s clicks start from silence, so a rise is where the sound truly begins.
  // Frames carry the rises since the previous frame as `rise: [t, …]` (absent when there were none).
  function createAnalyzer({ sampleRate = 44100, fftSize = 1024, hop = 512, maxHz = 14700, onFrame, riseLevel = 0.05, riseQuiet = 0.03 } = {}) {
    const N = fftSize, H = N >> 1, hz = sampleRate / N;
    const win = new Float64Array(N);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const ring = new Float32Array(N), re = new Float64Array(N), im = new Float64Array(N), prev = new Float64Array(H);
    const nBins = Math.max(2, Math.min(H, Math.round(maxHz / hz)));
    const wt = new Float64Array(nBins);
    let wsum = 0;
    for (let k = 0; k < nBins; k++) { const f = k * hz; wt[k] = f < 150 ? 3 : f < 500 ? 1.5 : 1; wsum += wt[k]; }
    const lowBins = Math.max(2, Math.ceil(150 / hz));   // bins 1 … < 150 Hz: the low flux the off-beat check compares
    const ranges = [];
    for (let i = 0; i < 8; i++) ranges.push([Math.max(1, Math.floor(EDGES[i] / hz)), Math.min(H - 1, Math.ceil(EDGES[i + 1] / hz))]);
    let pos = 0, seen = 0, sinceHop = 0, first = true;
    const frames = [], quietNeed = Math.round(riseQuiet * sampleRate), quietLevel = riseLevel / 4;
    // A sound starts with a ramp (a click's attack, the marker's raised-cosine edge) whose first samples sit between
    // riseLevel / 4 and riseLevel: the first sample over riseLevel / 4 after riseQuiet s of quiet arms the probe for 5 ms,
    // and the first sample over riseLevel while armed is the rise (3c: an armed-less version missed every ramp).
    const rampMax = Math.round(0.005 * sampleRate);
    let quiet = 0, armed = 0, rises = null;
    function frame(t) {
      for (let i = 0; i < N; i++) { re[i] = ring[(pos + i) % N] * win[i]; im[i] = 0; }   // oldest sample first
      fftInPlace(re, im);
      let flux = 0, low = 0;
      const bands = {};
      for (let k = 0; k < H; k++) {
        const mag = Math.hypot(re[k], im[k]) / (N / 4);   // a full-scale sine reads ≈ 1
        const c = Math.log1p(100 * mag);
        if (k < nBins && !first) flux += wt[k] * Math.max(0, c - prev[k]);
        if (k >= 1 && k < lowBins && !first) low += Math.max(0, c - prev[k]);   // the kick's own band (beat or off-beat)
        prev[k] = c; re[k] = mag;   // keep the magnitude for the bands
      }
      for (let i = 0; i < 8; i++) {
        const [a, b] = ranges[i];
        let s = 0;
        for (let k = a; k <= b; k++) s += re[k] * re[k];
        bands[BANDS[i]] = 10 * Math.log10(s / Math.max(1, b - a + 1) + 1e-20);
      }
      first = false;
      const f = { t, flux: flux / wsum, low, bands };
      if (rises) { f.rise = rises; rises = null; }
      if (onFrame) onFrame(f); else frames.push(f);
    }
    return {
      sampleRate, fftSize: N, hop, frames,
      // x: mono samples; t0: the time of x[0] (s). Frames come out with t = the time just after their last sample.
      process(x, t0 = 0) {
        for (let i = 0; i < x.length; i++) {
          const ax = x[i] < 0 ? -x[i] : x[i];
          if (ax < quietLevel) { quiet++; if (armed > 0) armed--; }
          else {
            if (quiet >= quietNeed) armed = rampMax; else if (armed > 0) armed--;
            quiet = 0;
            if (ax >= riseLevel) { if (armed > 0) (rises || (rises = [])).push(t0 + i / sampleRate); armed = 0; }
          }
          ring[pos] = x[i]; pos = (pos + 1) % N; seen++; sinceHop++;
          if (seen >= N && sinceHop >= hop) { sinceHop = 0; frame(t0 + (i + 1) / sampleRate); }
        }
      },
    };
  }

  // The AudioWorklet: the same analysis, posting one message per hop ({ t, flux, bands }, t = currentTime of the
  // hop's end). clock.js (3b) loads it with ctx.audioWorklet.addModule(ClockTracker.workletUrl()).
  const WORKLET_SOURCE = `const EDGES = ${JSON.stringify(EDGES)}, BANDS = ${JSON.stringify(BANDS)};
${fftInPlace.toString()}
${createAnalyzer.toString()}
class ClockTrackerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.an = createAnalyzer({ sampleRate, onFrame: f => this.port.postMessage(f) });
    this.mono = new Float32Array(128);
  }
  process(inputs) {
    const ch = inputs[0];
    if (!ch || !ch.length) return true;
    const n = ch[0].length;
    if (this.mono.length !== n) this.mono = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (const c of ch) s += c[i]; this.mono[i] = s / ch.length; }
    this.an.process(this.mono, currentTime);
    return true;
  }
}
registerProcessor('clock-tracker', ClockTrackerProcessor);
`;
  let workletUrlCache = null;
  function workletUrl() {
    if (!workletUrlCache) workletUrlCache = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    return workletUrlCache;
  }

  // ---------------------------------------------------------------- the tracker
  const frac = x => x - Math.round(x);   // signed distance to the nearest integer, −0.5 … 0.5
  const median = a => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

  function createTracker(options = {}) {
    const C = { ...DEFAULTS, ...options };
    const delay = (options.analysisDelayMs ?? ANALYSIS_DELAY_MS) / 1000;
    // history of frames (time, flux, threshold) and onsets; trimmed to the longest window
    const ft = [], fv = [], fthr = [];
    const onsets = [];
    let dtHop = 512 / 44100, lastT = null, lastEst = -1e9, peakEnv = 0, lastOnsetT = -1e9;
    // the tracker's own model: beats(t) = B0 + (t − T0) / P; pending = phase correction still to slew (beats)
    const own = { T0: 0, B0: 0, P: 0, pending: 0 };
    let bpm = 0, conf = 0, state = 'acquire', everLocked = false, lastConfidentBpm = 0, bigCount = 0;
    let lastInWindow = -1e9, barOrigin = 0, reacq = [], scheduled = null, strongRef = 0;
    // the output: own (plus an integer relabel) or, after a tap, the tap model until the tracker overrides it
    let tapModel = null, outOffset = 0, disagreeSince = null;
    const jumps = [], stateLog = [];
    let octaveLock = null, lockOutSince = null;
    const notes = [];

    const ownBeats = t => own.B0 + (t - own.T0) / own.P;
    const tapBeats = t => tapModel.B0 + (t - tapModel.T0) / tapModel.P;
    const outBeats = t => !own.P ? 0 : tapModel ? tapBeats(t) : ownBeats(t) + outOffset;
    function setState(s, t) { if (s !== state) { state = s; stateLog.push({ t, state: s }); if (s !== 'locked') offReset(true); } }

    // Beat or off-beat (3c truth (b), viz-183-1: Sandstorm locked steadily half a beat off, p50 −210 ms at 440 ms a
    // beat). The broadband flux of a trance off-beat (open hat + bass) can beat the kick's, and the PLL holds any phase
    // it acquired. Kicks own the low band, so while locked with the drums in the window, the strongest low-band flux
    // (bins under 150 Hz) near phase 0 and near phase ½ is kept per beat; when the half-beat side holds more than
    // offbeatRatio × the beat side over offbeatBeats beats, the model moves half a beat at the next beat line, logged as
    // jump { kind: 'offbeat' } (it rebooks like any tracker jump). Once per lock: never back and forth.
    const obRing = [];
    let obBeat = null, obCur = null, obDone = false;
    function offReset(all) { obRing.length = 0; obBeat = null; obCur = null; if (all) obDone = false; }
    function offbeatCheck(f, t) {
      if (f.low === undefined || state !== 'locked' || !own.P || scheduled || tapModel || obDone) return;
      const ph = ownBeats(t - delay), k = Math.floor(ph), u = ph - k;
      if (obBeat !== k) {
        if (obCur && t - lastInWindow < 1.5 * own.P) { obRing.push(obCur); if (obRing.length > C.offbeatBeats) obRing.shift(); }
        obBeat = k; obCur = { on: 0, off: 0 };
      }
      if (u < C.offbeatWin || u > 1 - C.offbeatWin) obCur.on = Math.max(obCur.on, f.low);
      else if (Math.abs(u - 0.5) < C.offbeatWin) obCur.off = Math.max(obCur.off, f.low);
      if (obRing.length < C.offbeatBeats) return;
      let on = 0, off = 0;
      for (const b of obRing) { on += b.on; off += b.off; }
      if (off > 0 && off > C.offbeatRatio * on) {
        scheduled = { kind: 'offbeat', delta: 0.5, atBeat: Math.floor(outBeats(t)) + 1 };
        notes.push({ t, kind: 'offbeat', on: +on.toFixed(3), off: +off.toFixed(3) });
        obDone = true; offReset(false);
      }
    }
    function logJump(t, kind, from, to) { const j = { type: 'jump', at: t, kind, fromBeats: from, toBeats: to }; jumps.push(j); return j; }
    function setPeriod(m, P, t) { if (m.P) { m.B0 = m.B0 + (t - m.T0) / m.P; m.T0 = t; } m.P = P; }
    const nextBarLine = b => barOrigin + C.bpb * (Math.floor((b - barOrigin) / C.bpb + 1e-9) + 1);

    // ---- tempo
    function prior(b) { const o = Math.log2(b / C.priorBpm) / C.priorOct; return Math.exp(-0.5 * o * o); }
    function estimate(t) {
      const n = Math.min(fv.length, Math.round(C.acWindow / dtHop));
      const Lmin = Math.floor(60 / C.maxBpm / dtHop), Lmax = Math.ceil(60 / C.minBpm / dtHop);
      if (n < Lmax + 4 || Lmin < 2) return null;
      const x = new Float64Array(n), off = fv.length - n;
      let mean = 0;
      for (let i = 0; i < n; i++) mean += fv[off + i];
      mean /= n;
      for (let i = 0; i < n; i++) x[i] = fv[off + i] - mean;
      const r = new Float64Array(Lmax + 2);
      let r0 = 0;
      for (let i = 0; i < n; i++) r0 += x[i] * x[i];
      if (r0 <= 1e-12) return null;
      for (let L = Lmin - 1; L <= Lmax + 1; L++) {
        let s = 0;
        for (let i = L; i < n; i++) s += x[i] * x[i - L];
        r[L] = s / (n - L) / (r0 / n);
      }
      let best = -1, bestS = -Infinity;
      for (let L = Lmin; L <= Lmax; L++) {
        if (!(r[L] >= r[L - 1] && r[L] >= r[L + 1])) continue;   // local peaks only
        const s = r[L] * prior(60 / (L * dtHop));
        if (s > bestS) { bestS = s; best = L; }
      }
      if (best < 0 || r[best] <= 0) return null;
      const para = L => { const a = r[L - 1], b = r[L], c = r[L + 1], d = a - 2 * b + c; return d < 0 ? L + 0.5 * (a - c) / d : L; };
      let Lf = para(best);
      const h = Math.round(Lf / 2);   // half-lag override: the double tempo if its peak holds ≥ 0.55 of this one
      if (h >= Lmin && h >= 2 && r[h] >= C.halfLag * r[best] && r[h] >= r[h - 1] && r[h] >= r[h + 1]) Lf = para(h);
      let raw = 60 / (Lf * dtHop);
      // refine the period on the onsets of the last refineWindow seconds
      const P0 = 60 / raw, strong = recentStrong(t, C.refineWindow);
      if (strong.length >= 6) {
        const tr = strong[strong.length - 1].t, ks = [], ts = [];
        for (const o of strong) { const k = Math.round((o.t - tr) / P0), res = o.t - tr - k * P0; if (Math.abs(res) < 0.15 * P0) { ks.push(k); ts.push(o.t); } }
        if (ks.length >= 6 && new Set(ks).size >= 4) {
          const mk = ks.reduce((a, b) => a + b, 0) / ks.length, mt = ts.reduce((a, b) => a + b, 0) / ts.length;
          let sxy = 0, sxx = 0;
          for (let i = 0; i < ks.length; i++) { sxy += (ks[i] - mk) * (ts[i] - mt); sxx += (ks[i] - mk) ** 2; }
          const P1 = sxx > 0 ? sxy / sxx : P0;
          if (Math.abs(P1 - P0) / P0 < 0.04) raw = 60 / P1;
        }
      }
      return raw;
    }
    function recentStrong(t, secs) {
      let mx = 0;
      for (let i = onsets.length - 1; i >= 0 && onsets[i].t > t - secs; i--) mx = Math.max(mx, onsets[i].s);
      return onsets.filter(o => o.t > t - secs && o.s >= C.strongRel * mx);
    }
    function applyTempo(raw, t) {
      if (!raw || !isFinite(raw)) return;
      if (bpm) {   // octave hysteresis: ×2 / ÷2 of the current tempo snaps back
        const q = raw / bpm;
        if (Math.abs(q - 2) < 0.12) raw /= 2; else if (Math.abs(q - 0.5) < 0.06) raw *= 2;
      }
      if (octaveLock) {   // ×2 / ÷2 by hand (3b): the estimate is read in the locked octave; it escapes only after it
        // has left that octave by > 20 % for > 4 s (brief D2), e.g. a real tempo change, never a half-tempo estimate
        const f = raw * Math.pow(2, Math.round(Math.log2(octaveLock / raw)));
        if (Math.abs(f / octaveLock - 1) > 0.2) {
          if (lockOutSince === null) lockOutSince = t;
          else if (t - lockOutSince > 4) { notes.push({ t, kind: 'octave-release', lock: octaveLock, raw }); octaveLock = null; lockOutSince = null; }
        } else lockOutSince = null;
        if (octaveLock) raw = f;
      }
      if (!own.P) {   // first estimate: anchor beat 0 on the newest strong onset
        const s = recentStrong(t, 2), o = s[s.length - 1];
        bpm = raw; own.P = 60 / raw; own.T0 = o ? o.t : t; own.B0 = 0;
        return;
      }
      if (t < estHoldUntil) return;   // the drift follower just set the period; the window still holds the old tempo
      if (Math.abs(raw - bpm) / bpm > 0.1) { if (++bigCount < 6) return; bpm = raw; }   // a real change holds for ~1 s
      else { bigCount = 0; bpm = 0.7 * bpm + 0.3 * raw; }
      setPeriod(own, 60 / bpm, t);
    }

    // ---- phase
    function onOnset(to, s) {
      onsets.push({ t: to, s });
      while (onsets.length && onsets[0].t < to - Math.max(C.refineWindow, 10)) onsets.shift();
      if (!own.P) return;
      // only strong onsets steer: ≥ strongRel of the strongest of the last 2 s (≥ 0.7 while acquiring, so an
      // off-beat hat can never pull the first lock half a beat away)
      let mx = 0;
      for (let i = onsets.length - 1; i >= 0 && onsets[i].t > to - 2; i--) mx = Math.max(mx, onsets[i].s);
      if (s < (state === 'acquire' ? 0.7 : C.strongRel) * mx) return;
      // ... and never anything far below the drums the lock was built on: a pad-only breakdown has no drum, so the
      // "strongest of the last 2 s" is a pad wobble (its chord beats at 53–110 Hz) and would pass the rule above,
      // keep the confidence up and then re-acquire on noise (#178: breakdown 0.10/0.20 jumped)
      if (strongRef && s < C.refRel * strongRef) return;
      const target = ownBeats(to) + own.pending;   // where the model will be once the pending slew is done
      const e = frac(target);
      if (state === 'free-run') {   // collect evidence; decide once reacqOnsets strong onsets agree (R1)
        reacq.push(e);
        if (reacq.length < C.reacqOnsets) return;
        const em = median(reacq);
        reacq = [];
        if (Math.abs(em) <= C.reacqJump) { own.pending -= em; conf = C.lockConf; lastInWindow = to; setState('locked', to); }
        else { scheduled = { kind: 'acquire', delta: -em, atBeat: nextBarLine(outBeats(to)) }; setState('acquire', to); }
        return;
      }
      if (state === 'acquire') {
        if (scheduled || Math.abs(e) > C.acqWindow) return;   // a bar-line jump is already decided: wait for it
        conf = (1 - C.confAlpha) * conf + C.confAlpha * (1 - 2 * Math.abs(e));
        const from = outBeats(to);
        own.B0 -= e; own.pending = 0;   // gain 1: snap
        if (everLocked && Math.abs(e) > 1e-6) logJump(to, 'acquire', from, outBeats(to));
        lastInWindow = to;
        if (conf >= C.lockConf) { setState('locked', to); if (!everLocked) { everLocked = true; barOrigin = Math.round(ownBeats(to)); } }
        return;
      }
      if (Math.abs(e) > C.trackWindow) return;
      conf = (1 - C.confAlpha) * conf + C.confAlpha * (1 - 2 * Math.abs(e));
      own.pending -= C.trackGain * e;
      lastInWindow = to;
      if (state === 'locked') strongRef = strongRef ? 0.9 * strongRef + 0.1 * s : s;   // the drums' level, from locked onsets
      drift(to, Math.round(target));
      if (tapModel) {   // the output follows the tap; the PLL only nudges its phase
        const te = frac(tapBeats(to) + tapModel.pending);
        if (Math.abs(te) <= C.trackWindow) tapModel.pending -= C.trackGain * te;
      }
    }

    // Tempo-step follower (#178 test-pr 1: the 120 → 128 step took 18 beats to re-lock, because the 4 s
    // autocorrelation window lags a step by ~4 s while the phase error piles up at 6.7 % a beat). The period seen
    // by the last driftOnsets in-window onsets (a line through onset time vs beat index; independent of the PLL's
    // own corrections) replaces the period at once when it differs by more than driftMin, and the estimator's
    // blend waits one window so the lagging autocorrelation can't pull it back. The phase error already piled up
    // is then slewed under the 3 % rule like any other correction (no step).
    const recent = [];
    let estHoldUntil = -1e9;
    function drift(to, k) {
      if (recent.length && k <= recent[recent.length - 1].k) recent.length = 0;   // a relabel or jump: start over
      recent.push({ t: to, k });
      while (recent.length > C.driftOnsets) recent.shift();
      if (recent.length < C.driftOnsets || recent[recent.length - 1].k - recent[0].k < C.driftOnsets - 1) return;
      const n = recent.length, mk = recent.reduce((a, o) => a + o.k, 0) / n, mt = recent.reduce((a, o) => a + o.t, 0) / n;
      let sxy = 0, sxx = 0;
      for (const o of recent) { sxy += (o.k - mk) * (o.t - mt); sxx += (o.k - mk) ** 2; }
      const P = sxx > 0 ? sxy / sxx : own.P;
      let res = 0;
      for (const o of recent) res = Math.max(res, Math.abs(o.t - (mt + (o.k - mk) * P)));
      if (!(P > 0) || res > 0.1 * P || Math.abs(P / own.P - 1) <= C.driftMin) return;
      setPeriod(own, P, to);
      bpm = 60 / P; estHoldUntil = to + C.acWindow; bigCount = 0;
      const e = frac(ownBeats(to) + own.pending);   // the phase error left at the new period, slewed from here
      own.pending -= e;
      // the window is kept: while it still straddles the step each new onset refines the period again
    }

    function slew(m, dt) {   // apply the pending correction as a rate change of at most maxRate
      if (!m.pending) return;
      const lim = C.maxRate * dt / m.P, step = Math.max(-lim, Math.min(lim, m.pending));
      m.B0 += step; m.pending -= step;
      if (Math.abs(m.pending) < 1e-9) m.pending = 0;
    }

    function push(f) {
      const t = f.t;
      if (lastT !== null) { const d = t - lastT; if (d > 0 && d < 0.1) dtHop = 0.9 * dtHop + 0.1 * d; }
      const dt = lastT === null ? dtHop : Math.max(0, t - lastT);
      lastT = t;
      // slews, then a scheduled bar-line jump
      if (own.P) { slew(own, dt); if (tapModel) slew(tapModel, dt); }
      if (scheduled && own.P && outBeats(t) >= scheduled.atBeat) {
        const from = outBeats(t);
        if (scheduled.kind === 'acquire') { own.B0 += scheduled.delta; own.pending = 0; conf = C.lockConf; lastInWindow = t; setState('locked', t); }
        else if (scheduled.kind === 'offbeat') { own.B0 += scheduled.delta; own.pending = 0; lastInWindow = t; }
        else { outOffset = Math.round(tapBeats(t) - ownBeats(t)); tapModel = null; disagreeSince = null; }
        logJump(t, scheduled.kind, from, outBeats(t));
        scheduled = null;
      }
      // onset strength history and an adaptive threshold over the last onsetWin seconds
      ft.push(t); fv.push(f.flux);
      const nWin = Math.max(4, Math.round(C.onsetWin / dtHop));
      let m = 0, v = 0, c = 0;
      for (let i = Math.max(0, fv.length - nWin); i < fv.length; i++) { m += fv[i]; c++; }
      m /= c;
      for (let i = Math.max(0, fv.length - nWin); i < fv.length; i++) v += (fv[i] - m) ** 2;
      fthr.push(m + C.onsetK * Math.sqrt(v / c));
      peakEnv = Math.max(f.flux, peakEnv * Math.exp(-dt / C.peakTau));
      const keep = Math.round(Math.max(C.acWindow, C.onsetWin) / dtHop) + 8;
      if (fv.length > 2 * keep) { ft.splice(0, fv.length - keep); fthr.splice(0, fv.length - keep); fv.splice(0, fv.length - keep); }
      // the previous frame is an onset if it is a local peak over its threshold and the floor
      const n = fv.length;
      if (n >= 3) {
        const a = fv[n - 3], b = fv[n - 2], cc = fv[n - 1], tb = ft[n - 2];
        if (b > fthr[n - 2] && b >= a && b > cc && b > C.floorRel * peakEnv && tb - lastOnsetT >= C.refractory) {
          const d = a - 2 * b + cc, off = d < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - cc) / d)) : 0;
          const to = tb + off * dtHop - delay;
          lastOnsetT = tb;
          onOnset(to, b);
        }
      }
      // tempo at ~estHz, not in free-run (no drums: keep lastConfidentBpm)
      if (t - lastEst >= 1 / C.estHz && state !== 'free-run' && t - lastOnsetT < 1.5) { lastEst = t; applyTempo(estimate(t), t); }
      // confidence decays while no onset lands in the window; locked → free-run below lostConf
      if (own.P && t - lastInWindow > 2 * own.P) conf *= Math.exp(-dt / C.confTau);
      if (state === 'locked' && conf >= C.acqConf) lastConfidentBpm = bpm;
      if (state === 'locked' && conf < C.lostConf) {
        setState('free-run', t); reacq = [];
        if (lastConfidentBpm) { bpm = lastConfidentBpm; setPeriod(own, 60 / bpm, t); }
      }
      offbeatCheck(f, t);
      // tap escape: the tracker's own model disagrees with the tap for > escapeSecs at high confidence → override
      if (tapModel && !scheduled) {
        const dTempo = Math.abs(tapModel.P / own.P - 1), dPhase = Math.abs(frac(tapBeats(t) - ownBeats(t)));
        if ((dTempo > C.escapeTempo || dPhase > C.escapePhase) && conf >= C.escapeConf && state === 'locked') {
          if (disagreeSince === null) disagreeSince = t;
          else if (t - disagreeSince > C.escapeSecs) scheduled = { kind: 'override', atBeat: nextBarLine(outBeats(t)) };
        } else disagreeSince = null;
      }
    }

    function read(t) {
      const b = outBeats(t), P = tapModel ? tapModel.P : own.P;
      const rel = b - barOrigin, bar = Math.floor(rel / C.bpb);
      return { beats: b, bpm: P ? 60 / P : 0, phase: b - Math.floor(b), bar, beatInBar: Math.floor(rel - bar * C.bpb),
        confidence: conf, state, octaveLock, lastJump: jumps[jumps.length - 1] || null };
    }

    return {
      push, read, beatsAt: outBeats,
      // tap: the output follows a tap of tempo bpm with a beat at t (the tracker only nudges it; R5 tap escape)
      tap({ t, bpm: tb }) {
        const b = Math.round(outBeats(t));
        tapModel = { T0: t, B0: b, P: 60 / tb, pending: 0 };
        disagreeSince = null;
        if (scheduled && scheduled.kind === 'override') scheduled = null;
      },
      setOctaveLock(b) { octaveLock = b || null; lockOutSince = null; },
      // the time at which the output reaches beat b (its current linear model; slews still pending are not in it)
      timeOf(b) {
        if (!own.P) return NaN;
        if (tapModel) return tapModel.T0 + (b - tapModel.B0) * tapModel.P;
        return own.T0 + (b - outOffset - own.B0) * own.P;
      },
      // ×2 / ÷2 by hand: the period changes at t with the beats continuous there, and the octave is locked (D2)
      scaleTempo(f, t) {
        if (!own.P || !(f > 0)) return;
        setPeriod(own, own.P / f, t);
        if (tapModel) setPeriod(tapModel, tapModel.P / f, t);
        bpm = 60 / own.P; octaveLock = bpm; lockOutSince = null;
        estHoldUntil = t + C.acWindow; recent.length = 0; bigCount = 0;
      },
      // __qa.tracker (#95 SHOULD 8)
      snapshot() {
        return { state, confidence: +conf.toFixed(3), octaveLock: octaveLock ? +octaveLock.toFixed(2) : null,
          bpm: +(tapModel ? 60 / tapModel.P : bpm).toFixed(2), tapped: !!tapModel, lastJump: jumps[jumps.length - 1] || null };
      },
      get notes() { return notes; }, get octaveLock() { return octaveLock; }, get hasModel() { return !!own.P; },
      get jumps() { return jumps; }, get stateLog() { return stateLog; }, get onsets() { return onsets; },
      get state() { return state; }, get confidence() { return conf; }, get bpm() { return tapModel ? 60 / tapModel.P : bpm; },
      get ownBpm() { return bpm; }, get lastConfidentBpm() { return lastConfidentBpm; }, get tapped() { return !!tapModel; },
      get barOrigin() { return barOrigin; },
    };
  }

  const api = { createAnalyzer, createTracker, fftInPlace, workletUrl, WORKLET_SOURCE, ANALYSIS_DELAY_MS, DEFAULTS, EDGES, BANDS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockTracker = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
