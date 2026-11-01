// 26 Lattice Gas: the FHP-I engine in plain JS. Spec: VIZ research, #71 (engine, truths 1 and 3); mock-ups in
// docs/proposals/fhp (#51). The page builds its shader tables from this file, and node runs it as the reference
// (qa/runner/test/fhp26.test.mjs): the GPU step must match stepCPU bit for bit.
//
// Lattice: hexagonal, 6 links per site, stored in axial coordinates (q, r) on an nq × nr torus (both wrap).
// Link i goes along DIRS[i]; on screen x = q + r/2, y = r·√3/2, so the links are 60° apart and i + 3 is the reverse.
// State: one byte per site, bit i = a particle on link i. A step is collide, then propagate:
//   collide: the 64-entry table LUT[chirality][state]: a head-on pair (i, i+3) alone at a site turns by +60° or −60°
//            (chirality = hash(site, step, seed) & 1), the symmetric triples {0,2,4} ↔ {1,3,5}, the rest unchanged
//   propagate (a gather): bit i at site x comes from bit i of the collided state at x − e_i
// Mass and momentum Σ n_i e_i are conserved exactly by every collision and by the propagation (truth 1).

export const S3 = Math.sqrt(3) / 2;
// axial (dq, dr) of the 6 links; screen angles 0°, −60°, −120°, 180°, 120°, 60°
export const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
export const SCREEN = DIRS.map(([dq, dr]) => [dq + dr / 2, dr * S3]);
export const POP = Uint8Array.from({ length: 64 }, (_, s) => { let n = 0; for (let i = 0; i < 6; i++) n += (s >> i) & 1; return n; });

// the collision table: LUT[c * 64 + s], c = 0 turns a head-on pair by +1 link (+60° in index), c = 1 by −1
function buildLut() {
  const t = new Uint8Array(128);
  for (let c = 0; c < 2; c++) for (let s = 0; s < 64; s++) {
    let o = s;
    for (let i = 0; i < 3; i++) {
      if (s === ((1 << i) | (1 << (i + 3)))) { const j = (i + (c === 0 ? 1 : 5)) % 6; o = (1 << j) | (1 << ((j + 3) % 6)); }
    }
    if (s === 0b010101) o = 0b101010; else if (s === 0b101010) o = 0b010101;
    t[c * 64 + s] = o;
  }
  return t;
}
export const LUT = buildLut();

// the shader's hash (lowbias32), the same bits on the GPU and here
export function hash32(x) {
  x >>>= 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0;
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}
// chirality of the collision at site (q, r) in step `step`: the GLSL is hash32((idx + step * 0x9E3779B9u) ^ seed) & 1u
export const chirality = (idx, step, seed) => hash32(((idx + Math.imul(step, 0x9e3779b9)) ^ seed) >>> 0) & 1;

const wrap = (a, n) => ((a % n) + n) % n;

// one step on the CPU: S (Uint8Array nq·nr, row r = q's) → out; the GPU's step pass with no source, sink or edits
export function stepCPU(S, nq, nr, step, seed, out = new Uint8Array(S.length)) {
  const C = new Uint8Array(S.length);
  for (let i = 0; i < S.length; i++) C[i] = LUT[chirality(i, step, seed) * 64 + S[i]];
  for (let r = 0; r < nr; r++) for (let q = 0; q < nq; q++) {
    let v = 0;
    for (let i = 0; i < 6; i++) {
      const sq = wrap(q - DIRS[i][0], nq), sr = wrap(r - DIRS[i][1], nr);
      v |= C[sr * nq + sq] & (1 << i);
    }
    out[r * nq + q] = v;
  }
  return out;
}

// mass and momentum Σ n_i e_i (axial components, exact integers)
export function massMomentum(S) {
  let m = 0, pq = 0, pr = 0;
  for (let k = 0; k < S.length; k++) {
    const s = S[k]; if (!s) continue;
    m += POP[s];
    for (let i = 0; i < 6; i++) if ((s >> i) & 1) { pq += DIRS[i][0]; pr += DIRS[i][1]; }
  }
  return { mass: m, pq, pr };
}

// the table keeps mass and momentum for all 64 states and both chiralities (truth 1, exhaustive)
export function checkLut(lut = LUT) {
  const bad = [];
  for (let c = 0; c < 2; c++) for (let s = 0; s < 64; s++) {
    const a = massMomentum([s]), b = massMomentum([lut[c * 64 + s]]);
    if (a.mass !== b.mass || a.pq !== b.pq || a.pr !== b.pr) bad.push({ c, s, out: lut[c * 64 + s] });
  }
  const changed = [];
  for (let s = 0; s < 64; s++) if (LUT[s] !== s || LUT[64 + s] !== s) changed.push(s);
  return { ok: bad.length === 0, bad, changed };
}

// a small seeded generator (mulberry32) for lattices
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// a random lattice, each link occupied with probability d
export function randomLattice(nq, nr, d, seed) {
  const R = rng(seed), S = new Uint8Array(nq * nr);
  for (let k = 0; k < S.length; k++) { let s = 0; for (let i = 0; i < 6; i++) if (R() < d) s |= 1 << i; S[k] = s; }
  return S;
}

// the screen offset between site (q, r) and a centre (cq, cr) on the torus (each axial component wrapped to the
// nearest image; fine while the radii used stay well under half the pulse spacing)
export function offset(q, r, cq, cr, nq, nr) {
  let dq = q - cq, dr = r - cr;
  dq -= nq * Math.round(dq / nq); dr -= nr * Math.round(dr / nr);
  return [dq + dr / 2, dr * S3];
}

// ---------- sound rings (truth 3) ----------
// A lattice of background density d per link, with weak pulses (d + amp inside screen radius `radius`) at the
// centres of a spacing × spacing grid of axial cells. The sound speed of FHP-I is 1/√2 links per step.
export function pulseCentres(nq, nr, spacing) {
  const c = [];
  for (let r = spacing / 2; r < nr; r += spacing) for (let q = spacing / 2; q < nq; q += spacing) c.push([q, r]);
  return c;
}
export function pulseLattice({ nq, nr, d = 0.25, amp = 0.1, radius = 5, spacing = 96, seed = 1 }) {
  const R = rng(seed), S = new Uint8Array(nq * nr), centres = pulseCentres(nq, nr, spacing);
  const sp = spacing;
  for (let r = 0; r < nr; r++) for (let q = 0; q < nq; q++) {
    // the nearest centre: centres sit at the middle of each spacing × spacing axial block
    const cq = Math.floor(q / sp) * sp + sp / 2, cr = Math.floor(r / sp) * sp + sp / 2;
    const [dx, dy] = offset(q, r, cq, cr, nq, nr);
    const p = Math.hypot(dx, dy) < radius ? Math.min(1, d + amp) : d;
    let s = 0; for (let i = 0; i < 6; i++) if (R() < p) s |= 1 << i;
    S[r * nq + q] = s;
  }
  return { S, centres };
}
// the radial profile of the density excess around the centres: E[b] = mean (particles − 6·mean) of the sites at
// screen distance in [b, b+1), averaged over all centres. Each centre reads only its own axial block.
// (rMax 40: the block reaches |y| < 41.6 in every direction, and a neighbour's ring at t = 40 stays beyond 60)
export function ringProfile(S, nq, nr, centres, spacing, rMax = 40) {
  let total = 0; for (let k = 0; k < S.length; k++) total += POP[S[k]];
  const mean = total / S.length, nb = Math.ceil(rMax);
  const sum = new Float64Array(nb), cnt = new Float64Array(nb), h = spacing / 2;
  for (const [cq, cr] of centres) {
    for (let dr = -h; dr < h; dr++) for (let dq = -h; dq < h; dq++) {
      const x = dq + dr / 2, y = dr * S3, d = Math.hypot(x, y);
      if (d >= rMax) continue;
      const q = wrap(cq + dq, nq), r = wrap(cr + dr, nr), b = Math.floor(d);
      sum[b] += POP[S[r * nq + q]] - mean; cnt[b]++;
    }
  }
  const E = new Float64Array(nb); for (let b = 0; b < nb; b++) E[b] = cnt[b] ? sum[b] / cnt[b] : 0;
  return { E, mean };
}
// where the outgoing ring is: the peak of the smoothed excess beyond rMin, refined by the centroid of the positive
// excess within ±3 bins of it (bin b holds radii [b, b+1), so its centre is b + 0.5)
export function ringRadius(E, rMin = 4) {
  const n = E.length, s = new Float64Array(n);
  for (let b = 0; b < n; b++) s[b] = (2 * E[b] + (E[b - 1] ?? E[b]) + (E[b + 1] ?? E[b])) / 4;
  let best = -1; for (let b = Math.ceil(rMin); b < n - 1; b++) if (best < 0 || s[b] > s[best]) best = b;
  let w = 0, m = 0;
  for (let b = Math.max(0, best - 3); b <= Math.min(n - 1, best + 3); b++) if (s[b] > 0) { w += s[b]; m += s[b] * (b + 0.5); }
  return { peak: best + 0.5, centroid: w > 0 ? m / w : best + 0.5, height: s[best] };
}
// the whole measurement on the CPU (node's truth 3): steps t1 and t2, speed = Δradius / Δt
export function soundSpeedCPU({ nq = 768, nr = 768, d = 0.25, amp = 0.1, radius = 5, spacing = 96, seed = 7, t1 = 20, t2 = 40 } = {}) {
  let { S, centres } = pulseLattice({ nq, nr, d, amp, radius, spacing, seed });
  let T = new Uint8Array(S.length), r1 = null, r2 = null;
  for (let t = 0; t < t2; t++) {
    stepCPU(S, nq, nr, t, seed, T); [S, T] = [T, S];
    if (t + 1 === t1) r1 = ringRadius(ringProfile(S, nq, nr, centres, spacing).E);
  }
  r2 = ringRadius(ringProfile(S, nq, nr, centres, spacing).E);
  return { rings: centres.length, r1, r2, speed: (r2.centroid - r1.centroid) / (t2 - t1), speedPeak: (r2.peak - r1.peak) / (t2 - t1), theory: Math.SQRT1_2 };
}
