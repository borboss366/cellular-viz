// The shared clock (docs/CELLULAR_VIZ_BRIEF_CLOCK.md task 1; names from #95 comment 6519125441).
// One object replaces each page's copied `metronome`. PR 1 holds the core: the metronome source (the code that
// 11, 13 and 19 copied, moved here unchanged), read() with phase/bar/beatInBar, hand commands (fix) logged as
// jumps, and the visual offset. PR 2 adds the file: source (below). The line source comes in PR 3; until then it
// falls back to the metronome and says so in clock.requested / clock.fallback.
//
// ?clock=file:<url> (#95 "file grid", authority locked): plays the track and reads its beat grid, the sidecar
// <url>.beatgrid.json (or ?grid=<url>): v2 { version: 2, beats: [{ ms, pos, conf }] } or v1 { bpm, firstBeatMs,
// beats: [ms] }. The warp W(beat) → ms is a monotone cubic through (k, t_k): beats = W⁻¹(track time), exact at every
// grid beat with no lag; bpm = 60000 / W′ (settings.bpm follows it); bar and beatInBar come from the per-beat pos.
// The drum lanes are the page's kick/snare/hat patterns laid on the grid's sixteenths (silent unless settings.click,
// the ear check), so pages respond as on the metronome. Hand fixes on a file grid: nudge (shifts the grid against
// the audio) and setOne (relabels pos from this beat on); tap, x2, half and reset belong to the grid editor and do
// nothing here. .seek(sec) jumps with the audio (a 'seek' jump). .file has { status: idle|loading|playing|error,
// error, url, gridUrl, durationMs }. After the track ends the beats run on at the last period, without hits.
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
//   metronome.fix(kind, arg, { origin }) → kind: 'tap' | 'nudge' (arg ms, + = clock ahead) | 'x2' | 'half' | 'setOne' | 'reset'
//                                  acts only for origin 'fix:controller' | 'fix:key' | 'qa' (beat authority, #95 31 Oct);
//                                  any other origin is a no-op logged in fixRejected (__qa.fixRejected)
//   metronome.nextBeatAt() / .nextBarAt() → read-only: the clock time (now() timeline) of the next beat / bar line
//   Hand-fix keys (Shift only; without Shift nothing touches the clock): Shift+A tap, Shift+H ÷2, Shift+D ×2,
//   Shift+1 set the 1, Shift+, / Shift+. nudge −10 / +10 ms, Shift+0 reset. The same commands come from the
//   controller's Shift buttons as origin 'fix:controller' (#85 layout).
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
  const FIX_ORIGINS = ['fix:controller', 'fix:key', 'qa'], QUANTUM = 0.003, NO_DOUBLE = 0.020, TAP_GAP = 2, TAPS_KEPT = 5;
  // Shift + key (KeyboardEvent.code) → hand fix; clear of the pages' own keys (z x c v t b [ ] `)
  const FIX_KEYS = { KeyA: ['tap'], KeyH: ['half'], KeyD: ['x2'], Digit1: ['setOne'], Comma: ['nudge', -10], Period: ['nudge', 10], Digit0: ['reset'] };
  const SOURCES_LATER = /^line$/;
  const FILE_GAIN = 1, CLICK_GAIN = 0.35, FILE_LEAD = 0.05;

  function defaultContext() {
    const AC = root.AudioContext || root.webkitAudioContext;
    return new AC();
  }

  // ---------- file: grids (#95 sidecar v2) ----------
  // a sidecar (v2 or v1) → { version, beats: [{ ms, pos, conf }] }: times strictly increasing, a pos (1…) on every
  // beat (missing ones count on from the beat before, the first is 1). durationMs fills a v1 grid that has only
  // bpm and firstBeatMs.
  function parseGrid(j, bpb = 4, durationMs) {
    if (!j || typeof j !== 'object') throw new Error('beat grid: not a JSON object');
    let raw = [];
    if (Array.isArray(j.beats) && j.beats.length && j.beats[0] !== null && typeof j.beats[0] === 'object') {
      raw = j.beats.map(b => ({ ms: Number(b.ms), pos: Number(b.pos), conf: b.conf === undefined ? 1 : Number(b.conf) }));
    } else if (Array.isArray(j.beats)) {
      raw = j.beats.map(ms => ({ ms: Number(ms), pos: NaN, conf: 1 }));
    }
    if (!raw.length && j.bpm > 0 && Number.isFinite(Number(j.firstBeatMs))) {
      const p = 60000 / j.bpm, t0 = Number(j.firstBeatMs), end = Number.isFinite(durationMs) ? durationMs : t0 + 3600000;
      for (let i = 0; t0 + i * p <= end && i < 100000; i++) raw.push({ ms: t0 + i * p, pos: NaN, conf: 1 });
    }
    raw = raw.filter(b => Number.isFinite(b.ms)).sort((a, b) => a.ms - b.ms);
    const beats = [];
    for (const b of raw) if (!beats.length || b.ms > beats[beats.length - 1].ms) beats.push(b);
    if (beats.length < 2) throw new Error('beat grid: fewer than 2 beats');
    for (let i = 0; i < beats.length; i++) {
      if (!(Number.isInteger(beats[i].pos) && beats[i].pos >= 1)) beats[i].pos = i ? beats[i - 1].pos % bpb + 1 : 1;
    }
    return { version: j.version === 2 ? 2 : 1, beats };
  }

  // the warp W(b) (beat → ms) through (k, t_k): cubic Hermite with Fritsch–Butland tangents (the harmonic mean of the
  // neighbouring periods), monotone for any increasing grid; beyond the ends it runs on at the end period.
  // at(b) = W(b), slope(b) = W′(b) (ms per beat), inv(ms) = W⁻¹(ms) (beats)
  function makeWarp(beats) {
    const n = beats.length, t = beats.map(b => b.ms), d = [], m = new Array(n);
    for (let k = 0; k < n - 1; k++) d.push(t[k + 1] - t[k]);
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let k = 1; k < n - 1; k++) m[k] = 2 * d[k - 1] * d[k] / (d[k - 1] + d[k]);
    const at = b => {
      if (b <= 0) return t[0] + b * m[0];
      if (b >= n - 1) return t[n - 1] + (b - n + 1) * m[n - 1];
      const k = Math.floor(b), s = b - k, s2 = s * s, s3 = s2 * s;
      return (2 * s3 - 3 * s2 + 1) * t[k] + (s3 - 2 * s2 + s) * m[k] + (3 * s2 - 2 * s3) * t[k + 1] + (s3 - s2) * m[k + 1];
    };
    const slope = b => {
      if (b <= 0) return m[0];
      if (b >= n - 1) return m[n - 1];
      const k = Math.floor(b), s = b - k, s2 = s * s;
      return (6 * s2 - 6 * s) * t[k] + (3 * s2 - 4 * s + 1) * m[k] + (6 * s - 6 * s2) * t[k + 1] + (3 * s2 - 2 * s) * m[k + 1];
    };
    const inv = ms => {
      if (ms <= t[0]) return (ms - t[0]) / m[0];
      if (ms >= t[n - 1]) return n - 1 + (ms - t[n - 1]) / m[n - 1];
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= ms) lo = mid; else hi = mid; }
      if (t[lo] === ms) return lo;
      let a = lo, z = lo + 1, b = lo + (ms - t[lo]) / d[lo];
      for (let i = 0; i < 60; i++) {   // Newton inside the bracket, bisection when a step would leave it
        const f = at(b) - ms;
        if (Math.abs(f) < 1e-7) break;
        if (f > 0) z = b; else a = b;
        const g = slope(b), nb = b - f / g;
        b = g > 0 && nb > a && nb < z ? nb : (a + z) / 2;
      }
      return b;
    };
    return { n, t, at, slope, inv };
  }

  // the track and its sidecar, fetched and decoded (pages); node's tests pass opts.fileData or opts.load instead
  async function loadFile(ctx, url, gridUrl) {
    const get = async (u, what) => { const r = await root.fetch(u); if (!r.ok) throw new Error(`${what} ${u}: HTTP ${r.status}`); return r; };
    const [audio, grid] = await Promise.all([get(url, 'track').then(r => r.arrayBuffer()), get(gridUrl, 'beat grid').then(r => r.json())]);
    return { buffer: await ctx.decodeAudioData(audio), grid };
  }

  // create({ source, settings, bpm, bpb, pattern, analyser, hitStep, audioContext, timers })
  //   settings     the page's live settings object (read at every step, as today); built from bpm/bpb/pattern if absent
  //   analyser     true: route clicks through a bus with an AnalyserNode and fill .wave on read() (11's metronome)
  //   hitStep      false: hits carry no .step (11 and 19); default true (13)
  //   audioContext a factory for the AudioContext (node's tests pass a fake)
  //   timers       false: no setInterval; the caller calls schedule() (tests)
  //   fileData     { buffer, grid } for a file: source (tests); load(ctx, url, gridUrl) → Promise of the same
  //   grid         the sidecar's url for a file: source (default ?grid=, else <url>.beatgrid.json)
  function create(opts = {}) {
    const requested = opts.source || 'metronome';
    let source = requested, fallback = null;
    const fileM = /^file:(.+)$/.exec(requested);
    if (requested !== 'metronome' && !fileM) {
      source = 'metronome';
      fallback = SOURCES_LATER.test(requested) ? `${requested} is not built yet (clock PR 3); playing the metronome`
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
    const warned = new Set();
    const warnOnce = (key, msg) => { if (!warned.has(key) && root.console) { warned.add(key); root.console.warn('[clock] ' + msg); } };
    let file = null;
    if (fileM) {
      const url = fileM[1];
      let gridUrl = opts.grid;
      if (!gridUrl) { try { gridUrl = new URLSearchParams(root.location.search).get('grid'); } catch (e) { gridUrl = null; } }
      file = { url, gridUrl: gridUrl || url.replace(/[?#].*$/, '') + '.beatgrid.json', status: 'idle', error: null,
        buffer: null, grid: null, warp: null, pos: [], bar: [], seg: null, src: null, step: 0, nudgeMs: 0, durationMs: Infinity };
    }
    const load = opts.load || loadFile;

    // ---------- the metronome (as 11/13/19), moved ----------
    const clock = {
      source, requested, fallback, settings, file,
      ctx: null, master: null, bus: null, clickBus: null, analyser: null, noise: null, timer: 0, playing: false,
      nextTime: 0, step: 0, hits: [], steps: [], wave: withAnalyser ? new Float32Array(2048) : null,
      jumps: [], oneAt: 0, offsetMs: 0, hitLog: [], dueAt: 0, booked: [], taps: [], fixRejected: [],
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
          // file: the track goes through master (and so the analyser audio-in hangs on it); the ear-check clicks don't
          if (file) { this.clickBus = ctx.createGain(); this.clickBus.connect(ctx.destination); }
          this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
          const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        this.ctx.resume(); this.setMuted(settings.muted);
        this.nextTime = this.ctx.currentTime + 0.05; this.step = 0; this.hits = []; this.steps = []; this.hitLog = []; this.dueAt = 0;
        this.oneAt = 0; this.booked = []; this.taps = [];
        this.gaps = []; this.lastPump = null; this.late = 0; this.lateMaxMs = 0; this.maxGapMs = 0; this.lookAhead = pumpOn ? AHEAD_MAX : AHEAD_MIN;
        this.playing = true;
        if (file) { this.fileStart(); return; }
        if (useTimers) this.timer = setInterval(() => this.schedule(), 25);
        this.schedule();
      },
      stop() {
        clearInterval(this.timer); this.playing = false;
        if (file && file.src) { try { file.src.stop(); } catch (e) {} try { file.src.disconnect(); } catch (e) {} file.src = null; }
      },
      setMuted(m) {
        if (this.master) this.master.gain.value = m ? 0 : (file ? FILE_GAIN : 0.35);
        if (this.clickBus) this.clickBus.gain.value = m || !settings.click ? 0 : CLICK_GAIN;
      },
      schedule() {
        if (file) return this.fileSchedule();
        const ct = this.ctx.currentTime;
        while (this.nextTime < ct + this.lookAhead) {
          if (this.nextTime < ct) { this.late++; this.lateMaxMs = Math.max(this.lateMaxMs, (ct - this.nextTime) * 1000); }   // booked after its own time
          this.queueStep(this.step, this.nextTime); this.nextTime += 60 / settings.bpm / 4; this.step++;
        }
        const old = this.ctx.currentTime - 1;
        this.hits = this.hits.filter(h => h.time > old);
        if (this.booked.length && this.booked[0].time < old) this.booked = this.booked.filter(c => c.time > old);
        while (this.steps.length > 2 && this.steps[1].time < old) this.steps.shift();
      },
      // steps (and so beats) stay on the grid; each hit may be moved off it by settings.swing (odd 16ths late by
      // swing × a 16th, 04/06/07/09) and settings.human (± human ms of jitter per hit), never before currentTime.
      // At swing 0 and human 0 the hit time is the grid time exactly, as before.
      // a step is a grid anchor { time, step, b, dur, span }: b is the beat count at time, span the sixteenths until the
      // next anchor (1 for steps; a hand command adds a marker anchor with step null, see rebook())
      queueStep(step, time) {
        const n = settings.bpb * 4, inBar = (((step - 4 * this.oneAt) % n) + n) % n, dur = 60 / settings.bpm / 4;
        this.steps.push({ time, step, b: step / 4, dur, span: 1 });
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
        const ctx = this.ctx, g = ctx.createGain(); g.connect(this.clickBus || this.bus || this.master);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.003);
        let src;
        if (lane === 'kick') { src = ctx.createOscillator(); src.frequency.setValueAtTime(150, t); src.frequency.exponentialRampToValueAtTime(60, t + 0.08); src.connect(g); }
        else { src = ctx.createBufferSource(); src.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = lane === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = lane === 'snare' ? 1800 : 8000; src.connect(f); f.connect(g); }
        const end = t + TAU[lane] * 4; g.gain.exponentialRampToValueAtTime(0.001, end); src.start(t); src.stop(end + 0.01);
        this.booked.push({ time: t, src, g });   // a handle, so a hand command can stop it before it sounds
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
      // today's beat count at audio time t (−1 before the first step), hand commands included (marker anchors). One change from
      // the copies: the sixteenth in progress keeps the spacing it was booked with, so a bpm change (slider, x2,
      // half) never steps beats backwards or stalls them; at a steady bpm it is exactly today's number.
      baseBeats(t) {
        if (file) return this.fileBeats(t);
        let last = null; for (const s of this.steps) if (s.time <= t) last = s;
        return last ? last.b + Math.min(last.span, (t - last.time) / last.dur) / 4 : -1;
      },
      // read-only helpers for quantising (gestures, macros, triggers): the now() time of the next beat / bar line
      nextBeatAt(o) {
        if (!this.ctx) return null;
        const now = this.now(o), b = this.baseBeats(now);
        if (b >= 0 && file) return this.beatTime(Math.floor(b) + 1);
        return b < 0 ? null : now + (Math.floor(b) + 1 - b) * 60 / settings.bpm;
      },
      nextBarAt(o) {
        if (!this.ctx) return null;
        const now = this.now(o), b = this.baseBeats(now), bpb = settings.bpb;
        if (b < 0) return null;
        if (file) { let j = Math.floor(b) + 1; while (this.posBar(j).pos !== 1 && j < Math.floor(b) + 64) j++; return this.beatTime(j); }
        const j = this.oneAt + (Math.floor((b - this.oneAt) / bpb) + 1) * bpb;
        return now + (j - b) * 60 / settings.bpm;
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
        if (b0 >= 0 && file) {
          // the grid: beat count, tempo and bar position straight from the warp (no PLL, no lag)
          const pb = this.posBar(Math.floor(b0));
          out.beats = b0; out.phase = b0 - Math.floor(b0);
          out.bar = pb.bar; out.beatInBar = pb.pos; out.bars = pb.bar + (pb.pos - 1 + out.phase) / settings.bpb;
          out.bpm = 60000 / file.warp.slope(b0);
        } else if (b0 >= 0) {
          const beats = b0;
          out.beats = beats; out.bars = beats / settings.bpb;
          out.phase = beats - Math.floor(beats);
          const k = Math.floor(beats) - this.oneAt, bpb = settings.bpb;
          out.bar = Math.floor(k / bpb); out.beatInBar = ((k % bpb) + bpb) % bpb + 1;
        }
        out.level = Math.max(out.kick, out.snare, out.hat);
        if (this.analyser && !lead) this.analyser.getFloatTimeDomainData(this.wave);
        return out;
      },
      // hand commands: immediate, logged in jumps (#95 6499054911, "command" authority). Beat authority (#95, 31 Oct):
      // only the controller's and keyboard's Shift-guarded hand fixes (and QA) may call it; gestures, the Wave ring,
      // macros and triggers read the clock (read, nextBeatAt, nextBarAt) but never move it.
      //   fix(kind, arg, { origin })  or  fix(kind, { origin, ms })
      fix(kind, arg, opts) {
        if (arg && typeof arg === 'object') { opts = arg; arg = arg.ms !== undefined ? arg.ms : arg.value; }
        const origin = opts && opts.origin;
        if (!FIX_ORIGINS.includes(origin)) {
          this.fixRejected.push({ at: this.ctx ? this.now({ raw: true }) : null, kind, origin: origin === undefined ? null : origin });
          if (this.fixRejected.length > JUMPS_KEPT) this.fixRejected.shift();
          const w = String(origin);
          if (!warned.has(w) && root.console) { warned.add(w); root.console.warn(`[clock] fix('${kind}') from origin ${w} rejected: only beat sources and Shift hand fixes move the clock`); }
          return null;
        }
        if (!this.ctx || !this.playing) return null;
        const at = this.now({ raw: true }), from = this.baseBeats(at);
        if (from < 0) return null;
        if (file) return this.fileFix(kind, arg, origin, at, from);
        let to = from;
        if (kind === 'nudge') {
          to = from + (Number(arg) || 0) / 1000 * settings.bpm / 60;
        } else if (kind === 'x2' || kind === 'half') {
          settings.bpm = Math.max(30, Math.min(300, kind === 'x2' ? settings.bpm * 2 : settings.bpm / 2));   // beats stay continuous
        } else if (kind === 'setOne') {
          this.oneAt = Math.round(from);
        } else if (kind === 'reset') {
          to = from - Math.floor(from); this.oneAt = 0;   // the current beat becomes beat 0, bar 1; phase is kept
        } else if (kind === 'tap') {
          // taps closer than 2 s set the tempo (median of the last intervals); every tap puts the nearest beat on it
          if (this.taps.length && at - this.taps[this.taps.length - 1] > TAP_GAP) this.taps = [];
          this.taps.push(at); if (this.taps.length > TAPS_KEPT) this.taps.shift();
          if (this.taps.length >= 2) {
            const iv = this.taps.slice(1).map((t, i) => t - this.taps[i]).sort((a, b) => a - b), med = iv[Math.floor(iv.length / 2)];
            if (med > 0) settings.bpm = Math.max(30, Math.min(300, 60 / med));
          }
          to = Math.round(from);
        } else return null;
        this.rebook(at, to);
        const jump = { type: 'jump', at, kind, fromBeats: from, toBeats: to, origin };
        this.jumps.push(jump);
        if (this.jumps.length > JUMPS_KEPT) this.jumps.shift();
        return jump;
      },
      // after a hand command, seek or jump: clicks booked after currentTime (up to the 0.1–0.25 s look-ahead) are
      // stopped before they sound and the future hits dropped (sound and picture); a marker anchor at `at` carries the
      // new beat count to the first new sixteenth after currentTime + one audio quantum, and the window is rebooked
      rebook(at, to) {
        const ct = this.ctx.currentTime, dur = 60 / settings.bpm / 4;
        const lastKept = this.dropFuture(ct);
        this.steps = this.steps.filter(s => s.time <= at);
        // the first new sixteenth: after currentTime + one quantum, and ≥ 20 ms after the last click left sounding (no double)
        let k = Math.floor(to * 4) + 1, tk = at + (k / 4 - to) * 60 / settings.bpm;
        while (tk <= ct + QUANTUM || tk - lastKept < NO_DOUBLE) { k++; tk += dur; }
        this.steps.push({ time: at, step: null, b: to, dur, span: k - 4 * to });
        this.step = k; this.nextTime = tk;
        this.schedule();
      },
      // clicks booked after currentTime stopped before they sound, future hits dropped (sound and picture); returns the
      // time of the last click left sounding
      dropFuture(ct) {
        for (const c of this.booked) if (c.time > ct) { try { c.src.stop(0); } catch (e) {} try { c.g.disconnect(); } catch (e) {} c.cancelled = true; }
        this.booked = this.booked.filter(c => !c.cancelled);
        this.hits = this.hits.filter(h => h.time <= ct);
        this.hitLog = this.hitLog.filter((h, i) => i < this.dueAt || h.time <= ct);   // the handed-out prefix stays, so dueAt holds
        return this.booked.reduce((m, c) => Math.max(m, c.time), -Infinity);
      },

      // ---------- the file: source (#95 file grid, authority locked) ----------
      fileStart() {
        file.seg = null; file.nudgeMs = 0;
        if (opts.fileData && !file.warp) this.fileLoaded(opts.fileData.buffer, opts.fileData.grid);
        else if (file.warp) { file.pos = file.grid.beats.map(b => b.pos); this.fileBars(); }   // a restart drops setOne relabels
        const go = () => {
          if (!this.playing || file.seg) return;
          file.status = 'playing'; this.playFrom(0);
          if (useTimers) this.timer = setInterval(() => this.schedule(), 25);
          this.schedule();
        };
        if (file.warp) { go(); return; }
        if (file.status === 'loading') return;
        file.status = 'loading';
        Promise.resolve().then(() => load(this.ctx, file.url, file.gridUrl))
          .then(d => { this.fileLoaded(d.buffer, d.grid); go(); })
          .catch(e => { file.status = 'error'; file.error = String((e && e.message) || e); warnOnce('load', `file source: ${file.error}`); });
      },
      fileLoaded(buffer, grid) {
        file.buffer = buffer;
        file.durationMs = buffer && Number.isFinite(buffer.duration) ? buffer.duration * 1000 : Infinity;
        file.grid = parseGrid(grid, settings.bpb, file.durationMs);
        file.warp = makeWarp(file.grid.beats);
        file.pos = file.grid.beats.map(b => b.pos); this.fileBars();
      },
      // the bar number of every grid beat: a new bar at each pos 1 (beats before the first one are bar 0)
      fileBars() { let bar = file.pos[0] === 1 ? -1 : 0; file.bar = file.pos.map(p => (p === 1 ? ++bar : bar)); },
      // pos and bar of beat k; past the grid's end they count on from its last beat
      posBar(k) {
        const n = file.pos.length, bpb = settings.bpb;
        if (k < 0) return { pos: 1, bar: -1 };
        if (k < n) return { pos: file.pos[k], bar: file.bar[k] };
        const j = file.pos[n - 1] - 1 + (k - n + 1);
        return { pos: j % bpb + 1, bar: file.bar[n - 1] + Math.floor(j / bpb) };
      },
      // track ms at audio time t (held at the start point during the lead-in), and back
      // the clock counts grid beats as they are: beat 0 is the grid's first beat
      trackMs(t) { return file.seg.off + Math.max(0, t - file.seg.at) * 1000; },
      fileBeats(t) {
        if (!file.seg) return -1;
        const b = file.warp.inv(this.trackMs(t) + file.nudgeMs);
        return b < 0 ? -1 : b;
      },
      // the audio time at which beat b plays (the inverse of fileBeats)
      beatTime(b) { return file.seg.at + (file.warp.at(b) - file.nudgeMs - file.seg.off) / 1000; },
      // play the track from sec (a new segment), booking from the first sixteenth at or after it
      playFrom(sec) {
        const ctx = this.ctx;
        if (file.src) { try { file.src.stop(); } catch (e) {} try { file.src.disconnect(); } catch (e) {} file.src = null; }
        const at = ctx.currentTime + FILE_LEAD;
        if (file.buffer && ctx.createBufferSource) {
          const s = ctx.createBufferSource(); s.buffer = file.buffer; s.connect(this.master); s.start(at, Math.max(0, sec)); file.src = s;
        }
        file.seg = { at, off: sec * 1000 };
        file.step = Math.max(0, Math.ceil(4 * file.warp.inv(file.seg.off + file.nudgeMs) - 1e-9));
      },
      fileSchedule() {
        if (!file.seg) return;
        const ct = this.ctx.currentTime;
        for (;;) {
          if (file.warp.at(file.step / 4) - file.nudgeMs > file.durationMs) break;   // the track has ended: no hits past it
          const t = this.beatTime(file.step / 4);
          if (t >= ct + this.lookAhead) break;
          if (t < ct) { this.late++; this.lateMaxMs = Math.max(this.lateMaxMs, (ct - t) * 1000); }
          this.queueFileStep(file.step, t); file.step++;
        }
        // settings.bpm follows the grid, so page code that reads it sees the track's tempo
        const b = this.fileBeats(this.now({ raw: true }));
        if (b >= 0) settings.bpm = Math.round(6000000 / file.warp.slope(b)) / 100;
        const old = ct - 1;
        this.hits = this.hits.filter(h => h.time > old);
        if (this.booked.length && this.booked[0].time < old) this.booked = this.booked.filter(c => c.time > old);
      },
      // the page's patterns on the grid: sixteenth s is beat s/4; its place in the bar comes from that beat's pos
      queueFileStep(step, time) {
        const pb = this.posBar(Math.floor(step / 4)), inBar = (pb.pos - 1) * 4 + step % 4;
        for (const lane of LANES) {
          if (settings[lane][inBar % 16] !== 'x') continue;
          const vel = inBar === 0 ? 1 : 0.7;
          const hit = hitStep ? { type: 'hit', lane, time, vel, step } : { type: 'hit', lane, time, vel };
          this.hits.push(hit); this.logHit(hit);
          if (settings.click) this.click(lane, time, vel);   // the ear check (?click=1): clicks on the grid over the track
        }
      },
      // hand fixes on a grid: nudge moves the grid against the audio, setOne relabels pos from this beat on; the rest
      // (tap, x2, half, reset) are the grid editor's and do nothing here
      fileFix(kind, arg, origin, at, from) {
        if (kind === 'nudge') {
          file.nudgeMs += Number(arg) || 0;
        } else if (kind === 'setOne') {
          const k = Math.round(from), n = file.pos.length, bpb = settings.bpb;
          for (let j = Math.max(0, Math.min(k, n - 1)); j < n; j++) file.pos[j] = (((j - k) % bpb) + bpb) % bpb + 1;
          this.fileBars();
        } else {
          warnOnce('fix:' + kind, `fix('${kind}') does nothing on a file grid: fix the grid in the grid editor`);
          return null;
        }
        this.fileRebook();
        const jump = { type: 'jump', at, kind, fromBeats: from, toBeats: this.baseBeats(at), origin };
        this.jumps.push(jump);
        if (this.jumps.length > JUMPS_KEPT) this.jumps.shift();
        return jump;
      },
      // after a nudge, setOne or seek: drop what was booked ahead and book again from the first sixteenth after
      // currentTime + one quantum (≥ 20 ms after the last click left sounding)
      fileRebook() {
        const ct = this.ctx.currentTime, lastKept = this.dropFuture(ct);
        let s = Math.max(0, Math.ceil(4 * file.warp.inv(this.trackMs(ct) + file.nudgeMs) - 1e-9));
        while (this.beatTime(s / 4) <= ct + QUANTUM || this.beatTime(s / 4) - lastKept < NO_DOUBLE) s++;
        file.step = s;
        this.schedule();
      },
      // jump the track to sec (transport, not a beat fix): the audio and the beats move together, logged as 'seek'
      seek(sec) {
        if (!file || !file.seg || !this.playing) return null;
        const at = this.now({ raw: true }), from = this.baseBeats(at);
        this.playFrom(Math.max(0, Number(sec) || 0)); this.fileRebook();
        const jump = { type: 'jump', at, kind: 'seek', fromBeats: from, toBeats: this.fileBeats(file.seg.at), origin: 'seek' };
        this.jumps.push(jump);
        if (this.jumps.length > JUMPS_KEPT) this.jumps.shift();
        return jump;
      },
      // a keydown from the page: Shift + a hand-fix key → fix(…, { origin: 'fix:key' }); anything else is ignored
      handFixKey(e) {
        if (!e || !e.shiftKey || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return null;
        const tag = e.target && e.target.tagName;
        if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type === 'text')) return null;
        const m = FIX_KEYS[e.code];
        if (!m) return null;
        if (e.preventDefault) e.preventDefault();
        return this.fix(m[0], m[1], { origin: 'fix:key' });
      },
    };
    // the Shift hand-fix keys on the page (clocks the caller drives itself, timers:false, don't listen)
    if (useTimers && opts.keys !== false && typeof root.addEventListener === 'function') root.addEventListener('keydown', e => clock.handFixKey(e));
    return clock;
  }

  // events and jumps as one list in time order, for a page's __qa.events
  function qaEvents(clock) {
    return [...(clock.hitLog || clock.events), ...clock.jumps].sort((a, b) => (a.type === 'jump' ? a.at : a.time) - (b.type === 'jump' ? b.at : b.time));
  }

  const api = { create, qaEvents, parseGrid, makeWarp, TAU, LANES, BANDS, OFFSET_MIN, OFFSET_MAX };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Clock = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));   // node's `this` is module.exports
