// The shared audio input: batch A of the clock port (contract: #95 comment 6533515449). Every page takes its audio
// from one of these instead of opening its own mic or reading its own clicks, so later sources (line-in through
// BlackHole, a file, DJ Link) change only this file, clock.js and the bridge, never the pages.
//
//   const clock = Clock.create({ source: qs.get('clock') || 'metronome', settings });
//   const audio = AudioIn.create({ clock, source: qs.get('audio') || 'clock' });
//   AudioIn.qa(audio, window.__qa);   // __qa.beatLog, .frame, .beatLanes, .events, .audioIn (live getters)
//   // in the rAF callback:
//   audio.frameStart(nowMs);          // top of the callback, before drawing: __qa.frame += 1, t, dt
//   const A = audio.read();           // { level, kick, snare, hat, bands: { sub … air }, wave }  (the #85 frame().audio)
//   for (const hit of audio.due(['kick'])) firePulse(hit);   // the hits the visuals reached this frame, logged
//
// read() is clock.read()'s kick/snare/hat/level/bands field for field under the default 'clock' source, so a page
// that swaps `clock.read()` for `audio.read()` looks exactly the same. Beats, bars, phase and bpm stay on clock.read().
// One AudioContext (the clock's) and one AnalyserNode. Sources:
//   'clock' (default)  the clock's own output (the synth metronome today). Lanes and level are the clock's numbers;
//                      bands are measured from the clicks on the analyser (the clock reports 0) and so is wave.
//   'mic' / 'line'     getUserMedia (line: the laptop's line-in, e.g. BlackHole; today the default input device),
//                      not routed to the speakers. Lanes are band-onset envelopes (sub+kick → kick, mid → snare,
//                      air → hat) with the clock's TAU decay, so the pages' mappings read the same.
//   'file:<url>'       a decoded file, looped through the speakers and the analyser; lanes as for 'mic'.
// Anything else falls back to 'clock' and says so in .fallback (as the clock does). Analysis runs once per read();
// the fixed 57 Hz AudioWorklet cadence comes with the live tracker (clock PR 3).
//
// __qa.beatLog (the check-shared beat-match row): due(lanes) pushes one entry per hit it hands out,
//   { time, lane, now, beats, frame, t, dt }   (time: the hit's audio time; now: clock.now(); t, dt in seconds)
// capped at 4096. Include with <script src="audio-in.js"></script> after clock.js; node's tests use require.
(function (root) {
  'use strict';

  const BANDS = ['sub', 'kick', 'low', 'lowMid', 'mid', 'upperMid', 'presence', 'air'];
  const EDGES = [20, 60, 120, 250, 500, 2000, 4000, 8000, 16000];   // Hz, band i is EDGES[i] … EDGES[i+1]
  const TAU = { kick: 0.150, snare: 0.120, hat: 0.040 };            // as clock.js
  const LANE_BANDS = { kick: ['sub', 'kick'], snare: ['mid'], hat: ['air'] };
  const MIN_GAP = { kick: 0.1, snare: 0.1, hat: 0.05 };
  const DB_FLOOR = -90, DB_SPAN = 70, LOG_KEPT = 4096;

  // magnitude spectrum (dB per bin) → 8 band levels 0..1 (mean over each band's bins, dB mapped −90 … −20 → 0 … 1)
  function bandLevels(db, sampleRate, out) {
    const n = db.length, hzPerBin = sampleRate / 2 / n;
    for (let i = 0; i < BANDS.length; i++) {
      const a = Math.max(1, Math.floor(EDGES[i] / hzPerBin)), b = Math.min(n - 1, Math.ceil(EDGES[i + 1] / hzPerBin));
      let s = 0, c = 0;
      for (let k = a; k <= b; k++) { const v = db[k]; s += Number.isFinite(v) ? v : DB_FLOOR; c++; }
      out[BANDS[i]] = c ? Math.max(0, Math.min(1, ((s / c) - DB_FLOOR) / DB_SPAN)) : 0;
    }
    return out;
  }

  // one lane's onset detector: positive flux of its bands against a running mean + 1.5 σ (about 1 s), min gap per lane
  function onsetLane(lane) {
    return { lane, prev: 0, mean: 0, varr: 0.0004, last: -1e9, hits: [],
      step(level, t) {
        const flux = Math.max(0, level - this.prev); this.prev = level;
        const thr = this.mean + 1.5 * Math.sqrt(this.varr) + 0.02;
        const k = 0.03; this.mean += k * (flux - this.mean); this.varr += k * ((flux - this.mean) ** 2 - this.varr);
        if (flux > thr && t - this.last >= MIN_GAP[lane]) {
          this.last = t;
          this.hits.push({ type: 'hit', lane, time: t, vel: Math.max(0.3, Math.min(1, flux / (thr * 2))) });
          if (this.hits.length > 64) this.hits.shift();
        }
      } };
  }

  // create({ clock, source, fftSize, getUserMedia, fetch })
  //   clock    a Clock.create() object (required): the AudioContext, the beats, and the 'clock' source's lanes
  //   getUserMedia, fetch   stand-ins for node's tests
  function create(opts = {}) {
    const clock = opts.clock;
    if (!clock || typeof clock.read !== 'function') throw new Error('AudioIn.create needs { clock }');
    const requested = opts.source || 'clock';
    const source = /^(clock|mic|line|file:.+)$/.test(requested) ? requested : 'clock';
    const fallback = source === requested ? null : `unknown audio source ${requested}; reading the clock`;
    if (fallback && root.console) root.console.warn('[audio-in] ' + fallback);
    const gum = opts.getUserMedia || (() => root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }));
    const fetchFn = opts.fetch || (u => root.fetch(u));
    const ZERO = () => { const o = {}; for (const b of BANDS) o[b] = 0; return o; };

    const a = {
      source, requested, fallback, clock, ctx: null, analyser: null, input: null, db: null, wave: null,
      status: 'idle', error: null, running: false,
      lanes: { kick: onsetLane('kick'), snare: onsetLane('snare'), hat: onsetLane('hat') },
      beatLog: [], beatLanes: null, frame: 0, t: null, dt: 0,
      // start() / stop(): reading is on between them; start() before the clock exists is fine (attached on read)
      start() { this.running = true; this.attach(); return this; },
      stop() {
        this.running = false;
        try { if (this.input && this.input.stop) this.input.stop(); } catch (e) {}
        try { if (this.input) this.input.disconnect(); } catch (e) {}
        try { if (this.input && this.input.mediaStream) this.input.mediaStream.getTracks().forEach(t => t.stop()); } catch (e) {}
        this.input = null; if (this.ctx && source !== 'clock') this.attached = false;
        return this;
      },
      attach() {
        if (!clock.ctx) return false;
        if (!this.ctx) {
          const ctx = this.ctx = clock.ctx;
          this.analyser = ctx.createAnalyser(); this.analyser.fftSize = opts.fftSize || 2048; this.analyser.smoothingTimeConstant = 0.5;
          this.db = new Float32Array(this.analyser.frequencyBinCount); this.wave = new Float32Array(this.analyser.fftSize);
        }
        if (this.attached || !this.running) return true;
        this.attached = true;
        const ctx = this.ctx;
        if (source === 'clock') { if (clock.master) clock.master.connect(this.analyser); this.status = 'clock'; }
        else if (source === 'mic' || source === 'line') {
          this.status = 'asking';
          Promise.resolve().then(gum).then(stream => { this.input = ctx.createMediaStreamSource(stream); this.input.connect(this.analyser); this.status = source; },
            e => { this.error = String(e && e.message || e); this.status = 'error'; });
        } else {
          this.status = 'loading';
          Promise.resolve(source.slice(5)).then(fetchFn).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => {
            const s = this.input = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
            s.connect(this.analyser); s.connect(ctx.destination); s.start(); this.status = 'file';
          }, e => { this.error = String(e && e.message || e); this.status = 'error'; });
        }
        return true;
      },
      // the top of each rAF callback, before drawing: the frame counter and this frame's time (nowMs: rAF's argument)
      frameStart(nowMs) {
        const t = (Number.isFinite(nowMs) ? nowMs : (root.performance ? root.performance.now() : Date.now())) / 1000;
        this.dt = this.t === null ? 0 : t - this.t; this.t = t; this.frame++;
        return this.frame;
      },
      // the frame's audio (#85 frame().audio): call once per frame
      read() {
        const c = clock.read();
        const out = { level: c.level, kick: c.kick, snare: c.snare, hat: c.hat, bands: ZERO(), wave: null };
        if (!this.running || !this.attach() || !this.analyser) return out;
        this.analyser.getFloatFrequencyData(this.db); bandLevels(this.db, this.ctx.sampleRate, out.bands);
        if (this.analyser.getFloatTimeDomainData) { this.analyser.getFloatTimeDomainData(this.wave); out.wave = this.wave; }
        if (source !== 'clock') {
          const t = this.ctx.currentTime;
          out.kick = out.snare = out.hat = 0;
          for (const lane of ['kick', 'snare', 'hat']) {
            const L = this.lanes[lane], bs = LANE_BANDS[lane], lvl = bs.reduce((s, b) => s + out.bands[b], 0) / bs.length;
            L.step(lvl, t);
            for (const h of L.hits) { const d = t - h.time; if (d >= 0) out[lane] = Math.max(out[lane], h.vel * (1 - Math.exp(-d / 0.005)) * Math.exp(-d / TAU[lane])); }
          }
          out.level = Math.max(out.kick, out.snare, out.hat);
        }
        return out;
      },
      // the clock hits the visuals reached this frame, on the page's lanes, each once; logged in beatLog for QA.
      // Call it where the page responds (fires its pulse), once per frame, after frameStart().
      due(lanes) {
        if (lanes) this.beatLanes = lanes.slice();
        if (!clock.ctx || typeof clock.hitsDue !== 'function') return [];
        const hits = clock.hitsDue(lanes);
        if (hits.length) {
          const now = clock.now(), beats = clock.read().beats;
          for (const h of hits) {
            this.beatLog.push({ time: h.time, lane: h.lane, now, beats, frame: this.frame, t: this.t, dt: this.dt });
            if (this.beatLog.length > LOG_KEPT) this.beatLog.shift();
          }
        }
        return hits;
      },
      // onsets the 'mic'/'line'/'file' sources detected (empty for 'clock': its hits are the clock's)
      get events() { return source === 'clock' ? [] : [...this.lanes.kick.hits, ...this.lanes.snare.hits, ...this.lanes.hat.hits].sort((x, y) => x.time - y.time); },
    };
    return a;
  }

  // window.__qa getters (pages fill __qa with Object.assign, which would copy values once)
  function qa(a, target) {
    if (!target) return target;
    const def = (k, get) => Object.defineProperty(target, k, { get, configurable: true, enumerable: true });
    def('beatLog', () => a.beatLog);
    def('frame', () => a.frame);
    def('beatLanes', () => a.beatLanes);
    def('events', () => (root.Clock && root.Clock.qaEvents ? root.Clock.qaEvents(a.clock) : [...(a.clock.hitLog || a.clock.events || [])]));
    def('audioIn', () => ({ source: a.source, requested: a.requested, fallback: a.fallback, status: a.status, error: a.error,
      now: a.clock.ctx && a.clock.now ? a.clock.now() : null, playing: !!a.clock.playing }));
    return target;
  }

  const api = { create, qa, bandLevels, BANDS, EDGES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AudioIn = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
