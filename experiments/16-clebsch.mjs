// 16c · 27 Neon Lines: the maths, in float64, shared by the scene (16-neon-lines.mjs) and node
// (qa/runner/test/clebsch16c.test.mjs). Spec: VIZ research, #37 comment 6444942841, section 16c.
//
// The Clebsch diagonal cubic in the ℝ³ chart (Wikipedia):
//   F = 81(x³+y³+z³) − 189(x²(y+z)+y²(z+x)+z²(x+y)) + 54xyz + 126(xy+yz+zx) − 9(x²+y²+z²) − 9(x+y+z) + 1
// A cubic is kept homogeneous in (x, y, z, w): 20 coefficients on MON. The chart is w = 1.
// The P⁴ model Σxᵢ = 0, Σxᵢ³ = 0 maps to the chart by M: x = x1+x5, y = x2+x5, z = x3+x5, w = 3x4+6x5,
// and F = 288·Σ(M⁻¹X)ᵢ³ exactly. S5 permutes the model's coordinates; an even permutation glides along
// R(s) = exp(s·log Pσ), so the surface at s is the projective image M·R(s)·M⁻¹ of the Clebsch surface.
// Build-up: P² blown up at Klein's 6 icosahedral points in pairs c_k ± t·d_k (t² = u_k). The cubics
// through the 6 points have the basis below, polynomial in (u1, u2, u3), so u_k can cross 0.

export const PHI = (1 + Math.sqrt(5)) / 2, SQ5 = Math.sqrt(5);

// ---------------------------------------------------------------- small linear algebra
export const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
export const norm = a => Math.sqrt(dot(a, a));
export const unit = a => { const n = norm(a); return n > 0 ? a.map(x => x / n) : a.slice(); };
export const addv = (a, b) => a.map((x, i) => x + b[i]);
export const subv = (a, b) => a.map((x, i) => x - b[i]);
export const scalev = (a, k) => a.map(x => x * k);
export const matVec = (A, v) => A.map(r => dot(r, v));
export const matMul = (A, B) => A.map(r => B[0].map((_, j) => { let s = 0; for (let k = 0; k < r.length; k++) s += r[k] * B[k][j]; return s; }));
export const transpose = A => A[0].map((_, j) => A.map(r => r[j]));
export const ident = n => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function solve(A, b) {   // Gaussian elimination, partial pivoting; null when singular
  const n = A.length, M = A.map((r, i) => [...r, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; }
    const d = M[k][k]; if (d === 0) return null;
    for (let i = k + 1; i < n; i++) { const f = M[i][k] / d; if (f) for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j]; }
  }
  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}
export function inverse(A) {
  const cols = ident(A.length).map(e => solve(A, e));
  return cols.some(c => !c) ? null : transpose(cols);
}
export function det(A) {
  const n = A.length, M = A.map(r => r.slice()); let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (M[p][k] === 0) return 0;
    if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; d = -d; }
    d *= M[k][k];
    for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j < n; j++) M[i][j] -= f * M[k][j]; }
  }
  return d;
}
// the unit null vector of an m×n matrix of rank n−1 (m ≥ n−1): column-pivoted Householder QR, then back substitution
export function nullVector(rows) {
  const m = rows.length, n = rows[0].length, A = rows.map(r => Float64Array.from(r)), perm = [...Array(n).keys()];
  const kmax = Math.min(m, n - 1);
  for (let k = 0; k < kmax; k++) {
    let best = k, bn = -1;
    for (let j = k; j < n; j++) { let s = 0; for (let i = k; i < m; i++) s += A[i][j] * A[i][j]; if (s > bn) { bn = s; best = j; } }
    if (best !== k) { for (let i = 0; i < m; i++) { const t = A[i][k]; A[i][k] = A[i][best]; A[i][best] = t; } const t = perm[k]; perm[k] = perm[best]; perm[best] = t; }
    let alpha = Math.sqrt(bn); if (alpha === 0) break;
    if (A[k][k] > 0) alpha = -alpha;
    const v = new Float64Array(m); for (let i = k; i < m; i++) v[i] = A[i][k]; v[k] -= alpha;
    let vn = 0; for (let i = k; i < m; i++) vn += v[i] * v[i];
    if (vn === 0) continue;
    for (let j = k; j < n; j++) { let s = 0; for (let i = k; i < m; i++) s += v[i] * A[i][j]; s = 2 * s / vn; for (let i = k; i < m; i++) A[i][j] -= s * v[i]; }
  }
  const y = new Float64Array(n); y[n - 1] = 1;
  for (let i = n - 2; i >= 0; i--) { let s = 0; for (let j = i + 1; j < n; j++) s += A[i][j] * y[j]; y[i] = A[i][i] !== 0 ? -s / A[i][i] : 0; }
  const x = new Array(n); for (let i = 0; i < n; i++) x[perm[i]] = y[i];
  return unit(x);
}
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- homogeneous cubics in (x, y, z, w)
export const MON = [];
for (let a = 3; a >= 0; a--) for (let b = 3 - a; b >= 0; b--) for (let c = 3 - a - b; c >= 0; c--) MON.push([a, b, c, 3 - a - b - c]);
const FACT = [1, 1, 2, 6];
export const multinom = e => 6 / (FACT[e[0]] * FACT[e[1]] * FACT[e[2]] * FACT[e[3]]);
const MON_INDEX = new Map(MON.map((e, i) => [e.join(''), i]));
export const monIndex = e => MON_INDEX.get(e.join(''));
export const monomials = X => MON.map(e => X[0] ** e[0] * X[1] ** e[1] * X[2] ** e[2] * X[3] ** e[3]);
export const evalCubic = (c, X) => dot(c, monomials(X));
export const cubeOfLinear = a => MON.map(e => multinom(e) * a[0] ** e[0] * a[1] ** e[1] * a[2] ** e[2] * a[3] ** e[3]);
export const normCubic = c => { let m = 0; for (const x of c) m = Math.max(m, Math.abs(x)); return m > 0 ? c.map(x => x / m) : c.slice(); };
function tensor(c) {
  const T = new Float64Array(64);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
    const e = [0, 0, 0, 0]; e[i]++; e[j]++; e[k]++; T[i * 16 + j * 4 + k] = c[monIndex(e)] / multinom(e);
  }
  return T;
}
function fromTensor(T) {
  return MON.map(e => { const ix = []; e.forEach((n, v) => { for (let q = 0; q < n; q++) ix.push(v); }); return multinom(e) * T[ix[0] * 16 + ix[1] * 4 + ix[2]]; });
}
// G(Y) = F(L·Y) for a 4×4 L, exactly (contract the symmetric tensor of F with L three times)
export function composeCubic(c, L) {
  const T = tensor(c), U = new Float64Array(64), V = new Float64Array(64), W = new Float64Array(64);
  for (let d = 0; d < 4; d++) for (let b = 0; b < 4; b++) for (let q = 0; q < 4; q++) { let s = 0; for (let a = 0; a < 4; a++) s += L[a][d] * T[a * 16 + b * 4 + q]; U[d * 16 + b * 4 + q] = s; }
  for (let d = 0; d < 4; d++) for (let e = 0; e < 4; e++) for (let q = 0; q < 4; q++) { let s = 0; for (let b = 0; b < 4; b++) s += L[b][e] * U[d * 16 + b * 4 + q]; V[d * 16 + e * 4 + q] = s; }
  for (let d = 0; d < 4; d++) for (let e = 0; e < 4; e++) for (let f = 0; f < 4; f++) { let s = 0; for (let q = 0; q < 4; q++) s += L[q][f] * V[d * 16 + e * 4 + q]; W[d * 16 + e * 4 + f] = s; }
  return fromTensor(W);
}

// ---------------------------------------------------------------- the Clebsch surface, its 27 lines and 10 Eckardt points
export const wikiF = (x, y, z) => 81 * (x ** 3 + y ** 3 + z ** 3) - 189 * (x * x * (y + z) + y * y * (z + x) + z * z * (x + y))
  + 54 * x * y * z + 126 * (x * y + y * z + z * x) - 9 * (x * x + y * y + z * z) - 9 * (x + y + z) + 1;
export function wikiCubic() {   // the same F, homogenised (w = 1), as 20 coefficients
  const c = new Array(20).fill(0), set = (e, v) => { c[monIndex(e)] = v; };
  set([3, 0, 0, 0], 81); set([0, 3, 0, 0], 81); set([0, 0, 3, 0], 81);
  for (const e of [[2, 1, 0, 0], [2, 0, 1, 0], [1, 2, 0, 0], [0, 2, 1, 0], [1, 0, 2, 0], [0, 1, 2, 0]]) set(e, -189);
  set([1, 1, 1, 0], 54);
  set([1, 1, 0, 1], 126); set([0, 1, 1, 1], 126); set([1, 0, 1, 1], 126);
  set([2, 0, 0, 1], -9); set([0, 2, 0, 1], -9); set([0, 0, 2, 1], -9);
  set([1, 0, 0, 2], -9); set([0, 1, 0, 2], -9); set([0, 0, 1, 2], -9);
  set([0, 0, 0, 3], 1);
  return c;
}
// the 27 lines (a,b,c)t + (p,q,r), Wikipedia's table, in its order: 1–15 the 15-line S5 orbit, 16–27 the 12-line √5 orbit
const s5 = SQ5;
export const TABLE = [
  [1, -1, 0, 0, 0, -1 / 3], [1, 0, -1, 0, -1 / 3, 0], [0, 1, -1, -1 / 3, 0, 0],
  [1, -1, 0, 1 / 6, 1 / 6, 0], [1, -1, 0, 1 / 3, 1 / 3, 1 / 3], [1, 0, -1, 1 / 6, 0, 1 / 6],
  [1, 0, -1, 1 / 3, 1 / 3, 1 / 3], [0, 1, -1, 0, 1 / 6, 1 / 6], [0, 1, -1, 1 / 3, 1 / 3, 1 / 3],
  [3, 0, 1, 1 / 6, 0, 1 / 6], [3, 1, 0, 1 / 6, 1 / 6, 0], [0, 3, 1, 0, 1 / 6, 1 / 6],
  [1, 3, 0, 1 / 6, 1 / 6, 0], [0, 1, 3, 0, 1 / 6, 1 / 6], [1, 0, 3, 1 / 6, 0, 1 / 6],
  [1 + 3 / s5, -1 / s5, 1, (5 + s5) / 30, (5 + 3 * s5) / 30, 0],
  [-1 / s5, 1 + 3 / s5, 1, (5 + 3 * s5) / 30, (5 + s5) / 30, 0],
  [-3 - s5, -s5, 1, (7 + 3 * s5) / 6, (3 + s5) / 6, 0],
  [(-3 + s5) / 4, (-5 + 3 * s5) / 4, 1, (3 + s5) / 12, (1 - s5) / 12, 0],
  [(-5 - 3 * s5) / 4, (-3 - s5) / 4, 1, (1 + s5) / 12, (3 - s5) / 12, 0],
  [s5, -3 + s5, 1, (3 - s5) / 6, (7 - 3 * s5) / 6, 0],
  [-s5, -3 - s5, 1, (3 + s5) / 6, (7 + 3 * s5) / 6, 0],
  [(-5 + 3 * s5) / 4, (-3 + s5) / 4, 1, (1 - s5) / 12, (3 + s5) / 12, 0],
  [(-3 - s5) / 4, (-5 - 3 * s5) / 4, 1, (3 - s5) / 12, (1 + s5) / 12, 0],
  [-3 + s5, s5, 1, (7 - 3 * s5) / 6, (3 - s5) / 6, 0],
  [1 / s5, 1 - 3 / s5, 1, (5 - 3 * s5) / 30, (5 - s5) / 30, 0],
  [1 - 3 / s5, 1 / s5, 1, (5 - s5) / 30, (5 - 3 * s5) / 30, 0],
];
// a line is two homogeneous points of P³: P = (p,q,r,1), Q = (a,b,c,0)
export const TABLE_LINES = TABLE.map(([a, b, c, p, q, r], i) => ({ label: 'T' + (i + 1), table: i, P: [p, q, r, 1], Q: [a, b, c, 0] }));
export const orbitOf = j => (j < 15 ? 15 : 12);

// the chart map of the P⁴ model and its inverse (onto Σxᵢ = 0)
export const M = [[1, 0, 0, 0, 1], [0, 1, 0, 0, 1], [0, 0, 1, 0, 1], [0, 0, 0, 3, 6]];
export const MINV = [[3 / 4, -1 / 4, -1 / 4, -1 / 12], [-1 / 4, 3 / 4, -1 / 4, -1 / 12], [-1 / 4, -1 / 4, 3 / 4, -1 / 12],
  [-1 / 2, -1 / 2, -1 / 2, 1 / 6], [1 / 4, 1 / 4, 1 / 4, 1 / 12]];
export const modelToChart = x => matVec(M, x);
export const chartToModel = X => matVec(MINV, X);
// the surface M·Q(Clebsch) for a 5×5 orthogonal Q that fixes (1,1,1,1,1): F_Q(X) = 288·Σᵢ((Qᵀ·M⁻¹·X)ᵢ)³
export function cubicOfModel(Q) {
  const rows = matMul(transpose(Q), MINV), c = new Array(20).fill(0);
  for (const r of rows) { const k = cubeOfLinear(r); for (let i = 0; i < 20; i++) c[i] += 288 * k[i]; }
  return c;
}
// the 10 Eckardt points: M(eᵢ − eⱼ), i < j (7 finite, 3 at infinity)
export const ECKARDT = [];
for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { const e = [0, 0, 0, 0, 0]; e[i] = 1; e[j] = -1; ECKARDT.push({ ij: [i + 1, j + 1], X: modelToChart(e) }); }

// ---------------------------------------------------------------- lines and points in P³
export function lineBasis(L) { const e1 = unit(L.P), q = subv(L.Q, scalev(e1, dot(L.Q, e1))); return [e1, unit(q)]; }
export function distToLine(X, B) { const x = unit(X), r = subv(subv(x, scalev(B[0], dot(x, B[0]))), scalev(B[1], dot(x, B[1]))); return norm(r); }
export function canon(X) { const x = unit(X); let k = 0; for (let i = 1; i < x.length; i++) if (Math.abs(x[i]) > Math.abs(x[k])) k = i; return x[k] < 0 ? x.map(v => -v) : x; }
// projective equality: X ~ ±Y after normalising. Not via canon(): when two coordinates tie in size with opposite
// signs, rounding picks a different one for each copy, and the same point came out as both X and −X (the Klein
// image then counted 12 Eckardt points instead of 10).
export const samePoint = (X, Y, tol = 1e-6) => { const x = unit(X), y = unit(Y); return Math.min(norm(subv(x, y)), norm(addv(x, y))) < tol; };
export const transformLine = (H, L) => ({ ...L, P: matVec(H, L.P), Q: matVec(H, L.Q) });
export function onLine(L, X, tol = 1e-7) { return distToLine(X, lineBasis(L)) < tol; }
export function sameLine(L1, L2, tol = 1e-7) { const B = lineBasis(L2); return distToLine(L1.P, B) < tol && distToLine(L1.Q, B) < tol; }
// meeting pairs, meetings at infinity, how many others each line meets, and the points where 3 lines meet
export function analyse(lines, tol = 1e-7) {
  const B = lines.map(lineBasis), n = lines.length, meets = new Array(n).fill(0), pts = [];
  let pairs = 0, atInfinity = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const [e1, e2] = B[i], [f1, f2] = B[j];
    if (Math.abs(det([e1, e2, f1, f2])) >= tol) continue;
    pairs++; meets[i]++; meets[j]++;
    const ab = nullVector([0, 1, 2, 3].map(r => [e1[r], e2[r], -f1[r], -f2[r]]));
    const X = addv(scalev(e1, ab[0]), scalev(e2, ab[1]));
    if (Math.abs(unit(X)[3]) < 1e-9) atInfinity++;
    pts.push(X);
  }
  const eckardt = [];
  for (const X of pts) {
    if (eckardt.some(e => samePoint(e.X, X))) continue;
    const on = []; B.forEach((b, k) => { if (distToLine(X, b) < 1e-6) on.push(k); });
    if (on.length >= 3) eckardt.push({ X: canon(X), lines: on, atInfinity: Math.abs(canon(X)[3]) < 1e-9 });
  }
  return { lines: n, pairs, atInfinity, finitePairs: pairs - atInfinity, meets, eckardt };
}

// ---------------------------------------------------------------- S5 and the A5 glides
export function allPerms(n = 5) {
  const out = [], a = [...Array(n).keys()];
  const rec = k => { if (k === n) { out.push(a.slice()); return; } for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  rec(0); return out;
}
export function cycles(sig) {   // sig[i] = σ(i): Pσ eᵢ = e_σ(i)
  const seen = new Array(sig.length).fill(false), out = [];
  for (let i = 0; i < sig.length; i++) { if (seen[i]) continue; const c = []; for (let j = i; !seen[j]; j = sig[j]) { seen[j] = true; c.push(j); } out.push(c); }
  return out;
}
export const isEven = sig => cycles(sig).reduce((s, c) => s + c.length - 1, 0) % 2 === 0;
export const cycleType = sig => cycles(sig).map(c => c.length).filter(l => l > 1).sort((a, b) => b - a).join(',') || '1';
export function permMatrix(sig) { const P = ident(sig.length).map(r => r.fill(0)); sig.forEach((t, i) => { P[t][i] = 1; }); return P; }
export const composePerm = (a, b) => b.map(x => a[x]);   // (a∘b)(i) = a(b(i)): Pa·Pb
export const invertPerm = a => { const r = new Array(a.length); a.forEach((t, i) => { r[t] = i; }); return r; };
// R(s) = exp(s·log Pσ) for even σ: each odd cycle turns by its principal angles, a pair of 2-cycles turns by πs in
// the plane of their two differences. R(0) = I, R(1) = Pσ, R(s) orthogonal and fixes (1,1,1,1,1) for every s.
export function glideMatrix(sig, s) {
  if (!isEven(sig)) return null;
  const R = ident(5), cs = cycles(sig);
  for (const c of cs) {
    const L = c.length; if (L === 1 || L === 2) continue;
    const h = (L - 1) / 2;
    for (let j = 0; j < L; j++) for (let m = 0; m < L; m++) {
      let v = 0; for (let k = -h; k <= h; k++) v += Math.cos(2 * Math.PI * k * (s + m - j) / L);
      R[c[j]][c[m]] = v / L;
    }
  }
  const twos = cs.filter(c => c.length === 2);
  if (twos.length === 2) {
    const u1 = [0, 0, 0, 0, 0], u2 = [0, 0, 0, 0, 0];
    u1[twos[0][0]] = Math.SQRT1_2; u1[twos[0][1]] = -Math.SQRT1_2; u2[twos[1][0]] = Math.SQRT1_2; u2[twos[1][1]] = -Math.SQRT1_2;
    const co = Math.cos(Math.PI * s), si = Math.sin(Math.PI * s);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
      R[i][j] += (co - 1) * (u1[i] * u1[j] + u2[i] * u2[j]) + si * (u2[i] * u1[j] - u1[i] * u2[j]);
  }
  return R;
}
export const chartOfModel = Q => matMul(matMul(M, Q), MINV);   // H = M·Q·M⁻¹, a projective map of P³
// where σ sends each table line and each Eckardt point (as indices), null if it is not a symmetry
const TABLE_BASES = TABLE_LINES.map(lineBasis);
export function tableIndexOf(L, tol = 1e-7) {
  for (let j = 0; j < 27; j++) if (distToLine(L.P, TABLE_BASES[j]) < tol && distToLine(L.Q, TABLE_BASES[j]) < tol) return j;
  return -1;
}
const permCache = new Map();
export function linePerm(sig) {
  const key = sig.join('');
  if (permCache.has(key)) return permCache.get(key);
  const H = chartOfModel(permMatrix(sig)), lines = TABLE_LINES.map(L => tableIndexOf(transformLine(H, L)));
  const points = ECKARDT.map(e => ECKARDT.findIndex(f => samePoint(matVec(H, e.X), f.X)));
  const ok = lines.every(j => j >= 0) && new Set(lines).size === 27 && points.every(j => j >= 0) && new Set(points).size === 10;
  const r = { lines, points, ok };
  permCache.set(key, r);
  return r;
}
export const A5 = allPerms().filter(isEven);
export const THREE_CYCLES = A5.filter(p => cycleType(p) === '3');
export const FIVE_CYCLES = A5.filter(p => cycleType(p) === '5');
export const DOUBLE_SWAPS = A5.filter(p => cycleType(p) === '2,2');
export const TRANSPOSITIONS = allPerms().filter(p => cycleType(p) === '2');

// ---------------------------------------------------------------- build-up: Klein's six points, in pairs c_k ± t·d_k, t² = u_k
export const PAIRS = [{ c: [0, 1, 0], d: [0, 0, PHI] }, { c: [1, 0, 0], d: [0, PHI, 0] }, { c: [0, 0, 1], d: [PHI, 0, 0] }];
// A basis of the cubics through the 6 points, polynomial in a = φ²u1, b = φ²u2, c = φ²u3 (derived from: on X = 0
// the cubic is divisible by Z² − aY², on Z = 0 by Y² − bX², on Y = 0 by X² − cZ²). It never loses rank, also at u = 0.
export function cubicsThrough(u) {
  const a = PHI * PHI * u[0], b = PHI * PHI * u[1], c = PHI * PHI * u[2];
  const f = ([X, Y, Z]) => [X * Y * Z, Y * Z * Z - a * Y ** 3 + a * b * X * X * Y, X * Y * Y - b * X ** 3 + b * c * X * Z * Z, X * X * Z - c * Z ** 3 + a * c * Y * Y * Z];
  const grad = ([X, Y, Z]) => [
    [Y * Z, X * Z, X * Y],
    [2 * a * b * X * Y, Z * Z - 3 * a * Y * Y + a * b * X * X, 2 * Y * Z],
    [Y * Y - 3 * b * X * X + b * c * Z * Z, 2 * X * Y, 2 * b * c * X * Z],
    [2 * X * Z, 2 * a * c * Y * Z, X * X - 3 * c * Z * Z + a * c * Y * Y],
  ];
  return { f, grad };
}
export function sixPoints(u) {   // the real ones, by index 2k (+) and 2k+1 (−); null where the pair is complex
  const pts = new Array(6).fill(null);
  PAIRS.forEach(({ c, d }, k) => { if (u[k] > 0) { const t = Math.sqrt(u[k]); pts[2 * k] = addv(c, scalev(d, t)); pts[2 * k + 1] = subv(c, scalev(d, t)); } });
  return pts;
}
const CONIC = P => { const [X, Y, Z] = P; return [X * X, Y * Y, Z * Z, X * Y, Y * Z, Z * X]; };
const qEval = (q, P) => dot(q, CONIC(P));
function conicThroughOthers(i, u, pts) {   // the conic through the five points other than pᵢ (pᵢ real), real rows
  const rows = [];
  PAIRS.forEach(({ c, d }, k) => {
    if (k === i >> 1) { rows.push(CONIC(pts[i ^ 1])); return; }
    const mc = CONIC(c), md = CONIC(d), mcd = CONIC(addv(c, d));
    rows.push(mc.map((x, j) => x + u[k] * md[j]));        // even part of q(c + t·d) with t² = u
    rows.push(mcd.map((x, j) => x - mc[j] - md[j]));       // odd part / t
  });
  return nullVector(rows);
}
const DIRS = [[0.31, -0.72, 0.62], [-0.58, 0.27, 0.77]];
function perpPair(p) {
  const ax = [0, 1, 2].reduce((m, k) => (Math.abs(p[k]) < Math.abs(p[m]) ? k : m), 0), e = [0, 0, 0]; e[ax] = 1;
  const v1 = unit(cross(p, e)); return [v1, unit(cross(p, v1))];
}
// The real lines for (u1, u2, u3) as P³ point pairs, after the chart map A (4×4): Eᵢ, Cᵢ for real pᵢ, L_ij for real
// pairs, and the line through each conjugate pair. Labels: E1–E6, C1–C6, L12–L56 (points 1,2 are pair 1, …).
export function realLines(u, A = ident(4)) {
  const { f, grad } = cubicsThrough(u), pts = sixPoints(u), out = [];
  const img = P => matVec(A, f(P));
  const dimg = (p, v) => matVec(A, grad(p).map(g => dot(g, v)));
  for (let i = 0; i < 6; i++) {
    const p = pts[i]; if (!p) continue;
    const [v1, v2] = perpPair(p);
    out.push({ label: 'E' + (i + 1), kind: 'E', pts: [i], P: dimg(p, v1), Q: dimg(p, v2) });
    const q = conicThroughOthers(i, u, pts), p0 = pts[i ^ 1];
    const second = v => { const twoB = qEval(q, addv(p0, v)) - qEval(q, p0) - qEval(q, v); return subv(scalev(p0, qEval(q, v)), scalev(v, twoB)); };
    out.push({ label: 'C' + (i + 1), kind: 'C', pts: [i], P: img(second(DIRS[0])), Q: img(second(DIRS[1])) });
  }
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    if (pts[i] && pts[j]) out.push({ label: `L${i + 1}${j + 1}`, kind: 'L', pts: [i, j], P: img(addv(pts[i], scalev(pts[j], 0.618))), Q: img(subv(pts[i], scalev(pts[j], 1.7))) });
    else if (j === (i ^ 1) && i % 2 === 0 && !pts[i]) {
      const { c, d } = PAIRS[i >> 1];
      out.push({ label: `L${i + 1}${j + 1}`, kind: 'L', pts: [i, j], P: img(addv(c, scalev(d, 0.5))), Q: img(subv(c, scalev(d, 1.3))) });
    }
  }
  return out;
}
export const expectedCount = u => { const r = 2 * u.filter(x => x > 0).length, c = 3 - r / 2; return r + r * (r - 1) / 2 + c + r; };
// the implicit cubic of the image surface: the null vector of the 20 monomials over 40 fixed sample points of P²
const SAMPLES = (() => { const r = rng(16); return Array.from({ length: 40 }, () => [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1]); })();
export function surfaceCubic(u, A = ident(4), prev = null) {
  const { f } = cubicsThrough(u);
  let c = nullVector(SAMPLES.map(P => monomials(unit(matVec(A, f(P))))));
  if (prev && dot(c, prev) < 0) c = c.map(x => -x);
  return c;
}
// a projective map of P³ from 5 points in general position to 5 points (null when degenerate)
export function projFrom5(src, dst) {
  const frame = p => { const S = transpose(p.slice(0, 4)), a = solve(S, p[4]); if (!a || a.some(x => !Number.isFinite(x) || Math.abs(x) < 1e-9)) return null; return S.map(r => r.map((x, j) => x * a[j])); };
  const S = frame(src.map(unit)), T = frame(dst.map(unit)); if (!S || !T) return null;
  const Si = inverse(S); return Si ? matMul(T, Si) : null;
}
// The chart A for the build-up: Klein's configuration (u = 1,1,1) is projectively the Clebsch surface; A sends its
// image onto the table's chart. Found by sending its 10 Eckardt points onto the table's (first match of 30240
// orderings of 5 targets whose other 5 points and all 27 lines land too), so every build-up ends on the true Clebsch.
// labelToTable[k]: the table line that build-up line k (in realLines' order at u = 1,1,1) becomes.
let chartCache = null;
export function kleinChart() {
  if (chartCache) return chartCache;
  const lines0 = realLines([1, 1, 1]), an = analyse(lines0), src = an.eckardt.map(e => e.X), dst = ECKARDT.map(e => e.X);
  if (src.length !== 10) throw new Error(`Klein image: ${src.length} Eckardt points, not 10`);
  let five = null;   // 5 source points, no 4 coplanar
  const idx = [...Array(10).keys()], combos = [];
  for (let a = 0; a < 10; a++) for (let b = a + 1; b < 10; b++) for (let c = b + 1; c < 10; c++) for (let d = c + 1; d < 10; d++) for (let e = d + 1; e < 10; e++) combos.push([a, b, c, d, e]);
  for (const cmb of combos) { const p = cmb.map(i => unit(src[i])); const quads = [[0, 1, 2, 3], [0, 1, 2, 4], [0, 1, 3, 4], [0, 2, 3, 4], [1, 2, 3, 4]]; if (quads.every(q => Math.abs(det(q.map(i => p[i]))) > 1e-4)) { five = cmb; break; } }
  if (!five) throw new Error('no 5 Eckardt points in general position');
  const s5pts = five.map(i => src[i]), rest = idx.filter(i => !five.includes(i));
  const pick = [], used = new Array(10).fill(false);
  let found = null;
  const tryA = () => {
    const A = projFrom5(s5pts, pick.map(i => dst[i])); if (!A) return false;
    for (const r of rest) { const Y = matVec(A, src[r]); if (!dst.some(D => samePoint(Y, D, 1e-6))) return false; }
    const labelToTable = lines0.map(L => tableIndexOf(transformLine(A, L), 1e-6));
    if (labelToTable.some(j => j < 0) || new Set(labelToTable).size !== 27) return false;
    found = { A, labelToTable, labels: lines0.map(L => L.label) }; return true;
  };
  const rec = k => { if (k === 5) return tryA(); for (let i = 0; i < 10; i++) { if (used[i]) continue; used[i] = true; pick.push(i); if (rec(k + 1)) return true; pick.pop(); used[i] = false; } return false; };
  if (!rec(0)) throw new Error('no projective map from the Klein image onto the Clebsch chart');
  chartCache = found;
  return found;
}
// the build-up surface for u: its cubic (unit coefficients), its real lines (with table index tags at u = 1,1,1)
export function buildUp(u, prevCubic = null) {
  const { A, labelToTable, labels } = kleinChart();
  const lines = realLines(u, A).map(L => ({ ...L, table: labelToTable[labels.indexOf(L.label)] }));
  return { cubic: surfaceCubic(u, A, prevCubic), lines, expected: expectedCount(u) };
}
// the second chart: p ↦ p/(1+x−y) brings all 10 Eckardt points into view (homogeneous: w' = w + x − y)
export const CHART_ALL_FINITE = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [1, -1, 0, 1]];

// ---------------------------------------------------------------- complex checks: general position of the 6 points
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], csub = (a, b) => [a[0] - b[0], a[1] - b[1]], cabs = a => Math.hypot(a[0], a[1]);
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
function cdet(A) {   // complex determinant, partial pivoting
  const n = A.length, M = A.map(r => r.map(z => z.slice())); let d = [1, 0];
  for (let k = 0; k < n; k++) {
    let p = k; for (let i = k + 1; i < n; i++) if (cabs(M[i][k]) > cabs(M[p][k])) p = i;
    if (cabs(M[p][k]) === 0) return [0, 0];
    if (p !== k) { const t = M[k]; M[k] = M[p]; M[p] = t; d = [-d[0], -d[1]]; }
    d = cmul(d, M[k][k]);
    for (let i = k + 1; i < n; i++) { const f = cdiv(M[i][k], M[k][k]); for (let j = k; j < n; j++) M[i][j] = csub(M[i][j], cmul(f, M[k][j])); }
  }
  return d;
}
export function complexPoints(u) {   // all six, complex: c ± √u·d
  const out = [];
  PAIRS.forEach(({ c, d }, k) => {
    const t = Math.sqrt(Math.abs(u[k])), re = u[k] >= 0;
    for (const sg of [1, -1]) out.push(c.map((x, j) => (re ? [x + sg * t * d[j], 0] : [x, sg * t * d[j]])));
  });
  return out.map(p => { const n = Math.sqrt(p.reduce((s, z) => s + z[0] * z[0] + z[1] * z[1], 0)); return p.map(z => [z[0] / n, z[1] / n]); });
}
// min |det| over the 20 triples (0 = three on a line) and |det| of the 6×6 conic matrix (0 = all six on a conic)
export function generalPosition(u) {
  const p = complexPoints(u); let minTriple = Infinity, worst = null;
  for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (let c = b + 1; c < 6; c++) { const v = cabs(cdet([p[a], p[b], p[c]])); if (v < minTriple) { minTriple = v; worst = [a + 1, b + 1, c + 1]; } }
  const conicRow = P => { const [X, Y, Z] = P; return [cmul(X, X), cmul(Y, Y), cmul(Z, Z), cmul(X, Y), cmul(Y, Z), cmul(Z, X)]; };
  const conic = cabs(cdet(p.map(conicRow)));
  return { minTriple, worstTriple: worst, conic };
}
