// The rehearsal page's scoring (#188 §4, experiments/rehearsal-score.js), truths Q1–Q4 on synthetic lists, plus the
// timeline mapping and the grid alignment check. node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const S = require('../../../experiments/rehearsal-score.js');

const P = 0.5;   // 120 BPM
const refsOf = (n, t0 = 1) => Array.from({ length: n }, (_, k) => ({ t: t0 + k * P, pos: (k % 4) + 1 }));
const clockOf = (n, { t0 = 1, period = P, shift = 0, skip = [], state = 'locked' } = {}) =>
  Array.from({ length: n }, (_, k) => ({ t: t0 + shift + k * period, beatInBar: (k % 4) + 1, state })).filter((_, k) => !skip.includes(k));
const classes = beats => beats.map(b => b.cls);
const count = (beats, c) => beats.filter(b => b.cls === c).length;

test('timeline: reference beats on the ctx timeline from the deck start(when, offset), no latency term', () => {
  const r = S.refTimes([{ ms: 10500, pos: 1 }, { ms: 11000, pos: 2 }], { startCtx: 2, offsetS: 10 });
  assert.deepEqual(r.map(x => +x.t.toFixed(9)), [2.5, 3]);
  assert.equal(+S.refTimes([{ ms: 1000, pos: 1 }], { startCtx: 0, offsetS: 0, shiftMs: 25 })[0].t.toFixed(9), 1.025, 'a grid shift moves the reference');
});

test('alignment: a lossy decode 25 ms late is found and shifted; FLAC/WAV never move', () => {
  const rate = 1000, env = new Float32Array(20000), grid = Array.from({ length: 30 }, (_, k) => 1000 + k * 500);
  for (const ms of grid) env[ms + 25] = 1;   // the encoder delay: the audio is 25 ms later than the grid
  assert.equal(S.alignLag(env, rate, grid), 25);
  assert.equal(S.gridShift(25, true), 25); assert.equal(S.gridShift(4, true), 0); assert.equal(S.gridShift(25, false), 0);
});

test('Q1 classes: exact, +20, +50, ½P, ×2, ÷2, 3:2, a 3-beat gap, a crossfade, no grid', () => {
  const refs = refsOf(64), inner = b => b.filter(x => x.cls !== 'outside');
  const run = (clock, extra = {}) => S.classifyTrack({ refs, clock, ...extra });
  const exact = run(clockOf(64));
  assert.equal(exact[0].cls, 'outside'); assert.equal(exact[63].cls, 'outside', 'first and last reference beats have no two-sided period');
  assert.ok(inner(exact).every(b => b.cls === 'good' && b.err === 0)); assert.equal(S.summarizeTrack(exact).summary.goodPct, 100);
  assert.ok(inner(exact).every(b => b.barOk === true), 'beat 1 on beat 1');
  assert.ok(inner(run(clockOf(64, { shift: 0.020 }))).every(b => b.cls === 'good' && Math.abs(b.err - 20) < 1e-6), '+20 ms is good');
  const late = inner(run(clockOf(64, { shift: 0.050 })));
  assert.ok(late.every(b => b.cls === 'loose' && b.err > 0), '+50 ms is loose, late (sign kept)');
  assert.ok(inner(run(clockOf(64, { shift: -0.050 }))).every(b => b.cls === 'loose' && b.err < 0), '−50 ms is loose, early');
  assert.ok(inner(run(clockOf(64, { shift: P / 2 }))).every(b => b.cls === 'offbeat'), '½ beat off');
  assert.ok(inner(run(clockOf(128, { period: P / 2 }))).every(b => b.cls === 'double'), '×2');
  assert.ok(inner(run(clockOf(32, { period: 2 * P }))).every(b => b.cls === 'half'), '÷2 (every other reference beat has no clock beat: still half, not lost)');
  assert.ok(inner(run(clockOf(96, { period: P * 2 / 3 }))).every(b => b.cls === 'ratio'), '3:2');
  const gap = run(clockOf(64, { skip: [20, 21, 22] }));
  assert.deepEqual(classes(gap.slice(19, 24)), ['good', 'lost', 'lost', 'lost', 'good'], 'a gap of 3 beats is lost');
  const xf = run(clockOf(64), { unscored: [{ from: 10, to: 18, cls: 'xfade' }] });
  assert.equal(count(xf, 'xfade'), 16); assert.equal(S.summarizeTrack(xf).summary.scored, 62 - 16, 'crossfade beats are not scored');
  const ng = S.classifyTrack({ hasGrid: false, clock: clockOf(40) });
  assert.equal(ng.length, 40); assert.ok(ng.every(b => b.cls === 'nogrid' && b.ref === null));
  const t = S.trackSummary(1, ng, []); assert.equal(t.withFixes.scored, 0);
  const sess = S.sessionSummary([S.trackSummary(0, exact, []), { ...t, reason: 'no grid' }]);
  assert.equal(sess.scoredTracks, 1, 'a track without grid is left out of the headline'); assert.equal(sess.tracksInGate, 1);
  assert.deepEqual(sess.unscored, [{ idx: 1, reason: 'no grid' }]);
});

// Q2–Q3 run on beat records made directly: one letter per reference beat at t = k·0.5 s
const CLS = { G: 'good', O: 'offbeat', L: 'loose', X: 'lost', D: 'double' };
const beatsOf = (spec, { state = 'locked' } = {}) => [...spec].map((c, k) => ({ k, ref: k * P, cls: CLS[c], err: c === 'G' ? 0 : 60, state }));
const rep = (c, n) => c.repeat(n);

test('Q2 episodes and fix attribution', () => {
  // an off-beat run with a flip landing inside it: endedBy fix, flip cured, reactionMs exact
  let b = beatsOf(rep('G', 20) + rep('O', 10) + rep('G', 20));
  let r = S.summarizeTrack(b, [{ id: 1, kind: 'flip', ctx: 11.0, landedCtx: 14.0 }]);
  assert.equal(r.episodes.length, 1);
  assert.deepEqual({ ...r.episodes[0] }, { id: 1, startCtx: 10, endCtx: 15, cls: 'offbeat', wrongLock: true, beats: 10, fixes: [1], reactionMs: 1000, cureMs: 5000, endedBy: 'fix' });
  assert.deepEqual(r.fixResults, [{ id: 1, verdict: 'cured', episode: 1 }]);
  // a fix with no recovery within 8 beats: noEffect; the episode ends by the tracker later
  b = beatsOf(rep('G', 20) + rep('O', 20) + rep('G', 20));
  r = S.summarizeTrack(b, [{ id: 1, kind: 'nudge', ctx: 11.0 }]);
  assert.deepEqual(r.fixResults, [{ id: 1, verdict: 'noEffect', episode: 1 }]); assert.equal(r.episodes[0].endedBy, 'tracker');
  // and one that never recovers: trackEnd
  r = S.summarizeTrack(beatsOf(rep('G', 20) + rep('O', 20)), [{ id: 1, kind: 'x2', ctx: 12.0 }]);
  assert.equal(r.episodes[0].endedBy, 'trackEnd'); assert.equal(r.fixResults[0].verdict, 'noEffect');
  // a nudge that breaks a good run: worse
  b = beatsOf(rep('G', 20) + rep('L', 6) + rep('G', 20));
  r = S.summarizeTrack(b, [{ id: 7, kind: 'nudge', ctx: 9.75 }]);
  assert.deepEqual(r.fixResults, [{ id: 7, verdict: 'worse', episode: 1 }]);
  // recovery with no fix: endedBy tracker; a fix in a quiet stretch: neutral
  r = S.summarizeTrack(b, [{ id: 2, kind: 'nudge', ctx: 20.0 }]);
  assert.equal(r.episodes[0].endedBy, 'tracker'); assert.deepEqual(r.fixResults, [{ id: 2, verdict: 'neutral', episode: null }]);
  // two fixes in one episode: partOf, then cured
  b = beatsOf(rep('G', 20) + rep('O', 10) + rep('G', 20));
  r = S.summarizeTrack(b, [{ id: 1, kind: 'nudge', ctx: 11.0 }, { id: 2, kind: 'flip', ctx: 12.0, landedCtx: 13.0 }]);
  assert.deepEqual(r.fixResults, [{ id: 1, verdict: 'partOf', episode: 1 }, { id: 2, verdict: 'cured', episode: 1 }]);
  assert.equal(r.episodes[0].reactionMs, 1000); assert.deepEqual(r.episodes[0].fixes, [1, 2]);
  // a single bad beat is not an episode; a lost run is not a wrong lock
  assert.equal(S.summarizeTrack(beatsOf(rep('G', 20) + 'O' + rep('G', 20))).episodes.length, 0);
  assert.equal(S.summarizeTrack(beatsOf(rep('G', 20) + rep('X', 5) + rep('G', 10), { state: 'acquire' })).episodes[0].wrongLock, false);
});

test('Q3 gate: 89.9 / 90.0 %, lockS 30.0 / 30.1 s, wrong-lock 16 / 17 beats', () => {
  const pattern = n => Array.from({ length: n }, (_, k) => (k % 10 === 9 ? 'O' : 'G')).join('');
  const at90 = S.summarizeTrack(beatsOf(pattern(1000)));
  assert.equal(at90.summary.goodPctAfterLock, 90); assert.equal(at90.inGate, true); assert.equal(at90.summary.episodes, 0);
  const p = [...pattern(1000)]; p[995] = 'O';
  const at899 = S.summarizeTrack(beatsOf(p.join('')));
  assert.equal(at899.summary.goodPctAfterLock, 89.9); assert.equal(at899.inGate, false);
  const lockAt = t0 => [{ k: 0, ref: 0, cls: 'lost', err: null, state: 'acquire' }, ...Array.from({ length: 20 }, (_, i) => ({ k: i + 1, ref: t0 + i * P, cls: 'good', err: 0, state: 'locked' }))];
  const l30 = S.summarizeTrack(lockAt(30.0)), l301 = S.summarizeTrack(lockAt(30.1));
  assert.equal(l30.summary.lockS, 30); assert.equal(l30.inGate, true);
  assert.equal(l301.summary.lockS, 30.1); assert.equal(l301.inGate, false);
  const w16 = S.summarizeTrack(beatsOf(rep('G', 20) + rep('O', 16) + rep('G', 2000)));
  const w17 = S.summarizeTrack(beatsOf(rep('G', 20) + rep('O', 17) + rep('G', 2000)));
  assert.equal(w16.summary.longestWrongBeats, 16); assert.equal(w16.inGate, true);
  assert.equal(w17.summary.longestWrongBeats, 17); assert.equal(w17.inGate, false);
  assert.equal(S.summarizeTrack(beatsOf(rep('O', 30))).inGate, false, 'never locked: out of the gate');
});

test('Q4 replay: score → JSONL → replay reproduces every trackSummary; the log parses and fits schema v1', () => {
  const refs = refsOf(80), track = 0;
  const clock = [...clockOf(30), ...clockOf(50, { t0: 1 + 30 * P, shift: P / 2 })];   // locks, then goes off-beat at beat 30 …
  const shadow = clockOf(80);                                                         // … while the tracker alone stays on
  const beats = S.classifyTrack({ refs, clock, shadow });
  const fixes = [{ type: 'fix', ctx: 17.2, track, trackMs: 16200, id: 1, kind: 'flip', arg: null, origin: 'qa', key: null, landedCtx: 19.0, before: {} }];
  const sum = S.trackSummary(track, beats, fixes);
  const recs = [{ type: 'session', ctx: 0, v: 1, id: 'test', startedAt: '2026-11-07T17:00:00Z', W_MS: 35, gate: S.GATE },
    { type: 'track', ctx: 0.5, idx: 0, name: 'truth-a.wav', file: { name: 'truth-a.wav', size: 1, durationMs: 41000, lossy: false }, grid: null, mode: 'start', track },
    ...beats.map(b => ({ type: 'beat', ctx: b.ref, track, trackMs: Math.round((b.ref - 1) * 1000), ...b })), ...fixes,
    ...sum.fixResults.map(f => ({ type: 'fixResult', ctx: 41, track, ...f })), { ...sum, ctx: 41, track }];
  const text = S.toJsonl(recs);
  const again = S.replay(text);
  assert.equal(again.tracks.length, 1);
  const { type, idx, withFixes, trackerAlone, inGate, episodes, fixResults } = again.tracks[0];
  assert.deepEqual({ type, idx, withFixes, trackerAlone, inGate, episodes, fixResults },
    { type: sum.type, idx: sum.idx, withFixes: sum.withFixes, trackerAlone: sum.trackerAlone, inGate: sum.inGate, episodes: sum.episodes, fixResults: sum.fixResults });
  assert.ok(sum.trackerAlone.goodPctAfterLock > sum.withFixes.goodPctAfterLock, 'the shadow stays on the beat');
  assert.equal(sum.episodes[0].cls, 'offbeat');
  // every line parses on its own and fits the schema; a broken line is named
  for (const l of text.trim().split('\n')) assert.deepEqual(S.checkRecord(JSON.parse(l)), []);
  assert.throws(() => S.parseLog(text + '{"type":"beat","k":1}\n'), /line \d+: beat: ctx missing/);
  assert.throws(() => S.parseLog('not json\n'), /line 1: not JSON/);
  assert.match(S.checkRecord({ type: 'nope', ctx: 1 })[0], /unknown type/);
});
