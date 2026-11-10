// The conductor scorer (#188 Task 2, qa/conduct-score.mjs): the issue's node truths on synthetic sessions — R4
// classes, R5′ crossfades, R6 verdicts and episodes, the R7 gate, R8 unscored, the A1–A7 rows, R14 alignment, the
// brief's planted session, and a byte-stable round trip. node --test qa/runner/test/*.test.mjs (qa/test-pr.sh).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../conduct-score.mjs';

// a reference grid: n beats at `bpm` from startMs; its beats on the render timeline when the track plays from t0
const grid = (bpm, n, startMs = 500) => Array.from({ length: n }, (_, k) => ({ ms: startMs + k * 60000 / bpm, pos: (k % 4) + 1 }));
const at = (g, t0 = 1) => g.map(b => t0 + b.ms / 1000);
const beatsList = ts => ts.map((t, i) => [t, (i % 4) + 1]);
const every = (from, to, step) => { const out = []; for (let t = from; t < to - 1e-9; t += step) out.push(t); return out; };

/** a session log: tracks [{ idx, play: [ctx from, ctx to] }] played from position 0, pairs every 5 s, 100 ms samples */
function sess({ tracks, xfades = [], clock, shadow = clock, bpm = () => 120, shadowBpm = bpm, conf = () => 0.9, shadowConf = conf,
  state = () => 'locked', fixes = [], jumps = [], marks = [], keys = [], input = 'line:page', clockLatency = 0 }) {
  const R = [{ type: 'session', ctx: 0, v: 1, id: 'test', startedAt: '2026-11-09T10:00:00Z', input },
    { type: 'latency', ctx: 0, outputLatency: 0.02, baseLatency: 0.005, clockLatency, visualOffsetMs: 40, analysisDelayMs: 50, sampleRate: 48000 }];
  let t0 = Infinity, t1 = 0;
  for (const tr of tracks) {
    const [a, b] = tr.play;
    t0 = Math.min(t0, a); t1 = Math.max(t1, b);
    R.push({ type: 'track', ctx: a - 0.25, idx: tr.idx, event: 'load', file: `secret-artist-${tr.idx}.flac` });
    R.push({ type: 'track', ctx: a, idx: tr.idx, event: 'play', posMs: 0 });
    for (let s = 5; a + s < b; s += 5) R.push({ type: 'pair', ctx: a + s, idx: tr.idx, posMs: s * 1000 });
    R.push({ type: 'track', ctx: b, idx: tr.idx, event: 'end', posMs: (b - a) * 1000 });
  }
  for (const x of xfades) {
    R.push({ type: 'xfade', ctx: x.start, from: x.from, to: x.to, event: 'start', ...(x.mode ? { mode: x.mode } : {}) });
    R.push({ type: 'xfade', ctx: x.end, from: x.from, to: x.to, event: 'end' });
  }
  for (const [t, bib] of clock) R.push({ type: 'beat', ctx: t, src: 'clock', beatInBar: bib });
  for (const [t] of shadow) R.push({ type: 'beat', ctx: t, src: 'shadow' });
  for (let i = 0; t0 + i * 0.1 <= t1 + 1e-9; i++) {
    const t = t0 + i * 0.1;
    R.push({ type: 'sample', ctx: t - clockLatency, clock: { bpm: bpm(t), conf: conf(t), state: state(t) }, shadow: { bpm: shadowBpm(t), conf: shadowConf(t), state: 'locked' } });
  }
  for (const f of fixes) R.push({ type: 'fix', origin: 'qa', ...f });
  for (const j of jumps) R.push({ type: 'jump', origin: 'tracker', ...j });
  for (const m of marks) R.push({ type: 'mark', ...m });
  for (const k of keys) R.push({ type: 'key', ...k });
  return R;
}
const G120 = grid(120, 118), T = at(G120);   // 1.5 … 60.0 s, the track plays 1 … 61 s
function one({ g = G120, clock = beatsList(at(g)), row = { slot: 'T1' }, gridExtra = {}, id = 'c1', dur = 60, ...rest } = {}) {
  return { records: sess({ tracks: [{ idx: 0, play: [1, 1 + dur] }], clock, ...rest }), info: { 0: { id, row, grid: { version: 2, beats: g, ...gridExtra } } } };
}
const run = o => { const { records, info } = one(o); return C.scoreSession(records, info); };
const shifted = (from, to, d) => beatsList(T.map((t, k) => (k >= from && k <= to ? t + d : t)));
const classes = r => r.tracks[0].conducted.classes;

test('R4 classes: exact, +20 ms, ±50 ms, +½P, ×2, ÷2, 3:2 and a 3-beat gap', () => {
  const n = G120.length;
  const exact = run();
  assert.deepEqual(classes(exact), { in: n });
  assert.equal(exact.tracks[0].conducted.inPct, 100);
  assert.equal(exact.session.inPct, 100);
  assert.equal(exact.session.pass, true, exact.session.findings.join('; '));
  const p20 = run({ clock: beatsList(T.map(t => t + 0.02)) });
  assert.deepEqual(classes(p20), { in: n }, '+20 ms is in');
  assert.deepEqual(p20.tracks[0].conducted.absE, { p50: 20, p90: 20, p95: 20 }, 'A3: |e| percentiles, report-only');
  const late = run({ clock: beatsList(T.map(t => t + 0.05)) }), early = run({ clock: beatsList(T.map(t => t - 0.05)) });
  assert.deepEqual(classes(late), { loose: n });
  assert.deepEqual(classes(early), { loose: n });
  assert.ok(late._beats.c1.every(b => b.e > 49) && early._beats.c1.every(b => b.e < -49), 'the sign is kept: late +, early −');
  assert.deepEqual(classes(run({ clock: beatsList(T.map(t => t + 0.25)) })), { side: n }, '½ beat off is side');
  assert.deepEqual(classes(run({ clock: beatsList(every(1.5, 60.5, 0.25)), bpm: () => 240 })), { octave: n }, '×2');
  assert.deepEqual(classes(run({ clock: beatsList(every(1.5, 61, 1)), bpm: () => 60 })), { octave: n }, '÷2');
  assert.deepEqual(classes(run({ clock: beatsList(every(1.5, 61, 1 / 3)), bpm: () => 180 })), { tempo: n }, '3:2');
  const gap = run({ clock: beatsList(T.filter((_, k) => k < 20 || k > 22)) });
  assert.deepEqual(classes(gap), { in: n - 3, lost: 3 }, 'no output beat within ±P/2: lost');
  assert.equal(gap.tracks[0].episodes.length, 0, '3 beats is not an episode (> 4 needed)');
});

test('R6 verdicts: a right flip (caught), a false ×2 judged 2 beats after landing, no effect, missed, caught at 8 vs late at 9', () => {
  const flip = run({ clock: shifted(40, 44, 0.25), fixes: [{ ctx: 22.6, id: 1, kind: 'flip', landedCtx: T[45] }] });
  const t = flip.tracks[0];
  assert.equal(t.fixes[0].verdict, 'right');
  assert.equal(t.episodes.length, 1);
  assert.deepEqual({ cls: t.episodes[0].cls, outcome: t.episodes[0].outcome, landBeats: t.episodes[0].landBeats, reaction: t.episodes[0].reactionBeats, clean: t.episodes[0].timeToCleanBeats },
    { cls: 'side', outcome: 'caught', landBeats: 5, reaction: 2.2, clean: 5 });

  // ×2 pressed on a clean beat: it lands on the next output beat, and 2 reference beats later the clock is at 2×
  const x2 = run({ clock: beatsList([...T.filter(x => x <= 20.0 + 1e-9), ...every(20.5, 60.5, 0.25)]), bpm: x => (x >= 20.5 - 1e-9 ? 240 : 120),
    fixes: [{ ctx: 20.1, id: 2, kind: 'x2' }] });
  assert.equal(x2.tracks[0].fixes[0].landS, 20.5);
  assert.equal(x2.tracks[0].fixes[0].verdict, 'false');
  assert.equal(x2.tracks[0].falseFixes, 1);

  const none = run({ clock: shifted(40, 59, 0.25), fixes: [{ ctx: 23.1, id: 3, kind: 'nudge' }] });
  assert.equal(none.tracks[0].fixes[0].verdict, 'noEffect');
  assert.equal(none.tracks[0].episodes[0].outcome, 'late', 'a fix, but no right one');
  assert.equal(run({ clock: shifted(40, 59, 0.25) }).tracks[0].episodes[0].outcome, 'missed');

  const at8 = run({ clock: shifted(40, 47, 0.25), fixes: [{ ctx: 22.0, id: 4, kind: 'nudge', landedCtx: T[48] }] }).tracks[0].episodes[0];
  const at9 = run({ clock: shifted(40, 48, 0.25), fixes: [{ ctx: 22.0, id: 5, kind: 'nudge', landedCtx: T[49] }] }).tracks[0].episodes[0];
  assert.deepEqual([at8.landBeats, at8.outcome], [8, 'caught']);
  assert.deepEqual([at9.landBeats, at9.outcome], [9, 'late']);
});

test('R7 gate: 90.0 % passes and 89.9 % fails; 1 false fix per track passes and 2 fail', () => {
  const g = grid(120, 1000), TT = at(g);
  const loose = extra => beatsList(TT.map((t, k) => (k % 10 === 9 || k === extra ? t + 0.05 : t)));
  const r90 = C.scoreSession(...Object.values(one({ g, dur: 501, clock: loose(-1) })));
  const r899 = C.scoreSession(...Object.values(one({ g, dur: 501, clock: loose(995) })));
  assert.equal(r90.session.inPct, 90);
  assert.equal(r90.session.pass, true, r90.session.findings.join('; '));
  assert.equal(r899.session.inPct, 89.9);
  assert.equal(r899.session.pass, false);
  assert.match(r899.session.findings[0], /inside the gate 89\.9 % < 90 %/);

  const clock = beatsList(T.map((t, k) => ([18, 19, 58, 59].includes(k) ? t + 0.05 : t)));
  const f1 = run({ clock, fixes: [{ ctx: 10.1, id: 1, kind: 'nudge' }] });
  const f2 = run({ clock, fixes: [{ ctx: 10.1, id: 1, kind: 'nudge' }, { ctx: 30.1, id: 2, kind: 'nudge' }] });
  assert.equal(f1.tracks[0].falseFixes, 1);
  assert.equal(f1.session.pass, true, f1.session.findings.join('; '));
  assert.equal(f2.tracks[0].falseFixes, 2);
  assert.equal(f2.session.pass, false);
  assert.ok(f2.session.findings.includes('c1: 2 false fixes'));
});

// two tracks: A (120) plays 1 … 39 s, B plays from 31 s; an 8 s crossfade 31 … 39 s, midpoint 35 s
function fade({ bpmB = 128, mode, clockA = null, clockB = null, conf = () => 0.9, dropB = [] } = {}) {
  const gA = grid(120, 76), gB = grid(bpmB, 120, 250), tA = at(gA, 1), tB = at(gB, 31);
  const cA = clockA || tA.filter(t => t < 35), cB = clockB || tB.filter((t, k) => t >= 35 && !dropB.includes(k));
  const records = sess({ tracks: [{ idx: 0, play: [1, 39] }, { idx: 1, play: [31, 91] }], xfades: [{ from: 0, to: 1, start: 31, end: 39, mode }],
    clock: beatsList([...cA, ...cB]), bpm: t => (t < 35 ? 120 : bpmB), conf });
  return { records, info: { 0: { id: 'c1', row: { slot: 'C2' }, grid: { beats: gA } }, 1: { id: 'c2', row: { slot: 'C2' }, grid: { beats: gB } } } };
}
test('R5′ crossfade: the grid switches at the midpoint, ±1 beat is excluded, re-lock is reported, mode A gates the overlap', () => {
  const r = C.scoreSession(...Object.values(fade()));
  assert.ok(r._beats.c1.every(b => b.t < 35) && r._beats.c2.every(b => b.t >= 35 - 1e-9), 'outgoing grid until the midpoint, incoming after');
  assert.equal(r._beats.c1.filter(b => b.excl === 'xfade').length, 1, 'the outgoing beat within 1 beat of the midpoint');
  assert.equal(r._beats.c2.filter(b => b.excl === 'xfade').length, 2, 'the incoming beat on the midpoint and the next');
  assert.equal(r.tracks[0].conducted.inPct, 100);
  assert.equal(r.tracks[1].conducted.inPct, 100);
  const w = r.windows[0];
  assert.deepEqual([w.mode, w.overlapS, w.relockFromMid, w.relockFromEnd, w.rewinds, w.pass], ['B', 8, 0, 0, 0, true]);
  assert.deepEqual(w.confRow, { ok: false, reportOnly: true }, 'mode B: a clock that stays confident over two tempos fails the (report-only) conf row');
  assert.equal(r.session.pass, true, r.session.findings.join('; '));

  const honest = C.scoreSession(...Object.values(fade({ conf: t => (t >= 31 && t < 39 ? 0.5 : 0.9) }))).windows[0];
  assert.deepEqual([honest.c0, honest.minConf, honest.confRow.ok], [0.9, 0.5, true], 'conf falls under 0.7 C₀ and is back within 8 beats');

  const relock = C.scoreSession(...Object.values(fade({ dropB: [8, 9, 10, 11, 12, 13] }))).windows[0];
  assert.deepEqual([relock.relockFromMid, relock.relockFromEnd, relock.pass], [4, 0, true]);

  const tA = at(grid(120, 76), 1), tB = at(grid(120, 120, 250), 31);
  const matched = C.scoreSession(...Object.values(fade({ bpmB: 120, mode: 'A' }))).windows[0];
  assert.deepEqual([matched.mode, matched.overlapInPct, matched.pass, matched.confRow.ok], ['A', 100, true, true], 'mode A: the overlap is gated, conf stays high');
  const slipped = C.scoreSession(...Object.values(fade({ bpmB: 120, mode: 'A',
    clockA: tA.filter(t => t < 35).map(t => (t >= 31 ? t + 0.25 : t)), clockB: tB.filter(t => t >= 35).map(t => (t <= 39 ? t + 0.25 : t)) })));
  assert.equal(slipped.windows[0].gated.inOk, false);
  assert.equal(slipped.windows[0].pass, false);
  assert.ok(slipped.session.findings.some(f => /transition c1 → c2 \(mode A\) fails inOk/.test(f)));
});

test('R8 unscored: no grid, a flagged grid (gridSuspect, driftCore > 20 %) and mic input are listed, never failed', () => {
  const two = (gridB, input) => {
    const gA = grid(120, 58), gB = grid(120, 58);
    const records = sess({ tracks: [{ idx: 0, play: [1, 31] }, { idx: 1, play: [31, 61] }], clock: beatsList([...at(gA, 1), ...at(gB, 31)]), input });
    return C.scoreSession(records, { 0: { id: 'c1', row: { slot: 'T1' }, grid: { beats: gA } }, 1: { id: 'c2', row: { slot: 'T1' }, grid: gridB === undefined ? { beats: gB } : gridB } });
  };
  const gB = grid(120, 58);
  const nogrid = two(null);
  assert.deepEqual(nogrid.session.unscored, [{ label: 'c2', reason: 'no grid' }]);
  assert.deepEqual([nogrid.session.scoredTracks, nogrid.session.inPct, nogrid.session.pass], [1, 100, true]);
  assert.equal(two({ beats: gB, gridSuspect: true }).tracks[1].reason, 'grid flagged');
  const drift = two({ beats: gB, driftCore: 25 });
  assert.deepEqual([drift.tracks[1].reason, drift.session.pass], ['grid flagged', true], 'a flagged grid is n/a, not a failed track');
  assert.match(C.renderReport(drift), /\| c2 \| T1 \| 30 \| UNSCORED: grid flagged \|/);
  assert.equal(two({ beats: gB, driftCore: 20 }).tracks[1].scored, true, 'exactly 20 % is not over 20 %');
  const mic = two(undefined, 'line');
  assert.deepEqual(mic.session.unscored.map(u => u.reason), ['mic input', 'mic input']);
  assert.ok(mic.session.findings.includes('no scored track'));
});

test('A1 octaveFree: the octave is picked once per track (×2, ÷2 with its parity), and a change of octave counts as octaveFlips', () => {
  const dbl = { clock: beatsList(every(1.5, 60.5, 0.25)), bpm: () => 240 };
  const free = run({ ...dbl, row: { slot: 'T8', octaveFree: true } });
  assert.deepEqual(free.tracks[0].conducted.octave, { factor: 2, parity: null, flips: 0 });
  assert.equal(free.tracks[0].conducted.inPct, 100);
  assert.equal(run(dbl).tracks[0].conducted.inPct, 0, 'without the flag ×2 is class octave (R4)');
  const half = run({ clock: beatsList(every(1.5, 61, 1)), bpm: () => 60, row: { slot: 'T8', octaveFree: true } });
  assert.deepEqual(half.tracks[0].conducted.octave, { factor: 0.5, parity: 0, flips: 0 });
  assert.equal(half.tracks[0].conducted.inPct, 100);
  const flips = run({ clock: beatsList([...every(1.5, 31, 0.25), ...T.filter(t => t >= 31 - 1e-9)]), bpm: t => (t < 31 ? 240 : 120), row: { slot: 'T8', octaveFree: true } });
  assert.equal(flips.tracks[0].conducted.octave.flips, 1);
  assert.ok(flips.session.findings.includes('c1: octaveFlips 1'));
});

test('A2 backbeatOk: the side span from acquisition is excluded, capped at 16 beats', () => {
  const s12 = run({ clock: shifted(0, 11, 0.25), row: { slot: 'T2', backbeatOk: true } }).tracks[0];
  assert.deepEqual(s12.conducted.sideSpan, { beats: 12, capped: false });
  assert.equal(s12.conducted.inPct, 100);
  assert.equal(s12.episodes.length, 0);
  const plain = run({ clock: shifted(0, 11, 0.25) }).tracks[0];
  assert.deepEqual([plain.episodes.length, plain.episodes[0].cls, plain.episodes[0].outcome], [1, 'side', 'missed']);
  const s20 = run({ clock: shifted(0, 19, 0.25), row: { slot: 'T2', backbeatOk: true } }).tracks[0];
  assert.deepEqual(s20.conducted.sideSpan, { beats: 20, capped: true }, 'longer than 16 beats is a finding, not an exclusion');
  assert.ok(s20.conducted.inPct < 100);
});

test('A4 lockBeats (from start or from the kick-entry mark), A5 conf columns, A6 jumps in low confidence and free-run drift, A7a barMoves, rewinds, bar report-only', () => {
  const cold = beatsList(T.filter((_, k) => k >= 10));
  assert.equal(run({ clock: cold }).tracks[0].conducted.lockBeats, 10);
  const mark = run({ clock: cold, row: { slot: 'T4', lockFrom: 'mark' }, marks: [{ ctx: 11.5, idx: 0, name: 'kickIn', trackMs: 10500 }] }).tracks[0];
  assert.deepEqual([mark.conducted.lockBeats, mark.lockFrom], [0, 'mark kickIn']);
  const nomark = run({ clock: cold, row: { slot: 'T4', lockFrom: 'mark' } }).tracks[0];
  assert.deepEqual([nomark.conducted.lockBeats, nomark.lockFrom], [null, 'mark (none logged)']);

  const c = run({ shadowConf: () => 0.7 }).tracks[0];
  assert.deepEqual([c.conducted.confMedian, c.alone.confMedian], [0.9, 0.7]);

  const low = run({ conf: t => (t >= 20 && t < 25 ? 0.3 : 0.9), jumps: [{ ctx: 22, kind: 'phase', fromBeats: 41, toBeats: 41.1 }, { ctx: 40, kind: 'phase', fromBeats: 77, toBeats: 77.1 }] }).tracks[0];
  assert.equal(low.jumpsLowConf, 1);
  const fr = slope => run({ state: t => (t >= 30 && t < 35 ? 'freerun' : 'locked'), bpm: t => (t >= 30 && t < 35 ? 120 + slope * (t - 30) / 5 : 120) }).tracks[0];
  assert.equal(fr(0.3).freeRunHeld, true);
  assert.ok(fr(0.3).freeRunDriftPct > 0.2 && fr(0.3).freeRunDriftPct < 0.5);
  assert.equal(fr(1.2).freeRunHeld, false);

  const bars = run({ fixes: [{ ctx: 10, id: 1, kind: 'set1' }],
    jumps: [{ ctx: 5, kind: 'bar', fromBeats: 8, toBeats: 9 }, { ctx: 15, kind: 'bar', fromBeats: 28, toBeats: 29 },
      { ctx: 20, kind: 'bar', origin: 'fix', fromBeats: 38, toBeats: 39 }, { ctx: 40, kind: 'phase', fromBeats: 78, toBeats: 77.5 }] }).tracks[0];
  assert.deepEqual([bars.barMoves, bars.rewinds], [1, 1], 'only the tracker-origin bar change after set 1; one backwards jump');
  assert.deepEqual([bars.barPct, bars.barReportOnly], [100, true], 'pos is scored report-only while the grid has no barOk');
  assert.equal(run({ gridExtra: { barOk: true } }).tracks[0].barReportOnly, false);
});

test('#214 jump kind octave: a known kind (Q9), parsed, counted, forward so no rewind; an unknown kind is listed, never an error', () => {
  assert.ok(C.JUMP_KINDS.includes('octave') && ['acquire', 'override', 'side', 'flip'].every(k => C.JUMP_KINDS.includes(k)));
  const { records, info } = one({ jumps: [{ ctx: 20, kind: 'octave', fromBeats: 40, toBeats: 40.5 }, { ctx: 30, kind: 'acquire', fromBeats: 60, toBeats: 60.1 }] });
  const again = C.parseLog(C.toJsonl(records));   // the log round trip keeps it
  assert.equal(again.filter(r => r.type === 'jump' && r.kind === 'octave').length, 1);
  const r = C.scoreSession(again, info);
  assert.deepEqual(r.session.jumps, { total: 2, byKind: { octave: 1, acquire: 1 }, unknown: [], octave: 1, rewinds: 0 });
  assert.deepEqual([r.tracks[0].jumpKinds, r.tracks[0].rewinds], [{ octave: 1, acquire: 1 }, 0]);
  assert.match(C.renderReport(r), /^Jumps 2: octave 1, acquire 1 · rewinds 0$/m);
  const odd = C.scoreSession(...Object.values(one({ jumps: [{ ctx: 20, kind: 'wobble', fromBeats: 40, toBeats: 40.2 }] })));
  assert.deepEqual(odd.session.jumps.unknown, ['wobble']);
  assert.match(C.renderReport(odd), /unknown kinds wobble/);
});

test('R3 shadow column and R2 timelines: tracker alone beside conducted; samples move by clock.latency, the fit residual shows', () => {
  const r = run({ clock: beatsList(T.map(t => t + 0.25)), shadow: beatsList(T) }).tracks[0];
  assert.deepEqual([r.conducted.inPct, r.alone.inPct, r.deltaInPct], [0, 100, -100]);
  assert.equal(r.timelineResidualMs, 0);
  const { records } = one({ clockLatency: 0.05 });
  const S = C._internal.readSession(records);
  assert.ok(Math.abs(S.samples[0].t - 1) < 1e-9, 'a sample logged on the heard timeline is compared at its render time');
  assert.equal(S.clockLatency, 0.05);
});

// the brief's planted session: an octave at 40 s fixed with ÷2, a flip at 70 s fixed with flip, a 3 s dropout nobody fixed
function planted() {
  const g = grid(120, 198), TT = at(g);
  const clock = [...TT.filter(t => t < 40 - 1e-9), ...every(40, 43, 0.25), ...TT.filter(t => t >= 43 - 1e-9 && t < 70 - 1e-9),
    ...TT.filter(t => t >= 70 - 1e-9 && t < 73 - 1e-9).map(t => t + 0.25), ...TT.filter(t => t >= 73 - 1e-9 && t < 80 - 1e-9), ...TT.filter(t => t >= 83 - 1e-9)];
  return one({ g, dur: 100, clock: beatsList(clock), bpm: t => (t >= 40 - 1e-9 && t < 43 - 1e-9 ? 240 : 120),
    fixes: [{ ctx: 42.1, id: 1, kind: 'half' }, { ctx: 71.1, id: 2, kind: 'flip', landedCtx: 73.0 }] });
}
test('the brief\'s planted session: octave caught, flip caught, dropout missed; reactions in beats', () => {
  const { records, info } = planted(), r = C.scoreSession(records, info), t = r.tracks[0];
  assert.deepEqual(t.episodes.map(e => [e.startS, e.cls, e.outcome, e.reactionBeats, e.landBeats]),
    [[40, 'octave', 'caught', 4.2, 5], [70, 'side', 'caught', 2.2, 6], [80, 'lost', 'missed', null, null]]);
  assert.deepEqual(t.fixes.map(f => [f.id, f.verdict]), [[1, 'right'], [2, 'right']]);
  assert.deepEqual(r.session.episodes, { total: 3, caught: 2, late: 0, missed: 1 });
  assert.equal(r.session.pass, false);
  assert.ok(r.session.findings.includes('c1: episode 3 at 80 s missed'));
});

test('round trip: session → JSONL → report is byte-stable; the report names no file; a broken log line is named', () => {
  const { records, info } = planted();
  const text = C.toJsonl(records), again = C.parseLog(text);
  const a = C.renderReport(C.scoreSession(records, info)), b = C.renderReport(C.scoreSession(again, info)), c = C.renderReport(C.scoreSession(C.parseLog(text), info));
  assert.equal(a, b);
  assert.equal(b, c);
  assert.doesNotMatch(a, /secret|\.flac|\.wav|\.mp3/, 'R9: corpus ids only');
  assert.match(a, /## The gate \(R7\): FAIL/);
  const anon = C.scoreSession(records, { 0: { grid: info[0].grid } });
  assert.equal(anon.tracks[0].label, 'track 1', 'no corpus id: "track N", never the file name');
  assert.throws(() => C.parseLog('{"type":"session","ctx":0,"v":1}\n{"type":"beat","src":"clock"}\n'), /line 2: beat: ctx missing/);
  assert.throws(() => C.parseLog('not json\n'), /line 1: not JSON/);
  assert.deepEqual(C.checkRecord({ type: 'nope', ctx: 1 }), ['unknown type nope']);
});

test('A1′: no bpm field of the grid is ever read — only its beats', () => {
  const plain = run(), noisy = run({ gridExtra: { medianBpm: 999, bpmFit: 1, bpmFitCore: 2, bpmTheilSen: 3 } });
  assert.deepEqual(noisy, plain);
});

test('R14: alignLag by cross-correlation (envelope, then samples), constant over the file; a lossy row plays with its grid moved by it', () => {
  const rate = 8000, n = 4 * rate, ref = new Float32Array(n);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let on = 400; on < n - 800; on += 2000 + Math.floor(rand() * 600)) for (let j = 0; j < 400; j++) ref[on + j] += (rand() * 2 - 1) * Math.exp(-j / 80);
  const delayed = (d) => { const y = new Float32Array(n); for (let i = 0; i < n; i++) { const s = i - d; if (s >= 0 && s < n) y[i] = ref[s]; } return y; };
  assert.deepEqual(C.alignLag(ref, delayed(104), rate), { lagSamples: 104, lagMs: 13 }, 'LAME-like delay, 13 ms');
  assert.deepEqual(C.alignLag(ref, delayed(-40), rate), { lagSamples: -40, lagMs: -5 });
  const chk = C.alignLagCheck(ref, delayed(104), rate);
  assert.deepEqual([chk.lagMs, chk.endLagMs, chk.driftMs, chk.constant, chk.within30], [13, 13, 0, true, true]);
  const fields = C.alignFields({ lagSamples: 104, rate, shaRef: 'aa', shaLossy: 'bb' });
  assert.deepEqual(fields, { alignLagMs: 13, alignLagSamples: 104, alignLagRate: 8000, alignLagMethod: 'xcorr', alignSha: { ref: 'aa', lossy: 'bb' } });
  assert.equal(C.alignNeeded(fields, 'aa', 'bb'), false, 'measured once');
  assert.equal(C.alignNeeded(fields, 'aa', 'cc'), true, 'a new file is measured again');
  assert.equal(C.alignNeeded({}, 'aa', 'bb'), true);

  const twin = run({ clock: beatsList(T.map(t => t + 0.013)), row: { slot: 'T12', lossy: true, alignLagMs: 13 } }).tracks[0];
  assert.deepEqual([twin.shiftMs, twin.conducted.absE.p50], [13, 0]);
  assert.equal(run({ clock: beatsList(T.map(t => t + 0.013)) }).tracks[0].conducted.absE.p50, 13);
});
