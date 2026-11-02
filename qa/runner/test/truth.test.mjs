// Clock PR 3c (#173): the truths' maths in node, before the box runs them on real audio (qa/runner/truth.mjs,
// experiments/clock-truth.html, exp-run.mjs audio[] with truth). No audio files: truth (a) is rendered here, (b)/(c)
// are checked on a synthetic cut with made-up references.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as TR from '../truth.mjs';
import { loadFile, expand } from '../experiment.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const CT = require('../../../experiments/clock-tracker.js');

const SR = 48000;

test('rise probe: the first sample over the level after silence, to the sample; none while the sound keeps going', () => {
  const x = new Float32Array(SR);   // 1 s: silence, a burst at 0.25 s, silence, a burst at 0.6 s, then noise to the end
  for (let i = 0; i < 480; i++) x[12000 + i] = 0.5 * Math.sin(2 * Math.PI * 2000 * i / SR);
  for (let i = 0; i < 480; i++) x[28800 + i] = 0.5;
  for (let i = 36000; i < SR; i++) x[i] = i % 2 ? 0.3 : -0.3;   // loud and continuous: one rise at its start only
  const frames = [], an = CT.createAnalyzer({ sampleRate: SR, onFrame: f => frames.push(f) });
  const t0 = 10;
  for (let i = 0; i < x.length; i += 128) an.process(x.subarray(i, i + 128), t0 + i / SR);
  const rises = frames.flatMap(f => f.rise || []);
  const first = (a0) => { for (let i = a0; i < x.length; i++) if (Math.abs(x[i]) >= 0.05) return i; return -1; };
  assert.deepEqual(rises.map(t => Math.round((t - t0) * SR)), [first(12000), 28800, 36000], `rises ${rises.map(t => (t - t0).toFixed(5))}`);
});

test('marker lead: one burst at MARK_S after silence; markerRise is its first sample over the probe level', () => {
  const lead = TR.markerLead(SR), rise = TR.markerRise(SR);
  assert.equal(lead.length, TR.LEAD_S * SR);
  const on = [...lead.keys()].filter(i => Math.abs(lead[i]) >= 0.05);
  assert.ok(on.length > 100, 'the burst is loud');
  assert.ok(on[0] / SR === rise && rise >= TR.MARK_S && rise < TR.MARK_S + 0.001, `rise ${rise}`);
  assert.ok(on[on.length - 1] / SR < TR.MARK_S + TR.MARK_LEN_S + 1e-9, 'silence after the burst');
});

test('truth (a) synth: kicks on the beat after the lead, each reference the click\'s first loud sample', () => {
  const { mono, refs } = TR.synthMetronome(SR, 120, 12);
  assert.equal(mono.length, (TR.LEAD_S + 12) * SR);
  assert.equal(refs.length, 23, `refs ${refs.length}`);   // beats at 0 … 11 s with 0.6 s of tail room
  refs.forEach((r, k) => {
    const i = Math.round(r * SR);
    assert.ok(Math.abs(mono[i]) >= 0.05 && Math.abs(mono[i - 1]) < 0.05, `ref ${k} is the first loud sample`);
    assert.ok(r - (TR.LEAD_S + k * 0.5) >= 0 && r - (TR.LEAD_S + k * 0.5) < 0.002, `ref ${k} within 2 ms of its beat (${r})`);
  });
});

test('truth (b)/(c) layout: references from the Beat This! beats, the step resampled after the cut', () => {
  const cut = new Float32Array(10 * SR), beats = Array.from({ length: 40 }, (_, k) => ({ t: 20 + k * 0.5 }));
  const b = TR.trackTruth(cut, SR, beats, 25, 10);
  assert.equal(b.refs.length, 20); assert.equal(b.stepAt, null);
  assert.ok(Math.abs(b.refs[0] - TR.LEAD_S) < 1e-9 && Math.abs(b.refs[19] - (TR.LEAD_S + 9.5)) < 1e-9);
  const c = TR.trackTruth(cut, SR, beats, 25, 10, 1.067);
  assert.equal(c.refs.length, 40);
  assert.ok(Math.abs(c.stepAt - (TR.LEAD_S + 10)) < 1e-9, `step at ${c.stepAt}`);
  assert.ok(Math.abs((c.refs[21] - c.refs[20]) - 0.5 / 1.067) < 1e-9, 'beats after the step are 1.067 × faster');
  assert.equal(c.mono.length, TR.LEAD_S * SR + 10 * SR + Math.floor(10 * SR / 1.067));
});

// a synthetic page log: the marker seen at ctx 7.25 + markerAt; hits on every reference beat shifted by `shift` ms
// with ±`jit` ms of alternating jitter; locked from `lockAfter` s into the music
function fakeLog(refs, { shift = 7, jit = 3, lockAfter = 4, bpm = 120, onsetShift = 2, offset = 7.25 } = {}) {
  const at = x => x + offset;
  const rises = [at(TR.markerRise(SR))];
  const hits = refs.map((r, i) => ({ time: at(r) + (shift + (i % 2 ? jit : -jit)) / 1000, lane: 'kick' }));
  const samples = [];
  for (let t = at(TR.LEAD_S); t < at(refs[refs.length - 1]) + 0.5; t += 0.05) {
    const locked = t >= at(TR.LEAD_S) + lockAfter;
    samples.push({ t, state: locked ? 'locked' : 'acquire', conf: locked ? 0.9 : 0.2, bpm: locked ? bpm : 0 });
  }
  const onsets = refs.map(r => ({ t: at(r) + onsetShift / 1000, s: 1 }));
  return { rises, hits, samples, onsets, jumps: [{ kind: 'acquire' }], delayMs: 20 };
}

test('truthMetrics: lock, phase, latency, R3 bias and the raw delay from a synthetic log', () => {
  const refs = Array.from({ length: 40 }, (_, k) => TR.LEAD_S + 0.001 + k * 0.5);
  const m = TR.truthMetrics(fakeLog(refs), { refs, markerAt: TR.markerRise(SR) });
  assert.equal(m.anchored, true);
  assert.ok(Math.abs(m.lockS - 4) < 0.06, `lock ${m.lockS}`);
  assert.ok(m.phaseP50Ms >= 4 && m.phaseP50Ms <= 10, `p50 ${m.phaseP50Ms}`);
  assert.equal(m.phaseP90Ms, 10); assert.equal(m.latencyP90Ms, 10); assert.equal(m.matched, 1);
  assert.equal(m.biasP50Ms, 2); assert.equal(m.rawDelayMs, 22);
  assert.equal(m.refBpm, 120); assert.equal(m.bpm, 120); assert.equal(m.octave, 0); assert.deepEqual(m.jumps, { acquire: 1 });
  const g = TR.truthGateMetrics(m);
  assert.equal(g['truth.anchored'], 1); assert.equal(g['truth.absBiasP50Ms'], 2);
  const doubled = TR.truthMetrics(fakeLog(refs, { bpm: 240 }), { refs, markerAt: TR.markerRise(SR) });
  assert.equal(doubled.octave, 1, 'a doubled tempo is octave 1 (reported, never gated)');
  const early = TR.truthMetrics(fakeLog(refs, { shift: -12, jit: 0 }), { refs, markerAt: TR.markerRise(SR) });
  assert.equal(early.phaseP50Ms, -12); assert.equal(early.phaseP90Ms, 12); assert.equal(early.latencyP90Ms, -12);
  const none = TR.truthMetrics({ rises: [], hits: [], samples: [] }, { refs, markerAt: 1.5 });
  assert.equal(none.anchored, false); assert.equal(TR.truthGateMetrics(none)['truth.anchored'], 0);
});

test('truthMetrics after a step: relock counted from the step, confidence dip and recovery', () => {
  const cut = new Float32Array(8 * SR), beats = Array.from({ length: 16 }, (_, k) => ({ t: k * 0.5 }));
  const c = TR.trackTruth(cut, SR, beats, 0, 8, 1.067);
  const T = fakeLog(c.refs, { shift: 0, jit: 0, lockAfter: 2 });
  // after the step the hits stay on the old grid for 5 beats (off by growing amounts), then follow the new one
  const stepCtx = c.stepAt + 7.25, after = c.refs.filter(r => r >= c.stepAt);
  T.hits = T.hits.filter(h => h.time < stepCtx);
  after.forEach((r, i) => T.hits.push({ time: r + 7.25 + (i < 5 ? 0.04 + 0.01 * i : 0.002), lane: 'kick' }));
  T.samples.forEach(s => { if (s.t >= stepCtx && s.t < stepCtx + 3) s.conf = 0.3; });
  const m = TR.truthMetrics(T, { refs: c.refs, markerAt: TR.markerRise(SR), stepAt: c.stepAt });
  assert.equal(m.relockBeats, 5, `relock ${m.relockBeats}`);
  assert.equal(m.confMinStep, 0.3); assert.equal(m.confAfterStep, 0.9);
  assert.equal(m.phaseP90Ms, 0, 'phase is measured before the step only');
});

test('truth (a) end to end in node: the analysis and the tracker on the rendered metronome (the page\'s path)', () => {
  const { mono, refs } = TR.synthMetronome(SR, 120, 20);
  const tr = CT.createTracker(), an = CT.createAnalyzer({ sampleRate: SR, onFrame: f => { tr.push(f); if (f.rise) rises.push(...f.rise); } });
  const rises = [], samples = [], t0 = 3.5;
  for (let i = 0; i < mono.length; i += 128) {
    an.process(mono.subarray(i, i + 128), t0 + i / SR);
    if (i % 2400 === 0) samples.push({ t: t0 + i / SR, state: tr.state, conf: tr.confidence, bpm: tr.bpm || 0 });
  }
  const P = 60 / 120, hits = [];
  for (const r of refs) { const t = t0 + r, b = Math.round(tr.beatsAt(t)); if (Number.isFinite(b)) hits.push({ time: tr.timeOf(b), lane: 'kick' }); }
  const m = TR.truthMetrics({ rises, hits, samples, onsets: tr.onsets.map(o => ({ t: o.t, s: o.s })), jumps: tr.jumps, delayMs: CT.ANALYSIS_DELAY_MS }, { refs, markerAt: TR.markerRise(SR) });
  console.log(`node truth (a): lock ${m.lockS} s · phase p50 ${m.phaseP50Ms} / p90 ${m.phaseP90Ms} ms · bias p50 ${m.biasP50Ms} ms · raw delay ${m.rawDelayMs} ms · bpm ${m.bpm} (ref ${m.refBpm}) · matched ${m.matched}`);
  const states = {}; for (const s of samples) states[s.state] = (states[s.state] || 0) + 1;
  console.log(`node truth (a): ${rises.length} rises (first ${rises.length ? (rises[0] - t0).toFixed(5) : '–'} s, marker ${TR.markerRise(SR).toFixed(5)} s) · ${tr.onsets.length} onsets · ${hits.length} hits · states ${JSON.stringify(states)} · jumps ${tr.jumps.length}`);
  assert.equal(m.anchored, true, `anchored: ${rises.length} rises`);
  assert.ok(Math.abs(rises[0] - t0 - TR.markerRise(SR)) < 1e-9, 'the first rise is the marker, to the sample');
  assert.ok(m.lockS !== null && m.lockS < 8, `locks within 8 s (${m.lockS}; states ${JSON.stringify(states)})`);
  assert.ok(Math.abs(m.bpm - 120) <= 1, `bpm ${m.bpm}`);
  assert.ok(Number.isFinite(m.rawDelayMs) && Math.abs(m.rawDelayMs) < 60, `raw delay ${m.rawDelayMs} ms (the box measures the real one)`);
  void P;
});

test('experiment files: a list of named excerpts, variants pick one, a plain single excerpt keeps its shape', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'truth-exp-')), f = path.join(dir, 'x.json');
  const write = o => { fs.writeFileSync(f, JSON.stringify(o)); return loadFile(f); };
  const base = { version: 1, id: '00-clock-truth', page: 'clock-truth', kind: 'audio', resolutions: ['1080p'], warmup: 1, seconds: 40, gates: [{ metric: 'truth.phaseP90Ms', max: 15 }] };
  const ok = write({ ...base, audio: [{ name: 'a', synth: 'metronome', bpm: 120, len: 20 }, { name: 'step', track: 'darude-sandstorm', from: 30, len: 16, truth: true, step: 1.067 }],
    variants: [{ name: 'metronome', audio: 'a' }, { name: 'step', audio: 'step' }, { name: 'r4', audio: 'a', params: { offset: 60 } }] });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.exp.audios.length, 2); assert.equal(ok.exp.audios[0].truth, true); assert.equal(ok.exp.audios[1].step, 1.067);
  assert.deepEqual(expand(ok.exp).map(r => [r.variant, r.audio]), [['metronome', 'a'], ['step', 'step'], ['r4', 'a']]);
  const bad = write({ ...base, audio: [{ name: 'a', synth: 'metronome', len: 20 }, { name: 'a', track: 'nope', len: 4, step: 1.5 }], variants: [{ name: 'v', audio: 'zz' }] });
  for (const want of ['bpm: 60–180', 'track: one of', 'step: a tempo factor', 'names must be unique', 'variants[0].audio: one of'])
    assert.ok(bad.errors.some(e => e.includes(want)), `error mentions "${want}": ${bad.errors.join(' | ')}`);
  const long = write({ ...base, seconds: 10, audio: [{ name: 's', track: 'darude-sandstorm', from: 0, len: 16, truth: true, step: 1.067 }] });
  assert.ok(long.errors.some(e => e.includes('must reach 1.5 s past')), 'a run shorter than lead + cut + step is refused');
  const plain = write({ ...base, gates: [], seconds: 16, audio: { track: 'darude-sandstorm', from: 30, len: 14 } });
  assert.deepEqual(plain.exp.audio, { track: 'darude-sandstorm', from: 30, len: 14, noloop: true, via: 'fake' });
  assert.equal(expand(plain.exp)[0].audio, 'default');
  fs.rmSync(dir, { recursive: true, force: true });
});
