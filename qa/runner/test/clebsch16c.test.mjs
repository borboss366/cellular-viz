// 16c · 27 Neon Lines: the QA truths of VIZ research's spec (#37 comment 6444942841, 16c), in float64, on the
// page's own maths (experiments/16c-clebsch.mjs) and scheduler (experiments/16c-neon-lines.mjs). No browser:
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it). Numbers the spec only asks to report are logged.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../../../experiments/16c-clebsch.mjs';
import { autoU, schedStep, holdOf, levelOf, LEVELS } from '../../../experiments/16c-neon-lines.mjs';

const maxAbs = a => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

test('cubic algebra: composeCubic(F, L)(Y) = F(L·Y), cubeOfLinear, 20 monomials', () => {
  assert.equal(K.MON.length, 20);
  const r = K.rng(3), c = Array.from({ length: 20 }, () => r() * 2 - 1), L = [0, 1, 2, 3].map(() => [0, 1, 2, 3].map(() => r() * 2 - 1));
  const G = K.composeCubic(c, L);
  for (let k = 0; k < 20; k++) { const Y = [r(), r(), r(), r()].map(x => 2 * x - 1); assert.ok(Math.abs(K.evalCubic(G, Y) - K.evalCubic(c, K.matVec(L, Y))) < 1e-12); }
  assert.ok(maxAbs(K.composeCubic(c, K.ident(4)).map((x, i) => x - c[i])) < 1e-14);
  const a = [0.3, -1.2, 0.7, 2], Y = [0.4, 0.1, -0.9, 0.5];
  assert.ok(Math.abs(K.evalCubic(K.cubeOfLinear(a), Y) - K.dot(a, Y) ** 3) < 1e-13);
  for (let k = 0; k < 10; k++) { const x = r() * 2 - 1, y = r() * 2 - 1, z = r() * 2 - 1; assert.ok(Math.abs(K.evalCubic(K.wikiCubic(), [x, y, z, 1]) - K.wikiF(x, y, z)) < 1e-11); }
});

test('truth 1: all 27 table lines lie on F, max |F| < 1e-9 (t in [-3, 3])', () => {
  let m = 0;
  for (const [a, b, c, p, q, r] of K.TABLE) for (let t = -3; t <= 3.0001; t += 0.001) m = Math.max(m, Math.abs(K.wikiF(p + a * t, q + b * t, r + c * t)));
  console.log(`truth 1: 27 lines, max |F| = ${m.toExponential(2)}`);
  assert.equal(K.TABLE.length, 27);
  assert.ok(m < 1e-9, `max |F| ${m}`);
});

test('truth 2: every line meets exactly 10 others: 135 pairs = 126 affine + 9 at infinity', () => {
  const an = K.analyse(K.TABLE_LINES);
  console.log(`truth 2: pairs ${an.pairs} (affine ${an.finitePairs}, at infinity ${an.atInfinity})`);
  assert.equal(an.pairs, 135); assert.equal(an.finitePairs, 126); assert.equal(an.atInfinity, 9);
  assert.ok(an.meets.every(m => m === 10), an.meets.join(','));
});

test('truth 3: exactly 10 points where 3 lines meet: the 7 finite ones listed and 3 directions', () => {
  const an = K.analyse(K.TABLE_LINES), fin = an.eckardt.filter(e => !e.atInfinity);
  assert.equal(an.eckardt.length, 10); assert.equal(fin.length, 7);
  assert.ok(an.eckardt.every(e => e.lines.length === 3));
  const listed = [[0, 1 / 6, 1 / 6], [1 / 6, 0, 1 / 6], [1 / 6, 1 / 6, 0], [1 / 3, 1 / 3, 1 / 3], [-1 / 3, 0, 0], [0, -1 / 3, 0], [0, 0, -1 / 3]].map(p => [...p, 1]);
  for (const X of listed) assert.ok(fin.some(e => K.samePoint(e.X, X)), `finite Eckardt point ${X}`);
  for (const d of [[1, -1, 0, 0], [1, 0, -1, 0], [0, 1, -1, 0]]) assert.ok(an.eckardt.some(e => e.atInfinity && K.samePoint(e.X, d)), `direction ${d}`);
  for (const e of K.ECKARDT) assert.ok(an.eckardt.some(f => K.samePoint(f.X, e.X)), `M(e${e.ij[0]} − e${e.ij[1]}) is an Eckardt point`);
});

test('truth 4: the chart map M sends the P⁴ model onto F = 0, and F = 288·Σ(M⁻¹X)³', () => {
  assert.ok(maxAbs(K.matMul(K.M, K.MINV).flat().map((x, i) => x - (i % 5 === 0 ? 1 : 0))) < 1e-15, 'M·M⁻¹ = I');
  assert.ok(maxAbs(K.cubicOfModel(K.ident(5)).map((x, i) => x - K.wikiCubic()[i])) < 1e-12, 'F = 288 Σ (M⁻¹X)ᵢ³');
  const r = K.rng(7); let worst = 0, cnt = 0;
  for (let k = 0; k < 3000; k++) {
    const a = r() * 4 - 2, b = r() * 4 - 2, c = r() * 4 - 2, s = a + b + c, A = 3 * s, B = 3 * s * s, C = s ** 3 - a ** 3 - b ** 3 - c ** 3, disc = B * B - 4 * A * C;
    if (disc < 0 || A * A < 1e-6) continue;
    for (const sg of [-1, 1]) {
      const x5 = (-B + sg * Math.sqrt(disc)) / (2 * A), x4 = -(s + x5), w = 3 * x4 + 6 * x5; if (w * w < 1e-4) continue;
      const X = (a + x5) / w, Y = (b + x5) / w, Z = (c + x5) / w, sc = 1 + X * X + Y * Y + Z * Z;
      worst = Math.max(worst, Math.abs(K.wikiF(X, Y, Z)) / sc ** 1.5); cnt++;
    }
  }
  console.log(`truth 4: ${cnt} random Clebsch points mapped, max normalised |F| = ${worst.toExponential(2)}`);
  assert.ok(cnt > 3000 && worst < 1e-11);
  const at = (i, j) => K.ECKARDT.find(e => e.ij[0] === i && e.ij[1] === j).X;
  assert.ok(K.samePoint(at(1, 4), [-1 / 3, 0, 0, 1]) && K.samePoint(at(1, 5), [0, 1 / 6, 1 / 6, 1]) && K.samePoint(at(4, 5), [1 / 3, 1 / 3, 1 / 3, 1]));
  for (const [i, j] of [[1, 2], [1, 3], [2, 3]]) assert.equal(at(i, j)[3], 0, `e${i} − e${j} is at infinity`);
});

test('truth 5: S5 permutes the 27 lines and the 10 diamonds; orbits {15, 12} and {10}; A5 glides keep the lines on F_s', () => {
  const perms = K.allPerms(); assert.equal(perms.length, 120); assert.equal(K.A5.length, 60);
  const parent = [...Array(27).keys()], find = x => (parent[x] === x ? x : (parent[x] = find(parent[x]))), pts = new Set([0]);
  for (const sig of perms) {
    const lp = K.linePerm(sig);
    assert.ok(lp.ok, `σ = ${sig} is a symmetry`);
    lp.lines.forEach((j, i) => { parent[find(i)] = find(j); });
    lp.points.forEach((j, i) => { if (pts.has(i)) pts.add(j); });
  }
  const sizes = {}; for (let i = 0; i < 27; i++) sizes[find(i)] = (sizes[find(i)] || 0) + 1;
  assert.deepEqual(Object.values(sizes).sort((a, b) => b - a), [15, 12]);
  for (let i = 0; i < 27; i++) assert.equal(find(i) === find(0), i < 15, `line ${i + 1} is in the ${i < 15 ? 15 : 12}-line orbit`);
  assert.equal(pts.size, 10);
  let worst = 0, formula = 0, orth = 0;
  for (const sig of K.A5) {
    const P = K.permMatrix(sig), R1 = K.glideMatrix(sig, 1);
    assert.ok(maxAbs(R1.flat().map((x, i) => x - P.flat()[i])) < 1e-12, `R(1) = Pσ for ${sig}`);
    for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const R = K.glideMatrix(sig, s), RtR = K.matMul(K.transpose(R), R);
      orth = Math.max(orth, maxAbs(RtR.flat().map((x, i) => x - (i % 6 === 0 ? 1 : 0))), maxAbs(K.matVec(R, [1, 1, 1, 1, 1]).map(x => x - 1)));
      const H = K.chartOfModel(R), Fs = K.normCubic(K.cubicOfModel(R)), Fc = K.normCubic(K.composeCubic(K.wikiCubic(), K.inverse(H)));
      formula = Math.max(formula, maxAbs(Fs.map((x, i) => x - Fc[i])));
      for (const L of K.TABLE_LINES) {
        const a = K.matVec(H, L.P), b = K.matVec(H, L.Q);
        for (let l = -3; l <= 3; l += 0.25) worst = Math.max(worst, Math.abs(K.evalCubic(Fs, K.unit(K.addv(a, K.scalev(b, l))))));
      }
    }
  }
  console.log(`truth 5: A5 glides, max |F_s| on the moved lines = ${worst.toExponential(2)}, Σy³ vs F∘H⁻¹ ${formula.toExponential(2)}, R(s) orthogonal to ${orth.toExponential(2)}`);
  assert.ok(worst < 1e-9 && formula < 1e-9 && orth < 1e-12);
  assert.ok(K.TRANSPOSITIONS.every(t => !K.glideMatrix(t, 0.5)), 'odd permutations do not glide');
  assert.equal(K.THREE_CYCLES.length, 20); assert.equal(K.FIVE_CYCLES.length, 24); assert.equal(K.DOUBLE_SWAPS.length, 15);
});

test('truth 6: build-up through Klein\'s six points: 3 / 7 / 15 / 27 real lines, 3 / 9 / 45 / 135 meetings', () => {
  const ch = K.kleinChart();
  assert.equal(new Set(ch.labelToTable).size, 27);
  const dbl = ch.labels.map((l, k) => [l, ch.labelToTable[k]]);
  console.log(`truth 6: Klein labels → table rows: ${dbl.map(([l, j]) => `${l}→${j + 1}`).join(' ')}`);
  const eAndC = dbl.filter(([l]) => l[0] !== 'L').map(([, j]) => j);
  console.log(`truth 6: E/C (a double six) land on table rows ${eAndC.every(j => j >= 15) ? '16–27 (the √5 orbit)' : 'mixed: ' + eAndC.map(j => j + 1).join(',')}`);
  const full = K.normCubic(K.surfaceCubic([1, 1, 1], ch.A)), wiki = K.normCubic(K.wikiCubic());
  const sgn = Math.sign(K.dot(full, wiki));
  assert.ok(maxAbs(full.map((x, i) => sgn * x - wiki[i])) < 1e-9, 'Klein\'s configuration in the chart A is the Clebsch F');
  const rows = [];
  for (const u of [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [1, 1, 1], [-0.4, -0.7, -0.2], [0.3, -0.6, -0.9], [0.6, 0.35, -0.3], [0.8, 0.5, 0.35]]) {
    const b = K.buildUp(u), an = K.analyse(b.lines);
    let mf = 0; for (const L of b.lines) for (let l = -2; l <= 2; l += 0.25) mf = Math.max(mf, Math.abs(K.evalCubic(b.cubic, K.unit(K.addv(L.P, K.scalev(L.Q, l))))));
    rows.push({ u: u.join(','), lines: b.lines.length, expected: b.expected, pairs: an.pairs, eckardt: an.eckardt.length, maxF: mf.toExponential(1) });
    assert.equal(b.lines.length, b.expected);
    assert.equal(an.pairs, { 3: 3, 7: 9, 15: 45, 27: 135 }[b.lines.length], `meetings at u = ${u}`);
    assert.ok(mf < 1e-9, `lines on the surface at u = ${u}: ${mf}`);
    for (let i = 0; i < b.lines.length; i++) for (let j = i + 1; j < b.lines.length; j++) assert.ok(!K.sameLine(b.lines[i], b.lines[j], 1e-6), `distinct lines at u = ${u}`);
  }
  console.table(rows);
  assert.deepEqual(rows.slice(0, 4).map(r => r.lines), [3, 7, 15, 27]);
  assert.equal(rows[3].eckardt, 10);
});

test('truth 6b: general position of the six points along the schedule\'s paths (complex arithmetic; reported)', () => {
  const report = [];
  for (const k of [0, 1, 2]) {
    let prev = null, prev2 = null, minAway = Infinity;
    for (let i = 0; i <= 4000; i++) {
      const x = -1 + i / 2000, u = [0, 1, 2].map(j => (j < k ? 1 : j === k ? x : -1)), g = K.generalPosition(u), v = Math.min(g.minTriple, g.conic);
      if (Math.abs(x) >= 0.05) minAway = Math.min(minAway, v);
      if (prev && prev2 && prev.v < prev2.v && prev.v <= v && prev.v < 1e-2) report.push({ pair: k + 1, u: prev.x.toFixed(4), minDet: prev.v.toExponential(1), what: prev.g.minTriple < prev.g.conic ? `points ${prev.g.worstTriple} collinear` : 'on a conic' });
      prev2 = prev; prev = { x, v, g };
    }
    report.push({ pair: k + 1, u: '|u| ≥ 0.05', minDet: minAway.toExponential(1), what: 'smallest |det| away from the wall' });
  }
  console.table(report);
  for (const r of report.filter(r => r.u === '|u| ≥ 0.05')) assert.ok(+r.minDet > 1e-3, `general position away from the walls (pair ${r.pair}): ${r.minDet}`);
});

test('scheduler: walls at bars 8, 16, 24 (the drop), back down over bar 31; shape holds as 16b', () => {
  const bpb = 4, sign = u => u.map(x => (x > 0 ? '+' : '-')).join('');
  assert.equal(sign(autoU(7 * bpb, bpb)), '---'); assert.equal(sign(autoU(9 * bpb, bpb)), '+--');
  assert.equal(sign(autoU(17 * bpb, bpb)), '++-'); assert.equal(sign(autoU(25 * bpb, bpb)), '+++');
  assert.equal(sign(autoU(30.5 * bpb, bpb)), '+++'); assert.equal(sign(autoU(31.9 * bpb, bpb)), '---'); assert.equal(sign(autoU(33 * bpb, bpb)), '---');
  for (const [k, bar] of [[0, 8], [1, 16], [2, 24]]) { assert.equal(autoU(bar * bpb, bpb)[k], 0); assert.equal(autoU(bar * bpb + 1, bpb)[k], 1); assert.equal(autoU(bar * bpb - 1, bpb)[k], -1); }
  assert.deepEqual(autoU(30 * bpb, bpb), [1, 1, 1]);
  assert.deepEqual([0, 0.25, 0.5, 0.75, 1].map(holdOf), [8, 4, 2, 1, 0.5]);
  assert.deepEqual([0, 0.33, 0.67, 1].map(v => LEVELS[levelOf(v)]), [3, 7, 15, 27]);
  // holds on the clock: ½ bar → a change every 2 beats on the beat grid, 1 bar → every downbeat
  for (const hold of [0.5, 1, 2]) {
    const s = { next: null, last: null, hold: null, pending: false, cause: 'auto' }, ev = [];
    for (let f = 0; f <= 60 * 20; f++) { const e = schedStep(s, f / 60 * 2, hold * bpb, bpb); if (e) ev.push(e); }
    const gaps = ev.slice(1).map((e, i) => e.beat - ev[i].beat);
    assert.ok(gaps.length > 3 && gaps.every(g => Math.abs(g - hold * bpb) < 1e-9), `hold ${hold}: ${gaps}`);
    assert.ok(ev.every(e => Math.abs(e.morphBeats - Math.min(bpb, hold * bpb / 2)) < 1e-9));
  }
});
