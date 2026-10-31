// The shared clock (docs/CELLULAR_VIZ_BRIEF_CLOCK.md task 1; names from #95 comment 6519125441).
// One object replaces each page's copied `metronome`. PR 1 holds the core: the metronome source (the code that
// 11, 13 and 19 copied, moved here unchanged), read() with phase/bar/beatInBar, hand commands (fix) logged as
// jumps, and the visual offset. The file: and line sources come in later PRs; until then they fall back to the
// metronome and say so in clock.requested / clock.fallback.
//
//   const metronome = Clock.create({ source: qs.get('clock') || 'metronome', settings });
//   // settings is the page's live object: bpm, bpb, muted and the kick/snare/hat patterns ('x' = hit);
//   // optional swing (0..1 of a 16th, odd 16ths late) and human (± ms of jitter per hit)
//   metronome.start() .stop() .setMuted(m) .latency() .playing .ctx .hits
//   metronome.read()             → { beats, bars, phase, bar, beatInBar, bpm, confidence, kick, snare, hat, level, bands }
//   metronome.read({ raw: true }) → the same, without the visual offset (for analysis and tests)
//   metronome.read(lead)         → 11's form: lead seconds ahead of the heard clock
//   metronome.events             → drum hits only: [{ type: 'hit', lane, time, vel, step }] (the last second)
//   metronome.hitLog             → every hit booked since start(), capped at 4096, never pruned (batch A, #95 6533515449)
//   metronome.hitsDue(lanes)     → hits whose time ≤ now() not handed out yet; each hit is handed out once per clock
//   metronome.jumps              → hand commands: [{ type: 'jump', at, kind, fromBeats, toBeats }]
//   metronome.fix(kind, arg)     → kind: 'nudge' (arg ms, + = clock ahead) | 'x2' | 'half' | 'setOne' | 'reset'
//   metronome.setVisualOffset(ms) / .visualOffsetMs   → −100 … +200 ms, + = visuals earlier (#95 6498683963)
//   metronome.now()              → the clock's time on the audio clock that the visuals show now (heard + offset)
//   Clock.qaEvents(metronome)    → events and jumps merged, sorted by time (for __qa.events)
//   metronome.lateStats          → { late, lateMaxMs, maxGapMs, lookAheadMs } (#95: heavy 4K frames; __qa.clockLate)
//
// Booking under long frames (#95, 31 Oct): read() and hitsDue() call schedule() first, at most once per frame, so a
// frame longer than the 25 ms timer can't push the booking past its look-ahead; the look-ahead is
// clamp(2 × p95 of the last 120 frame gaps, 0.1, 0.25) s (0.25 until 10 frames are seen). A step booked after its own
// time counts in lateStats.late (should stay 0). Clocks made with timers:false (the caller drives schedule(), as the
// node parity tests do) keep today's fixed 0.1 s and don't pump unless created with pump:true.
//
// Times are on the AudioContext clock (ctx.currentTime), as today's hits are. read() reports the clock at the
// moment the listener hears it (currentTime − latency()), moved earlier in the music by visualOffsetMs: a positive
// offset makes visuals fire earlier, to cover projector lag. At offset 0, read() is exactly today's metronome.
// Include with <script src="clock.js"></script> next to panic.js; node's tests load it with require.
(function (root) {
  'use strict';

  const TAU = { kick: 0.150, snare: 0.120, hat: 0.040 };
  const LANES = ['kick', 'snare', 'hat'];
  const BANDS = ['sub', 'kick', 'low', 'lowMid', 'mid', 'upperMid', 'presence', 'air'];
  const OFFSET_MIN = -100, OFFSET_MAX = 200, JUMPS_KEPT = 256, HITLOG_KEPT = 4096;
  const AHEAD_MIN = 0.1, AHEAD_MAX = 0.25, GAPS_KEPT = 120, GAPS_MIN = 10, PUMP_MIN_MS = 4;
  const SOURCES_LATER = /^(file:|line$)/;

  function defaultContext() {
    const AC = root.AudioContext || root.webkitAudioContext;
    return new AC();
  }

  // create({ source, settings, bpm, bpb, pattern, analyser, hitStep, audioContext, timers })
  //   settings     the page's live settings object (read at every step, as today); built from bpm/bpb/pattern if absent
  //   analyser     true: route clicks through a bus with an AnalyserNode and fill .wave on read() (11's metronome)
  //   hitStep      false: hits carry no .step (11 and 19); default true (13)
  //   audioContext a factory for the AudioContext (node's tests pass a fake)
  //   timers       false: no setInterval; the caller calls schedule() (tests)
  function create(opts = {}) {
    const requested = opts.source || 'metronome';
    let source = requested, fallback = null;
    if (requested !== 'metronome') {
      source = 'metronome';
      fallback = SOURCES_LATER.test(requested) ? `${requested} is not built yet (clock PR 2/3); playing the metronome`
        : `unknown clock source ${requested}; playing the metronome`;
      if (root.console) root.console.warn('[clock] ' + fallback);
    }
    const settings = opts.settings || {
      bpm: opts.bpm || 120, bpb: opts.bpb || 4, muted: !!opts.muted,
      kick: (opts.pattern && opts.pattern.kick) || 'x---x---x---x---',
      snare: (opts.pattern && opts.pattern.snare) || '----x-------x---',
      hat: (opts.pattern && opts.pattern.hat) || '--x---x---x---x-',
    };
    const makeContext = opts.audioContext || defaultContext;
    const useTimers = opts.timers !== false, hitStep = opts.hitStep !== false, withAnalyser = !!opts.analyser;
    const pumpOn = opts.pump !== undefined ? !!opts.pump : useTimers;
    const perfNow = opts.now || (() => (root.performance ? root.performance.now() : Date.now()));

    // ---------- the metronome (as 11/13/19), moved ----------
    const clock = {
      source, requested, fallback, settings,
      ctx: null, master: null, bus: null, analyser: null, noise: null, timer: 0, playing: false,
      nextTime: 0, step: 0, hits: [], steps: [], wave: withAnalyser ? new Float32Array(2048) : null,
      jumps: [], beatShift: 0, oneAt: 0, offsetMs: 0, hitLog: [], dueAt: 0,
      lookAhead: pumpOn ? AHEAD_MAX : AHEAD_MIN, gaps: [], lastPump: null, late: 0, lateMaxMs: 0, maxGapMs: 0,
      start() {
        if (!this.ctx) {
          const ctx = makeContext();
          this.ctx = ctx; this.master = ctx.createGain();
          if (withAnalyser) {
            this.bus = ctx.createGain(); this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048;
            this.bus.connect(this.master); this.bus.connect(this.analyser);
          }
          this.master.connect(ctx.destination);
          this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        this.ctx.resume(); this.master.gain.value = settings.muted ? 0 : 0.35;
        this.nextTime = this.ctx.currentTime + 0.05; this.step = 0; this.hits = []; this.steps = []; this.hitLog = []; this.dueAt = 0;
        this.beatShift = 0; this.oneAt = 0;
        this.gaps = []; this.lastPump = null; this.late = 0; this.lateMaxMs = 0; this.maxGapMs = 0; this.lookAhead = pumpOn ? AHEAD_MAX : AHEAD_MIN;
        this.playing = true;
        if (useTimers) this.timer = setInterval(() => this.schedule(), 25);
        this.schedule();
      },
      stop() { clearInterval(this.timer); this.playing = false; },
      setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 0.35; },
      schedule() {
        const ct = this.ctx.currentTime;
        while (this.nextTime < ct + this.lookAhead) {
          if (this.nextTime < ct) { this.late++; this.lateMaxMs = Math.max(this.lateMaxMs, (ct - this.nextTime) * 1000); }   // booked after its own time
          this.queueStep(this.step, this.nextTime); this.nextTime += 60 / settings.bpm / 4; this.step++;
        }
        const old = this.ctx.currentTime - 1;
        this.hits = this.hits.filter(h => h.time > old);
        while (this.steps.length > 2 && this.steps[1].time < old) this.steps.shift();
      },
      // steps (and so beats) stay on the grid; each hit may be moved off it by settings.swing (odd 16ths late by
      // swing × a 16th, 04/06/07/09) and settings.human (± human ms of jitter per hit), never before currentTime.
      // At swing 0 and human 0 the hit time is the grid time exactly, as before.
      queueStep(step, time) {
        const inBar = step % (settings.bpb * 4), dur = 60 / settings.bpm / 4; this.steps.push({ time, step, dur });
        const swing = (step % 2 && settings.swing) ? settings.swing * dur : 0, human = settings.human || 0;
        for (const lane of LANES) {
          if (settings[lane][inBar % 16] !== 'x') continue;
          const vel = inBar === 0 ? 1 : 0.7;
          let t = time;
          if (swing || human) t = Math.max(this.ctx.currentTime, time + swing + (human ? (Math.random() * 2 - 1) * human / 1000 : 0));
          const hit = hitStep ? { type: 'hit', lane, time: t, vel, step } : { type: 'hit', lane, time: t, vel };
          this.hits.push(hit); this.logHit(hit);
          this.click(lane, t, vel);
        }
      },
      // hitLog stays in time order (jittered hits can land out of order), never before the hits already handed out
      logHit(hit) {
        const L = this.hitLog; let i = L.length;
        while (i > this.dueAt && L[i - 1].time > hit.time) i--;
        L.splice(i, 0, hit);
        if (L.length > HITLOG_KEPT) { L.shift(); this.dueAt = Math.max(0, this.dueAt - 1); }
      },
      click(lane, t, vel) {
        const ctx = this.ctx, g = ctx.createGain(); g.connect(this.bus || this.master);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.003);
        let src;
        if (lane === 'kick') { src = ctx.createOscillator(); src.frequency.setValueAtTime(150, t); src.frequency.exponentialRampToValueAtTime(60, t + 0.08); src.connect(g); }
        else { src = ctx.createBufferSource(); src.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = lane === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = lane === 'snare' ? 1800 : 8000; src.connect(f); f.connect(g); }
        const end = t + TAU[lane] * 4; g.gain.exponentialRampToValueAtTime(0.001, end); src.start(t); src.stop(end + 0.01);
      },
      latency() { return this.ctx ? Math.min(0.3, this.ctx.outputLatency || this.ctx.baseLatency || 0) : 0; },

      // once per frame from read() and hitsDue(): note the frame gap, adapt the look-ahead, book what's due (#95)
      pump() {
        if (!pumpOn || !this.ctx || !this.playing) return;
        const p = perfNow();
        if (this.lastPump !== null) {
          const gap = p - this.lastPump;
          if (gap < PUMP_MIN_MS) return;   // the same frame (read() then hitsDue())
          this.gaps.push(gap); if (this.gaps.length > GAPS_KEPT) this.gaps.shift();
          this.maxGapMs = Math.max(this.maxGapMs, gap);
          if (this.gaps.length >= GAPS_MIN) {
            const s = [...this.gaps].sort((a, b) => a - b), p95 = s[Math.min(s.length - 1, Math.floor(0.95 * s.length))];
            this.lookAhead = Math.max(AHEAD_MIN, Math.min(AHEAD_MAX, 2 * p95 / 1000));
          }
        }
        this.lastPump = p;
        this.schedule();
      },
      get lateStats() { return { late: this.late, lateMaxMs: +this.lateMaxMs.toFixed(2), maxGapMs: +this.maxGapMs.toFixed(2), lookAheadMs: Math.round(this.lookAhead * 1000) }; },

      // ---------- the shared clock on top ----------
      get events() { return this.hits; },
      // the hits the visuals have reached since the last call (time ≤ now()), each handed out once; lanes filters them
      // at: the visual time to hand out up to (default now()); audio-in passes its frame's time so lag and dt agree
      hitsDue(lanes, at) {
        const out = [];
        if (!this.ctx) return out;
        this.pump();
        const now = Number.isFinite(at) ? at : this.now();
        while (this.dueAt < this.hitLog.length && this.hitLog[this.dueAt].time <= now) {
          const h = this.hitLog[this.dueAt++];
          if (!lanes || lanes.includes(h.lane)) out.push(h);
        }
        return out;
      },
      get visualOffsetMs() { return this.offsetMs; },
      setVisualOffset(ms) {
        if (Number.isFinite(ms)) this.offsetMs = Math.max(OFFSET_MIN, Math.min(OFFSET_MAX, ms));
        return this.offsetMs;
      },
      // the audio-clock time whose sound the visuals show now: heard time, moved by the visual offset
      now(o) {
        if (!this.ctx) return NaN;
        const raw = o && o.raw;
        return this.ctx.currentTime - this.latency() + (raw ? 0 : this.offsetMs / 1000);
      },
      // today's beat count at audio time t (−1 before the first step), without hand commands. One change from
      // the copies: the sixteenth in progress keeps the spacing it was booked with, so a bpm change (slider, x2,
      // half) never steps beats backwards or stalls them; at a steady bpm it is exactly today's number.
      baseBeats(t) {
        let last = null; for (const s of this.steps) if (s.time <= t) last = s;
        return last ? (last.step + Math.min(1, (t - last.time) / last.dur)) / 4 : -1;
      },
      read(arg) {
        const o = typeof arg === 'number' ? { lead: arg } : (arg || {});
        const lead = o.lead || 0;
        const out = { kick: 0, snare: 0, hat: 0, beats: -1, bars: -1, phase: 0, bar: -1, beatInBar: 0,
          bpm: settings.bpm, confidence: 1, level: 0, bands: {} };
        for (const b of BANDS) out.bands[b] = 0;
        if (!this.ctx) return out;
        this.pump();
        const now = this.now(o) + lead;
        for (const h of this.hits) { const dt = now - h.time; if (dt >= 0) out[h.lane] = Math.max(out[h.lane], h.vel * (1 - Math.exp(-dt / 0.005)) * Math.exp(-dt / TAU[h.lane])); }
        const b0 = this.baseBeats(now);
        if (b0 >= 0) {
          const beats = b0 + this.beatShift;
          out.beats = beats; out.bars = beats / settings.bpb;
          out.phase = beats - Math.floor(beats);
          const k = Math.floor(beats) - this.oneAt, bpb = settings.bpb;
          out.bar = Math.floor(k / bpb); out.beatInBar = ((k % bpb) + bpb) % bpb + 1;
        }
        out.level = Math.max(out.kick, out.snare, out.hat);
        if (this.analyser && !lead) this.analyser.getFloatTimeDomainData(this.wave);
        return out;
      },
      // hand commands: immediate, logged in jumps (#95 6499054911, "command" authority)
      fix(kind, arg) {
        if (!this.ctx || !this.playing) return null;
        const at = this.now({ raw: true }), b0 = this.baseBeats(at);
        if (b0 < 0) return null;
        const from = b0 + this.beatShift;
        if (kind === 'nudge') {
          const ms = Number(arg) || 0;
          this.beatShift += ms / 1000 * settings.bpm / 60;
        } else if (kind === 'x2' || kind === 'half') {
          // the rate changes from now: the clicks already booked (≤ 100 ms) keep the old spacing and beats stay on
          // the clicks, so beats stay continuous (fromBeats = toBeats)
          settings.bpm = Math.max(30, Math.min(300, kind === 'x2' ? settings.bpm * 2 : settings.bpm / 2));
        } else if (kind === 'setOne') {
          this.oneAt = Math.round(from);
        } else if (kind === 'reset') {
          this.beatShift -= Math.floor(from); this.oneAt = 0;   // the current beat becomes beat 0, bar 1; phase is kept
        } else return null;
        const jump = { type: 'jump', at, kind, fromBeats: from, toBeats: this.baseBeats(at) + this.beatShift };
        this.jumps.push(jump);
        if (this.jumps.length > JUMPS_KEPT) this.jumps.shift();
        return jump;
      },
    };
    return clock;
  }

  // events and jumps as one list in time order, for a page's __qa.events
  function qaEvents(clock) {
    return [...(clock.hitLog || clock.events), ...clock.jumps].sort((a, b) => (a.type === 'jump' ? a.at : a.time) - (b.type === 'jump' ? b.at : b.time));
  }

  const api = { create, qaEvents, TAU, LANES, BANDS, OFFSET_MIN, OFFSET_MAX };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Clock = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));   // node's `this` is module.exports
