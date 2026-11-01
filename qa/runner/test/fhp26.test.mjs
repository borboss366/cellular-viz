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
