// The shared audio input (#85 frame().audio; VIZ research's port ruling, 30 Oct). Every page takes its audio from one
// of these instead of opening its own mic or reading its own clicks, so later sources (line-in through BlackHole, a
// file, DJ Link) change only this file, clock.js and the bridge, never the pages.
//
//   const metronome = Clock.create({ source: qs.get('clock') || 'metronome', settings });
//   const audio = AudioIn.create({ clock: metronome, source: qs.get('audio') || 'clock' });
//   AudioIn.qa(audio, window.__qa);          // __qa.beatLog, __qa.audioIn (the check-shared beat-match row reads them)
//   // in the frame loop, once per frame, instead of metronome.read():
//   const A = audio.read();   // { kick, snare, hat, level, bands:{sub … air}, beats, bars, phase, bar, beatInBar, bpm, confidence }
//
// One AudioContext (the clock's) and one AnalyserNode. Sources:
//   'clock' (default)  the clock's own clicks (the synth metronome today; file:/line when clock.js has them). kick,
//                      snare, hat and level are clock.read()'s numbers unchanged, so a ported page looks exactly as
//                      before; bands are measured from the clicks on the analyser (they were all 0).
//   'mic'              getUserMedia, not routed to the speakers. Lanes are band-onset envelopes (sub+kick → kick,
//                      mid → snare, air → hat) with the clock's TAU decay, so the pages' mappings read the same.
//   'file:<url>'       a decoded file looped through the speakers and the analyser; lanes as for 'mic'.
// Beats, bars, phase and bpm always come from the clock. Analysis runs once per read() (the page's frame); the fixed
// 57 Hz AudioWorklet cadence comes with the live tracker (clock PR 3).
//
// QA: every clock hit is logged the first time a read() sees it (visual time ≥ hit time) in beatLog as
// { lane, time, seen, lagMs, frameMs, perf }. A page that reads every frame has lagMs within one frame (≤ frameMs).
// Include with <script src="audio-in.js"></script> after clock.js; node's tests load it with require.
(function (root) {
  'use strict';

  const BANDS = ['sub', 'kick', 'low', 'lowMid', 'mid', 'upperMid', 'presence', 'air'];
  const EDGES = [20, 60, 120, 250, 500, 2000, 4000, 8000, 16000];   // Hz, band i is EDGES[i] … EDGES[i+1]
  const TAU = { kick: 0.150, snare: 0.120, hat: 0.040 };            // as clock.js
  const LANE_BANDS = { kick: ['sub', 'kick'], snare: ['mid'], hat: ['air'] };
  const DB_FLOOR = -90, DB_SPAN = 70, LOG_KEPT = 1024, MIN_GAP = { kick: 0.1, snare: 0.1, hat: 0.05 };

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
          this.last = t; const vel = Math.max(0.3, Math.min(1, flux / (thr * 2)));
          this.hits.push({ type: 'hit', lane, time: t, vel }); if (this.hits.length > 64) this.hits.shift();
        }
      } };
  }

  // create({ clock, source, fftSize, getUserMedia, fetch, now })
  //   clock         a Clock.create() object (required): the AudioContext, the beats, and the 'clock' source's lanes
  //   source        'clock' | 'mic' | 'file:<url>'; anything else falls back to 'clock' and says so in .fallback
  //   getUserMedia, fetch, now   overrides for node's tests (now: a performance.now stand-in)
  function create(opts = {}) {
    const clock = opts.clock;
    if (!clock || typeof clock.read !== 'function') throw new Error('AudioIn.create needs { clock }');
    const requested = opts.source || 'clock';
    let source = /^(clock|mic|file:.+)$/.test(requested) ? requested : 'clock';
    const fallback = source === requested ? null : `unknown audio source ${requested}; reading the clock`;
    if (fallback && root.console) root.console.warn('[audio-in] ' + fallback);
    const perfNow = opts.now || (() => (root.performance ? root.performance.now() : Date.now()));
    const gum = opts.getUserMedia || (() => root.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }));
    const fetchFn = opts.fetch || ((u) => root.fetch(u));

    const a = {
      source, requested, fallback, clock, ctx: null, analyser: null, input: null, db: null, error: null, status: 'idle',
      bands: {}, lanes: { kick: onsetLane('kick'), snare: onsetLane('snare'), hat: onsetLane('hat') },
      beatLog: [], logged: new WeakSet(), lastPerf: null, frameMs: 1000 / 60,
      // attach to the clock's AudioContext once it exists (pages create it on Play)
      attach() {
        if (this.ctx || !clock.ctx) return !!this.ctx;
        const ctx = this.ctx = clock.ctx;
        this.analyser = ctx.createAnalyser(); this.analyser.fftSize = opts.fftSize || 2048; this.analyser.smoothingTimeConstant = 0.5;
        this.db = new Float32Array(this.analyser.frequencyBinCount);
        if (source === 'clock') { if (clock.master) clock.master.connect(this.analyser); this.status = 'clock'; }
        else if (source === 'mic') {
          this.status = 'asking';
          Promise.resolve().then(gum).then(stream => { this.input = ctx.createMediaStreamSource(stream); this.input.connect(this.analyser); this.status = 'mic'; },
            e => { this.error = String(e && e.message || e); this.status = 'error'; });
        } else {
          const url = source.slice(5); this.status = 'loading';
          Promise.resolve(url).then(fetchFn).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => {
            const s = this.input = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
            s.connect(this.analyser); s.connect(ctx.destination); s.start(); this.status = 'file';
          }, e => { this.error = String(e && e.message || e); this.status = 'error'; });
        }
        return true;
      },
      // the frame's audio: call once per frame
      read() {
        const c = clock.read(), p = perfNow();
        if (this.lastPerf !== null) { const dt = p - this.lastPerf; if (dt > 0 && dt < 1000) this.frameMs = dt; }
        this.lastPerf = p;
        for (const b of BANDS) this.bands[b] = 0;
        if (this.attach() && this.analyser) { this.analyser.getFloatFrequencyData(this.db); bandLevels(this.db, this.ctx.sampleRate, this.bands); }
        const out = Object.assign({}, c, { bands: Object.assign({}, this.bands) });
        if (source !== 'clock' && this.ctx) {
          const t = this.ctx.currentTime;
          out.kick = out.snare = out.hat = 0;
          for (const lane of ['kick', 'snare', 'hat']) {
            const L = this.lanes[lane], lvl = LANE_BANDS[lane].reduce((s, b) => s + this.bands[b], 0) / LANE_BANDS[lane].length;
            L.step(lvl, t);
            for (const h of L.hits) { const dt = t - h.time; if (dt >= 0) out[lane] = Math.max(out[lane], h.vel * (1 - Math.exp(-dt / 0.005)) * Math.exp(-dt / TAU[lane])); }
          }
          out.level = Math.max(out.kick, out.snare, out.hat);
        }
        this.logBeats(p);
        return out;
      },
      // QA: clock hits the visuals have now reached, logged once each
      logBeats(p) {
        if (!clock.ctx || !clock.playing || typeof clock.now !== 'function') return;
        const seen = clock.now();
        for (const h of clock.events) {
          if (h.time > seen || this.logged.has(h)) continue;
          this.logged.add(h);
          this.beatLog.push({ lane: h.lane, time: h.time, seen, lagMs: (seen - h.time) * 1000, frameMs: this.frameMs, perf: p });
          if (this.beatLog.length > LOG_KEPT) this.beatLog.shift();
        }
      },
      // onsets the 'mic'/'file' sources detected (empty for 'clock': its hits are clock.events)
      get events() { return source === 'clock' ? [] : [...this.lanes.kick.hits, ...this.lanes.snare.hits, ...this.lanes.hat.hits].sort((x, y) => x.time - y.time); },
      stop() { try { if (this.input && this.input.stop) this.input.stop(); } catch {} try { if (this.input) this.input.disconnect(); } catch {} this.input = null; },
    };
    return a;
  }

  // window.__qa.beatLog / .audioIn as getters (pages assign __qa with Object.assign, which would copy values once)
  function qa(a, target) {
    if (!target) return;
    Object.defineProperty(target, 'beatLog', { get: () => a.beatLog, configurable: true, enumerable: true });
    Object.defineProperty(target, 'audioIn', { get: () => ({ source: a.source, requested: a.requested, fallback: a.fallback, status: a.status, error: a.error, frameMs: a.frameMs }), configurable: true, enumerable: true });
  }

  const api = { create, qa, bandLevels, BANDS, EDGES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AudioIn = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
