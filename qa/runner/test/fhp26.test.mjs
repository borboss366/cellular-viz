// 26 Lattice Gas (FHP): VIZ research's truths (#71) that need no browser, on the page's own engine
// (experiments/26-fhp.mjs). node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
// The GPU's bit-for-bit match with stepCPU, its live mass and the picture are the page's and the runner's.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../../../experiments/26-fhp.mjs';

test('the 6 links: opposite pairs cancel, 60° apart, unit length on screen', () => {
  for (let i = 0; i < 6; i++) {
    const a = F.DIRS[i], b = F.DIRS[(i + 3) % 6];
    assert.deepEqual([a[0] + b[0], a[1] + b[1]], [0, 0]);
    const [x, y] = F.SCREEN[i], [x1, y1] = F.SCREEN[(i + 1) % 6];
    assert.ok(Math.abs(Math.hypot(x, y) - 1) < 1e-12);
    assert.ok(Math.abs(x * x1 + y * y1 - 0.5) < 1e-12, `links ${i}, ${i + 1} are 60° apart`);
  }
});

test('truth 1a: the collision table keeps mass and momentum for all 64 states and both chiralities', () => {
  const r = F.checkLut();
  assert.ok(r.ok, JSON.stringify(r.bad));
  // exactly the 3 head-on pairs and the 2 symmetric triples collide
  assert.deepEqual(r.changed, [9, 18, 21, 36, 42]);
  for (const s of [9, 18, 36]) {
    assert.notEqual(F.LUT[s], F.LUT[64 + s], 'the two chiralities turn a pair opposite ways');
    assert.equal(F.POP[F.LUT[s]], 2);
  }
  assert.equal(F.LUT[21], 42); assert.equal(F.LUT[42], 21); assert.equal(F.LUT[64 + 21], 42);
  // a collision is undone by the other chirality (the rules are reversible)
  for (let s = 0; s < 64; s++) assert.equal(F.LUT[64 + F.LUT[s]], s);
});

test('truth 1b: a 120 × 120 periodic lattice keeps mass and momentum exactly every step (6 seeds, 40 steps)', () => {
  const n = 120, rows = [];
  for (let k = 0; k < 6; k++) {
    const seed = 1000 + 17 * k;
    let S = F.randomLattice(n, n, 0.25, seed), T = new Uint8Array(S.length);
    const ref = F.massMomentum(S);
    for (let t = 0; t < 40; t++) {
      F.stepCPU(S, n, n, t, seed, T); [S, T] = [T, S];
      const m = F.massMomentum(S);
      assert.deepEqual(m, ref, `seed ${seed} step ${t + 1}`);
    }
    rows.push({ seed, mass: ref.mass, momentum: `${ref.pq}, ${ref.pr}` });
  }
  console.table(rows);
});

test('the gas moves: a lone particle travels one link a step and wraps the torus', () => {
  const n = 16, S = new Uint8Array(n * n);
  S[5 * n + 3] = 1;   // link 0 (+q) at (q 3, r 5)
  let A = S, B = new Uint8Array(S.length);
  for (let t = 0; t < n; t++) { F.stepCPU(A, n, n, t, 1, B); [A, B] = [B, A]; }
  assert.equal(A[5 * n + 3], 1, 'back where it started after n steps');
  assert.equal(F.massMomentum(A).mass, 1);
});

test('the hash is the shader\'s: lowbias32 values and the chirality bit', () => {
  assert.equal(F.hash32(0), 0);
  assert.equal(F.hash32(1), F.hash32(1));
  const ones = Array.from({ length: 10000 }, (_, i) => F.chirality(i, 3, 7)).reduce((a, b) => a + b, 0);
  assert.ok(ones > 4700 && ones < 5300, `chirality is fair: ${ones} / 10000`);
});

test('truth 3: a weak pulse rings out at the FHP-I sound speed 1/√2 (±10 %, 64 rings, steps 20 → 40)', () => {
  const r = F.soundSpeedCPU();
  console.log(JSON.stringify({ rings: r.rings, r1: r.r1, r2: r.r2, speed: +r.speed.toFixed(4), speedPeak: +r.speedPeak.toFixed(4), theory: +r.theory.toFixed(4) }));
  assert.equal(r.rings, 64);
  assert.ok(Math.abs(r.speed - r.theory) / r.theory <= 0.1, `ring speed ${r.speed.toFixed(3)} vs ${r.theory.toFixed(3)}`);
});

test('truth 4 estimator (F2): a stream-function flow reads divergence-free, the same field turned 90° (a potential flow) curl-free', () => {
  const nq = 512, nr = 288, B = 8, w = nq / B, h = nr / B, modes = F.flowModes(3, { count: 6, kMax: 2 });
  const U = [], P = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = F.flowAt(modes, x * B, y * B, nq, nr); U.push(u); P.push([-u[1], u[0]]); }
  const a = F.divCurl(U, w, h, B), b = F.divCurl(P, w, h, B);
  console.log(JSON.stringify({ solenoidal: a, potential: b }));
  assert.ok(a.ratio < 0.05, `stream-function flow: div/curl ${a.ratio}`);
  assert.ok(b.ratio > 10, `potential flow: div/curl ${b.ratio}`);
});

test('F2 start: the vortex lattice holds its flow in the coarse momentum (equilibrium p_i = d (1 + 2 e_i · u))', () => {
  const nq = 256, nr = 160, B = 32, { S, modes, scale } = F.flowLattice(nq, nr, 0.25, 5, { kMax: 2 });
  let dot = 0, uu = 0, vv = 0;
  for (let by = 0; by < nr / B; by++) for (let bx = 0; bx < nq / B; bx++) {
    let m = 0, px = 0, py = 0;
    for (let r = by * B; r < by * B + B; r++) for (let q = bx * B; q < bx * B + B; q++) {
      const s = S[r * nq + q];
      for (let i = 0; i < 6; i++) if ((s >> i) & 1) { m++; px += F.SCREEN[i][0]; py += F.SCREEN[i][1]; }
    }
    const u = F.flowAt(modes, bx * B + B / 2, by * B + B / 2, nq, nr).map(c => c * scale), v = [px / m, py / m];
    dot += u[0] * v[0] + u[1] * v[1]; uu += u[0] * u[0] + u[1] * u[1]; vv += v[0] * v[0] + v[1] * v[1];
  }
  const corr = dot / Math.sqrt(uu * vv);
  assert.ok(corr > 0.8, `block velocity vs the flow: correlation ${corr.toFixed(3)}`);
  assert.equal(F.massMomentum(S).mass > 0.24 * 6 * nq * nr, true);
});

test('truth 4 noise removal: two noisy measurements of one solenoidal flow cross-correlate to div/curl ≈ 0, the plain ratio does not', () => {
  const nq = 512, nr = 512, B = 16, w = nq / B, modes = F.flowModes(11, { count: 8, kMax: 2 }), R = F.rng(99);
  const gauss = () => { let s = 0; for (let i = 0; i < 12; i++) s += R(); return s - 6; };
  const flow = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) flow.push(F.flowAt(modes, x * B, y * B, nq, nr));
  const peak = Math.max(...flow.map(u => Math.hypot(u[0], u[1])));
  const sigma = 0.08 * peak;   // noise whose derivative is a third of the curl signal
  const noisy = () => flow.map(u => [u[0] + sigma * gauss(), u[1] + sigma * gauss()]);
  const r = F.divCurlCross(noisy(), noisy(), w, w, B);
  console.log(JSON.stringify(r));
  assert.ok(r.plainRatio > 0.15, `plain ratio ${r.plainRatio} (noise must show)`);
  assert.ok(r.ratio < 0.1, `cross ratio ${r.ratio}`);
  assert.ok(Number.isFinite(r.ddMean) && r.ddSigma > 0 && r.ratioUpper >= r.ratio, `signed cross term and its bound: ${r.ddMean} ± ${r.ddSigma}, upper ${r.ratioUpper}`);
  assert.ok(r.ratioUpper < 0.2, `upper bound ${r.ratioUpper}`);
});

test('F2 mixing (#165): the Kolmogorov force is constant along its link (divergence-free) and periodic on both tori', () => {
  for (const [nq, nr, kk] of [[2048, 1152, 16], [1024, 576, 16], [512, 512, 4]]) for (let axis = 0; axis < 3; axis++) {
    const [dq, dr] = F.DIRS[axis], R = F.rng(axis + nq);
    let sum = 0;
    for (let k = 0; k < 2000; k++) {
      const q = Math.floor(R() * nq), r = Math.floor(R() * nr), f = F.forceAt(axis, q, r, nq, nr, 0.7, kk);
      assert.ok(Math.abs(F.forceAt(axis, q + dq, r + dr, nq, nr, 0.7, kk) - f) < 1e-9, `axis ${axis}: along its link at ${q},${r}`);
      assert.ok(Math.abs(F.forceAt(axis, q + nq, r, nq, nr, 0.7, kk) - f) < 1e-9 && Math.abs(F.forceAt(axis, q, r + nr, nq, nr, 0.7, kk) - f) < 1e-9, `axis ${axis}: periodic (${nq} x ${nr}, k ${kk})`);
    }
    for (let r = 0; r < nr; r += 3) for (let q = 0; q < nq; q += 5) sum += F.forceAt(axis, q, r, nq, nr, 0, kk);
    assert.ok(Math.abs(sum) / ((nr / 3) * (nq / 5)) < 0.02, `axis ${axis}: no net push (${sum})`);
  }
});

test('F2 mixing: a forcing flip keeps mass and pushes momentum along the force', () => {
  const nq = 128, nr = 72, S = F.randomLattice(nq, nr, 0.25, 3), R = F.rng(5), before = F.massMomentum(S);
  let push = 0, flips = 0;
  for (let axis = 0; axis < 3; axis++) for (let k = 0; k < S.length; k++) {
    const q = k % nq, r = Math.floor(k / nq), f = F.forceAt(axis, q, r, nq, nr), s = S[k], t = F.forceFlip(s, axis, f, 0.5, R());
    if (t !== s) {
      flips++;
      const a = F.massMomentum([s]), b = F.massMomentum([t]);
      assert.equal(a.mass, b.mass);
      const dp = [b.pq - a.pq, b.pr - a.pr];
      assert.deepEqual(dp, F.DIRS[axis].map(c => 2 * c * Math.sign(f)));
      push += 1;
    }
    S[k] = t;
  }
  assert.ok(flips > 500, `flips ${flips}`);
  assert.equal(F.massMomentum(S).mass, before.mass);
});

test('F2 mixing: twice the vortices per axis (16 modes, |m|, |n| ≤ 12) keep |u| ≤ 0.2 at every site', () => {
  for (const seed of [1, 2, 3]) {
    const { ux, uy, modes } = F.flowField(1024, 576, seed, { umax: 0.18, count: 16, kMax: 12 });
    assert.equal(modes.length, 16);
    assert.ok(modes.every(k => Math.abs(k.m) <= 12 && Math.abs(k.n) <= 12));
    let peak = 0; for (let i = 0; i < ux.length; i++) peak = Math.max(peak, Math.hypot(ux[i], uy[i]));
    assert.ok(peak <= 0.2 && peak >= 0.17, `seed ${seed}: peak |u| ${peak.toFixed(4)}`);
  }
});
