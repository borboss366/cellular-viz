// Hand-held mode with a simulated hand (#239 c3; the user 16 Nov 09:08), REPORT-ONLY, box only (skipped elsewhere,
// with the reason). On the "bad" tracks, the line clock (clock.js, a fake AudioContext, the tracker under test) runs
// over the first SIM_SECS s of each track three times:
//   free  no hand
//   off   the hand, auto-hold off (fixes as on main)
//   on    the hand, auto-hold on (a flip or a tap set also holds)
// The hand reads the reference grid (the track's beat grid, the one the scorer uses) at every reference beat, after
// the clock's first lock, and acts REACT_BARS bars after the error starts (origin 'qa'):
//   - the clock half a beat off (|phase| >= 0.375 beat) for FLIP_BEATS beats in a row -> flip;
//   - the clock's tempo more than 3 % off the local reference tempo for TEMPO_BEATS beats -> 4 even taps on the
//     reference beats (the tempo wins over the side: a wrong tempo makes the phase meaningless);
//   - held with the SUSPECT lamp on for RELEASE_BEATS reference beats in a row -> it releases the hold (Shift+L; a
//     press, logged as holdPress kind hold, listed as release@t), like a real hand (#241, Orchestrator 16 Nov);
//   - nothing else; after a press it waits COOL_BEATS beats before it reads again, then its rules apply as before.
// A press is "undone" when the same error comes back within UNDO_S s of it. Per track and mode: inside-gate % (the
// conductor scorer, qa/conduct-score.mjs, on the clock's output beats), the presses (flips, tap sets of 4), the ones
// undone, the time held, the inside-gate % of the held and of the free time, the holdSuspect onsets and seconds. One
// summary line per mode. Corpus ids only (R9). Never hard.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { heavyLock } from './fixtures/heavy-lock.mjs';
import { SR, trackFile, decode } from './fixtures/corpus-audio.mjs';
const require = createRequire(import.meta.url);
const Clock = require('../../../experiments/clock.js');
const T = require('../../../experiments/clock-tracker.js');
const C = await import('../../corpus.mjs');
const A = await import('../audio.mjs');
const SCORE = await import('../../conduct-score.mjs');
const CD = await import('../../../experiments/conductor.mjs');

// opus is out (#240 probe): its reference grid is unusable in the first 180 s (ref bpm 176, 107, 130, 81 ... per 8 beats)
export const SIM_IDS = ['house-01', 'house-02', 'house-03', 'house-04', 'house-05', 'sandstorm', 'sicko-mode', 're-rewind',
  'voodoo-people', 'sincere', 'dj-set-brejcha'];
export const MODES = ['free', 'off', 'on'];
const SIM_SECS = 180, REACT_BARS = 2, FLIP_BEATS = 4, TEMPO_BEATS = 8, TEMPO_TOL = 0.03, SIDE = 0.375, COOL_BEATS = 16, UNDO_S = 60, RELEASE_BEATS = 8;
const QA = { origin: 'qa' };
function say(t, line) { console.log(`# ${line}`); t.diagnostic(`corpus: report: ${line}`); }

// a fake AudioContext (as clock-line.test.mjs): the test moves currentTime; no sound
function fakeContext() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const src = () => { const s = { frequency: param(), buffer: null, connect() {}, start(t) { s.t = t; }, stop() {} }; return s; };
  return { currentTime: 0, sampleRate: 48000, outputLatency: 0, baseLatency: 0, destination: { connect() {} }, resume() {},
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }), createOscillator: src, createBufferSource: src,
    createBiquadFilter: () => ({ type: '', frequency: { value: 0 }, connect() {} }), createBuffer: (ch, len) => ({ getChannelData: () => new Float32Array(len) }),
    createAnalyser: () => ({ fftSize: 2048, connect() {}, getFloatTimeDomainData() {} }) };
}
const SETTINGS = () => ({ bpm: 120, bpb: 4, muted: false, click: false, kick: 'x---x---x---x---', snare: '----------------', hat: '----------------' });

/** the hand's rule, pure (node-tested): one reference beat's reading → the run counts and, when due, the action */
export function handStep(st, { off, tempoOff }) {
  st.offRun = off ? st.offRun + 1 : 0;
  st.tempoRun = tempoOff ? st.tempoRun + 1 : 0;
  if (st.tempoRun >= TEMPO_BEATS) return 'taps';
  if (st.offRun >= FLIP_BEATS && !tempoOff) return 'flip';
  return null;
}
/** a press is undone when the same kind is due again within UNDO_S s of it: marks the last such press */
export function markUndone(presses, kind, t) {
  for (let i = presses.length - 1; i >= 0; i--) {
    if (presses[i].kind !== kind) continue;
    if (t - presses[i].at <= UNDO_S) presses[i].undone = true;
    return;
  }
}

/** one clock over the frames with the hand of `mode`: output beats, samples, hold / fix records, presses */
function simulate(frames, G, mode) {
  const ctx = fakeContext();
  let perf = 0;
  const c = Clock.create({ source: 'line', settings: SETTINGS(), audioContext: () => ctx, timers: false, pump: true, now: () => perf,
    lineFeed: true, keys: false, autoHold: mode === 'on' });
  c.start();
  const hand = mode !== 'free', st = { offRun: 0, tempoRun: 0 }, presses = [], recs = [], beats = [], samples = [];
  const counter = CD.beatCounter();
  let gi = 0, plan = null, coolUntil = -Infinity, everLocked = false, fixId = 0, lastHeld = false, lastSus = false, nextS = 0, susRun = 0;
  const localP = k => { const iv = []; for (let j = Math.max(1, k - 3); j <= k; j++) iv.push(G[j] - G[j - 1]); iv.sort((a, b) => a - b); return iv[iv.length >> 1]; };
  for (const f of frames) {
    ctx.currentTime = f.t; perf = f.t * 1000;
    c.lineFrame(f); c.read();
    const ts = c.trackerState || {};
    if (ts.state === 'locked') everLocked = true;
    // a planned press, due now: the flip, or the next of the 4 taps
    if (plan && f.t >= plan.times[plan.i]) {
      const kind = plan.kind === 'flip' ? 'flip' : 'tap', j = c.fix(kind, QA);
      recs.push({ type: 'fix', ctx: f.t, id: ++fixId, kind, origin: 'qa', ...(j && j.rejected ? { rejected: j.rejected } : {}) });
      if (++plan.i >= plan.times.length) { presses.push({ kind: plan.kind, at: f.t, undone: false }); coolUntil = f.t + COOL_BEATS * plan.P; plan = null; st.offRun = 0; st.tempoRun = 0; }
    }
    // the hand reads every reference beat that has passed
    while (gi < G.length && G[gi] <= f.t) {
      const k = gi++, t = G[k];
      // the SUSPECT lamp, read at every reference beat: released after RELEASE_BEATS in a row (not while a press is planned)
      const susOn = !!(ts.held && ts.held.on && ts.held.suspect);
      susRun = hand && everLocked && susOn ? susRun + 1 : 0;
      if (hand && !plan && susRun >= RELEASE_BEATS) {
        const j = c.fix('hold', QA);
        if (j && j.on === false) {
          recs.push({ type: 'holdPress', ctx: f.t, kind: 'hold', origin: 'qa', on: false });
          presses.push({ kind: 'release', at: f.t, undone: false });
          coolUntil = t + COOL_BEATS * (k >= 1 ? G[k] - G[k - 1] : 0.5); st.offRun = 0; st.tempoRun = 0;
        }
        susRun = 0;
        continue;
      }
      if (!hand || k < 1 || !everLocked || plan || t < coolUntil) continue;
      const b = c.baseBeats(t), P = localP(k), bpm = ts.bpm;
      if (!(b >= 0) || !(bpm > 0)) continue;
      const e = b - Math.round(b), act = handStep(st, { off: Math.abs(e) >= SIDE, tempoOff: Math.abs(bpm * P / 60 - 1) > TEMPO_TOL });
      if (!act) continue;
      markUndone(presses, act, t);
      if (act === 'flip') plan = { kind: 'flip', times: [t + REACT_BARS * 4 * P], i: 0, P };
      else {
        const m = G.findIndex(x => x >= t + REACT_BARS * 4 * P);
        if (m >= 0 && m + 3 < G.length) plan = { kind: 'taps', times: G.slice(m, m + 4), i: 0, P };
      }
    }
    for (const at of counter(x => c.baseBeats(x), x => c.lineTime(x), f.t)) beats.push(at);
    if (f.t >= nextS) {
      nextS = f.t + 0.1;
      samples.push({ t: f.t, bpm: ts.bpm || null, conf: ts.confidence, state: ts.state });
      const h = ts.held || null, on = !!(h && h.on), sus = on && !!h.suspect;
      if (on !== lastHeld) { recs.push({ type: 'hold', ctx: f.t, on }); lastHeld = on; }
      if (sus !== lastSus) { recs.push({ type: 'holdSuspect', ctx: f.t, on: sus }); lastSus = sus; }
    }
  }
  return { beats, samples, recs, presses };
}
/** the clock's run → the conductor scorer's track (as the gate table's gateScore, with the hold and fix records) */
function score(run, id, row, grid, secs) {
  const rec = [{ type: 'session', ctx: 0, v: 3, id: `hold-sim-${id}`, input: 'line:page' }, { type: 'latency', ctx: 0, clockLatency: 0 },
    { type: 'track', ctx: 0, idx: 0, event: 'load', id }, { type: 'track', ctx: 0, idx: 0, event: 'play', posMs: 0 }];
  for (let s = 5; s < secs; s += 5) rec.push({ type: 'pair', ctx: s, idx: 0, posMs: s * 1000 });
  rec.push({ type: 'track', ctx: secs, idx: 0, event: 'end', posMs: secs * 1000 });
  for (const t of run.beats) rec.push({ type: 'beat', ctx: t, src: 'clock' }, { type: 'beat', ctx: t, src: 'shadow' });
  for (const s of run.samples) { const c = { bpm: s.bpm, conf: s.conf, state: s.state }; rec.push({ type: 'sample', ctx: s.t, clock: c, shadow: c }); }
  rec.push(...run.recs);
  const g = { ...grid };
  delete g.gridSuspect; delete g.driftCore;   // scored anyway (as the gate table)
  return SCORE.scoreSession(rec, { 0: { id, row, grid: g } }).tracks[0];
}

// the hand's rule and the undone count (node, no audio)
test('hold-sim hand rule: flip after 4 half-beat-off beats, 4 taps after 8 tempo-off beats (tempo first), runs reset; undone = the same kind again within 60 s', () => {
  const st = { offRun: 0, tempoRun: 0 }, off = { off: true, tempoOff: false }, ok = { off: false, tempoOff: false }, slow = { off: true, tempoOff: true };
  assert.deepEqual([handStep(st, off), handStep(st, off), handStep(st, off)], [null, null, null]);
  assert.equal(handStep(st, off), 'flip', 'the 4th beat half a beat off');
  handStep(st, ok);
  assert.equal(st.offRun, 0, 'an on-beat reading resets the run');
  const s2 = { offRun: 0, tempoRun: 0 }, got = [];
  for (let i = 0; i < 8; i++) got.push(handStep(s2, slow));
  assert.deepEqual(got, [null, null, null, null, null, null, null, 'taps'], 'tempo off: no flip on the way, taps after 8 beats');
  const presses = [{ kind: 'flip', at: 10, undone: false }, { kind: 'taps', at: 20, undone: false }];
  markUndone(presses, 'flip', 69.9);
  assert.equal(presses[0].undone, true, 'a flip again 59.9 s later: the first one was undone');
  markUndone(presses, 'taps', 81);
  assert.equal(presses[1].undone, false, 'taps again 61 s later: not undone');
  assert.deepEqual(SIM_IDS.filter(id => !/^[a-z0-9-]+$/.test(id)), [], 'corpus ids only (R9)');
  assert.deepEqual(MODES, ['free', 'off', 'on']);
});

test(`hold-sim: the simulated hand on the bad tracks, free / hand with auto-hold off / hand with auto-hold on, first ${SIM_SECS} s (report-only; box only)`, async (t) => {
  const dir = A.audioDir();
  if (!fs.existsSync(dir)) { t.skip('no tracks folder here'); return; }
  const map = C.loadMap(dir);
  if (map.missing) { t.skip('no corpus-map.json beside the tracks'); return; }
  const release = await heavyLock('hold-sim', { signal: t.signal }); t.after(release);   // one heavy box test at a time
  if (t.signal.aborted) return;
  const rows = new Map(C.loadCorpus().map(r => [r.id, r]));
  const json = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const fmt = x => (x === null || x === undefined ? '-' : Number(x).toFixed(1));
  const sum = Object.fromEntries(MODES.map(m => [m, { inS: 0, playedS: 0, heldS: 0, flips: 0, taps: 0, releases: 0, undone: 0, suspects: 0, suspectS: 0, n: 0 }]));
  const t0 = Date.now();
  for (const id of SIM_IDS) {
    const stem = map.tracks[id];
    if (!stem) { say(t, `hold-sim ${id}: skipped (not in the map)`); continue; }
    const grid = json(path.join(dir, `${stem}.beatgrid.json`));
    if (!grid || !Array.isArray(grid.beats)) { say(t, `hold-sim ${id}: skipped (no grid)`); continue; }
    const f = trackFile(id), d = f.skip ? f : await decode(f, SIM_SECS);
    if (d.skip) { say(t, `hold-sim ${id}: skipped (${d.skip})`); continue; }
    const secs = Math.floor(d.mono.length / SR), frames = [];
    const an = T.createAnalyzer({ sampleRate: SR, onFrame: fr => frames.push(fr) });
    for (let i = 0; i < d.mono.length; i += 128) an.process(d.mono.subarray(i, Math.min(d.mono.length, i + 128)), i / SR);
    const G = grid.beats.map(b => (b && Number.isFinite(b.ms) ? b.ms / 1000 : NaN)).filter(Number.isFinite).sort((p, q) => p - q);
    for (const mode of MODES) {
      const run = simulate(frames, G, mode), tr = score(run, id, rows.get(id) || null, grid, secs);
      if (!tr.scored) { say(t, `hold-sim ${id} ${mode}: not scored (${tr.reason})`); continue; }
      const c = tr.conducted, h = c.hold || { heldS: 0, inHeldPct: null, inFreePct: null, suspects: 0, suspectS: 0 };
      const flips = run.presses.filter(p => p.kind === 'flip'), taps = run.presses.filter(p => p.kind === 'taps'), releases = run.presses.filter(p => p.kind === 'release');
      const undone = run.presses.filter(p => p.undone).length, s = sum[mode];
      s.n++; s.inS += c.inPct / 100 * tr.playedS; s.playedS += tr.playedS; s.heldS += h.heldS; s.flips += flips.length; s.taps += taps.length;
      s.releases += releases.length; s.undone += undone; s.suspects += h.suspects; s.suspectS += h.suspectS;
      say(t, `hold-sim ${id} ${mode}: inside-gate ${fmt(c.inPct)} % of ${fmt(tr.playedS)} s | presses: flips ${flips.length} (undone within ${UNDO_S} s ${flips.filter(p => p.undone).length}), tap sets ${taps.length} (undone ${taps.filter(p => p.undone).length}), releases on SUSPECT ${releases.length}`
        + ` at ${run.presses.map(p => `${p.kind}@${p.at.toFixed(1)}s${p.undone ? '(undone)' : ''}`).join(' ') || '-'} | held ${fmt(h.heldS)} s, inside-gate held ${fmt(h.inHeldPct)} %, free ${fmt(h.inFreePct)} %`
        + ` | holdSuspect ${h.suspects} times, ${fmt(h.suspectS)} s | episodes ${tr.episodes.length} [report-only]`);
    }
  }
  const pct = s => (s.playedS > 0 ? 100 * s.inS / s.playedS : null);
  for (const mode of MODES) {
    const s = sum[mode], label = { free: 'free (no hand)', off: 'hand, auto-hold off', on: 'hand, auto-hold on' }[mode];
    say(t, `hold-sim summary ${label}: ${s.n} of ${SIM_IDS.length} tracks | inside-gate, time-weighted ${fmt(pct(s))} % | presses: flips ${s.flips}, tap sets ${s.taps}, releases on SUSPECT ${s.releases}, undone within ${UNDO_S} s ${s.undone} | held ${fmt(s.heldS)} s | holdSuspect ${s.suspects} times, ${fmt(s.suspectS)} s [report-only]`);
  }
  say(t, `hold-sim run time ${((Date.now() - t0) / 1000).toFixed(0)} s [report-only]`);
  assert.ok(true, 'report-only');
});
