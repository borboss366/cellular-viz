// The shared audio input: batch A of the clock port (contract: #95 comment 6533515449). Every page takes its audio
// from one of these instead of opening its own mic or reading its own clicks, so later sources (line-in through
// BlackHole, a file, DJ Link) change only this file, clock.js and the bridge, never the pages.
//
//   const clock = Clock.create({ source: qs.get('clock') || 'metronome', settings });
//   const audio = AudioIn.create({ clock, source: qs.get('audio') || 'clock' });
//   AudioIn.qa(audio, window.__qa);   // __qa.beatLog, .frame, .beatLanes, .events, .audioIn (live getters)
//   // in the rAF callback:
//   audio.frameStart(nowMs);          // top of the callback, before drawing: __qa.frame += 1, t, now, dt (audio clock)
//   const A = audio.read();           // { level, kick, snare, hat, bands: { sub … air }, wave }  (the #85 frame().audio)
//   for (const hit of audio.due(['kick'])) firePulse(hit);   // the hits the visuals reached this frame, logged
//
// read() is clock.read()'s kick/snare/hat/level/bands field for field under the default 'clock' source, so a page
// that swaps `clock.read()` for `audio.read()` looks exactly the same. Beats, bars, phase and bpm stay on clock.read().
// One AudioContext (the clock's) and one AnalyserNode. Sources:
//   'clock' (default)  the clock's own output (the synth metronome today). Lanes and level are the clock's numbers;
//                      bands are measured from the clicks on the analyser (the clock reports 0) and so is wave.
//   'mic' / 'line'     getUserMedia with deviceId exact and no echo cancellation, noise suppression or gain control,
//                      not routed to the speakers. The input is picked by label: ?audio=line&device=blackhole
//                      (case-insensitive substring of the audioinput label, remembered in localStorage; ?device=default
//                      forgets it). No match: a warning banner on the page, __qa.audioIn.warning, the default input. Lanes are band-onset envelopes (sub+kick → kick, mid → snare,
//                      air → hat) with the clock's TAU decay, so the pages' mappings read the same.
//   'file:<url>'       a decoded file, looped through the speakers and the analyser; lanes as for 'mic'.
// Anything else falls back to 'clock' and says so in .fallback (as the clock does). Analysis runs once per read();
// the fixed 57 Hz AudioWorklet cadence comes with the live tracker (clock PR 3).
//
// The runner's audio checks (#141, kind 'audio'): with a mic, line or file source, frameStart() also reads the
// analyser once and logs { t, rmsDb, bands[8] } per frame in __qa.audioIn.log (rmsDb: RMS of the raw waveform, dBFS,
// before any envelope); read() in the same frame reuses that reading. A page adds its own per-frame numbers to the
// frame's entry with audio.logFrame({ rows, lanes }). __qa.audioIn also has banner (the no-match warning is shown),
// openedAt (the frame clock, s, when the input opened), smoothing, fftSize and sampleRate.
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
  const DB_FLOOR = -90, DB_SPAN = 70, LOG_KEPT = 4096, LOG_FRAMES = 4000;   // LOG_FRAMES: ~66 s of audio log at 60 fps
  const nowSec = () => (root.performance ? root.performance.now() : Date.now()) / 1000;   // the frame clock (rAF time)

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
    const md = () => root.navigator && root.navigator.mediaDevices;
    const gum = opts.getUserMedia || (c => md().getUserMedia(c));
    const enumerate = opts.enumerateDevices || (() => (md() && md().enumerateDevices ? md().enumerateDevices() : Promise.resolve([])));
    const fetchFn = opts.fetch || (u => root.fetch(u));
    // the input device, by label (#95 comment 6481085928): ?device=blackhole is a case-insensitive substring of an
    // audioinput label, remembered in localStorage; ?device=default forgets it. Without a match: warn, default input.
    const storage = opts.storage !== undefined ? opts.storage : (() => { try { return root.localStorage || null; } catch (e) { return null; } })();
    const urlDevice = opts.device !== undefined ? opts.device : (() => { try { return new URLSearchParams(root.location.search).get('device'); } catch (e) { return null; } })();
    const DEVICE_KEY = 'cellular-viz.audioIn.device';
    let wantDevice = null;
    try {
      if (urlDevice !== null && urlDevice !== undefined) {
        if (urlDevice === '' || urlDevice.toLowerCase() === 'default') { if (storage) storage.removeItem(DEVICE_KEY); }
        else { wantDevice = urlDevice; if (storage) storage.setItem(DEVICE_KEY, urlDevice); }
      } else if (storage) wantDevice = storage.getItem(DEVICE_KEY) || null;
    } catch (e) { wantDevice = urlDevice || null; }
    const CLEAN = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    const ZERO = () => { const o = {}; for (const b of BANDS) o[b] = 0; return o; };

    const a = {
      source, requested, fallback, clock, ctx: null, analyser: null, input: null, db: null, wave: null,
      status: 'idle', error: null, running: false, warning: null, device: null,
      lanes: { kick: onsetLane('kick'), snare: onsetLane('snare'), hat: onsetLane('hat') },
      beatLog: [], beatLanes: null, frame: 0, t: null, dt: 0, rafDt: 0, now: null,
      log: [], logOn: source !== 'clock' || !!opts.log, dbFrame: -1, openedAt: null,
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
          this.openInput().then(stream => { this.input = ctx.createMediaStreamSource(stream); this.input.connect(this.analyser); this.status = source; this.openedAt = nowSec(); },
            e => { this.error = String(e && e.message || e); this.status = 'error'; });
        } else {
          this.status = 'loading';
          Promise.resolve(source.slice(5)).then(fetchFn).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b)).then(buf => {
            const s = this.input = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
            s.connect(this.analyser); s.connect(ctx.destination); s.start(); this.status = 'file'; this.openedAt = nowSec();
          }, e => { this.error = String(e && e.message || e); this.status = 'error'; });
        }
        return true;
      },
      // pick the input by label, then open it with deviceId exact and no browser processing (raw line-in)
      async openInput() {
        const inputs = async () => (await enumerate()).filter(d => d.kind === 'audioinput');
        let devs = await inputs(), pick = null;
        if (wantDevice) {
          if (devs.length && devs.every(d => !d.label)) {   // labels stay empty until the page has mic permission once
            const s = await gum({ audio: CLEAN }); try { s.getTracks().forEach(t => t.stop()); } catch (e) {}
            devs = await inputs();
          }
          const w = wantDevice.toLowerCase();
          pick = devs.find(d => (d.label || '').toLowerCase().includes(w)) || null;
          if (!pick) this.warn(`no audio input matches "${wantDevice}" (inputs: ${devs.map(d => d.label || '?').join(', ') || 'none'}); using the default input`);
        }
        if (!pick) pick = devs.find(d => d.deviceId === 'default') || devs[0] || null;
        this.device = pick ? { label: pick.label, deviceId: pick.deviceId, wanted: wantDevice } : { label: null, deviceId: null, wanted: wantDevice };
        return gum({ audio: pick ? { deviceId: { exact: pick.deviceId }, ...CLEAN } : CLEAN });
      },
      // a warning for the person at the laptop: console, __qa.audioIn.warning, and a small banner on the page
      warn(msg) {
        this.warning = msg;
        if (root.console) root.console.warn('[audio-in] ' + msg);
        try {
          const doc = root.document; if (!doc || !doc.body) return;
          let el = doc.getElementById('audio-in-warning');
          if (!el) {
            el = doc.createElement('div'); el.id = 'audio-in-warning'; el.title = 'click to hide';
            el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;max-width:60ch;padding:6px 10px;font:12px/1.4 system-ui,sans-serif;background:#3a2a00;color:#ffd27a;border:1px solid #a87a1a;border-radius:4px;cursor:pointer';
            el.onclick = () => el.remove(); doc.body.appendChild(el);
          }
          el.textContent = 'audio: ' + msg;
        } catch (e) {}
      },
      // the top of each rAF callback, before drawing: the frame counter and this frame's time (nowMs: rAF's argument).
      // The frame's visual time is clock.now(), read once here; dt is its step since the last frame, on the audio
      // clock (Chrome's currentTime can move in ~10 ms chunks, so a 16.7 ms frame may see a 20 ms step); rafDt is rAF's.
      frameStart(nowMs) {
        const t = (Number.isFinite(nowMs) ? nowMs : (root.performance ? root.performance.now() : Date.now())) / 1000;
        this.rafDt = this.t === null ? 0 : t - this.t; this.t = t; this.frame++;
        const now = clock.ctx && typeof clock.now === 'function' ? clock.now() : null;
        this.dt = Number.isFinite(now) && Number.isFinite(this.now) ? Math.max(0, now - this.now) : 0;
        this.now = Number.isFinite(now) ? now : null;
        if (this.logOn && this.running && this.ctx && this.analyser && (source === 'clock' || this.input)) this.sampleLog();
        return this.frame;
      },
      // one analyser reading for the frame's log entry (#141 audio checks); read() reuses it in the same frame
      sampleLog() {
        const A = this.analyser;
        A.getFloatFrequencyData(this.db); this.dbFrame = this.frame;
        let rmsDb = null;
        if (A.getFloatTimeDomainData) {
          A.getFloatTimeDomainData(this.wave);
          let s = 0; for (let i = 0; i < this.wave.length; i++) s += this.wave[i] * this.wave[i];
          rmsDb = +(10 * Math.log10(s / this.wave.length + 1e-20)).toFixed(2);
        }
        const b = bandLevels(this.db, this.ctx.sampleRate, {});
        this.log.push({ t: this.t, rmsDb, bands: BANDS.map(k => +b[k].toFixed(4)) });
        if (this.log.length > LOG_FRAMES) this.log.shift();
      },
      // the page's own numbers for this frame (16b: rows = the row glows, lanes = the band envelope each row follows)
      logFrame(extra) {
        const e = this.log[this.log.length - 1];
        if (e && e.t === this.t && extra) for (const [k, v] of Object.entries(extra)) e[k] = Array.isArray(v) || ArrayBuffer.isView(v) ? Array.from(v, x => +(+x).toFixed(4)) : v;
      },
      // the frame's audio (#85 frame().audio): call once per frame
      read() {
        const c = clock.read();
        const out = { level: c.level, kick: c.kick, snare: c.snare, hat: c.hat, bands: ZERO(), wave: null };
        if (!this.running || !this.attach() || !this.analyser) return out;
        const fresh = !(this.logOn && this.dbFrame === this.frame);   // frameStart's log reading, if this frame has one
        if (fresh) this.analyser.getFloatFrequencyData(this.db);
        bandLevels(this.db, this.ctx.sampleRate, out.bands);
        if (this.analyser.getFloatTimeDomainData) { if (fresh) this.analyser.getFloatTimeDomainData(this.wave); out.wave = this.wave; }
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
        // the frame's visual time from frameStart (so a hit is due in exactly the frame whose now passed it)
        const at = Number.isFinite(this.now) ? this.now : clock.now();
        const hits = clock.hitsDue(lanes, at);
        if (hits.length) {
          const beats = clock.read().beats;
          for (const h of hits) {
            this.beatLog.push({ time: h.time, lane: h.lane, now: at, beats, frame: this.frame, t: this.t, dt: this.dt, rafDt: this.rafDt });
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
    def('clockLate', () => (a.clock.lateStats ? a.clock.lateStats : null));   // #95: steps booked late (should be 0), largest frame gap, look-ahead
    def('fixRejected', () => a.clock.fixRejected || []);   // #95 beat authority: fix() calls from non-fix origins (should stay empty)
    def('events', () => (root.Clock && root.Clock.qaEvents ? root.Clock.qaEvents(a.clock) : [...(a.clock.hitLog || a.clock.events || [])]));
    def('audioIn', () => ({ source: a.source, requested: a.requested, fallback: a.fallback, status: a.status, error: a.error,
      warning: a.warning, device: a.device, banner: !!a.warning, openedAt: a.openedAt, log: a.log,
      smoothing: a.analyser ? a.analyser.smoothingTimeConstant : null, fftSize: a.analyser ? a.analyser.fftSize : null,
      sampleRate: a.ctx ? a.ctx.sampleRate : null,
      now: a.clock.ctx && a.clock.now ? a.clock.now() : null, playing: !!a.clock.playing }));
    return target;
  }

  const api = { create, qa, bandLevels, BANDS, EDGES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AudioIn = api;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));
