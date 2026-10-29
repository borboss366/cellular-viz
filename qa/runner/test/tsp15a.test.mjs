// 15a Pulsing salesman: the CPU-checkable QA truths (#37 comment 6493121591), on the page's own maths
// (experiments/15-tsp-core.js). No browser: node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const T = require('../../../experiments/15-tsp-core.js');

test('truth 1: with heat 0 every applied 2-opt move strictly shortens the tour', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const pts = T.makeCities(60, seed), t = T.nearestNeighbour(pts);
    let len = T.tourLength(pts, t), moves = 0;
    for (;;) {
      const m = T.best2opt(pts, t);
      if (!m) break;
      T.apply2opt(t, m.i, m.j);
      const nl = T.tourLength(pts, t);
      assert.ok(nl < len, `seed ${seed}: move ${moves} did not shorten (${len} → ${nl})`);
      assert.ok(Math.abs(nl - len - m.delta) < 1e-9, 'delta matches the length change');
      len = nl; moves++;
    }
    assert.ok(moves > 0);
  }
});

test('truth 2: a settled 2-opt tour has no crossings (20 seeds, n = 50 and 120)', () => {
  for (const n of [50, 120]) for (let seed = 1; seed <= 20; seed++) {
    const pts = T.makeCities(n, seed * 7 + n);
    const t = T.twoOptConverge(pts, T.sfcTour(pts));
    assert.equal(T.countCrossings(pts, t), 0, `n ${n} seed ${seed}`);
  }
});

test('ruling on #123: a snap settles within 4 bars (n = 200, 3 moves a frame, 60 fps, 180 bpm worst case)', () => {
  const budget = 3 * 60 * (4 * 4 * 60 / 180);   // 3 moves/frame × frames in 4 bars at 180 bpm = 960 moves
  for (let seed = 1; seed <= 10; seed++) {
    const pts = T.makeCities(200, 300 + seed), t = T.sfcTour(pts);
    let moves = 0;
    for (let m; (m = T.best2opt(pts, t)); moves++) T.apply2opt(t, m.i, m.j);
    assert.ok(moves <= budget, `seed ${seed}: ${moves} moves > ${budget}`);
    assert.equal(T.countCrossings(pts, t), 0);
  }
});

test('the crossing test finds a crossing when there is one', () => {
  const pts = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.equal(T.countCrossings(pts, [0, 1, 2, 3]), 0);
  assert.equal(T.countCrossings(pts, [0, 2, 1, 3]), 1);
});

test('truth 3: every tour the engine makes is a Hamiltonian cycle', () => {
  const pts = T.makeCities(200, 42);
  for (const t of [T.nearestNeighbour(pts), T.sfcTour(pts), T.twoOptConverge(pts, T.sfcTour(pts))]) assert.ok(T.isHamiltonian(t, 200));
  const grow = [0, 1, 2];
  for (let c = 3; c < 200; c++) T.cheapestInsert(pts, grow, c);
  assert.ok(T.isHamiltonian(grow, 200));
  const ac = T.antColony(pts.slice(0, 40), { seed: 3 });
  ac.step();
  for (const t of ac.lastAnts) assert.ok(T.isHamiltonian(t, 40));
  assert.ok(!T.isHamiltonian([0, 1, 1, 3], 4) && !T.isHamiltonian([0, 1, 2], 4));
});

test('truth 4: route count (n−1)!/2', () => {
  assert.equal(T.routeCount(10).exact, '181440');
  assert.equal(T.routeCount(20).exact, '60822550204416000');
  assert.equal(T.routeCount(4).exact, '3');
  const r = T.routeCount(200);
  assert.equal(r.exact, null);
  assert.ok(Math.abs(r.log10 - 372.2948) < 0.001, `log10 ${r.log10}`);   // 199!/2 ≈ 1.97·10^372
});

test('truth 5: an edge no ant used decays by exactly (1 − ρ) per iteration', () => {
  const pts = T.makeCities(30, 9), ac = T.antColony(pts, { seed: 5, rho: 0.1 });
  for (let it = 0; it < 12; it++) {
    const before = Float64Array.from(ac.tau);
    ac.step();
    let unused = 0;
    for (let e = 0; e < before.length; e++) {
      if (ac.lastUsed[e]) continue;
      unused++;
      assert.equal(ac.tau[e], before[e] * (1 - 0.1));
    }
    assert.ok(unused > 0);
  }
});

test('truth 6: Held–Karp matches brute force for n ≤ 10 on 20 seeds; 2-opt is never below it', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const n = 5 + (seed % 6), pts = T.makeCities(n, 1000 + seed);
    const hk = T.heldKarp(pts), bf = T.bruteForce(pts);
    assert.ok(Math.abs(hk.length - bf) < 1e-9, `seed ${seed} n ${n}: ${hk.length} vs ${bf}`);
    assert.ok(T.isHamiltonian(hk.tour, n));
    assert.ok(Math.abs(T.tourLength(pts, hk.tour) - hk.length) < 1e-9, 'the returned tour has the optimal length');
    const two = T.tourLength(pts, T.twoOptConverge(pts, T.nearestNeighbour(pts)));
    assert.ok(two >= hk.length - 1e-9);
  }
  const pts = T.makeCities(13, 77);
  assert.ok(T.isHamiltonian(T.heldKarp(pts).tour, 13), 'n = 13 (the page limit) solves');
});

test('15b truth 2 (used by the SFC tour): the Hilbert index visits every cell of order 3 once, grid-adjacent', () => {
  const N = 8, at = new Array(N * N);
  for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) at[T.hilbertIndex(x, y, 3)] = [x, y];
  for (let k = 0; k < N * N; k++) assert.ok(at[k], `index ${k} used`);
  for (let k = 1; k < N * N; k++) assert.equal(Math.abs(at[k][0] - at[k - 1][0]) + Math.abs(at[k][1] - at[k - 1][1]), 1);
});
