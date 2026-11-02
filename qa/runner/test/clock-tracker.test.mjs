// Clock PR 3a (#173): the worklet's analysis and the tracker port, on synthetic tracks only (no audio files).
// Brief task 1 (analysis) and task 2 (tracker suite), plus the #95 amendments R1 (re-acquire after a breakdown) and
// R5 (tap escape). Scenarios: qa/runner/test/fixtures/tracker-scenarios.mjs (VIZ pages, e64c6d0).
// Numbers per scenario are printed (bpm error, phase p50/p90 at true beats after lock, lock time, octave) so a
// failing gate shows where it stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { render, renderHits } from './fixtures/tracker-scenarios.mjs';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/clock-tracker.js');

const SR = 44100;
const pct = (a, p) => { if (!a.length) return NaN; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))]; };
const frac = x => x - Math.round(x);

// run a scenario through the analysis and the tracker, frame by frame; `bursts` holds frames back and releases them
// together (the tracker uses each frame's own t, so a blocked main thread loses nothing); `at` hooks run once when
// the analysis reaches a time (for taps)
function run(s, { bursts = null, at = [] } = {}) {
  const tr = T.createTracker();
  const frames = [];
  const an = T.createAnalyzer({ sampleRate: s.sr, onFrame: f => frames.push(f) });
  for (let i = 0; i < s.samples.length; i += 128) an.process(s.samples.subarray(i, Math.min(s.samples.length, i + 128)), i / s.sr);
  const out = { tr, errs: [], beatsSeen: [], conf: [], lockT: null, monotonic: true };
  let bi = 0, prevB = -Infinity, queue = [], hooks = at.slice().sort((a, b) => a.t - b.t);
  const feed = f => {
    while (hooks.length && hooks[0].t <= f.t) hooks.shift().fn(tr, f.t);
    tr.push(f);
    const b = tr.beatsAt(f.t);
    if (out.lockT !== null && b < prevB - 1e-9) out.monotonic = false;   // acquisition may snap; after the first lock, never back
    prevB = b;
    out.conf.push({ t: f.t, c: tr.confidence, state: tr.state });
    if (out.lockT === null && tr.state === 'locked') out.lockT = f.t;
    while (bi < s.beats.length && s.beats[bi] <= f.t) {   // the tracker's phase at each true beat, as of that moment
      out.errs.push({ i: bi, t: s.beats[bi], e: frac(tr.beatsAt(s.beats[bi])), locked: tr.state === 'locked' });
      bi++;
    }
  };
  for (const f of frames) {
    if (bursts) {
      queue.push(f);
      const gap = bursts.find(g => f.t >= g.t && f.t < g.t + g.ms / 1000);
      if (gap) continue;   // the main thread is blocked: messages pile up
      for (const q of queue) feed(q);
      queue = [];
    } else feed(f);
  }
  for (const q of queue) feed(q);
  return out;
}
// phase error in beats at true beats after lock + settle beats. The analysis delay is one constant
// (ANALYSIS_DELAY_MS, placeholder until 3c measures it on truth (a), R3), so the phase gates here measure the error
// around its own median: `bias` is printed and the spread is gated. R3 gates the bias on the box.
function phaseStats(o, s, { from = 0, to = Infinity, settle = 8, bias = null } = {}) {
  const lockBeat = o.lockT === null ? Infinity : s.beats.findIndex(t => t >= o.lockT);
  const sig = o.errs.filter(x => x.i >= lockBeat + settle && x.t >= from && x.t < to).map(x => x.e);
  const b = bias ?? (sig.length ? pct(sig, 0.5) : 0), e = sig.map(x => Math.abs(x - b));
  return { n: e.length, bias: b, p50: pct(e, 0.5), p90: pct(e, 0.9), max: e.length ? Math.max(...e) : NaN };
}
// the steering lane (3c): which lane, R per lane (now and mean while locked), every switch
const laneStr = tr => { const L = tr.laneReport(), sd = L.side; return `timing broad; R broad ${L.R.broad} (half-period ${L.R2.broad}) low ${L.R.low} (half-period ${L.R2.low}); side offset ${sd.offset}${sd.hand ? ' (hand)' : ''}, at lock ${JSON.stringify(sd.atLock)}, moves ${sd.moves.map(m => `${m.why}@${m.t}`).join(', ') || 'none'}`; };
const sustained = tr => tr.laneLog.filter(x => x.why === 'sustained');
const fmt = (s, o, st, extra = '') => `${s.name}: bpm ${o.tr.ownBpm.toFixed(2)} (true ${[].concat(s.bpm).join('→')}), lock ${o.lockT === null ? 'never' : o.lockT.toFixed(2) + ' s'}, bias ${(st.bias * 60000 / [].concat(s.bpm).slice(-1)[0]).toFixed(1)} ms, phase p50 ${st.p50.toFixed(4)} p90 ${st.p90.toFixed(4)} max ${st.max.toFixed(4)} beat (n ${st.n}), jumps ${o.tr.jumps.map(j => j.kind).join(',') || 'none'}, ${laneStr(o.tr)}${extra}`;

// ---------------------------------------------------------------- task 1: analysis
test('analysis: a click stream gives a flux peak in the first two frames that hold each click', () => {
  const clicks = []; for (let t = 0.5; t < 9.5; t += 0.5) clicks.push(t);
  const x = new Float32Array(10 * SR);
  for (const t of clicks) { const i0 = Math.round(t * SR); for (let i = 0; i < 64; i++) x[i0 + i] += (i % 2 ? -0.8 : 0.8) * Math.exp(-i / 16); }
  const an = T.createAnalyzer({ sampleRate: SR });
  for (let i = 0; i < x.length; i += 128) an.process(x.subarray(i, i + 128), i / SR);
  const hop = 512 / SR, f = an.frames, lags = [];
  for (const t of clicks) {
    let best = null;
    for (let k = 1; k < f.length - 1; k++) if (f[k].t > t - 2 * hop && f[k].t < t + 3 * hop && (!best || f[k].flux > best.flux)) best = f[k];
    assert.ok(best && best.flux > 0, `a flux peak near ${t}`);
    // a click sits in two windows (hop = half a window); the flux peak is in one of them, so the peak frame ends
    // 0–2 hops after the click. That lag is part of ANALYSIS_DELAY_MS (R3 measures it in 3c).
    assert.ok(best.t - t >= -1e-9 && best.t - t <= 2 * hop + 1e-9, `click ${t}: peak frame ends ${((best.t - t) * 1000).toFixed(2)} ms after it`);
    lags.push(best.t - t);
  }
  console.log(`click → flux peak frame end: median ${(pct(lags, 0.5) * 1000).toFixed(1)} ms, max ${(Math.max(...lags) * 1000).toFixed(1)} ms`);
  // between clicks the flux falls to (near) nothing
  const quiet = f.filter(fr => clicks.every(t => Math.abs(fr.t - t) > 0.1)).map(fr => fr.flux);
  const peak = Math.max(...f.map(fr => fr.flux));
  assert.ok(Math.max(...quiet) < 0.05 * peak, 'no flux between clicks');
});

test('analysis: band levels of a 1 kHz sine sit in the mid band, ~−9 dB at amplitude 0.5', () => {
  const x = new Float32Array(SR); for (let i = 0; i < x.length; i++) x[i] = 0.5 * Math.sin(2 * Math.PI * 1000 * i / SR);
  const an = T.createAnalyzer({ sampleRate: SR });
  an.process(x, 0);
  const b = an.frames[an.frames.length - 1].bands, top = Object.keys(b).sort((p, q) => b[q] - b[p])[0];
  assert.equal(top, 'mid');
  console.log(`1 kHz sine at 0.5: bands ${Object.entries(b).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', ')} dB`);
});

test('the worklet source carries the same analysis and registers clock-tracker', () => {
  assert.match(T.WORKLET_SOURCE, /registerProcessor\('clock-tracker'/);
  assert.ok(T.WORKLET_SOURCE.includes('function createAnalyzer') && T.WORKLET_SOURCE.includes('function fftInPlace'));
  assert.equal(typeof T.ANALYSIS_DELAY_MS, 'number');
});

test('fftInPlace: a cosine at bin 5 of 64 lands in bin 5 (and 59)', () => {
  const n = 64, re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = Math.cos(2 * Math.PI * 5 * i / n);
  T.fftInPlace(re, im);
  for (let k = 0; k < n; k++) { const m = Math.hypot(re[k], im[k]); if (k === 5 || k === 59) assert.ok(Math.abs(m - n / 2) < 1e-9); else assert.ok(m < 1e-9, `bin ${k}: ${m}`); }
});

// ---------------------------------------------------------------- task 2: the tracker suite
for (const name of ['128-steady', '127.3-steady', 'humanize-10ms']) {
  test(`${name}: bpm ±1, phase p90 ≤ 0.03 beat after lock`, () => {
    const s = render(name, { sr: SR }), o = run(s), st = phaseStats(o, s);
    console.log(fmt(s, o, st));
    assert.ok(o.lockT !== null && o.lockT < 10, `locks within 10 s (${o.lockT})`);
    assert.ok(Math.abs(o.tr.ownBpm - s.bpm) <= 1, `bpm ${o.tr.ownBpm} vs ${s.bpm}`);
    assert.ok(st.p90 <= 0.03, `phase p90 ${st.p90}`);
    assert.ok(o.monotonic, 'beats monotonic');
    assert.equal(o.tr.jumps.filter(j => j.kind === 'side').length, 0, `no side move on a steady track: ${laneStr(o.tr)}`);
  });
}

test('128-bursty: frames held back 150 ms every 2 s change nothing that matters', () => {
  const s = render('128-bursty', { sr: SR }), o = run(s, { bursts: s.events }), st = phaseStats(o, s);
  console.log(fmt(s, o, st));
  assert.ok(Math.abs(o.tr.ownBpm - 128) <= 1);
  assert.ok(st.p90 <= 0.03, `phase p90 ${st.p90}`);
  assert.ok(o.monotonic);
});

test('81-stomp-clap: reported (octave predicted double, never gated)', () => {
  const s = render('81-stomp-clap', { sr: SR }), o = run(s), st = phaseStats(o, s);
  const q = o.tr.ownBpm / 81, octave = Math.abs(q - 2) < 0.05 ? 'double' : Math.abs(q - 1) < 0.05 ? 'same' : Math.abs(q - 0.5) < 0.03 ? 'half' : 'other';
  console.log(fmt(s, o, st, `, octave ${octave} (predicted ${s.expect.octave})`));
  assert.ok(['double', 'same'].includes(octave), `81 tracked as ${o.tr.ownBpm}`);
});

test('step-120-128: re-lock ≤ 8 beats after the step', () => {
  const s = render('step-120-128', { sr: SR }), o = run(s);
  const bias = phaseStats(o, s, { to: 30 }).bias;   // the analysis delay, from the steady part before the step
  const after = o.errs.filter(x => x.t >= 30);
  // re-lock: the first true beat after the step from which the next 4 beats all sit within 0.05 beat (around the bias)
  let relock = -1;
  for (let k = 0; k + 4 <= after.length; k++) if (after.slice(k, k + 4).every(x => Math.abs(x.e - bias) <= 0.05)) { relock = k; break; }
  const st = phaseStats(o, s, { from: 30 + 8 * 0.46875 });
  const trace = after.slice(0, 20).map(x => (x.e - bias).toFixed(3)).join(' ');
  const detail = `re-lock after ${relock} beats; error per beat after the step (beats, bias ${bias.toFixed(3)} removed): ${trace}; bpm ${o.tr.ownBpm.toFixed(2)}`;
  console.log(fmt(s, o, st, `, ${detail}`));
  assert.ok(relock >= 0 && relock <= 8, detail);
  assert.ok(Math.abs(o.tr.ownBpm - 128) <= 1, `bpm ${o.tr.ownBpm}`);
  assert.ok(o.monotonic);
});

test('dropout-2s: confidence falls in the dropout and recovers, beats never rewind', () => {
  const s = render('dropout-2s', { sr: SR }), o = run(s);
  const before = o.conf.filter(c => c.t > 17 && c.t < 20).map(c => c.c), during = o.conf.filter(c => c.t > 21.5 && c.t < 22).map(c => c.c);
  const end = o.conf.filter(c => c.t > 30).map(c => c.c);
  const st = phaseStats(o, s, { from: 26 });
  console.log(fmt(s, o, st, `, conf before ${Math.min(...before).toFixed(2)}, in dropout ${Math.min(...during).toFixed(2)}, after ${Math.min(...end).toFixed(2)}`));
  assert.ok(Math.min(...during) < Math.min(...before), 'confidence falls');
  assert.ok(Math.min(...end) >= 0.5, 'confidence recovers');
  assert.ok(o.monotonic, 'no phase rewind');
  assert.ok(st.p90 <= 0.03, `phase p90 after the dropout ${st.p90}`);
});

// ---------------------------------------------------------------- R1: re-acquire after a kickless breakdown
for (const X of [0.10, 0.20, 0.40]) {
  test(`R1 breakdown-${X.toFixed(2)}: ${X < 0.25 ? 'no jump, ≤ 25 ms within 4 bars' : 'exactly one acquire jump, on a bar line'}`, () => {
    const s = render(`breakdown-${X.toFixed(2)}`, { sr: SR }), o = run(s);
    const tB = s.events.find(e => e.kind === 'breakdown').t, tR = s.events.find(e => e.kind === 'return').t;
    const late = o.tr.jumps.filter(j => j.at > tB);
    const Pend = 60 / s.bpm[1];
    const bias = phaseStats(o, s, { to: tB }).bias;   // the analysis delay, from this run's own steady part
    const after = o.errs.filter(x => x.t >= tR + 16 * Pend).map(x => Math.abs(x.e - bias) * Pend * 1000);
    const states = o.tr.stateLog.filter(x => x.t > tB).map(x => x.state);
    console.log(`breakdown-${X.toFixed(2)}: ${laneStr(o.tr)}`);
    console.log(`breakdown-${X.toFixed(2)}: jumps after the breakdown ${late.map(j => `${j.kind}@${j.at.toFixed(2)} (${j.fromBeats.toFixed(3)}→${j.toBeats.toFixed(3)})`).join(', ') || 'none'}, ms after 4 bars max ${Math.max(...after).toFixed(1)} p90 ${pct(after, 0.9).toFixed(1)}, states ${states.join('→')}, bpm ${o.tr.ownBpm.toFixed(2)}`);
    const detail = `jumps ${late.map(j => `${j.kind}@${j.at.toFixed(2)} (${j.fromBeats.toFixed(3)}→${j.toBeats.toFixed(3)})`).join(', ') || 'none'}; ms after 4 bars max ${Math.max(...after).toFixed(1)} p90 ${pct(after, 0.9).toFixed(1)}; first 24 beats after the return (ms): ${o.errs.filter(x => x.t >= tR).slice(0, 24).map(x => ((x.e - bias) * Pend * 1000).toFixed(0)).join(' ')}; states ${states.join('→')}; monotonic ${o.monotonic}; bpm ${o.tr.ownBpm.toFixed(2)}`;
    if (X < 0.25) {
      assert.equal(late.length, 0, `no jump: ${detail}`);
      assert.ok(o.monotonic, `beats monotonic: ${detail}`);
      assert.ok(Math.max(...after) <= 25, `phase within 4 bars: ${detail}`);
    } else {
      assert.equal(late.filter(j => j.kind === 'acquire').length, 1, `exactly one acquire jump: ${detail}`);
      const j = late.find(x => x.kind === 'acquire'), onBar = Math.abs(frac((j.fromBeats - o.tr.barOrigin) / 4)) * 4;
      assert.ok(onBar <= 0.05, `jump ${onBar.toFixed(3)} beat from a bar line`);
    }
    // R6 (state sequence; __qa.tracker itself comes with 3b): locked → free-run → (acquire) → locked
    assert.equal(states[0], 'free-run', `states ${states.join('→')}`);
    assert.equal(states[states.length - 1], 'locked');
  });
}

// ---------------------------------------------------------------- R5: tap escape
function longSteady(bpm, seconds) {   // 128-steady is 40 s; R5's "32 bars without override" needs longer
  const P = 60 / bpm, beats = [], hits = [];
  for (let t = 0.5; t < seconds - 0.6; t += P) beats.push(t);
  beats.forEach((t, i) => {
    hits.push({ t, lane: 'kick', vel: i % 4 ? 0.8 : 1 });
    if (i % 4 === 1 || i % 4 === 3) hits.push({ t, lane: 'snare', vel: 0.8 });
    hits.push({ t, lane: 'hat', vel: 0.9 }); hits.push({ t: t + P / 2, lane: 'hat', vel: 0.7 });
  });
  const samples = renderHits(hits, seconds, SR, 4242);
  let m = 0; for (const v of samples) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < samples.length; i++) samples[i] *= 0.8 / m;
  return { name: `${bpm}-long`, sr: SR, duration: seconds, samples, beats, bpm };
}

test('R5 tap escape: a tap 5 % off gives exactly one override within 4 s + 1 bar', () => {
  const s = render('128-steady', { sr: SR }), P = 60 / 128;
  const tTap = s.beats.find(t => t >= 12);
  const o = run(s, { at: [{ t: tTap, fn: tr => tr.tap({ t: tTap, bpm: 128 * 1.05 }) }] });
  const ov = o.tr.jumps.filter(j => j.kind === 'override');
  console.log(`R5 5 % off: overrides ${ov.map(j => (j.at - tTap).toFixed(2) + ' s after the tap').join(', ') || 'none'}, own bpm ${o.tr.ownBpm.toFixed(2)}, out bpm ${o.tr.bpm.toFixed(2)}`);
  assert.equal(ov.length, 1, 'exactly one override');
  assert.ok(ov[0].at - tTap <= 4 + 4 * P + 0.05, `override ${ov[0].at - tTap} s after the tap`);
  assert.ok(!o.tr.tapped && Math.abs(o.tr.bpm - 128) <= 1, 'the output follows the tracker again');
});

test('R5 tap escape: a correct tap gives no override for 32 bars', () => {
  const s = longSteady(128, 82), P = 60 / 128;
  const tTap = s.beats.find(t => t >= 12);
  const o = run(s, { at: [{ t: tTap, fn: tr => tr.tap({ t: tTap, bpm: 128 }) }] });
  const ov = o.tr.jumps.filter(j => j.kind === 'override');
  console.log(`R5 correct tap: ${((s.duration - tTap) / (4 * P)).toFixed(1)} bars after the tap, overrides ${ov.length}`);
  assert.ok((s.duration - 0.6 - tTap) / (4 * P) >= 32, 'the track runs 32 bars past the tap');
  assert.equal(ov.length, 0, 'no override');
  assert.ok(o.tr.tapped, 'the output still follows the tap');
});

// ---------------------------------------------------------------- 3c: the steering lane on an off-beat bass
// The reviewer's risk (#173, 2 Nov): R picks the lane, not the phase in it. A trance off-beat bass in the low band
// (here a kick-like 45–60 Hz hit at 0.9 of the kick, Sandstorm's low band is ~1.08 kick/bass) plus loud open hats on
// the off-beat and soft closed hats on the beat. Reported: which lane wins, R per lane, and where the lock sits
// against the kicks (bias 0 = on the kick, ±0.5 = on the off-beat). Gated only on what the selector promises: it
// locks, beats never rewind, and the side moves at most once while locked (timing is broadband; the low lane picks the side).
test('lane: off-beat bass + open hats on the off-beat (reported; hysteresis gated)', () => {
  const bpm = 128, P = 60 / bpm, seconds = 40, beats = [], hits = [];
  for (let t = 0.5; t < seconds - 0.6; t += P) beats.push(t);
  beats.forEach(t => {
    hits.push({ t, lane: 'kick', vel: 1 });
    hits.push({ t: t + P / 2, lane: 'kick', vel: 0.9 });   // the off-beat bass
    hits.push({ t: t + P / 2, lane: 'hat', vel: 1 });      // open hat on the off-beat
    hits.push({ t, lane: 'hat', vel: 0.4 });               // closed hat on the beat
  });
  const samples = renderHits(hits, seconds, SR, 777);
  let m = 0; for (const v of samples) m = Math.max(m, Math.abs(v));
  for (let i = 0; i < samples.length; i++) samples[i] *= 0.8 / m;
  const s = { name: 'offbeat-bass-128', sr: SR, duration: seconds, samples, beats, bpm };
  const o = run(s), st = phaseStats(o, s), L = o.tr.laneReport();
  const side = Math.abs(st.bias) < 0.125 ? 'on the kick' : Math.abs(Math.abs(st.bias) - 0.5) < 0.125 ? 'on the off-beat' : 'between';
  console.log(fmt(s, o, st, `, lock ${side} (bias ${st.bias.toFixed(3)} beat), lane phases broad ${L.phase.broad} low ${L.phase.low}, after jumps ${L.afterJump.join(' ') || '\u2013'}`));
  assert.ok(o.lockT !== null, `locks: the first lock counts only broadband onsets within ±¼ beat of the low lane's phase, so the off-beat hats can't hold the confidence at ~0.5 (3679f19 never locked here): ${laneStr(o.tr)}`);
  assert.ok(o.monotonic, 'beats monotonic after the first lock');
  assert.ok(o.tr.jumps.filter(j => j.kind === 'side').length <= 1, `at most one side move while locked: ${laneStr(o.tr)}`);
});

test('lane: snapshot().lane carries the lane, R per lane, switches and the states after jumps', () => {
  const s = render('128-steady', { sr: SR }), o = run(s), L = o.tr.snapshot().lane;
  assert.ok(L.lane === 'broad' || L.lane === 'low');
  assert.ok(L.R.broad === null || (L.R.broad >= 0 && L.R.broad <= 1));
  assert.ok(L.R.low === null || (L.R.low >= 0 && L.R.low <= 1));
  assert.ok(Array.isArray(L.switches) && Array.isArray(L.afterJump) && Array.isArray(L.jumps));
  assert.equal('offbeat' in o.tr.snapshot(), false, 'the off-beat rules are gone');
});
