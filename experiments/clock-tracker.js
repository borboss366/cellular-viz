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
//     current tempo, EMA 0.7/0.3, re-estimated at ~6 Hz. Free-run keeps lastConfidentBpm. The chosen lag's
//     non-octave relatives (4/3, 3/2, 2/3, 3/4) are scored by ACF x prior x onset concentration (#188 fix a, the 4:3
//     lock). An octave hold (x2 / /2) also releases on evidence: the estimate as heard >= 0.75 octave away for > 2 s
//     (a hold slower than the estimate also needs its grid to split the onsets); the model then moves to that octave
//     (#188 fix c).
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
//   - two onset lanes (3c, #173): the broadband flux and the low-band flux (< 150 Hz), each with its own threshold,
//     floor and refractory. Timing is broadband's alone (reviewer fix, 2 Nov): the tempo, the PLL, the confidence and
//     the strength reference (mx and strongRef: only onsets inside the ±¼-beat window around the model's beat, while
//     acquiring around the snapped phase) come from broadband onsets. The low lane only chooses the beat side: its
//     weighted mean phase since the acquisition began snaps the first lock. No side moves while locked; fix('flip')
//     moves half a beat by hand. snapshot().lane: R and R at half the period per lane, the side, the last locked stats.
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
    laneBeats: 8, laneMinOnsets: 4,
    // non-octave relatives (#188 6766497000 fix a): the chosen lag's 4/3, 3/2, 2/3 and 3/4 tempos are scored with the
    // ACF, the prior and the onset concentration R at that period (relSecs of broadband onsets); one wins only by
    // relMargin and relMinGain of R. The octaves stay with the half-lag override and the hysteresis.
    relRatios: [4 / 3, 3 / 2, 2 / 3, 3 / 4], relMargin: 1.2, relMinGain: 0.1, relSecs: 8,
    // VIZ research's ruling on the #214 box run (10 Nov): relatives only from a trusted base (conf >= lockConf and the
    // current tempo's R >= relMinR0; at R 0.1 the base itself is in doubt), and while locked a tempo more than tempoTol
    // off must hold (within tempoTol of itself) for tempoHoldN estimates (~2 s at 6 Hz) before it replaces bpm
    relMinR0: 0.2, tempoTol: 0.03, tempoHoldN: 12,
    // VIZ research's ruling on de9b83b (10 Nov): (1) a home tempo, trustedBpm = bpm while conf >= lockConf and R there
    // >= trustR; a candidate within trustTol of it lands on the first estimate (leaving a good tempo stays slow, coming
    // back is immediate). (2) relatives gated on the destination, not the origin: R(candidate) >= relMinR and >= R0 +
    // relMinGainR (replacing relMinR0 and relMinGain); at most one relative move per relEverySecs, its phase re-acquired
    // at the next bar line (jump kind 'relative')
    trustR: 0.3, trustTol: 0.01, relMinR: 0.25, relMinGainR: 0.15, relEverySecs: 8,
    // the octave hold's evidence release (fix c, the user's ruling 10 Nov 14:57): the estimate is >= holdOct octaves from
    // the hold for > holdSecs, and, only when the hold is SLOWER than the estimate, R at the hold < holdFast x R there.
    // A hold faster than the estimate needs the distance alone (holdSlow is logged as support). Then the hold goes and
    // the model moves to the estimate's octave
    holdOct: 0.75, holdSlow: 0.8, holdFast: 0.6, holdSecs: 2,
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
    const lowBins = Math.max(2, Math.ceil(150 / hz));   // bins 1 … < 150 Hz: the low lane's flux (3c)
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
        if (k >= 1 && k < lowBins && !first) low += Math.max(0, c - prev[k]);   // the kick's own band
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
    // onset lanes (3c): each keeps its frames (time, flux, threshold) and onsets, trimmed to the longest window, and
    // picks onsets from its own flux (broad: frame.flux, low: frame.low); the tempo autocorrelation reads broad's
    const mkLane = name => ({ name, ft: [], fv: [], fthr: [], peakEnv: 0, lastOnsetT: -1e9, onsets: [] });
    const lanes = { broad: mkLane('broad'), low: mkLane('low') };
    const fv = lanes.broad.fv;
    let dtHop = 512 / 44100, lastT = null, lastEst = -1e9;
    // the tracker's own model: beats(t) = B0 + (t − T0) / P; pending = phase correction still to slew (beats)
    const own = { T0: 0, B0: 0, P: 0, pending: 0 };
    let bpm = 0, conf = 0, state = 'acquire', everLocked = false, lastConfidentBpm = 0, bigCount = 0;
    let lastInWindow = -1e9, barOrigin = 0, reacq = [], scheduled = null, strongRef = 0;
    // the output: own (plus an integer relabel) or, after a tap, the tap model until the tracker overrides it
    let tapModel = null, outOffset = 0, disagreeSince = null;
    const jumps = [], stateLog = [];
    let octaveLock = null, lockOutSince = null, holdOutSince = null;
    const notes = [];
    let relCount = 0, relLast = null;   // fix (a): how often a non-octave relative replaced the ACF's choice, and the last
    let relEval = null, holdEval = null;
    let pend = null, tempoHold = null, tempoMoves = 0;   // ruling (i): the pending tempo while locked, its last state, moves
    let trustedBpm = null, trustedAt = null, homeReturns = 0;   // ruling (1): the home tempo
    let relPick = null, relLandT = null, relMoves = 0;   // ruling (2): the last relative pick, the last landed move
    const relEvals = [], relStats = { n: 0, closest: 0, closestAt: null };

    const ownBeats = t => own.B0 + (t - own.T0) / own.P;
    const tapBeats = t => tapModel.B0 + (t - tapModel.T0) / tapModel.P;
    const outBeats = t => !own.P ? 0 : tapModel ? tapBeats(t) : ownBeats(t) + outOffset;
    function setState(s, t) { if (s !== state) { state = s; stateLog.push({ t, state: s }); if (s === 'locked') laneHold = false; } }

    // ---- timing on broadband, the beat side from the low lane (3c reviewer fix, 2 Nov evening; #173)
    // The low lane hears a kick later than broadband (its flux peaks with the kick's body): steering on it put every
    // Sandstorm hit 45–80 ms late (viz-183-11/12), and measuring that lag (27097f7, 38c4db0) only patched it. Now the
    // timing is broadband's alone: the PLL, the confidence and the strength reference use broadband onsets inside the
    // ±¼-beat window around the model's beat, so the kick competes with kicks, not with the off-beat stab. The low lane
    // only says which side of the beat the kick is on: its weighted mean phase (all its onsets since acquisition began)
    // snaps the first lock. While acquiring, the confidence counts only broadband onsets within ±¼ beat of that snapped
    // phase, so the off-beat hats neither lower it nor pull the lock (viz-183-15: the lock followed the loud off-beat;
    // test 89 never locked). No side moves while locked (viz-183-10: a locked move flipped Sandstorm onto the off-beat);
    // fix('flip') is the hand fix. ANALYSIS_DELAY_MS stays the one delay.
    const lane = 'broad';   // the steering lane: always broadband (kept in the report for continuity)
    let laneHold = false;
    const laneLog = [], laneLast = { broad: { R: null, R2: null, n: 0, phase: null }, low: { R: null, R2: null, n: 0, phase: null } };
    const laneAcc = { broad: 0, low: 0, n: 0 };   // mean R per lane while locked (the run's report)
    const r3 = x => x === null || x === undefined ? null : +x.toFixed(3);
    // amplitude-weighted circular resultant of a lane's onsets over the last laneBeats beats at the tracked period
    // (a few loud kicks outweigh many soft hats): R 1 = every onset on one phase, 0 = spread; R2 = the same at half the
    // period (two streams half a beat apart: R low, R2 high); phase = the mean onset phase in beats (0 = the tracked
    // beat, ±0.5 = the off-beat); on / off = the onset weight within ¼ beat of the beat / of the off-beat side
    function laneStat(ln, t, since = null) {
      const from = since !== null ? since : t - C.laneBeats * own.P;
      let c = 0, s = 0, c2 = 0, s2 = 0, w = 0, n = 0, on = 0, off = 0;
      for (let i = ln.onsets.length - 1; i >= 0 && ln.onsets[i].t > from; i--) {
        const o = ln.onsets[i], b = ownBeats(o.t), th = 2 * Math.PI * b;
        c += o.s * Math.cos(th); s += o.s * Math.sin(th); c2 += o.s * Math.cos(2 * th); s2 += o.s * Math.sin(2 * th); w += o.s; n++;
        if (Math.abs(frac(b)) <= 0.25) on += o.s; else off += o.s;
      }
      if (n < C.laneMinOnsets || !(w > 0)) return { R: null, R2: null, n, phase: null, on, off };
      return { R: Math.hypot(c, s) / w, R2: Math.hypot(c2, s2) / w, n, phase: Math.atan2(s, c) / (2 * Math.PI), on, off };
    }
    let laneReadyAt = null;   // the first lock waits for the low lane's side at most until then
    function laneTick(t) {
      if (!own.P) return;
      if (laneReadyAt === null) laneReadyAt = t + C.laneBeats * own.P;
      const b = laneStat(lanes.broad, t), l = laneStat(lanes.low, t);
      laneLast.broad = b; laneLast.low = l;
      if (b.R !== null && l.R !== null && state === 'locked') { laneAcc.broad += b.R; laneAcc.low += l.R; laneAcc.n++; laneLocked = { t: +t.toFixed(3), broad: b, low: l }; }
      if (state === 'locked') sideTick(t, l);
    }
    let laneLocked = null;   // the last lane stats while locked (the snapshot is read after the music, in free-run)
    let acqSince = null;     // when the first acquisition began: the low lane's evidence for the first lock runs from here
    // The beat side (0 or ½) from the low lane: the kick owns the low band, so even when an off-beat bass makes the low
    // lane's R small (Sandstorm ≈ 0.1–0.4), its weight near the beat vs near the off-beat says where the kick is.
    let sideOffset = 0, sideSince = null, sideLast = null, sideAtLock = null, sideHand = false;
    const sideLog = [];
    function sideMoveNeeded(l) { return l && l.R !== null && Math.abs(l.phase) > 0.25 && l.off > l.on; }
    function sideAt(t, l, why) {   // the side moves half a beat (forward: beats never run back)
      sideLog.push({ t: +t.toFixed(3), why, phase: r3(l.phase), R: r3(l.R), on: r3(l.on), off: r3(l.off), n: l.n });
      notes.push({ t, kind: 'side', why, phase: l.phase, R: l.R });
      sideSince = null;
    }
    // while locked the side is only measured (snapshot().lane.side.last), never moved
    function sideTick(t, l) {
      if (l.R !== null) sideLast = { t: +t.toFixed(3), phase: r3(l.phase), R: r3(l.R), R2: r3(l.R2), on: r3(l.on), off: r3(l.off), n: l.n };
    }
    // the first lock: the low lane's side over everything it heard since acquisition began, silently (nothing booked)
    function sideAtFirstLock(t) {
      const l = laneStat(lanes.low, t, acqSince);
      sideAtLock = l.R === null ? 'no R' : { phase: r3(l.phase), R: r3(l.R), on: r3(l.on), off: r3(l.off), n: l.n };
      if (sideMoveNeeded(l) && !tapModel) { sideAt(t, l, 'first lock'); own.B0 += 0.5; own.pending = 0; sideOffset = sideOffset ? 0 : 0.5; }
    }
    function laneReport() {
      const j0 = jumps.length ? jumps[0].at : null, st = x => ({ R: r3(x.R), R2: r3(x.R2), n: x.n, phase: r3(x.phase), on: r3(x.on), off: r3(x.off) });
      return { lane, R: { broad: r3(laneLast.broad.R), low: r3(laneLast.low.R) }, R2: { broad: r3(laneLast.broad.R2), low: r3(laneLast.low.R2) },
        n: { broad: laneLast.broad.n, low: laneLast.low.n }, phase: { broad: r3(laneLast.broad.phase), low: r3(laneLast.low.phase) },
        broad: st(laneLast.broad), low: st(laneLast.low),
        Rmean: laneAcc.n ? { broad: r3(laneAcc.broad / laneAcc.n), low: r3(laneAcc.low / laneAcc.n) } : null,
        locked: laneLocked ? { t: laneLocked.t, broad: st(laneLocked.broad), low: st(laneLocked.low) } : null,
        switches: laneLog.slice(-8), side: { offset: sideOffset, hand: sideHand, moves: sideLog.slice(-4), atLock: sideAtLock, last: sideLast, pendingSince: sideSince === null ? null : +sideSince.toFixed(3) },
        jumps: jumps.slice(-8).map(j => `${j.kind}@${j.at.toFixed(2)}${j.origin ? ' ' + j.origin : ''}`),
        afterJump: j0 === null ? [] : stateLog.filter(s => s.t >= j0).slice(0, 16).map(s => `${s.state}@${s.t.toFixed(2)}`) };
    }
    function logJump(t, kind, from, to, origin) { const j = { type: 'jump', at: t, kind, fromBeats: from, toBeats: to }; if (origin) j.origin = origin; jumps.push(j); return j; }
    function setPeriod(m, P, t) { if (m.P) { m.B0 = m.B0 + (t - m.T0) / m.P; m.T0 = t; } m.P = P; }
    const nextBarLine = b => barOrigin + C.bpb * (Math.floor((b - barOrigin) / C.bpb + 1e-9) + 1);

    // ---- tempo
    function prior(b) { const o = Math.log2(b / C.priorBpm) / C.priorOct; return Math.exp(-0.5 * o * o); }
    // onset concentration at a period, independent of the model's phase: the amplitude-weighted circular resultant of
    // the broadband onsets of the last secs at period P (1 = every onset on one phase of P, 0 = spread); null when
    // fewer than 2 x laneMinOnsets onsets
    function periodR(P, t, secs) {
      const ons = lanes.broad.onsets;
      let c = 0, s = 0, w = 0, n = 0;
      for (let i = ons.length - 1; i >= 0 && ons[i].t > t - secs; i--) {
        const th = 2 * Math.PI * ons[i].t / P;
        c += ons[i].s * Math.cos(th); s += ons[i].s * Math.sin(th); w += ons[i].s; n++;
      }
      return n < 2 * C.laneMinOnsets || !(w > 0) ? null : Math.hypot(c, s) / w;
    }
    // fix (a), the 4:3 lock (#188 6766497000): the ACF peak and the half-lag override only ever weigh octave relatives,
    // so a comb at 3/4 of the beat (a dotted-eighth riff, off-beat eighths) could win and then confirm itself in the
    // refine and drift steps. Score the chosen lag's non-octave relatives by ACF x prior x periodR and keep the best.
    const acfAt = (r, L, Lmin, Lmax) => { const i = Math.round(L); return i < Lmin || i > Lmax ? null : Math.max(r[i - 1], r[i], r[i + 1]); };
    // every estimate's evaluation is kept (relEval, the last relEvals) so a miss shows how close it came: the ACF's
    // choice and each relative with its score and R; `ratio` = the best relative's score / the choice's (a switch needs
    // > relMargin and R >= the choice's R + relMinGain). relStats keeps the run's closest call.
    function relativeLag(Lf, r, Lmin, Lmax, t) {
      const b0 = 60 / (Lf * dtHop), a0 = acfAt(r, Lf, Lmin, Lmax), R0 = periodR(60 / b0, t, C.relSecs);
      if (R0 === null || !(a0 > 0)) return Lf;
      // ruling (2): the gate is on the destination (R(candidate) >= relMinR and >= R0 + relMinGainR), not on the origin.
      // A relative that only confirms the current tempo (within tempoTol of bpm) is always allowed; one that moves away
      // from it waits relEverySecs after the last landed relative move.
      const rated = relLandT !== null && t - relLandT < C.relEverySecs;
      const s0 = a0 * prior(b0) * R0, cands = [];
      let bestL = Lf, bestS = s0 * C.relMargin, bestK = 1, bestR = R0, topRatio = 0, topK = null, blocked = null;
      for (const k of C.relRatios) {
        const b = b0 * k;
        if (b < C.minBpm || b > C.maxBpm) continue;
        const a = acfAt(r, Lf / k, Lmin, Lmax), R = periodR(60 / b, t, C.relSecs);
        if (!(a > 0) || R === null) { cands.push({ k: r3(k), bpm: +b.toFixed(2), score: null, R: r3(R) }); continue; }
        const sc = a * prior(b) * R;
        cands.push({ k: r3(k), bpm: +b.toFixed(2), score: r3(sc), R: r3(R), ratio: r3(sc / s0), rGain: r3(R - R0) });
        if (sc / s0 > topRatio) { topRatio = sc / s0; topK = k; }
        if (R < C.relMinR || R < R0 + C.relMinGainR) continue;
        if (sc <= bestS) continue;
        if (rated && bpm && Math.abs(b / bpm - 1) > C.tempoTol) { blocked = 'rate'; continue; }
        bestS = sc; bestL = Lf / k; bestK = k; bestR = R;
      }
      if (blocked) relStats.skipped = (relStats.skipped || 0) + 1;
      relEval = { t: +t.toFixed(3), choice: { bpm: +b0.toFixed(2), score: r3(s0), R: r3(R0) }, conf: r3(conf), cands, picked: r3(bestK), ...(blocked ? { skipped: blocked } : {}) };
      relEvals.push(relEval); if (relEvals.length > 16) relEvals.shift();
      relStats.n++;
      if (bestK === 1 && topRatio > relStats.closest) relStats.closest = r3(topRatio), relStats.closestAt = { t: +t.toFixed(3), from: +b0.toFixed(2), k: r3(topK) };
      if (bestK !== 1) {
        relCount++; relPick = { t, to: b0 * bestK };
        relLast = { t: +t.toFixed(3), from: +b0.toFixed(2), to: +(b0 * bestK).toFixed(2), R0: r3(R0), R: r3(bestR), score0: r3(s0), score: r3(bestS) };
      }
      return bestL;
    }
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
      Lf = relativeLag(Lf, r, Lmin, Lmax, t);   // fix (a): a non-octave relative with clearly better onset support
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
      const onsets = lanes[lane].onsets;   // the steering lane's
      for (let i = onsets.length - 1; i >= 0 && onsets[i].t > t - secs; i--) mx = Math.max(mx, onsets[i].s);
      return onsets.filter(o => o.t > t - secs && o.s >= C.strongRel * mx);
    }
    // fix (c) (#188 6766497000): the old release below tests the estimate after the fold into the hold's octave, so a
    // hold whole octaves wrong reads ratio ~1 and never goes. This one reads the estimate as heard (before the
    // hysteresis and the fold) and asks the onsets: the estimate's octave must explain them at least as well. A hold
    // the estimator merely disagrees with (the reason a hold exists: 81 stomp-clap read at 162, held at 81) keeps.
    // holdEval (snapshot().hold.eval) keeps every check's numbers, so a hold that doesn't release shows why
    function holdWrong(est, t) {
      const d = Math.log2(est / octaveLock);
      const Rh = periodR(60 / octaveLock, t, C.relSecs), Re = periodR(60 / est, t, C.relSecs);
      let wrong = false;
      // the user's ruling (10 Nov 14:57, VIZ research): a hold FASTER than the estimate (the estimate slower, e.g. a
      // wrong x2) releases on distance alone, >= holdOct octaves for > holdSecs; the half-period signature (every onset
      // also on the slower grid, Rest >= 0.8 Rhold) is logged as support, not required. A hold SLOWER than the estimate
      // keeps the R bar: the hold's grid must split the onsets (Rhold < 0.6 Rest), so a right /2 survives an estimator
      // that reads double (81 stomp-clap).
      const support = Rh !== null && Re !== null ? Re >= C.holdSlow * Rh : null;
      if (Math.abs(d) >= C.holdOct) wrong = d < 0 ? true : (Rh !== null && Re !== null && Rh < C.holdFast * Re);
      holdEval = { t: +t.toFixed(3), lock: +octaveLock.toFixed(2), est: +est.toFixed(2), oct: r3(d), Rhold: r3(Rh), Rest: r3(Re),
        test: d < 0 ? 'hold faster: distance >= 0.75 octave (support: Rest >= 0.8 Rhold)' : 'hold slower: Rhold < 0.6 Rest', wrong,
        ...(d < 0 ? { support } : {}),
        accS: wrong && holdOutSince !== null ? +(t - holdOutSince).toFixed(3) : 0 };
      return wrong;
    }
    function releaseHold(est, t) {
      const f = bpm ? Math.pow(2, Math.round(Math.log2(est / bpm))) : 1;
      notes.push({ t, kind: 'octave-release', why: 'evidence', lock: octaveLock, raw: est });
      octaveLock = null; lockOutSince = null; holdOutSince = null;
      if (f === 1 || !own.P) return;
      setPeriod(own, own.P / f, t);
      bpm = 60 / own.P; bigCount = 0; pend = null; recent.length = 0;
      if (tapModel) { setPeriod(tapModel, tapModel.P / f, t); return; }   // a tap owns the output's phase
      rephase(t, 'octave');
    }
    // after a tempo move the model's beat is re-acquired: the beat side at the new period from the low lane's mean phase
    // (the kick), broadband's without one; the re-acquire rule (R1) books it
    function rephase(t, kind) {
      if (tapModel) return;   // a tap owns the output's phase
      let st = laneStat(lanes.low, t);
      if (st.R === null) st = laneStat(lanes.broad, t);
      if (st.R === null) return;
      // the re-acquire rule (R1): |e| <= 1/4 beat slews under the 3 % rule; more is booked at the next bar line as
      // jump { kind }, forward only (beats never run back): -e when that is forward, else 1 - e
      const e = frac(st.phase + own.pending);
      if (Math.abs(e) <= C.trackWindow) { own.pending -= e; return; }
      if (scheduled) return;   // a bar-line jump is already due; the PLL and the next acquisition handle the rest
      scheduled = { kind, delta: e > 0 ? 1 - e : -e, atBeat: nextBarLine(outBeats(t)) };
      lastInWindow = t;
    }
    function applyTempo(raw, t) {
      if (!raw || !isFinite(raw)) return;
      const est = raw;   // as heard: before the hysteresis and the hold's fold
      if (octaveLock) {
        if (holdWrong(est, t)) {
          if (holdOutSince === null) holdOutSince = t;
          else if (t - holdOutSince > C.holdSecs) { releaseHold(est, t); return; }
        } else holdOutSince = null;
      }
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
      const dev = Math.abs(raw - bpm) / bpm;
      let moved = false;
      if (state === 'locked' && dev > C.tempoTol) {
        if (trustedBpm && Math.abs(raw / trustedBpm - 1) <= C.trustTol) {
          // ruling (1): back to the home tempo on the first estimate
          bpm = raw; pend = null; bigCount = 0; tempoMoves++; homeReturns++; moved = true;
          tempoHold = { t: +t.toFixed(3), cand: +raw.toFixed(2), n: 1, home: +trustedBpm.toFixed(2) };
        } else {
          // locked (ruling i): a new tempo replaces bpm only after tempoHoldN estimates agreeing with each other within
          // tempoTol (~2 s); a scatter (110, 141, 179 on Sandstorm) keeps restarting the count and never lands
          if (pend && Math.abs(raw / pend.bpm - 1) <= C.tempoTol) { pend.n++; pend.bpm = 0.7 * pend.bpm + 0.3 * raw; }
          else pend = { bpm: raw, n: 1, since: t };
          tempoHold = { t: +t.toFixed(3), bpm: +bpm.toFixed(2), cand: +pend.bpm.toFixed(2), n: pend.n, since: +pend.since.toFixed(3) };
          if (pend.n < C.tempoHoldN) return;
          bpm = pend.bpm; pend = null; bigCount = 0; tempoMoves++; moved = true;
        }
      }
      else if (dev > 0.1) { pend = null; if (++bigCount < 6) return; bpm = raw; moved = true; }   // not locked: a real change holds for ~1 s
      else { bigCount = 0; pend = null; bpm = 0.7 * bpm + 0.3 * raw; }
      setPeriod(own, 60 / bpm, t);
      // ruling (2): a tempo move that lands a fresh relative pick re-acquires the phase at the next bar line
      if (moved && state === 'locked' && relPick && t - relPick.t <= 3 && Math.abs(bpm / relPick.to - 1) <= C.tempoTol) { relLandT = t; relMoves++; relPick = null; rephase(t, 'relative'); }
      // ruling (1): the home tempo, while the lock is good and the onsets sit on it
      if (state === 'locked' && conf >= C.lockConf) {
        const R = periodR(60 / bpm, t, C.relSecs);
        if (R !== null && R >= C.trustR) { trustedBpm = bpm; trustedAt = t; }
      }
    }

    // ---- phase
    function onOnset(to, s) {   // a broadband onset (lanes.broad.onsets already holds it)
      if (!own.P) return;
      const ons = lanes.broad.onsets;
      const target = ownBeats(to) + own.pending;   // where the model will be once the pending slew is done
      const e = frac(target);
      // The first acquisition: the phase is the low lane's amplitude-weighted mean over everything it heard since the
      // acquisition began (the kick's side), broadband's mean while the low lane has too few onsets. Each broadband onset
      // snaps the model there (nothing is booked yet); only broadband onsets within ±¼ beat of that phase count for the
      // confidence, with the strength reference taken among them, so the off-beat hats neither lower the confidence
      // nor win it (viz-183-15 locked on the hats; test 89 never locked).
      if (state === 'acquire' && !everLocked && !scheduled) {
        if (acqSince === null) acqSince = to;
        let st = laneStat(lanes.low, to, acqSince);
        if (st.R === null) st = laneStat(lanes.broad, to);
        if (st.R !== null) {
          const ea = frac(st.phase + own.pending);
          own.B0 -= ea; own.pending = 0;
          const ce = frac(e - ea);   // this onset against the snapped phase
          if (Math.abs(ce) > C.trackWindow) return;
          let mxIn = 0;
          for (let i = ons.length - 1; i >= 0 && ons[i].t > to - 2; i--) if (Math.abs(frac(ownBeats(ons[i].t))) <= C.trackWindow) mxIn = Math.max(mxIn, ons[i].s);
          if (s < 0.7 * mxIn) return;
          conf = (1 - C.confAlpha) * conf + C.confAlpha * (1 - 2 * Math.abs(ce));
          lastInWindow = to;
          if (conf >= C.lockConf) {
            // the lock waits for the low lane's side (an R), at most laneBeats beats of a known period
            const lowR = laneStat(lanes.low, to, acqSince).R !== null;
            if (!lowR && !tapModel && !(laneReadyAt !== null && to >= laneReadyAt)) return;
            sideAtFirstLock(to);
            everLocked = true; barOrigin = Math.round(ownBeats(to));
            setState('locked', to);
          }
          return;
        }
      }
      // only strong onsets steer: ≥ strongRel of the strongest of the last 2 s (≥ 0.7 while acquiring). While locked
      // the strongest is taken inside the ±¼-beat window around the model's beat only: the kick competes with kicks,
      // not with the off-beat stab (Sandstorm's loud off-beat hats/bass pushed the kicks under the gate)
      let mx = 0;
      for (let i = ons.length - 1; i >= 0 && ons[i].t > to - 2; i--) {
        if (state === 'locked' && Math.abs(frac(ownBeats(ons[i].t) + own.pending)) > C.trackWindow) continue;
        mx = Math.max(mx, ons[i].s);
      }
      if (state !== 'locked' || Math.abs(e) <= C.trackWindow) {
        if (s < (state === 'acquire' ? 0.7 : C.strongRel) * mx) return;
        // ... and never far below the drums the lock was built on (strongRef: in-window locked onsets): a pad-only
        // breakdown's "strongest of the last 2 s" is a pad wobble and would pass the rule above (#178)
        if (strongRef && s < C.refRel * strongRef) return;
      }
      if (state === 'free-run') {   // collect evidence; decide once reacqOnsets strong onsets agree (R1)
        reacq.push(frac(e + sideOffset));   // on the side the low lane chose
        if (reacq.length < C.reacqOnsets) return;
        const em = median(reacq);
        reacq = [];
        if (Math.abs(em) <= C.reacqJump) { own.pending -= em; conf = C.lockConf; lastInWindow = to; setState('locked', to); }
        else { scheduled = { kind: 'acquire', delta: -em, atBeat: nextBarLine(outBeats(to)) }; setState('acquire', to); }
        return;
      }
      if (state === 'acquire') {
        if (scheduled) return;   // a bar-line jump is already decided: wait for it
        // before any lane mean exists, and on re-acquisitions (after a breakdown both means are noise, R1): this onset,
        // on the side the low lane chose at the first lock
        const ea = frac(e + sideOffset);
        if (Math.abs(ea) > C.acqWindow) return;
        conf = (1 - C.confAlpha) * conf + C.confAlpha * (1 - 2 * Math.abs(ea));
        const from = outBeats(to);
        own.B0 -= ea; own.pending = 0;   // gain 1: snap
        if (everLocked && Math.abs(ea) > 1e-6) logJump(to, 'acquire', from, outBeats(to));
        lastInWindow = to;
        if (conf >= C.lockConf) {
          if (!everLocked) {
            // the first lock waits for the low lane's side (an R), at most laneBeats beats of a known period
            const lowR = laneStat(lanes.low, to, acqSince).R !== null;
            if (!lowR && !tapModel && !(laneReadyAt !== null && to >= laneReadyAt)) return;
            sideAtFirstLock(to);
            everLocked = true; barOrigin = Math.round(ownBeats(to));
          }
          setState('locked', to);
        }
        return;
      }
      // locked: steer and update the confidence on broadband in-window onsets only
      if (Math.abs(e) > C.trackWindow) return;
      conf = (1 - C.confAlpha) * conf + C.confAlpha * (1 - 2 * Math.abs(e));
      own.pending -= C.trackGain * e;
      lastInWindow = to;
      strongRef = strongRef ? 0.9 * strongRef + 0.1 * s : s;   // the drums' level, from in-window locked onsets
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
      bpm = 60 / P; estHoldUntil = to + C.acWindow; bigCount = 0; pend = null;
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

    // one lane's onset picking: the frame's value joins the lane's history; an adaptive threshold over the last onsetWin
    // seconds (mean + onsetK sigma), the floor (floorRel of the slow peak envelope) and the refractory decide whether the
    // previous frame was an onset; its time is refined by a parabola. Returns { t, s } or null.
    function detect(ln, t, x, dt) {
      const fv = ln.fv;
      ln.ft.push(t); fv.push(x);
      const nWin = Math.max(4, Math.round(C.onsetWin / dtHop));
      let m = 0, v = 0, c = 0;
      for (let i = Math.max(0, fv.length - nWin); i < fv.length; i++) { m += fv[i]; c++; }
      m /= c;
      for (let i = Math.max(0, fv.length - nWin); i < fv.length; i++) v += (fv[i] - m) ** 2;
      ln.fthr.push(m + C.onsetK * Math.sqrt(v / c));
      ln.peakEnv = Math.max(x, ln.peakEnv * Math.exp(-dt / C.peakTau));
      const keep = Math.round(Math.max(C.acWindow, C.onsetWin) / dtHop) + 8;
      if (fv.length > 2 * keep) { const d = fv.length - keep; ln.ft.splice(0, d); ln.fthr.splice(0, d); fv.splice(0, d); }
      const n = fv.length;
      if (n < 3) return null;
      const a = fv[n - 3], b = fv[n - 2], cc = fv[n - 1], tb = ln.ft[n - 2];
      if (!(b > ln.fthr[n - 2] && b >= a && b > cc && b > C.floorRel * ln.peakEnv && tb - ln.lastOnsetT >= C.refractory)) return null;
      const d2 = a - 2 * b + cc, off = d2 < 0 ? Math.max(-0.5, Math.min(0.5, 0.5 * (a - cc) / d2)) : 0;
      ln.lastOnsetT = tb;
      const o = { t: tb + off * dtHop - delay, s: b };
      ln.onsets.push(o);
      while (ln.onsets.length && ln.onsets[0].t < o.t - Math.max(C.refineWindow, 10)) ln.onsets.shift();
      return o;
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
        else if (scheduled.kind === 'octave' || scheduled.kind === 'relative') { own.B0 += scheduled.delta; own.pending = 0; lastInWindow = t; }   // onto the onsets at the new tempo (fix c, ruling 2)
        else if (scheduled.kind === 'side' || scheduled.kind === 'flip') {   // half a beat forward, the other side
          own.B0 += scheduled.delta; own.pending = 0; lastInWindow = t;
          if (tapModel) { tapModel.B0 += scheduled.delta; tapModel.pending = 0; }
          sideOffset = sideOffset ? 0 : 0.5; strongRef = 0; sideSince = null;
        }
        else { outOffset = Math.round(tapBeats(t) - ownBeats(t)); tapModel = null; disagreeSince = null; }
        logJump(t, scheduled.kind, from, outBeats(t), scheduled.origin);
        scheduled = null;
      }
      // onsets in both lanes; the low lane's only feed the side, broadband's steer
      const ob = detect(lanes.broad, t, f.flux, dt);
      if (f.low !== undefined) detect(lanes.low, t, f.low, dt);
      laneTick(t);
      if (ob) onOnset(ob.t, ob.s);
      // tempo at ~estHz, not in free-run (no drums: keep lastConfidentBpm)
      if (t - lastEst >= 1 / C.estHz && state !== 'free-run' && t - lanes.broad.lastOnsetT < 1.5) { lastEst = t; applyTempo(estimate(t), t); }
      // confidence decays while no onset lands in the window; locked → free-run below lostConf
      // (not while an octave release waits for its bar line: the onsets are known to sit off the window until then)
      if (own.P && t - lastInWindow > 2 * own.P && !(scheduled && (scheduled.kind === 'octave' || scheduled.kind === 'relative'))) conf *= Math.exp(-dt / C.confTau);
      if (state === 'locked' && conf >= C.acqConf) lastConfidentBpm = bpm;
      if (state === 'locked' && conf < C.lostConf) {
        setState('free-run', t); reacq = [];
        if (lastConfidentBpm) { bpm = lastConfidentBpm; setPeriod(own, 60 / bpm, t); }
      }
      // tap escape: the tracker's own model disagrees with the tap for > escapeSecs at high confidence → override
      if (tapModel && !scheduled) {
        const dTempo = Math.abs(tapModel.P / own.P - 1), dPhase = Math.abs(frac(tapBeats(t) - ownBeats(t)));
        if ((dTempo > C.escapeTempo || dPhase > C.escapePhase) && conf >= C.escapeConf && state === 'locked') {
          if (disagreeSince === null) disagreeSince = t;
          else if (t - disagreeSince > C.escapeSecs) scheduled = { kind: 'override', atBeat: nextBarLine(outBeats(t)) };
        } else disagreeSince = null;
      }
    }

    // __qa.tracker / snapshot(): fix (a)'s and fix (c)'s numbers (VIZ research's review of #214)
    const relReport = () => ({ count: relCount, last: relLast, eval: relEval, evals: relEvals.slice(-8), estimates: relStats.n, skipped: relStats.skipped || 0, closest: relStats.closest, closestAt: relStats.closestAt,
      tempoHold, tempoMoves, moves: relMoves, lastMoveT: relLandT === null ? null : +relLandT.toFixed(3),
      home: trustedBpm ? { bpm: +trustedBpm.toFixed(2), at: +trustedAt.toFixed(3), returns: homeReturns } : null });
    const holdReport = () => ({ lock: octaveLock ? +octaveLock.toFixed(2) : null, outSinceS: holdOutSince === null ? null : +holdOutSince.toFixed(3), eval: holdEval,
      releases: notes.filter(n => n.kind === 'octave-release').slice(-4).map(n => ({ t: +n.t.toFixed(3), why: n.why || 'fold', lock: +n.lock.toFixed(2), raw: +n.raw.toFixed(2) })) });
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
      setOctaveLock(b) { octaveLock = b || null; lockOutSince = null; holdOutSince = null; },
      // fix('flip') by hand (clock.js lineFix, Shift + F or the controller): half a beat at the next bar line, logged
      // as jump { kind: 'flip', origin } when it lands. Returns what was scheduled, or null (no model, or a jump is due).
      flip(t, origin = null) {
        if (!own.P || (scheduled && scheduled.kind !== 'side')) return null;
        sideSince = null; sideHand = true;   // from now on the side is the hand's: the side check only measures
        scheduled = { kind: 'flip', delta: 0.5, atBeat: nextBarLine(outBeats(t)), origin };
        return { ...scheduled };
      },
      get scheduled() { return scheduled ? { ...scheduled } : null; },
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
        bpm = 60 / own.P; octaveLock = bpm; lockOutSince = null; holdOutSince = null;
        estHoldUntil = t + C.acWindow; recent.length = 0; bigCount = 0; pend = null;
      },
      // __qa.tracker (#95 SHOULD 8)
      snapshot() {
        return { state, confidence: +conf.toFixed(3), octaveLock: octaveLock ? +octaveLock.toFixed(2) : null,
          bpm: +(tapModel ? 60 / tapModel.P : bpm).toFixed(2), tapped: !!tapModel, lastJump: jumps[jumps.length - 1] || null,
          lane: laneReport(), relative: relReport(), hold: holdReport() };
      },
      get notes() { return notes; }, get relative() { return relReport(); }, get hold() { return holdReport(); }, get octaveLock() { return octaveLock; }, get hasModel() { return !!own.P; },
      get jumps() { return jumps; }, get stateLog() { return stateLog; }, get onsets() { return lanes.broad.onsets; }, get lane() { return lane; }, get laneLog() { return laneLog; }, get sideLog() { return sideLog; }, laneReport,
      get state() { return state; }, get confidence() { return conf; }, get bpm() { return tapModel ? 60 / tapModel.P : bpm; },
      get ownBpm() { return bpm; }, get lastConfidentBpm() { return lastConfidentBpm; }, get tapped() { return !!tapModel; },
      get barOrigin() { return barOrigin; },
    };
  }

  const api = { createAnalyzer, createTracker, fftInPlace, workletUrl, WORKLET_SOURCE, ANALYSIS_DELAY_MS, DEFAULTS, EDGES, BANDS };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClockTracker = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
