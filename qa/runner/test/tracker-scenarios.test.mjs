// Checks the live-tracker test tracks themselves (qa/runner/test/fixtures/tracker-scenarios.mjs, clock PR 3a, #173),
// not any tracker: lengths and levels, the beat grids, kicks where the grid says, silence in the dropout, no transient
// in the breakdowns, the breakdowns' free-run phase error, and the 120 → 128 step.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NAMES, render, renderHits, scenarios } from './fixtures/tracker-scenarios.mjs';

const SR = 44100;
const CONTRACT = ['128-steady', '128-bursty', '127.3-steady', '81-stomp-clap', 'step-120-128', 'dropout-2s', 'humanize-10ms',
  'breakdown-0.10', 'breakdown-0.20', 'breakdown-0.40'];

// ---- a small onset detector: band-limit (2nd-order HP then LP, each twice), square, causal 10 ms mean; an onset is
// the first sample past 30 % of the way from the level just before to the local peak. Its own lag is calibrated on a
// lone hit rendered by the same synth, so the ±5 ms check measures where the hits are, not the filter delay.
function biquad(x, sr, type, f0, q = Math.SQRT1_2) {
  const w = 2 * Math.PI * f0 / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q);
  const [b0, b1, b2] = type === 'hp' ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [(1 - c) / 2, 1 - c, (1 - c) / 2];
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
function bandEnv(samples, sr, lo, hi) {
  const y = Float64Array.from(samples);
  biquad(y, sr, 'hp', lo); biquad(y, sr, 'hp', lo); biquad(y, sr, 'lp', hi); biquad(y, sr, 'lp', hi);
  const w = Math.round(0.010 * sr), env = new Float64Array(y.length); let acc = 0;
  for (let i = 0; i < y.length; i++) { acc += y[i] * y[i]; if (i >= w) acc -= y[i - w] * y[i - w]; env[i] = acc / w; }
  return env;
}
function onsetNear(env, sr, t) {
  const i0 = Math.max(0, Math.round((t - 0.03) * sr)), iB = Math.round((t - 0.005) * sr), i1 = Math.min(env.length - 1, Math.round((t + 0.08) * sr));
  let base = Infinity, pk = -Infinity;
  for (let i = i0; i <= iB; i++) base = Math.min(base, env[i]);
  for (let i = iB; i <= i1; i++) pk = Math.max(pk, env[i]);
  const thr = base + 0.3 * (pk - base);
  for (let i = i0; i <= i1; i++) if (env[i] >= thr) return i / sr;
  return NaN;
}
const BANDS = { kick: [40, 150], snare: [1200, 2500] };
const lag = {};
for (const lane of Object.keys(BANDS)) {
  const x = renderHits([{ t: 0.5, lane, vel: 1 }], 1.5, SR, 7);
  lag[lane] = onsetNear(bandEnv(x, SR, ...BANDS[lane]), SR, 0.5) - 0.5;
}
const rms = (x, sr, t0, t1) => { const a = Math.round(t0 * sr), b = Math.round(t1 * sr); let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)); };
const excluded = s => {   // [from, to) spans where beats carry no drums: dropouts and breakdowns
  const out = [], ev = s.events || [];
  for (const e of ev) if (e.kind === 'dropout') out.push([e.t, e.t + e.ms / 1000]);
  const b = ev.find(e => e.kind === 'breakdown'), r = ev.find(e => e.kind === 'return');
  if (b && r) out.push([b.t, r.t]);
  return out;
};
const inside = (t, spans) => spans.some(([a, b]) => t >= a - 1e-9 && t < b - 1e-9);

test('the scenario list matches the contract (#173), scenarios() and render() agree', () => {
  assert.deepEqual(NAMES, CONTRACT);
  const lo = scenarios({ sr: 8000 });   // a low rate keeps this one cheap; the full-rate checks are per scenario below
  assert.deepEqual(lo.map(s => s.name), CONTRACT);
  for (const s of lo) assert.equal(s.sr, 8000);
  assert.throws(() => render('nope'));
  assert.ok(Math.abs(lag.kick) < 0.02 && Math.abs(lag.snare) < 0.02, `detector lag kick ${lag.kick}, snare ${lag.snare}`);
});

for (const name of CONTRACT) {
  test(`${name}: renders, grid, drums on the beats`, () => {
    const s = render(name, { sr: SR }), x = s.samples;
    // renders: length = duration × sr, peak ≤ 1 (≈ 0.8)
    assert.ok(x instanceof Float32Array);
    assert.equal(s.sr, SR);
    assert.equal(x.length, Math.round(s.duration * SR));
    let pk = 0; for (const v of x) { assert.ok(Number.isFinite(v)); pk = Math.max(pk, Math.abs(v)); }
    assert.ok(pk <= 1 && pk > 0.75, `peak ${pk}`);
    if (name !== 'breakdown-0.10' && name !== 'breakdown-0.20' && name !== 'breakdown-0.40' && name !== 'step-120-128') assert.ok(s.duration >= 30 && s.duration <= 60);
    if (name === '128-steady') assert.ok(s.duration >= 40, 'R5 uses 128-steady: at least 40 s');
    // grid: strictly ascending, downbeats ⊂ beats, every 4th beat in 4/4
    for (let i = 1; i < s.beats.length; i++) assert.ok(s.beats[i] > s.beats[i - 1], `beats ascend at ${i}`);
    assert.ok(s.beats[s.beats.length - 1] < s.duration);
    const set = new Set(s.beats); for (const d of s.downbeats) assert.ok(set.has(d), `downbeat ${d} is a beat`);
    assert.deepEqual(s.downbeats, s.beats.filter((_, i) => i % 4 === 0));
    // every beat outside a dropout or breakdown carries a kick (81-stomp-clap: a stomp on 1 and 3, a clap on 2 and 4)
    const spans = excluded(s), hitAt = (lane, t) => s.hits.some(h => h.lane === lane && Math.abs(h.t - t) < (s.onsets ? 0.011 : 1e-9));
    s.beats.forEach((t, i) => {
      if (inside(t, spans)) return;
      if (name === '81-stomp-clap') assert.ok(i % 2 === 0 ? hitAt('kick', t) : hitAt('snare', t), `beat ${i}: stomp or clap`);
      else assert.ok(hitAt('kick', t), `beat ${i} at ${t.toFixed(4)} s has a kick`);
    });
    // the audio: an onset in the 40–150 Hz band within ±5 ms of each kick (humanize: of its shifted onset), and for
    // 81-stomp-clap the claps in their band (1.2–2.5 kHz)
    const lowEnv = bandEnv(x, SR, ...BANDS.kick), targets = [];
    s.beats.forEach((t, i) => { if (inside(t, spans)) return; if (name !== '81-stomp-clap' || i % 2 === 0) targets.push(s.onsets ? s.onsets[i] : t); });
    let worst = 0;
    for (const t of targets) { const e = Math.abs(onsetNear(lowEnv, SR, t) - lag.kick - t); assert.ok(e <= 0.005, `${name}: kick onset ${(e * 1000).toFixed(2)} ms off at ${t.toFixed(4)} s`); worst = Math.max(worst, e); }
    if (name === '81-stomp-clap') {
      const midEnv = bandEnv(x, SR, ...BANDS.snare);
      s.beats.forEach((t, i) => { if (i % 2 === 1) { const e = Math.abs(onsetNear(midEnv, SR, t) - lag.snare - t); assert.ok(e <= 0.005, `clap ${(e * 1000).toFixed(2)} ms off at ${t.toFixed(4)} s`); } });
      assert.deepEqual(s.expect, { octave: 'double' });
    }
    console.log(`${name}: ${s.duration.toFixed(2)} s, ${s.beats.length} beats, ${targets.length} kicks checked, worst onset ${(worst * 1000).toFixed(2)} ms`);
  });
}

test('humanize-10ms: beats are the unshifted 128 grid, onsets within ±10 ms of them', () => {
  const s = render('humanize-10ms', { sr: SR }), P = 60 / 128;
  assert.equal(s.onsets.length, s.beats.length);
  s.beats.forEach((t, i) => { assert.ok(Math.abs(t - (s.beats[0] + i * P)) < 1e-9); assert.ok(Math.abs(s.onsets[i] - t) <= 0.010 + 1e-12); });
  assert.ok(s.onsets.some((o, i) => Math.abs(o - s.beats[i]) > 0.005), 'the shifts are really there');
});

test('128-bursty: the 128-steady audio and grid, with a 150 ms gap event every 2 s', () => {
  const a = render('128-steady', { sr: SR }), b = render('128-bursty', { sr: SR });
  assert.deepEqual(b.beats, a.beats);
  assert.equal(b.samples.length, a.samples.length);
  for (let i = 0; i < a.samples.length; i += 97) assert.equal(b.samples[i], a.samples[i]);
  assert.ok(b.events.length >= 19 && b.events.every((e, i) => e.kind === 'gap' && e.ms === 150 && Math.abs(e.t - 2 * (i + 1)) < 1e-9));
});

test('dropout-2s: silent (RMS < 1e-4) from 20.0 to 22.0 s, beats still listed there', () => {
  const s = render('dropout-2s', { sr: SR });
  assert.ok(rms(s.samples, SR, 20.0, 22.0) < 1e-4);
  assert.ok(s.beats.filter(t => t >= 20 && t < 22).length >= 4);
  assert.deepEqual(s.events, [{ t: 20, kind: 'dropout', ms: 2000 }]);
});

for (const X of [0.10, 0.20, 0.40]) {
  test(`breakdown-${X.toFixed(2)}: pad only, no transient, free-run phase error ${X} beat at the return`, () => {
    const s = render(`breakdown-${X.toFixed(2)}`, { sr: SR }), x = s.samples;
    const b = s.events.find(e => e.kind === 'breakdown'), r = s.events.find(e => e.kind === 'return');
    assert.ok(b && r && r.freeRunErrBeats === X);
    // 16 + 16 + 16 bars
    const iB = s.beats.findIndex(t => Math.abs(t - b.t) < 1e-9), iR = s.beats.findIndex(t => Math.abs(t - r.t) < 1e-9);
    assert.equal(iB, 64); assert.equal(iR, 128); assert.equal(s.beats.length, 192);
    // no transient: the largest 10 ms frame-to-frame RMS rise inside the breakdown is tiny; the pad is audible
    const f = 0.010; let rise = 0, prev = rms(x, SR, b.t, b.t + f);
    for (let t = b.t + f; t + f < r.t - 0.02; t += f) { const v = rms(x, SR, t, t + f); rise = Math.max(rise, v - prev); prev = v; }
    assert.ok(rise < 0.005, `largest RMS rise in the breakdown ${rise}`);
    assert.ok(rms(x, SR, b.t + 2, r.t - 2) > 0.01, 'pad audible');
    // free-run phase error at the return, from beats vs a 128 BPM grid anchored on the last pre-breakdown beat
    const P = 60 / 128, iLast = iB - 1, err = (s.beats[iLast] + (iR - iLast) * P - s.beats[iR]) / P;
    assert.ok(Math.abs(err - X) <= 0.005, `free-run error ${err}`);
    // steady again for the return
    const d = s.beats.slice(iR).map((t, i, a) => (i ? t - a[i - 1] : null)).slice(1);
    assert.ok(d.every(v => Math.abs(v - d[0]) < 1e-9));
    console.log(`breakdown-${X.toFixed(2)}: return at ${r.t.toFixed(4)} s, free-run error ${err.toFixed(6)} beat, final tempo ${(60 / d[0]).toFixed(3)} BPM, max rise ${rise.toExponential(2)}`);
  });
}

test('step-120-128: spacing 0.5 s before t = 30, 0.46875 s after (1e-6), continuous across the step', () => {
  const s = render('step-120-128', { sr: SR });
  assert.ok(s.beats.some(t => Math.abs(t - 30) < 1e-9), 'a beat on the step');
  for (let i = 1; i < s.beats.length; i++) {
    const d = s.beats[i] - s.beats[i - 1], want = s.beats[i - 1] < 30 - 1e-9 ? 0.5 : 0.46875;
    assert.ok(Math.abs(d - want) < 1e-6, `interval ${i}: ${d}`);
  }
  assert.deepEqual(s.events, [{ t: 30, kind: 'step', from: 120, to: 128 }]);
  assert.deepEqual(s.bpm, [120, 128]);
});

test('deterministic: the same scenario renders the same samples twice', () => {
  const a = render('humanize-10ms', { sr: 8000 }), b = render('humanize-10ms', { sr: 8000 });
  assert.deepEqual(a.onsets, b.onsets);
  for (let i = 0; i < a.samples.length; i += 13) assert.equal(a.samples[i], b.samples[i]);
});
