// 24 Paint Pour: the QA truths of VIZ research's spec (#87) that need no browser, in float64, on the page's own
// maths (experiments/24-marble.mjs). node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
// The GPU trace (truth 3), edges, flash and budget are the page's and the runner's.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../../../experiments/24-marble.mjs';

const R = K.rng(5), U = () => R() * 2 - 1;
const mk = {
  comb: () => { const a = R() * 2 * Math.PI; return { type: K.COMB, bx: U(), by: U(), mx: Math.cos(a), my: Math.sin(a), z: 0.02 + 0.05 * R(), u: 0.3 + 0.3 * R(), lam: 0.02, sp: 0.1, n: 3 + Math.floor(R() * 5) }; },
  vortex: () => { const r0 = 0.06 + 0.1 * R(); return { type: K.SWIRL, cx: U(), cy: U(), z: Math.PI / 2 * r0, u: 0.35, r0, lam: r0, hmin: 0.3 * r0, ring: 0 }; },
  ring: () => ({ type: K.SWIRL, cx: U(), cy: U(), z: 0.03 * (R() < 0.5 ? -1 : 1), u: 0.5, r0: 0.6, lam: 0.25, hmin: 0.2, ring: 1 }),
  drop: () => ({ type: K.DROP, cx: U(), cy: U(), r: 0.03 + 0.3 * R(), colour: 1 + Math.floor(R() * 4) }),
};
const randomOps = n => Array.from({ length: n }, () => { const t = R(); return t < 0.45 ? mk.comb() : t < 0.6 ? mk.vortex() : t < 0.7 ? mk.ring() : mk.drop(); });

test('truth 1: every op is area-preserving, max |det J − 1| < 1e-5 on 10⁴ points per type', () => {
  const rows = {};
  for (const [name, f] of Object.entries(mk)) {
    let w = 0, n = 0;
    for (let k = 0; k < 50; k++) {
      const o = f();
      for (let j = 0; j < 200; j++) {
        const x = 2 * U(), y = 2 * U();
        if (o.type !== K.COMB) { const h = Math.hypot(x - o.cx, y - o.cy); if (h < 1e-2 || (o.type === K.SWIRL && h < 1.05 * o.hmin)) continue; }
        w = Math.max(w, Math.abs(K.jacobianDet((a, b) => K.fwdOp(o, a, b), x, y) - 1)); n++;
      }
    }
    rows[name] = { points: n, maxDetErr: w.toExponential(2) };
    assert.ok(n > 9000 && w < 1e-5, `${name}: |det J − 1| = ${w}`);
  }
  console.table(rows);
});

test('the shader\'s skips are exact: a swirl beyond its reach (< 1e-7), a comb beyond 20 λ (< 1e-5)', () => {
  for (let k = 0; k < 200; k++) {
    const o = R() < 0.5 ? mk.vortex() : mk.ring(), reach = K.swirlReach(o);
    for (let j = 0; j < 50; j++) {
      const x = 3 * U(), y = 3 * U(), h = Math.hypot(x - o.cx, y - o.cy), e = o.ring ? Math.abs(h - o.r0) : h - o.r0;
      if (e <= reach) continue;
      const p = K.fwdOp(o, x, y); assert.ok(Math.hypot(p[0] - x, p[1] - y) < 1e-7, `swirl moved ${Math.hypot(p[0] - x, p[1] - y)} beyond its reach`);
    }
  }
  for (let k = 0; k < 100; k++) { const c = mk.comb(); assert.ok(c.z * Math.pow(c.u, 20) < 1e-5); }
  assert.equal(K.swirlReach({ ...mk.vortex(), z: 0 }), -1e9);
});

test('motion rates: a drop grows at ≤ A_MOVE, strokes report dz/dt only while running', () => {
  const d = { type: K.DROP, start: 0, dur: K.growSeconds(0.35, 0.6, 0.5) / 0.5, r: 0.35 };
  assert.ok(K.rateOf(d, d.dur / 2, 120) * 2 * Math.PI <= K.A_MOVE + 1e-12);
  assert.equal(K.rateOf(d, -1, 120), 0); assert.equal(K.rateOf(d, d.dur + 1, 120), 0);
  const c = { ...mk.comb(), start: 0, dur: 0.5 }; assert.ok(Math.abs(K.rateOf(c, 0.25, 120) - c.z * 1.5 / 0.25) < 1e-12);
});

test('truth 3 (float64 half): the inverse is exact, round trip after 96 ops < 1e-9', () => {
  const ops = randomOps(96);
  let w = 0, n = 0;
  for (let k = 0; k < 20000; k++) {
    const x = 4 * U(), y = 4 * U(), p = K.fwd(ops, x, y), q = K.inv(ops, p[0], p[1]);
    assert.ok(q, 'a forward image is never inside a later drop');
    w = Math.max(w, Math.hypot(q[0] - x, q[1] - y)); n++;
  }
  console.log(`truth 3: round trip after 96 ops, ${n} points: max error ${w.toExponential(2)}`);
  assert.ok(w < 1e-9, `${w}`);
});

test('truth 4: a stroke then the same stroke reversed (N then S) is the identity, < 1e-6', () => {
  let w = 0;
  for (let k = 0; k < 2000; k++) { const a = mk.comb(), b = { ...a, mx: -a.mx, my: -a.my }, x = U(), y = U(), p = K.fwd([a, b], x, y); w = Math.max(w, Math.hypot(p[0] - x, p[1] - y)); }
  assert.ok(w < 1e-6, `${w}`);
  // and a swirl undone by its negative
  for (let k = 0; k < 2000; k++) { const a = mk.vortex(), b = { ...a, z: -a.z }, x = U(), y = U(), p = K.fwd([a, b], x, y); w = Math.max(w, Math.hypot(p[0] - x, p[1] - y)); }
  assert.ok(w < 1e-9, `${w}`);
});

test('truth 2: dye area is conserved; a drop adds exactly πr² of its colour (grid 600², < 2 %)', () => {
  const ops = [{ type: K.DROP, cx: 0, cy: 0, r: 0.3, colour: 1 }, ...randomOps(40).map(o => (o.type === K.DROP ? { ...o, colour: 2 } : o))];
  const N = 600, X = 3, cell = (2 * X / N) ** 2;
  let a1 = 0, a2 = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const t = K.trace(ops, -X + 2 * X * (i + 0.5) / N, -X + 2 * X * (j + 0.5) / N);
    if (t.hit >= 0) { if (ops[t.hit].colour === 1) a1 += cell; else a2 += cell; }
  }
  const want1 = Math.PI * 0.09, want2 = ops.filter(o => o.colour === 2).reduce((s, o) => s + Math.PI * o.r * o.r, 0);
  console.log(`truth 2: first drop ${a1.toFixed(5)} (want ${want1.toFixed(5)}), later drops ${a2.toFixed(4)} (want ${want2.toFixed(4)})`);
  assert.ok(Math.abs(a1 - want1) / want1 < 0.02 && Math.abs(a2 - want2) / want2 < 0.02);
});

test('drops compose: r₁ then r₂ in the same centre = one drop of √(r₁² + r₂²)', () => {
  const a = { type: K.DROP, cx: 0.1, cy: -0.2, r: 0.12 }, b = { ...a, r: 0.2 }, c = { ...a, r: Math.hypot(0.12, 0.2) };
  let w = 0; for (let k = 0; k < 2000; k++) { const x = U(), y = U(), p = K.fwd([a, b], x, y), q = K.fwd([c], x, y); w = Math.max(w, Math.hypot(p[0] - q[0], p[1] - q[1])); }
  assert.ok(w < 1e-12, `${w}`);
});

test('truth 5: the pour law, r = √(rate·t/π) at every beat of the build', () => {
  const pal = K.palette('canada'), inp = { seed: 3, dropScale: 1, cellsPerDrop: 0.5, blackShare: 0.3, tines: 0.5, tineDepth: 1, tineSharp: 0.5, vortexOn: true, pourRate: 0.006, bassSwirl: 0.5, camDrift: 1 };
  const [pour] = K.opsFor({ kind: 'pour', beat: 12 * 4, bpb: 4, bpm: 120 }, inp, pal);
  assert.equal(pour.role, 'pour'); assert.equal(pour.dur, 16);
  for (let t = 0; t <= 16; t += 0.37) { const e = K.effective(pour, pour.start + t), want = Math.sqrt(pour.pour * t / Math.PI); assert.ok(Math.abs(e.r - want) <= 1e-12 + 0.005 * want); }
  assert.ok(Math.abs(K.effective(pour, pour.start + 99).r - pour.r) < 1e-12, 'the pour stops at the drop');
});

test('truth 9: the op log is a function of the seed and the beat clock (any frame rate)', () => {
  const pal = K.palette('canada'), inp = { seed: 42, dropScale: 1, cellsPerDrop: 0.5, blackShare: 0.3, tines: 0.5, tineDepth: 1, tineSharp: 0.5, vortexOn: true, pourRate: 0.006, bassSwirl: 0.5, camDrift: 1 };
  const pat = { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' };
  const run = (fps, seed = 42) => {
    const out = []; let last = -1e-6;
    for (let f = 1; f / fps * 2 <= 34 * 4; f++) {
      const b = f / fps * 2;   // 120 BPM
      for (const e of K.eventsIn(last, b, 4, K.patternHits(last, b, 4, pat))) for (const o of K.songOps(e, { ...inp, seed }, pal, 4, 120)) out.push(JSON.stringify(o));
      last = b;
    }
    return out;
  };
  const a = run(60), b = run(37), c = run(144), d = run(60, 43);
  assert.ok(a.length > 100, `${a.length} ops`);
  assert.deepEqual(b, a); assert.deepEqual(c, a);
  assert.notDeepEqual(d, a, 'another seed, another log');
  const roles = {}; for (const s of a) { const r = JSON.parse(s).role; roles[r] = (roles[r] || 0) + 1; }
  console.log(`truth 9: 34 bars → ${a.length} ops`, roles);
});

test('the song: drop at bar 0 of every 16, breakdown 8–11 without drops, build 12–15 pours; colours never repeat', () => {
  const pal = K.palette('canada'), inp = { seed: 9, dropScale: 1, cellsPerDrop: 0.5, blackShare: 0.3, tines: 1, tineDepth: 1, tineSharp: 0.5, vortexOn: true, pourRate: 0.006, bassSwirl: 0.5, camDrift: 1 };
  assert.deepEqual([0, 7, 8, 11, 12, 15, 16].map(K.phaseOf), ['groove', 'groove', 'breakdown', 'breakdown', 'build', 'build', 'groove']);
  const ev = K.eventsIn(-1e-6, 32 * 4, 4);
  assert.deepEqual(ev.filter(e => e.kind === 'drop').map(e => e.beat), [0, 64, 128]);
  assert.deepEqual(ev.filter(e => e.kind === 'pour').map(e => e.beat), [48, 112]);
  for (let b = 32; b < 48; b++) assert.equal(K.songOps({ kind: 'kick', beat: b }, inp, pal, 4, 120).length, 0, 'no combs in the breakdown');
  const cols = Array.from({ length: 200 }, (_, k) => K.sectionColour(9, k, pal, 0.3));
  assert.notEqual(cols[0], 0, 'the first drop is not black');
  for (let k = 1; k < cols.length; k++) assert.notEqual(cols[k], cols[k - 1], `sections ${k - 1}, ${k}`);
  const black = cols.filter(c => c === 0).length / cols.length;
  console.log(`black share of big drops: ${black.toFixed(2)}`);
  assert.ok(black > 0.1 && black < 0.45);
});

test('truth 10: palette contrast ≥ 3:1 against the ground; no big drop above L 0.75', () => {
  for (const name of K.PALETTE_NAMES) {
    const p = K.palette(name), rows = p.colours.slice(1).map(h => [h, K.contrast(h, K.GROUND)]);
    if (name === 'canada') { console.table(Object.fromEntries(rows.map(([h, c]) => [h, c.toFixed(2)]))); for (const [h, c] of rows) assert.ok(c >= 3, `${h} ${c}`); }
    for (const i of p.big) assert.ok(p.L[i] <= 0.75, `${name} ${p.colours[i]} L ${p.L[i]}`);
  }
  assert.ok(Math.abs(K.contrast('#B8121C', K.GROUND) - 3.09) < 0.02);
});

test('flash-safe growth: a big drop grows at a constant area rate, slow enough for every 10° window', () => {
  const pal = K.palette('canada');
  for (const c of pal.big) for (const r of [0.15, 0.25, 0.35]) {
    const dL = pal.L[c] - pal.L[0], T = K.growSeconds(r, dL, 0.5), rate = Math.PI * r * r / T;
    assert.ok(T >= 0.5);
    assert.ok(dL * rate * 0.1 / K.WINDOW_AREA <= 0.2 + 1e-12, `${pal.colours[c]} r ${r}: window rise ${(dL * rate * 0.1 / K.WINDOW_AREA).toFixed(3)} per 100 ms`);
    assert.ok(T >= 0.7 * (r / 0.35) ** 2 * (dL / 0.675) - 1e-12);
  }
  const d = { type: K.DROP, start: 0, dur: 4, r: 0.3 };
  for (const s of [0, 0.25, 0.5, 1]) assert.ok(Math.abs(Math.PI * K.effective(d, 4 * s).r ** 2 - Math.PI * 0.09 * s) < 1e-12, 'area ∝ s');
});

test('pour here, dragged: a drag from left to right leaves the pour colour at the end point and all along the path; one segment at most every ¼ beat; the area is the pour rate × the hold', () => {
  // the scene's own chain (K.pourDragStep, as 24-paint-pour.mjs calls it every frame while the pour is held)
  const fps = 60, bpm = 120, colour = 3, rate = 0.0385, maxDur = 16;   // area a beat (about the page's rate at zoom 1), 8 s
  const info = { t0: 0, maxDur, rate, colour };
  let seg = { type: K.DROP, start: 0, dur: maxDur, cx: -0.6, cy: 0, r: Math.sqrt(rate * maxDur / Math.PI), pour: rate, colour, role: 'pour', held: true };
  const ops = [seg], dragBeats = 8, holdBeats = 1;   // drag 1.2 screen heights over 8 beats, then hold still for a beat
  let last = 0;
  for (let f = 1; f / fps * bpm / 60 <= dragBeats + holdBeats; f++) {
    const b = f / fps * bpm / 60, x = -0.6 + 1.2 * Math.min(1, b / dragBeats);
    const nx = K.pourDragStep(seg, [x, 0], b, info, 1);
    if (nx) { ops.push(nx); seg = nx; }
    last = b;
  }
  seg.dur = Math.min(seg.dur, last - seg.start);   // the release
  const eff = ops.map(o => K.effective(o, last + 1)), at = (x, y) => { const t = K.trace(eff, x, y); return t.hit >= 0 ? eff[t.hit].colour : 0; };
  assert.equal(at(0.6, 0), colour, 'the pour colour at the end point');
  assert.equal(at(-0.6, 0), colour, 'and at the start');
  const xs = Array.from({ length: 25 }, (_, i) => -0.6 + 0.05 * i), gaps = xs.filter(x => at(x, 0) !== colour);
  assert.deepEqual(gaps, [], 'no gap along the path');
  const end = ops[ops.length - 1];
  assert.ok(Math.hypot(end.cx - 0.6, end.cy) < K.POUR_STEP_MIN + 1e-9, `the last segment sits under the finger (${end.cx.toFixed(3)})`);
  for (let i = 1; i < ops.length; i++) assert.ok(ops[i].start - ops[i - 1].start >= K.POUR_SEG_BEATS - 1e-9, 'no burst: one segment per ¼ beat at most');
  assert.ok(ops.length >= 10 && ops.length <= Math.floor(last / K.POUR_SEG_BEATS) + 1, `${ops.length} segments`);
  const area = eff.reduce((s, o) => s + Math.PI * o.r * o.r, 0);
  assert.ok(Math.abs(area - rate * last) < 1e-9, `area ${area} = rate × hold ${rate * last}`);
  console.log(`pour drag: ${ops.length} segments over ${last.toFixed(2)} beats, area ${area.toFixed(4)}`);
  // a still finger makes no new segment; a flick far ahead starts one right under it
  const still = { ...ops[0], start: 0, dur: maxDur, cx: 0, cy: 0, held: true };
  for (let b = 0.1; b < 4; b += 0.1) assert.equal(K.pourDragStep(still, [0.01, 0], b, info, 1), null);
  const flick = K.pourDragStep({ ...still }, [0.9, 0.2], 1, info, 1);
  assert.deepEqual([flick.cx, flick.cy], [0.9, 0.2]);
});

test('?beatFx=0: a 16-bar run has no comb or swirl op from the song; the drops (rings, cells) and the build pour stay the same', () => {
  const pal = K.palette('canada'), inp = { seed: 7, dropScale: 1, cellsPerDrop: 0.5, blackShare: 0.3, tines: 1, tineDepth: 1, tineSharp: 0.5, vortexOn: true, pourRate: 0.006, bassSwirl: 0.5, camDrift: 1 };
  const pat = { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' };
  const run = beatFx => {
    const out = []; let last = -1e-6;
    for (let f = 1; f / 60 * 2 <= 16 * 4; f++) {
      const b = f / 60 * 2;
      for (const e of K.eventsIn(last, b, 4, K.patternHits(last, b, 4, pat))) for (const o of K.songOps(e, { ...inp, beatFx }, pal, 4, 120)) out.push(o);
      last = b;
    }
    return out;
  };
  const off = run(false), on = run(true), stirs = ops => ops.filter(o => o.type === K.COMB || o.type === K.SWIRL);
  assert.equal(stirs(off).length, 0, 'no kick comb, snare vortex, bass swirl or feather comb');
  assert.ok(stirs(on).length > 20, `beatFx on still stirs (${stirs(on).length} ops)`);
  const drops = ops => ops.filter(o => o.type === K.DROP).map(o => JSON.stringify(o));
  assert.deepEqual(drops(off), drops(on), 'the same drops, rings, cells and pour');
  assert.ok(off.some(o => o.role === 'drop') && off.some(o => o.role === 'pour'), 'the drop and the build pour stay');
  assert.deepEqual(run(undefined).map(o => JSON.stringify(o)), on.map(o => JSON.stringify(o)), 'the default is beatFx on');
});

test('?pulse: the colour pulse peaks on every beat, is 0 at the half beat, never steps between frames, and brightens < 10 %', () => {
  for (const b of [0, 1, 7, 63]) { assert.ok(Math.abs(K.beatPulse(b) - 1) < 1e-12, `peak on beat ${b}`); assert.ok(K.beatPulse(b + 0.5) < 1e-12, 'nothing at the half beat'); }
  let step = 0;   // the largest change between two 60 fps frames at 180 bpm (the fastest clock)
  for (let f = 0; f < 60 * 8; f++) step = Math.max(step, Math.abs(K.beatPulse((f + 1) / 60 * 3) - K.beatPulse(f / 60 * 3)));
  console.log(`colour pulse: largest frame step ${step.toFixed(3)} at 180 bpm, 60 fps`);
  assert.ok(step < 0.3, `a step of ${step}`);
  assert.ok(K.PULSE_GAIN < 0.1, 'the brightness lift stays under the 10 % general-flash change');
});
