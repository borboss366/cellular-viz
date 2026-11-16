// Hand-held mode (docs/CELLULAR_VIZ_BRIEF_HOLD.md, the user's go 15 Nov 23:15): after the hand confirms the beat the
// tracker may trim and may not move. Synthetic tracks only (no real audio), one tracker run each, scripted as at the
// desk: lock, flip if the side is wrong, hold (the tracker's own calls, origin 'qa'). Rows (HARD):
//   a. the house trap (126, kick and on-beat hat out for 8 bars at 30 s and 75 s, a snare build in the second): the
//      side never changes after the hold, the net phase trim <= holdNetMax, no tracker jump
//   b. the real-breakdown trap (128, 8 bars bass + pad only): the same
//   c. tempo-excursion bait (the house trap's build, the house-01/02 route): the tempo within holdTempoTol (1 %) of
//      the held tempo at every frame after the hold
//   d. a 16-bar breakdown (126, kick and on-beat hat out, the off-beat bass and hat stay): on the beat within 35 ms for
//      the first 8 beats after the kick returns
//   e. a real 120 -> 128 step under hold: nothing moves (tempo within 1 % of 120, no jump, net <= holdNetMax) and
//      holdSuspect comes on within 16 beats of the step
//   f. hold off: no gate ever fires (held off, nothing blocked), so every other tracker test runs as before
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { render } from './fixtures/tracker-scenarios.mjs';
import { houseTrap, sideBreakdown, frac } from './fixtures/tracker-traps.mjs';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/clock-tracker.js');
const report = (t, line) => { console.log(`# ${line}`); t.diagnostic(`corpus: report: ${line}`); };

const GATE_MS = 35, SETTLE = 6, C = T.DEFAULTS;
const sgn = x => (x >= 0 ? '+' : '') + x.toFixed(3);

/** the tracker over a track with the desk script: SETTLE s after the first lock, flip if the model sits more than a
 *  quarter beat off the true beat, then hold (hold: false runs it free). The error at every true beat, the tempo at
 *  every frame after the hold, the jumps after it, and when holdSuspect first came on. */
function runHold(s, { hold = true, trace = false } = {}) {
  const sr = s.sr || 44100, tr = T.createTracker(), frames = [];
  const an = T.createAnalyzer({ sampleRate: sr, onFrame: f => frames.push(f) });
  for (let i = 0; i < s.samples.length; i += 128) an.process(s.samples.subarray(i, Math.min(s.samples.length, i + 128)), i / sr);
  const P0 = 60 / (Array.isArray(s.bpm) ? s.bpm[0] : s.bpm);
  const per = [];
  let lockT = null, holdT = null, flipped = false, heldBpm = null, worstTempo = 0, worstAt = null, suspectT = null, bi = 0;
  // trace (diagnostics for a and d, Orchestrator 16 Nov): every period write after the hold with the tempo decision
  // behind it, the first write that reached the 1 % band edge, and one row every 8 true beats from the hold on
  const writes = [], rows = [];
  let seenPl = 0, edge = null, kHold = null, wFrom = 0, steps0 = 0;
  // cause-B probe: every detected broadband onset within 1/4 beat of a true beat (the kicks; the off-beat bass and hat
  // sit at 1/2), as onset time minus that beat in ms
  const kickDev = [];
  let lastOnT = -Infinity, prevRowT = -Infinity;
  for (const f of frames) {
    tr.push(f);
    if (trace) {
      const ons = tr.onsets || [];
      for (let i = 0; i < ons.length; i++) {
        const o = ons[i];
        if (o.t <= lastOnT) continue;
        lastOnT = o.t;
        const k = Math.round((o.t - s.beats[0]) / P0), d = o.t - (s.beats[0] + k * P0);
        if (Math.abs(d) <= P0 / 4) kickDev.push({ t: o.t, ms: d * 1000 });
      }
    }
    if (trace && holdT !== null) {
      const pl = tr.periodLog || [];
      for (; seenPl < pl.length; seenPl++) {
        const p = pl[seenPl];
        if (p.t < holdT) continue;
        const rep = tr.tempoReport, w = { t: p.t, src: p.src, from: p.from, to: p.to, dec: rep.last, steps: rep.steps };
        writes.push(w);
        if (edge === null && p.to && Math.abs(p.to / heldBpm - 1) >= 0.0099) edge = w;
      }
    }
    if (lockT === null && tr.state === 'locked') lockT = f.t;
    if (hold && holdT === null && lockT !== null && f.t >= lockT + SETTLE) {
      const k = s.beats.findIndex(b => b >= f.t), ph = k > 0 ? frac(tr.beatsAt(s.beats[k - 1])) : 0;
      tr.handHold(true, f.t, 'qa');   // as clock.js: the hold first (it drops a booked tracker jump), then the flip
      if (Math.abs(ph) > 0.25) flipped = !!tr.flip(f.t, 'qa');
      holdT = f.t; heldBpm = tr.bpm;
      if (trace) { seenPl = (tr.periodLog || []).length; steps0 = tr.tempoReport.steps; }
    }
    if (holdT !== null && f.t > holdT) {
      const d = Math.abs(tr.bpm / heldBpm - 1);
      if (d > worstTempo) { worstTempo = d; worstAt = f.t; }
      if (suspectT === null && tr.holdSuspect) suspectT = f.t;
    }
    while (bi < s.beats.length && s.beats[bi] <= f.t) {
      const e = lockT === null ? null : frac(tr.beatsAt(s.beats[bi]));
      per.push({ k: bi, t: s.beats[bi], e });
      if (trace && holdT !== null && s.beats[bi] >= holdT) {
        if (kHold === null) kHold = bi;
        if ((bi - kHold) % 8 === 0) {
          const rep = tr.tempoReport, ons = tr.onsets || [];
          let lastIn = null;
          for (let i = ons.length - 1; i >= 0; i--) if (Math.abs(frac(tr.beatsAt(ons[i].t))) <= C.holdWindow) { lastIn = ons[i].t; break; }
          const W = writes.slice(wFrom); wFrom = writes.length;
          const rowT = s.beats[bi], med = a => { if (!a.length) return null; const x = [...a].sort((p, q) => p - q); return x[x.length >> 1]; };
          const kick = med(kickDev.filter(x => x.t > prevRowT && x.t <= rowT).map(x => x.ms));
          const trimE = med((tr.holdTrimLog || []).filter(x => x.t > prevRowT && x.t <= rowT).map(x => x.e));
          const fp = tr.holdFitPhase;
          prevRowT = rowT;
          rows.push({ beat: bi - kHold, t: s.beats[bi], bpm: tr.bpm, fit: rep.fit, dec: rep.last, steps: rep.steps - steps0,
            kick, trimE, fitPhase: fp && fp.t !== null && fp.t > rowT - 8 * P0 ? fp.v : null, median: tr.heldReport.median,
            nW: W.length, wFrom: W.length ? W[0].from : null, wTo: W.length ? W[W.length - 1].to : null, wSrc: [...new Set(W.map(w => w.src))].join('+'),
            state: tr.state, conf: tr.confidence, e, lastIn, net: tr.heldReport.net, suspect: tr.holdSuspect });
        }
      }
      bi++;
    }
  }
  const jumps = (tr.jumps || []).filter(j => holdT !== null && j.at >= holdT);
  return { tr, P0, per, lockT, holdT, flipped, heldBpm, worstTempo, worstAt, suspectT, jumps, held: tr.heldReport, snap: tr.snapshot(), writes, rows, edge, kickDev };
}
const f2 = x => (x === null || x === undefined ? '-' : (+x).toFixed(2));
const decLine = d => (d ? `${d.path}${d.cand ? ' ' + d.cand : ''} ${d.ok ? 'ok' : 'rejected' + (d.why ? ' (' + d.why + ')' : '')} @${f2(d.t)}` : '-');
/** the trace rows (one report line each) and the edge line, for hold a and hold d */
function traceReport(t, name, s, r) {
  const P = s.P || r.P0;
  for (const x of r.rows) {
    report(t, `hold trace ${name} beat +${x.beat} (${x.t.toFixed(1)} s): bpm ${f2(x.bpm)} (truth ${s.bpm}); fit-long target ${x.fit ? f2(x.fit.bpm) + ' @' + f2(x.fit.t) : '-'}, last decision ${decLine(x.dec)}; period writes in these 8 beats ${x.nW}${x.nW ? ` (${x.wSrc}: ${f2(x.wFrom)} -> ${f2(x.wTo)})` : ''}, step-path steps since the hold ${x.steps}; ${x.state} conf ${f2(x.conf)}; error ${x.e === null ? '-' : sgn(x.e) + ' beat ' + (x.e * P * 1000).toFixed(1) + ' ms'}; last in-window onset ${x.lastIn === null ? 'none' : x.lastIn.toFixed(2) + ' s'}; holdNet ${sgn(x.net)}; suspect ${x.suspect}; probe B: kick onset - truth median ${x.kick === null ? '-' : x.kick.toFixed(1) + ' ms'}, tracker e at trimmed onsets median ${x.trimE === null ? '-' : sgn(x.trimE)}, blocked fit line phase ${x.fitPhase === null ? '-' : sgn(x.fitPhase)}; latest hold-median ${x.median ? (x.median.empty ? 'empty @' + f2(x.median.t) : f2(x.median.bpm) + ' from ' + x.median.n + ' fits (was ' + f2(x.median.from) + ') @' + f2(x.median.t)) : '-'}`);
  }
  const e = r.edge;
  report(t, `hold trace ${name} edge: ${e ? `the period reached the 1 % band edge at ${e.t.toFixed(2)} s by ${e.src} (${f2(e.from)} -> ${f2(e.to)}, held ${f2(r.heldBpm)}), tempo decision then ${decLine(e.dec)}, step-path steps since the start ${e.steps}` : 'no period write reached the 1 % band edge'}; period writes after the hold ${r.writes.length} by ${[...new Set(r.writes.map(w => w.src))].join(', ') || 'none'}`);
  const hm = r.writes.filter(w => w.src === 'hold-median');
  report(t, `hold trace ${name} hold-median: writes ${hm.length ? hm.map(w => `${w.t.toFixed(2)} s ${f2(w.from)} -> ${f2(w.to)}`).join(', ') : 'none'}; empty windows (period kept) ${r.held.blocked['hold-median:empty'] || 0}`);
}
/** after the hold (and a hand flip's bar line): the worst |error| at a true beat, in beats */
function sideCheck(r) {
  const from = r.holdT + (r.flipped ? 4 * r.P0 + 0.05 : 0);
  const E = r.per.filter(p => p.e !== null && p.t > from + 0.05).map(p => Math.abs(p.e));
  return { n: E.length, worst: E.length ? Math.max(...E) : null, off: E.filter(e => e >= 0.375).length };
}
const heldLine = r => `held ${r.holdT === null ? 'never' : `at ${r.holdT.toFixed(2)} s`} (first lock ${r.lockT === null ? 'never' : r.lockT.toFixed(2) + ' s'}${r.flipped ? ', flipped first' : ''}) at ${r.heldBpm === null ? '-' : r.heldBpm.toFixed(2)} bpm; net now ${sgn(r.held.net)} peak ${r.held.netPeak.toFixed(3)} (cap ${C.holdNetMax}), trims ${r.held.trims}, clips ${r.held.clips}; worst tempo ${(100 * r.worstTempo).toFixed(2)} % at ${r.worstAt === null ? '-' : r.worstAt.toFixed(1) + ' s'}; suspect ${r.suspectT === null ? 'never' : 'at ' + r.suspectT.toFixed(2) + ' s'}; jumps after the hold ${r.jumps.map(j => `${j.kind}@${j.at.toFixed(1)}`).join(' ') || 'none'}; blocked ${JSON.stringify(r.held.blocked)}`;

let house = null;
const houseRun = () => house || (house = (() => { const s = houseTrap(); return { s, r: runHold(s, { trace: true }) }; })());

test('hold a: the house trap held after the lock: the side never changes, net <= holdNetMax, no tracker jump (hard)', (t) => {
  const { s, r } = houseRun(), sc = sideCheck(r);
  report(t, `hold house trap ${s.name}: ${heldLine(r)}; after the hold ${sc.n} beats, worst |error| ${sc.worst === null ? '-' : sc.worst.toFixed(3)} beat, ${sc.off} on the off-beat side`);
  traceReport(t, 'a (house trap)', s, r);
  assert.ok(r.holdT !== null, 'locked and held');
  assert.equal(r.held.on, true, 'still held at the end');
  assert.ok(sc.n > 150, `beats after the hold: ${sc.n}`);
  assert.equal(sc.off, 0, `the side never changes (worst ${sc.worst})`);
  assert.ok(r.held.netPeak <= C.holdNetMax + 1e-9, `net trim peak ${r.held.netPeak}`);
  assert.deepEqual(r.jumps.filter(j => j.kind !== 'flip').map(j => j.kind), [], 'no tracker jump while held');
});

test('hold b: the real-breakdown trap (8 bars bass + pad only) held: the side never changes, net <= holdNetMax (hard)', (t) => {
  const s = sideBreakdown(), r = runHold({ ...s, sr: 44100 }), sc = sideCheck(r);
  const last = r.per.slice(-32).filter(p => p.e !== null), inPct = 100 * last.filter(p => Math.abs(p.e) * s.P * 1000 <= GATE_MS).length / 32;
  report(t, `hold breakdown trap ${s.name}: ${heldLine(r)}; after the hold ${sc.n} beats, worst |error| ${sc.worst === null ? '-' : sc.worst.toFixed(3)} beat, ${sc.off} off-side; last 8 bars ${inPct.toFixed(1)} % within ${GATE_MS} ms`);
  assert.ok(r.holdT !== null && r.holdT < s.kickOut, `held before the breakdown (${r.holdT} < ${s.kickOut})`);
  assert.equal(sc.off, 0, `the side never changes (worst ${sc.worst})`);
  assert.ok(r.held.netPeak <= C.holdNetMax + 1e-9, `net trim peak ${r.held.netPeak}`);
  assert.deepEqual(r.jumps.filter(j => j.kind !== 'flip').map(j => j.kind), [], 'no tracker jump while held');
});

test('hold c: tempo-excursion bait (the house trap\'s snare build) held: the tempo stays within holdTempoTol of the held tempo (hard)', (t) => {
  const { s, r } = houseRun();
  report(t, `hold tempo bait ${s.name}: held ${r.heldBpm} bpm (truth ${s.bpm}), worst ${(100 * r.worstTempo).toFixed(3)} % at ${r.worstAt === null ? '-' : r.worstAt.toFixed(1) + ' s'} (tolerance ${100 * C.holdTempoTol} %); period writes refused ${JSON.stringify(r.held.blocked)}`);
  assert.ok(r.worstTempo <= C.holdTempoTol + 1e-9, `tempo ${(100 * r.worstTempo).toFixed(3)} % from the held tempo`);
  assert.ok(Math.abs(r.heldBpm / s.bpm - 1) <= 0.01, `held at the true tempo: ${r.heldBpm}`);
});

test('hold d: a 16-bar breakdown (kick and on-beat hat out, off-beat bass and hat stay) held: on the beat within 35 ms when the kick returns (hard)', (t) => {
  const s = houseTrap({ secs: 72, drops: [16], dropBars: 16, build: false }), r = runHold({ ...s, sr: 44100 }, { trace: true });
  const back = s.drops[0][1], first = r.per.filter(p => p.t >= back - 1e-6).slice(0, 8), ms = first.map(p => (p.e === null ? NaN : p.e * s.P * 1000));
  const sc = sideCheck(r);
  report(t, `hold 16-bar breakdown ${s.name}: kick out ${s.drops[0][0].toFixed(1)}-${back.toFixed(1)} s; ${heldLine(r)}; first 8 beats after the return (ms) ${ms.map(x => x.toFixed(1)).join(' ')}; states ${(r.tr.stateLog || []).filter(x => x.t > r.holdT).map(x => `${x.state}@${x.t.toFixed(1)}`).join(' ') || 'no change'}`);
  {   // probe B at the return: is the error vs the grid onset bias in the fixture (the kicks detected early or late)?
    const K = r.kickDev.filter(x => x.t >= back - s.P / 4 && x.t < back + 8 * s.P - s.P / 4).map(x => x.ms), Ks = [...K].sort((p, q) => p - q);
    report(t, `hold 16-bar breakdown ${s.name} probe B at the return: kick onset - truth over the first 8 beats (ms) ${K.map(x => x.toFixed(1)).join(' ') || 'none'}; median ${Ks.length ? Ks[Ks.length >> 1].toFixed(1) : '-'}; clock error at those beats (ms) ${ms.map(x => x.toFixed(1)).join(' ')}`);
  }
  traceReport(t, 'd (16-bar breakdown)', s, r);
  assert.ok(r.holdT !== null && r.holdT + (r.flipped ? 4 * s.P : 0) < s.drops[0][0], `held before the breakdown (${r.holdT})`);
  assert.equal(first.length, 8);
  for (const x of ms) assert.ok(Math.abs(x) <= GATE_MS, `on the beat after the return: ${ms.map(v => v.toFixed(1)).join(' ')} ms`);
  assert.equal(sc.off, 0, 'the side never changes');
  assert.deepEqual(r.jumps.filter(j => j.kind !== 'flip').map(j => j.kind), [], 'no tracker jump while held');
});

test('hold e: a real 120 -> 128 step under hold: nothing moves, holdSuspect within 16 beats (hard)', (t) => {
  const s = render('step-120-128', { sr: 44100 }), r = runHold(s), tStep = s.events.find(e => e.kind === 'step').t;
  const by = 16 * 60 / 128;
  report(t, `hold step ${s.name}: step at ${tStep} s; ${heldLine(r)}; suspect ${r.suspectT === null ? 'never' : `${((r.suspectT - tStep) * 128 / 60).toFixed(1)} beats after the step`} (target <= 16); end bpm ${r.tr.bpm.toFixed(2)}, shadow ${r.held.shadowBpm}`);
  assert.ok(r.holdT !== null && r.holdT < tStep, `held before the step (${r.holdT})`);
  assert.ok(Math.abs(r.heldBpm / 120 - 1) <= 0.01, `held at 120: ${r.heldBpm}`);
  assert.ok(r.worstTempo <= C.holdTempoTol + 1e-9, `the tempo stays within 1 % of the held tempo: ${(100 * r.worstTempo).toFixed(3)} %`);
  assert.deepEqual(r.jumps.filter(j => j.kind !== 'flip').map(j => j.kind), [], 'no jump');
  assert.ok(r.held.netPeak <= C.holdNetMax + 1e-9, `net trim peak ${r.held.netPeak}`);
  assert.equal(r.held.on, true, 'still held: holdSuspect is a hint only');
  assert.ok(r.suspectT !== null && r.suspectT > tStep && r.suspectT <= tStep + by, `holdSuspect within 16 beats of the step: ${r.suspectT}`);
});

test('hold f: hold off (no hand): no gate fires, nothing blocked, the snapshot says held off (hard)', () => {
  const s = sideBreakdown(), r = runHold({ ...s, sr: 44100 }, { hold: false });
  assert.ok(r.lockT !== null, 'locks');
  assert.deepEqual({ on: r.held.on, suspect: r.held.suspect, entries: r.held.entries, blocked: r.held.blocked, trims: r.held.trims },
    { on: false, suspect: false, entries: 0, blocked: {}, trims: 0 });
  assert.equal(r.snap.held.on, false);
  assert.equal(r.tr.held, false);
  for (const k of ['holdWindow', 'holdTempoTol', 'holdNetMax', 'holdSuspectTempo', 'holdSuspectPhase', 'holdSuspectBeats']) assert.ok(Number.isFinite(C[k]), k);
});

test('hold g: handHold without a model returns false; off when not held is a no-op', () => {
  const tr = T.createTracker();
  assert.equal(tr.handHold(true, 0), false, 'no model yet');
  assert.equal(tr.held, false);
});
