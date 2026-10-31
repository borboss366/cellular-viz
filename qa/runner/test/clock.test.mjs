// Clock PR 1 (experiments/clock.js): metronome parity with the copies in 11/13/19, phase and bar, the visual
// offset, and hand commands. No browser: a fake AudioContext whose currentTime the test moves.
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');

// ---------- a fake AudioContext: records nothing, only keeps time ----------
function fakeContext(outputLatency = 0.02) {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = extra => ({ connect() {}, ...extra });
  return {
    currentTime: 0, sampleRate: 64, outputLatency, baseLatency: 0.005, destination: {},
    resume() {},
    createGain: () => node({ gain: param() }),
    createOscillator: () => node({ frequency: param(), start() {}, stop() {} }),
    createBufferSource: () => node({ buffer: null, start() {}, stop() {} }),
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }),
    createAnalyser: () => node({ fftSize: 0, getFloatTimeDomainData() {} }),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
  };
}
const SETTINGS = () => ({ bpm: 128, bpb: 4, muted: false, kick: 'x---x---x---x---', snare: '----x-------x---', hat: '--x---x---x---x-' });
const QA = { origin: 'qa' };   // #95 beat authority: tests move the clock as QA

// ---------- the old copies, verbatim (13 with `settings`, 11 with `params`), for parity ----------
function old13(settings, ctx) {
  const window = { AudioContext: function () { return ctx; } };
  // ---------- metronome (as 11/19) ----------  (13-flow-lab.html at main 890c2de)
  const TAU = { kick: 0.150, snare: 0.120, hat: 0.040 };
  const LANES = ['kick', 'snare', 'hat'];
  const metronome = {
    ctx: null, master: null, noise: null, timer: 0, playing: false, nextTime: 0, step: 0, hits: [], steps: [],
    start() {
      if (!this.ctx) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.ctx = ctx; this.master = ctx.createGain(); this.master.connect(ctx.destination);
        this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = this.noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      this.ctx.resume(); this.master.gain.value = settings.muted ? 0 : 0.35;
      this.nextTime = this.ctx.currentTime + 0.05; this.step = 0; this.hits = []; this.steps = [];
      this.playing = true; this.timer = setInterval(() => this.schedule(), 25); this.schedule();
    },
    stop() { clearInterval(this.timer); this.playing = false; },
    setMuted(m) { if (this.master) this.master.gain.value = m ? 0 : 0.35; },
    schedule() {
      while (this.nextTime < this.ctx.currentTime + 0.1) { this.queueStep(this.step, this.nextTime); this.nextTime += 60 / settings.bpm / 4; this.step++; }
      const old = this.ctx.currentTime - 1;
      this.hits = this.hits.filter(h => h.time > old);
      while (this.steps.length > 2 && this.steps[1].time < old) this.steps.shift();
    },
    queueStep(step, time) {
      const inBar = step % (settings.bpb * 4); this.steps.push({ time, step });
      for (const lane of LANES) { if (settings[lane][inBar % 16] !== 'x') continue; const vel = inBar === 0 ? 1 : 0.7; this.hits.push({ lane, time, vel, step }); this.click(lane, time, vel); }
    },
    click(lane, t, vel) {
      const ctx = this.ctx, g = ctx.createGain(); g.connect(this.master);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vel, t + 0.003);
      let src;
      if (lane === 'kick') { src = ctx.createOscillator(); src.frequency.setValueAtTime(150, t); src.frequency.exponentialRampToValueAtTime(60, t + 0.08); src.connect(g); }
      else { src = ctx.createBufferSource(); src.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = lane === 'snare' ? 'bandpass' : 'highpass'; f.frequency.value = lane === 'snare' ? 1800 : 8000; src.connect(f); f.connect(g); }
      const end = t + TAU[lane] * 4; g.gain.exponentialRampToValueAtTime(0.001, end); src.start(t); src.stop(end + 0.01);
    },
    latency() { return this.ctx ? Math.min(0.3, this.ctx.outputLatency || this.ctx.baseLatency || 0) : 0; },
    read() {
      const out = { kick: 0, snare: 0, hat: 0, beats: -1 };
      if (!this.ctx) return out;
      const now = this.ctx.currentTime - this.latency();
      for (const h of this.hits) { const dt = now - h.time; if (dt >= 0) out[h.lane] = Math.max(out[h.lane], h.vel * (1 - Math.exp(-dt / 0.005)) * Math.exp(-dt / TAU[h.lane])); }
      let last = null; for (const s of this.steps) if (s.time <= now) last = s;
      if (last) out.beats = (last.step + Math.min(1, (now - last.time) / (60 / settings.bpm / 4))) / 4;
      return out;
    },
  };
  return metronome;
}
function old11(params, ctx) {   // 11-riemann-show.html at main 890c2de: the analyser bus and read(lead) → bars
  const TAU = { kick: 0.150, snare: 0.120, hat: 0.040 };
  const LANES = ['kick', 'snare', 'hat'];
  return {
    ctx: null, hits: [], steps: [], nextTime: 0, step: 0, playing: false,
    start() { this.ctx = ctx; this.nextTime = ctx.currentTime + 0.05; this.step = 0; this.hits = []; this.steps = []; this.playing = true; this.schedule(); },
    stop() { this.playing = false; },
    schedule() {
      while (this.nextTime < this.ctx.currentTime + 0.1) {
        this.queueStep(this.step, this.nextTime);
        this.nextTime += 60 / params.bpm / 4; this.step++;
      }
      const old = this.ctx.currentTime - 1;
      this.hits = this.hits.filter(h => h.time > old);
      while (this.steps.length > 2 && this.steps[1].time < old) this.steps.shift();
    },
    queueStep(step, time) {
      const inBar = step % (params.bpb * 4);
      this.steps.push({ time, step });
      for (const lane of LANES) {
        if (params[lane][inBar % 16] !== 'x') continue;
        const vel = inBar === 0 ? 1.0 : 0.7;
        this.hits.push({ lane, time, vel });
      }
    },
    latency() { return this.ctx ? Math.min(0.3, this.ctx.outputLatency || this.ctx.baseLatency || 0) : 0; },
    read(lead = 0) {
      const out = { kick: 0, snare: 0, hat: 0, bars: -1 };
      if (!this.ctx) return out;
      const now = this.ctx.currentTime - this.latency() + lead;
      for (const h of this.hits) {
        const dt = now - h.time;
        if (dt >= 0) out[h.lane] = Math.max(out[h.lane], h.vel * (1 - Math.exp(-dt / 0.005)) * Math.exp(-dt / TAU[h.lane]));
      }
      let last = null;
      for (const s of this.steps) if (s.time <= now) last = s;
      if (last) {
        const sixteenth = 60 / params.bpm / 4, frac = Math.min(1, (now - last.time) / sixteenth);
        out.bars = (last.step + frac) / (params.bpb * 4);
      }
      return out;
    },
  };
}

// drive a clock like the page does: schedule every 25 ms, read on 60 Hz frames
function drive(clocks, ctx, seconds, onFrame) {
  let nextTick = 0;
  for (let f = 0; f * (1 / 60) < seconds; f++) {
    ctx.currentTime = 0.3 + f / 60;
    while (nextTick <= ctx.currentTime) { for (const c of clocks) c.schedule(); nextTick += 0.025; }
    onFrame(f);
  }
}
const hitKey = h => `${h.lane}@${h.time.toFixed(9)}v${h.vel}` + (h.step === undefined ? '' : `s${h.step}`);

test('metronome parity with 13: same hits and drums on every frame; same beats at a steady bpm', () => {
  const s1 = SETTINGS(), s2 = SETTINGS(), ctx = fakeContext();
  const old = old13(s1, ctx), neu = Clock.create({ settings: s2, audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; old.start(); old.stop(); old.playing = true; neu.start();
  let frames = 0, compared = 0, lastBeats = -1, changedAt = -1;
  drive([old, neu], ctx, 40, f => {
    // tempo changes mid-run (the bpm slider): up, then down. Hits follow them identically. Beats differ only
    // for the sixteenths booked before the change (≤ 0.25 s), where the old copies re-timed them at the new rate
    if (f === 900) { s1.bpm = s2.bpm = 140; changedAt = ctx.currentTime; }
    if (f === 1500) { s1.bpm = s2.bpm = 96; changedAt = ctx.currentTime; }
    if (f === 1800) { s1.kick = s2.kick = 'x-x-x-x-x-x-x-x-'; }
    const a = old.read(), b = neu.read();
    for (const k of ['kick', 'snare', 'hat']) assert.equal(b[k], a[k], `frame ${f}: ${k}`);
    if (changedAt < 0 || ctx.currentTime - changedAt > 0.25) { assert.equal(b.beats, a.beats, `frame ${f}: beats`); compared++; }
    assert.ok(b.beats >= lastBeats, `frame ${f}: beats went back ${lastBeats} → ${b.beats}`); lastBeats = b.beats;
    assert.deepEqual(neu.hits.map(hitKey), old.hits.map(hitKey), `frame ${f}: hits`);
    frames++;
  });
  assert.ok(frames >= 2400 && compared >= frames - 40);
  assert.ok(neu.hits.every(h => h.type === 'hit'));
});

test('metronome parity with 11: hits without step, read(lead) gives the same bars and drums', () => {
  const p1 = SETTINGS(), p2 = SETTINGS(), ctx = fakeContext();
  const old = old11(p1, ctx), neu = Clock.create({ settings: p2, analyser: true, hitStep: false, audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; old.start(); neu.start();
  drive([old, neu], ctx, 20, f => {
    for (const lead of [0, 0.05]) {
      const a = old.read(lead), b = neu.read(lead);
      for (const k of ['kick', 'snare', 'hat', 'bars']) assert.equal(b[k], a[k], `frame ${f} lead ${lead}: ${k}`);
    }
    assert.deepEqual(neu.hits.map(hitKey), old.hits.map(hitKey));
  });
  assert.ok(neu.wave instanceof Float32Array && neu.analyser);
});

test('phase is the fraction of beats in [0,1); bar and beatInBar count bpb', () => {
  const ctx = fakeContext(0), s = SETTINGS(); s.bpb = 3;
  const c = Clock.create({ settings: s, audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; c.start();
  let lastBeat = -1;
  drive([c], ctx, 15, () => {
    const r = c.read();
    if (r.beats < 0) return;
    assert.ok(r.phase >= 0 && r.phase < 1);
    assert.ok(Math.abs(r.beats - Math.floor(r.beats) - r.phase) < 1e-12);
    const k = Math.floor(r.beats);
    assert.equal(r.bar, Math.floor(k / 3)); assert.equal(r.beatInBar, k % 3 + 1);
    assert.equal(r.bars, r.beats / 3);
    assert.ok(r.beats >= lastBeat, 'beats never go backwards'); lastBeat = r.beats;
    assert.equal(r.confidence, 1); assert.equal(r.bpm, 128);
    assert.equal(Object.keys(r.bands).join(), Clock.BANDS.join());
  });
});

test('visual offset: read() is the raw clock read later by the offset; clamped to −100 … +200 ms', () => {
  const ctx = fakeContext(), c = Clock.create({ settings: SETTINGS(), audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; c.start();
  assert.equal(c.visualOffsetMs, 0);
  for (const X of [-40, 25, 100]) {
    c.setVisualOffset(X);
    drive([c], ctx, 3, () => {
      const a = c.read(), b = c.read({ raw: true, lead: X / 1000 });
      for (const k of ['kick', 'snare', 'hat', 'beats', 'phase', 'bar', 'beatInBar']) assert.equal(a[k], b[k], `X ${X}: ${k}`);
      assert.ok(Math.abs(c.now() - c.now({ raw: true }) - X / 1000) < 1e-12);
    });
  }
  c.setVisualOffset(0);
  const a = c.read(), b = c.read({ raw: true });
  assert.deepEqual(a, b, 'at 0 the offset changes nothing');
  assert.equal(c.setVisualOffset(-500), -100); assert.equal(c.setVisualOffset(999), 200);
  assert.equal(c.setVisualOffset(NaN), 200); assert.equal(c.setVisualOffset(-100.5), -100);
});

test('the offset never touches beats or bpm at a fixed audio time', () => {
  const ctx = fakeContext(), c = Clock.create({ settings: SETTINGS(), audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; c.start();
  drive([c], ctx, 2, () => {});
  const base = c.read({ raw: true });
  for (const X of [-100, -3, 0, 17, 200]) { c.setVisualOffset(X); const r = c.read({ raw: true }); assert.equal(r.beats, base.beats); assert.equal(r.bpm, base.bpm); }
});

test('hand commands are visible on the next read and logged as jumps, never as hits', () => {
  const ctx = fakeContext(0), s = SETTINGS(), c = Clock.create({ settings: s, audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; c.start();
  drive([c], ctx, 4.01, () => {});
  const r0 = c.read();
  // nudge: +20 ms moves the clock ahead by 20 ms of beats at once
  const j1 = c.fix('nudge', 20, QA), r1 = c.read();
  assert.ok(Math.abs(r1.beats - r0.beats - 0.020 * 128 / 60) < 1e-9);
  assert.equal(j1.kind, 'nudge'); assert.ok(Math.abs(j1.toBeats - j1.fromBeats - 0.020 * 128 / 60) < 1e-9);
  // setOne: relabels bar and beatInBar only
  const j2 = c.fix('setOne', QA), r2 = c.read();
  assert.equal(r2.beats, r1.beats); assert.equal(j2.fromBeats, j2.toBeats);
  assert.equal(r2.beatInBar, Math.floor(r2.beats) - Math.round(r2.beats) + 1 || 4);
  // x2 / half: the rate doubles and halves from now, clamped 30 … 300
  c.fix('x2', QA); assert.equal(s.bpm, 256); c.fix('x2', QA); assert.equal(s.bpm, 300);
  c.fix('half', QA); assert.equal(s.bpm, 150); s.bpm = 128;
  // reset: the current beat becomes beat 0 of bar 0, with the phase kept
  const before = c.read().phase, j5 = c.fix('reset', QA), r5 = c.read();
  assert.ok(r5.beats >= 0 && r5.beats < 1); assert.ok(Math.abs(r5.phase - before) < 1e-9);
  assert.equal(r5.bar, 0); assert.equal(r5.beatInBar, 1); assert.equal(j5.kind, 'reset');
  assert.equal(c.fix('seek', 10, QA), null, 'seek and cue belong to file sources');
  assert.equal(c.fix('bogus', QA), null);
  // logs: jumps only in .jumps, hits only in .events, and the QA view merges them by time
  assert.deepEqual(c.jumps.map(j => j.kind), ['nudge', 'setOne', 'x2', 'x2', 'half', 'reset']);
  assert.ok(c.events.every(e => e.type === 'hit' && 'lane' in e));
  const q = Clock.qaEvents(c), t = e => e.type === 'jump' ? e.at : e.time;
  assert.equal(q.length, c.hitLog.length + c.jumps.length);   // batch A: qaEvents lists every hit since start (hitLog), not the last second
  for (let i = 1; i < q.length; i++) assert.ok(t(q[i]) >= t(q[i - 1]));
});

test('beats keep running forward after x2 and half (no backwards step)', () => {
  const ctx = fakeContext(0), s = SETTINGS(), c = Clock.create({ settings: s, audioContext: () => ctx, timers: false });
  ctx.currentTime = 0.3; c.start();
  let last = -1, n = 0;
  drive([c], ctx, 12, f => {
    if (f === 200) c.fix('x2', QA);
    if (f === 400) c.fix('half', QA);
    const b = c.read().beats; if (b < 0) return;
    assert.ok(b >= last - 1e-12, `frame ${f}: ${last} → ${b}`); last = b; n++;
  });
  assert.ok(n > 600);
});

test('sources not built yet fall back to the metronome and say so', () => {
  const orig = console.warn; const warned = []; console.warn = m => warned.push(m);
  try {
    for (const src of ['line', 'file:track.wav', 'nonsense']) {
      const c = Clock.create({ source: src, audioContext: fakeContext, timers: false });
      assert.equal(c.source, 'metronome'); assert.equal(c.requested, src); assert.ok(c.fallback);
    }
    assert.equal(warned.length, 3);
    const m = Clock.create({ audioContext: fakeContext, timers: false });
    assert.equal(m.source, 'metronome'); assert.equal(m.fallback, null);
    assert.equal(m.settings.bpm, 120); assert.equal(m.read().beats, -1, 'not started: beats −1 as today');
  } finally { console.warn = orig; }
});

// ---------- #95 (31 Oct): booking under long frames (16b morphs 72 ms late at 4K) ----------
function longFrames({ frameMs, seconds, bpm, pump = true, perFrameTimer = false }) {
  const ctx = fakeContext(0), s = SETTINGS(); s.bpm = bpm;
  let wall = 0;
  const c = Clock.create({ settings: s, audioContext: () => ctx, timers: false, pump, now: () => wall });
  ctx.currentTime = 0.3; c.start();
  let prevNow = -Infinity, handed = 0, firstRead = 0;
  for (let f = 1; f * frameMs / 1000 <= seconds; f++) {
    ctx.currentTime = 0.3 + f * frameMs / 1000; wall = f * frameMs;
    if (perFrameTimer) c.schedule();   // the old way: a 25 ms timer starved to one call per long frame
    c.read();
    const now = c.now();
    for (const h of c.hitsDue()) { handed++; if (h.time <= now && h.time > prevNow) firstRead++; }
    prevNow = now;
  }
  const due = c.hitLog.filter(h => h.time <= prevNow).length;
  return { c, handed, firstRead, due };
}

test('#95 truth: 150 ms frames at 174 bpm for 30 s: no late bookings, every hit handed out at the first read at or after its time', () => {
  const { c, handed, firstRead, due } = longFrames({ frameMs: 150, seconds: 30, bpm: 174 });
  assert.equal(c.lateStats.late, 0, `late bookings ${JSON.stringify(c.lateStats)}`);
  assert.ok(handed > 30 * 174 / 60 * 2, `${handed} hits`);   // ≥ kicks + hats over 30 s
  assert.equal(handed, due, 'every hit up to the last read handed out');
  assert.equal(firstRead, handed, 'each at the first read at or after its time');
  assert.equal(c.lateStats.lookAheadMs, 250);
  assert.equal(Math.round(c.lateStats.maxGapMs), 150);
});

test('#95: the same frames with only a starved timer (fixed 0.1 s look-ahead, no pump) book late, and lateStats says so', () => {
  const { c } = longFrames({ frameMs: 150, seconds: 10, bpm: 174, pump: false, perFrameTimer: true });
  assert.ok(c.lateStats.late > 0 && c.lateStats.lateMaxMs > 0, JSON.stringify(c.lateStats));
});

test('#95: look-ahead = clamp(2 × p95 of the last 120 frame gaps, 0.1, 0.25); 0.25 until 10 frames are seen', () => {
  assert.equal(longFrames({ frameMs: 1000 / 60, seconds: 0.1, bpm: 120 }).c.lateStats.lookAheadMs, 250);   // 6 frames: not enough yet
  assert.equal(longFrames({ frameMs: 1000 / 60, seconds: 5, bpm: 120 }).c.lateStats.lookAheadMs, 100);
  assert.equal(longFrames({ frameMs: 90, seconds: 5, bpm: 120 }).c.lateStats.lookAheadMs, 180);
  const { c } = longFrames({ frameMs: 1000 / 60, seconds: 5, bpm: 120 });
  assert.equal(c.lateStats.late, 0);
});

test('#95: schedule() runs at most once per frame (read() then hitsDue() in the same frame count one gap)', () => {
  const ctx = fakeContext(0); let wall = 0;
  const c = Clock.create({ settings: SETTINGS(), audioContext: () => ctx, timers: false, pump: true, now: () => wall });
  ctx.currentTime = 0.3; c.start();
  for (let f = 1; f <= 20; f++) { wall = f * 16; ctx.currentTime = 0.3 + f * 0.016; c.read(); c.hitsDue(); c.read({ raw: true }); }
  assert.equal(c.gaps.length, 19);
});

// ---------- #95 beat authority (the user's decision, 31 Oct) ----------
function lcg(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function pumped(bpm = 128, ctxFn = () => fakeContext(0)) {
  const ctx = ctxFn(), s = SETTINGS(); s.bpm = bpm;
  let wall = 0;
  const c = Clock.create({ settings: s, audioContext: () => ctx, timers: false, pump: true, now: () => wall });
  ctx.currentTime = 0.3; c.start();
  return { c, ctx, s, at: (sec, ms) => { ctx.currentTime = sec; wall = ms; } };
}

test('#95 truth 1: ~500 gesture, macro and trigger events never move the beat (0 jumps, raw beats as without input)', () => {
  const A = pumped(), B = pumped(), rnd = lcg(95);
  const origins = ['gesture:leap', 'gesture:flow', 'wave', 'macro:2', 'trigger:1', 'trigger:3'], kinds = ['nudge', 'x2', 'half', 'tap', 'setOne', 'reset'];
  let events = 0, fixes = 0;
  for (let f = 1; f <= 60 * 60; f++) {
    const sec = 0.3 + f / 60, ms = f * 1000 / 60;
    A.at(sec, ms); B.at(sec, ms);
    if (rnd() < (f % 600 < 60 ? 8 / 60 : 0.11)) {   // a mash at ~8/s for 1 s every 10 s, ~6.6/s sparse otherwise
      events++;
      const r = rnd();
      if (r < 0.25) B.c.read(); else if (r < 0.4) B.c.nextBeatAt(); else if (r < 0.55) B.c.nextBarAt();
      else { fixes++; assert.equal(B.c.fix(kinds[Math.floor(rnd() * kinds.length)], 30, { origin: origins[Math.floor(rnd() * origins.length)] }), null); }
    }
    const a = A.c.read({ raw: true }).beats, b = B.c.read({ raw: true }).beats;
    assert.ok(Math.abs(a - b) < 1e-9, `frame ${f}: ${a} vs ${b}`);
  }
  assert.ok(events >= 320 && events <= 600, `${events} events (about 500 wanted)`);
  assert.equal(B.c.jumps.length, 0);
  assert.equal(B.c.fixRejected.length, Math.min(fixes, 256));
  assert.equal(A.c.lateStats.late + B.c.lateStats.late, 0);
});

test('#95 truth 2: a fix() from a non-fix origin changes nothing and logs one fixRejected entry', () => {
  const { c, at } = pumped();
  for (let f = 1; f <= 120; f++) { at(0.3 + f / 60, f * 1000 / 60); c.read(); }
  const before = c.read({ raw: true }).beats;
  assert.equal(c.fix('nudge', 30, { origin: 'gesture:leap' }), null);
  assert.equal(c.fixRejected.length, 1);
  assert.deepEqual([c.fixRejected[0].kind, c.fixRejected[0].origin], ['nudge', 'gesture:leap']);
  assert.equal(c.jumps.length, 0);
  assert.equal(c.read({ raw: true }).beats, before);
  assert.equal(c.fix('x2'), null, 'no origin at all is rejected too');
  assert.equal(c.fixRejected.length, 2);
});

test('#95 truth 3: the Shift guard: a hand-fix key without Shift gives 0 jumps, with Shift exactly 1 of its kind', () => {
  const { c, at, s } = pumped();
  for (let f = 1; f <= 120; f++) { at(0.3 + f / 60, f * 1000 / 60); c.read(); }
  for (const code of ['KeyA', 'KeyH', 'KeyD', 'Digit1', 'Comma', 'Period', 'Digit0']) assert.equal(c.handFixKey({ code, shiftKey: false }), null, code);
  assert.equal(c.jumps.length, 0); assert.equal(s.bpm, 128);
  assert.equal(c.handFixKey({ code: 'KeyX', shiftKey: true }), null, 'not a hand-fix key');
  assert.equal(c.handFixKey({ code: 'KeyD', shiftKey: true, ctrlKey: true }), null, 'Ctrl+Shift is not the guard');
  const j = c.handFixKey({ code: 'KeyD', shiftKey: true });
  assert.equal(c.jumps.length, 1); assert.equal(j.kind, 'x2'); assert.equal(j.origin, 'fix:key'); assert.equal(s.bpm, 256);
  const k = c.fix('setOne', { origin: 'fix:controller' });
  assert.equal(k.kind, 'setOne'); assert.equal(c.jumps.length, 2);
});

test('#95: nextBeatAt / nextBarAt are read-only and land on the next beat and bar line', () => {
  const { c, at } = pumped();
  for (let f = 1; f <= 200; f++) { at(0.3 + f / 60, f * 1000 / 60); c.read(); }
  const nb = c.nextBeatAt(), nbar = c.nextBarAt(), now = c.now(), beats = c.read().beats;
  assert.ok(nb > now && nb - now <= 60 / 128 + 1e-9);
  assert.ok(Math.abs((beats + (nb - now) * 128 / 60) % 1) < 1e-9 || Math.abs((beats + (nb - now) * 128 / 60) % 1 - 1) < 1e-9);
  const atBar = beats + (nbar - now) * 128 / 60;
  assert.ok(Math.abs(atBar / 4 - Math.round(atBar / 4)) < 1e-9 && nbar >= nb - 1e-9);
  assert.equal(c.jumps.length, 0); assert.equal(c.fixRejected.length, 0);
});

// a fake AudioContext that records every click source: its start time and whether it was stopped before it began
function recordingContext() {
  const srcs = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = x => ({ connect() {}, disconnect() {}, ...x });
  const src = () => node({ frequency: param(), buffer: null, start(t) { this.t = t; srcs.push(this); }, stop(w) { if (this.t !== undefined && w < this.t) this.cancelled = true; } });
  return { srcs, currentTime: 0, sampleRate: 48000, outputLatency: 0.02, baseLatency: 0.005, destination: {}, resume() {},
    createGain: () => node({ gain: param() }), createOscillator: src, createBufferSource: src,
    createBiquadFilter: () => node({ type: '', frequency: { value: 0 } }), createAnalyser: () => node({}),
    createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }) };
}

for (const cmd of ['tap', 'nudge', 'x2']) {
  test(`#95 truth 4 (${cmd}): 174 bpm, 150 ms frames: no old-grid click after the command, new clicks on the new grid, no doubles, late 0`, () => {
    const ctx = recordingContext(), s = SETTINGS(); s.bpm = 174; s.hat = 'xxxxxxxxxxxxxxxx';   // a click on every sixteenth
    let wall = 0;
    const c = Clock.create({ settings: s, audioContext: () => ctx, timers: false, pump: true, now: () => wall });
    ctx.currentTime = 0.3; c.start();
    let f = 0;
    const frame = () => { f++; ctx.currentTime = 0.3 + f * 0.15; wall = f * 150; c.read(); c.hitsDue(); };
    for (let i = 0; i < 20; i++) frame();
    assert.equal(c.lateStats.lookAheadMs, 250, 'look-ahead at its maximum');
    let jump;
    if (cmd === 'tap') { c.fix('tap', QA); for (let i = 0; i < 3; i++) frame(); c.fix('tap', QA); for (let i = 0; i < 3; i++) frame(); jump = c.fix('tap', QA); assert.ok(Math.abs(s.bpm - 60 / 0.45) < 1e-6, `tap tempo ${s.bpm}`); }
    else if (cmd === 'nudge') jump = c.fix('nudge', 30, QA);
    else { jump = c.fix('x2', QA); assert.equal(s.bpm, 300); }
    const ct = ctx.currentTime, sixteenth = 60 / s.bpm / 4;
    for (let i = 0; i < 14; i++) frame();
    const onsets = ctx.srcs.filter(x => !x.cancelled).map(x => x.t).sort((a, b) => a - b);
    const after = onsets.filter(t => t > ct + 128 / 48000);
    assert.ok(after.length > 10, `${after.length} clicks after the command`);
    for (const t of after) {
      const n = (t - jump.at) / sixteenth + 4 * jump.toBeats;
      assert.ok(Math.abs(n - Math.round(n)) * sixteenth < 0.001, `click at ${t.toFixed(4)} is ${(Math.abs(n - Math.round(n)) * sixteenth * 1000).toFixed(2)} ms off the new grid`);
    }
    for (let i = 1; i < onsets.length; i++) { const d = onsets[i] - onsets[i - 1]; assert.ok(d < 1e-9 || d >= 0.020, `double click ${(d * 1000).toFixed(1)} ms apart at ${onsets[i].toFixed(4)}`); }
    assert.ok(ctx.srcs.some(x => x.cancelled), 'booked old-grid clicks were stopped');
    assert.ok(c.hitLog.every((h, i) => i === 0 || c.hitLog[i - 1].time <= h.time));
    assert.equal(c.lateStats.late, 0);
  });
}
