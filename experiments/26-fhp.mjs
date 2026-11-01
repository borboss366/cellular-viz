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
// ---------- the fluid (F2, truth 4) ----------
// A lattice in the low-Mach FHP equilibrium p_i = d (1 + 2 e_i · u) of a divergence-free flow: u = (∂ψ/∂y, −∂ψ/∂x)
// of a stream function ψ = Σ a_k sin(2π (m q / nq + n r / nr) + φ_k), periodic on the torus, scaled to |u| ≤ umax.
// On screen ∂/∂x = ∂/∂q and ∂/∂y = (2 ∂/∂r − ∂/∂q) / √3.
export function flowModes(seed, { count = 8, kMax = 6 } = {}) {
  const R = rng(seed * 31 + 7), modes = [];
  while (modes.length < count) {
    const m = Math.round((R() * 2 - 1) * kMax), n = Math.round((R() * 2 - 1) * kMax);
    if (m === 0 && n === 0) continue;
    modes.push({ m, n, a: 0.5 + R(), ph: R() * 2 * Math.PI });
  }
  return modes;
}
export function flowAt(modes, q, r, nq, nr) {
  let dq = 0, dr = 0;
  for (const k of modes) {
    const c = k.a * Math.cos(2 * Math.PI * (k.m * q / nq + k.n * r / nr) + k.ph);
    dq += c * 2 * Math.PI * k.m / nq; dr += c * 2 * Math.PI * k.n / nr;
  }
  const dx = dq, dy = (2 * dr - dq) / Math.sqrt(3);   // ∂ψ/∂x, ∂ψ/∂y
  return [dy, -dx];
}
// the flow itself, sampled at every site (scaled so the peak |u| is umax): { ux, uy, modes, scale }
export function flowField(nq, nr, seed, { umax = 0.15, count = 8, kMax = 6 } = {}) {
  const modes = flowModes(seed, { count, kMax });
  let peak = 0;
  for (let r = 0; r < nr; r += 8) for (let q = 0; q < nq; q += 8) { const [ux, uy] = flowAt(modes, q, r, nq, nr); peak = Math.max(peak, Math.hypot(ux, uy)); }
  const k = peak > 0 ? umax / peak : 0, ux = new Float32Array(nq * nr), uy = new Float32Array(nq * nr);
  for (let r = 0; r < nr; r++) for (let q = 0; q < nq; q++) { const u = flowAt(modes, q, r, nq, nr); ux[r * nq + q] = u[0] * k; uy[r * nq + q] = u[1] * k; }
  return { ux, uy, modes, scale: k };
}
// a lattice drawn from the equilibrium of a sampled flow; particleSeed picks the particles (replicas of one flow).
// field.rho (optional): a density factor per site (the splash start's bumps)
export function latticeFromFlow(field, nq, nr, d, particleSeed) {
  const R = rng(particleSeed), S = new Uint8Array(nq * nr), { ux, uy, rho } = field;
  for (let k = 0; k < S.length; k++) {
    let s = 0;
    const dk = rho ? d * rho[k] : d;
    for (let i = 0; i < 6; i++) if (R() < Math.min(1, Math.max(0, dk * (1 + 2 * (SCREEN[i][0] * ux[k] + SCREEN[i][1] * uy[k]))))) s |= 1 << i;
    S[k] = s;
  }
  return S;
}
export function flowLattice(nq, nr, d, seed, opts = {}) {
  const field = flowField(nq, nr, seed, opts);
  return { S: latticeFromFlow(field, nq, nr, d, seed), modes: field.modes, scale: field.scale };
}
// F2's stirring (#165 "mix faster"): a Kolmogorov body force along link `axis` (0, 1, 2), its strength sin(…) varying
// only across that link, so it is divergence-free; k periods across q, periodic on the nq × nr torus when k nr / nq
// is whole (k 16 on 2048 × 1152 and 1024 × 576, 4 on truth 4's 512²). The page's STEP shader computes the same (uForce).
export function forceAt(axis, q, r, nq, nr, phase = 0, k = 16) {
  const arg = k / nq * (axis === 0 ? r : axis === 1 ? q + r : q);
  return Math.sin(2 * Math.PI * arg + phase);
}
// one site's forcing flip (CPU mirror of the shader): with probability amp · |s| a particle on the link against the
// force moves to the empty link along it (u01: the site's uniform draw)
export function forceFlip(s, axis, f, amp, u01) {
  if (!(u01 < amp * Math.abs(f))) return s;
  const along = 1 << (f > 0 ? axis : axis + 3), against = 1 << (f > 0 ? axis + 3 : axis);
  return (s & against) && !(s & along) ? (s & ~against) | along : s;
}
// RMS divergence and curl of a coarse velocity field on a w × h grid of blocks, each B sites a side in q and r
// (periodic). V: [vx, vy] per block, row-major (row = r). Central differences, then the screen chain rule above.
export function divCurl(V, w, h, B) {
  const at = (x, y) => V[((y + h) % h) * w + ((x + w) % w)];
  let d2 = 0, c2 = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const xp = at(x + 1, y), xm = at(x - 1, y), yp = at(x, y + 1), ym = at(x, y - 1);
    const dqx = (xp[0] - xm[0]) / (2 * B), dqy = (xp[1] - xm[1]) / (2 * B), drx = (yp[0] - ym[0]) / (2 * B), dry = (yp[1] - ym[1]) / (2 * B);
    const dxvx = dqx, dxvy = dqy, dyvx = (2 * drx - dqx) / Math.sqrt(3), dyvy = (2 * dry - dqy) / Math.sqrt(3);
    const div = dxvx + dyvy, curl = dxvy - dyvx;
    d2 += div * div; c2 += curl * curl; n++;
  }
  const divRMS = Math.sqrt(d2 / n), curlRMS = Math.sqrt(c2 / n);
  return { divRMS, curlRMS, ratio: curlRMS > 0 ? divRMS / curlRMS : Infinity };
}
// the same with the particle noise taken out: VA and VB are two independent measurements of one flow (two halves
// of the replicas), so their noise is uncorrelated and ⟨div_A · div_B⟩ estimates the flow's own div² (likewise curl).
// ratio = sqrt(max(0, ⟨dA dB⟩) / ⟨cA cB⟩); the plain one-field ratio of the mean is returned too.
export function divCurlCross(VA, VB, w, h, B) {
  const field = V => {
    const at = (x, y) => V[((y + h) % h) * w + ((x + w) % w)], out = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const xp = at(x + 1, y), xm = at(x - 1, y), yp = at(x, y + 1), ym = at(x, y - 1);
      const dqx = (xp[0] - xm[0]) / (2 * B), dqy = (xp[1] - xm[1]) / (2 * B), drx = (yp[0] - ym[0]) / (2 * B), dry = (yp[1] - ym[1]) / (2 * B);
      const dyvx = (2 * drx - dqx) / Math.sqrt(3), dyvy = (2 * dry - dqy) / Math.sqrt(3);
      out.push([dqx + dyvy, dqy - dyvx]);
    }
    return out;
  };
  const A = field(VA), Bf = field(VB);
  let dd = 0, cc = 0, d2 = 0, c2 = 0, ddSq = 0;
  for (let k = 0; k < A.length; k++) {
    const pd = A[k][0] * Bf[k][0];
    dd += pd; ddSq += pd * pd; cc += A[k][1] * Bf[k][1];
    const dm = (A[k][0] + Bf[k][0]) / 2, cm = (A[k][1] + Bf[k][1]) / 2; d2 += dm * dm; c2 += cm * cm;
  }
  // the signed cross terms (div² can come out below 0: noise only), the spread of the div² estimate over the blocks,
  // and an upper bound: the div that the estimate + 2σ allows (#165 viz-165-4: a clamped 0 can't be gated on)
  const n = A.length, ddMean = dd / n, ccMean = cc / n, ddSigma = Math.sqrt(Math.max(0, ddSq / n - ddMean * ddMean) / n);
  const divSignal = Math.sqrt(Math.max(0, ddMean)), curlSignal = Math.sqrt(Math.max(0, ccMean)), divUpper = Math.sqrt(Math.max(0, ddMean + 2 * ddSigma));
  return { divSignal, curlSignal, ratio: curlSignal > 0 ? divSignal / curlSignal : Infinity, ddMean, ddSigma, ccMean,
    divUpper, ratioUpper: curlSignal > 0 ? divUpper / curlSignal : Infinity,
    plainRatio: Math.sqrt(d2) / Math.max(1e-30, Math.sqrt(c2)), divRMS: Math.sqrt(d2 / n), curlRMS: Math.sqrt(c2 / n) };
}
// the whole measurement on the CPU (node's truth 3): steps t1 and t2, speed = Δradius / Δt
export function soundSpeedCPU({ nq = 768, nr = 768, d = 0.25, amp = 0.1, radius = 5, spacing = 96, seed = 7, t1 = 20, t2 = 40 } = {}) {
  let { S, centres } = pulseLattice({ nq, nr, d, amp, radius, spacing, seed });
  let T = new Uint8Array(S.length), r1 = null, r2 = null;
  for (let t = 0; t < t2; t++) {
    stepCPU(S, nq, nr, t, seed, T); [S, T] = [T, S];
    if (t + 1 === t1) { r1 = ringRadius(ringProfile(S, nq, nr, centres, spacing).E); }
  }
  r2 = ringRadius(ringProfile(S, nq, nr, centres, spacing).E);
  return { rings: centres.length, r1, r2, speed: (r2.centroid - r1.centroid) / (t2 - t1), speedPeak: (r2.peak - r1.peak) / (t2 - t1), theory: Math.SQRT1_2 };
}

// ---------- starting configurations (#165 grade: "random starting configurations"; VIZ research's ruling) ----------
// A flow start and a dye pattern, each picked from the seed (5 × 4). Every flow start keeps |u| ≤ umax (FHP: ≤ 0.2)
// and has its mean subtracted; all but splash are built from a stream function, so they are divergence-free and the
// first frames don't flash with sound waves. Splash is a gas at rest with density bumps: the opening is its rings.
export const FLOW_STARTS = ['vortices', 'shear', 'dipoles', 'jets', 'splash'];
export const DYE_PATTERNS = ['bands', 'checker', 'rings', 'blobs'];
// the main eddy of each start, in features across the torus's q axis (the dye's feature size follows it)
export const START_EDDIES = { vortices: 8, shear: 4, dipoles: 10, jets: 6, splash: 8 };

// seed 1 (the QA seed) is the classic opening: the vortices and today's bands
export function pickStart(seed, flow = 'auto', dye = 'auto') {
  seed >>>= 0;
  const h = hash32((seed ^ 0x5f3759df) >>> 0);
  const flowFixed = FLOW_STARTS.includes(flow), dyeFixed = DYE_PATTERNS.includes(dye);
  return {
    flow: flowFixed ? flow : seed === 1 ? 'vortices' : FLOW_STARTS[h % 5],
    dye: dyeFixed ? dye : seed === 1 ? 'bands' : DYE_PATTERNS[(h >>> 8) % 4],
    flowFixed, dyeFixed,
  };
}

const TAU = 2 * Math.PI, R3 = Math.sqrt(3);
const wrapPi = x => x - TAU * Math.round(x / TAU);
// profile flows: ψ = Σ a P(θ), θ = 2π (m q / nq + n r / nr) + ph, given g = P' (periodic, zero mean); u = (∂ψ/∂y, −∂ψ/∂x)
function profileAt(parts, q, r, nq, nr) {
  let dq = 0, dr = 0;
  for (const p of parts) {
    const c = p.a * p.g(TAU * (p.m * q / nq + p.n * r / nr) + p.ph);
    dq += c * TAU * p.m / nq; dr += c * TAU * p.n / nr;
  }
  return [(2 * dr - dq) / R3, -dq];
}
// the peak |u| of fn on every 3rd site (the starts are smooth on that scale)
function peakOf(fn, nq, nr) {
  let p = 0;
  for (let r = 0; r < nr; r += 3) for (let q = 0; q < nq; q += 3) { const [a, b] = fn(q, r); p = Math.max(p, Math.hypot(a, b)); }
  return p || 1;
}
// a small wiggle (2–4 wavelengths along the layers) so a layer rolls up instead of sitting still
function wiggleParts(R, alongQ) {
  return [0, 1, 2].map(() => {
    const k = 2 + Math.floor(R() * 3);
    return { m: alongQ ? k : 0, n: alongQ ? 0 : k, a: 0.5 + R(), ph: R() * TAU, g: Math.cos };
  });
}
// layers (shear, jets) along one axis plus the wiggle at eps of their peak
function layered(base, R, alongQ, eps, nq, nr) {
  const wig = wiggleParts(R, alongQ), fb = (q, r) => profileAt(base, q, r, nq, nr), fw = (q, r) => profileAt(wig, q, r, nq, nr);
  const pb = peakOf(fb, nq, nr), pw = peakOf(fw, nq, nr);
  return (q, r) => { const a = fb(q, r), b = fw(q, r); return [a[0] / pb + eps * b[0] / pw, a[1] / pb + eps * b[1] / pw]; };
}

// a start's flow on the nq × nr torus: { kind, ux, uy, rho (density factor or null), stats }
export function startFlow(kind, nq, nr, seed, { umax = 0.18 } = {}) {
  const R = rng((Math.imul(seed >>> 0, 2654435761) + 0x51ed27) >>> 0), N = nq * nr;
  let ux, uy, rho = null, fn = null, info = {};
  if (kind === 'vortices') {
    ({ ux, uy } = flowField(nq, nr, seed, { umax, count: 16, kMax: 12 }));
  } else if (kind === 'shear') {
    // two periodic shear layers (tanh(κ cos θ): ~nr / 60 sites thick), along q (horizontal) or along r
    const alongQ = R() < 0.6, kap = 10, ph = R() * TAU;
    const base = [{ m: alongQ ? 0 : 1, n: alongQ ? 1 : 0, a: 1, ph, g: t => Math.tanh(kap * Math.cos(t)) / Math.tanh(kap) }];
    fn = layered(base, R, alongQ, 0.05, nq, nr); info = { alongQ };
  } else if (kind === 'jets') {
    // 2 or 4 opposing jets, evenly spaced, alternating
    const count = R() < 0.5 ? 2 : 4, w = TAU / (count * 5), alongQ = R() < 0.6, ph0 = R() * TAU;
    const g = t => { let s = 0; for (let j = 0; j < count; j++) { const x = wrapPi(t - ph0 - TAU * j / count) / w; s += (j % 2 ? -1 : 1) * Math.exp(-x * x); } return s; };
    fn = layered([{ m: alongQ ? 0 : 1, n: alongQ ? 1 : 0, a: 1, ph: 0, g }], R, alongQ, 0.05, nq, nr); info = { count, alongQ };
  } else if (kind === 'dipoles') {
    // 3–6 Gaussian vortex pairs (ψ = ±Γ e^(−d²/2σ²)), each heading for the next pair's centre, so they travel and collide
    const pairs = 3 + Math.floor(R() * 4), sig = nq / 40, sep = 1.1 * sig, W = nq + nr / 2, Hs = nr * S3;
    const centres = Array.from({ length: pairs }, () => [R() * W, R() * Hs]);
    const vort = [];
    centres.forEach((c, k) => {
      const t = centres[(k + 1) % pairs]; let hx = t[0] - c[0], hy = t[1] - c[1]; const hl = Math.hypot(hx, hy) || 1; hx /= hl; hy /= hl;
      const nx = hy, ny = -hx;   // to the right of the heading: the clockwise one there, the counter-clockwise one left
      for (const [s, G] of [[1, -1], [-1, 1]]) {
        const x = c[0] + s * sep * nx, y = c[1] + s * sep * ny, r = y / S3;
        vort.push({ q: x - r / 2, r, G });
      }
    });
    const s2 = sig * sig, cut = 5 * sig;
    fn = (q, r) => {
      let a = 0, b = 0;
      for (const v of vort) {
        const [dx, dy] = offset(q, r, v.q, v.r, nq, nr);
        if (Math.abs(dx) > cut || Math.abs(dy) > cut) continue;
        const p = v.G * Math.exp(-(dx * dx + dy * dy) / (2 * s2));
        a += -p * dy / s2; b += p * dx / s2;
      }
      return [a, b];
    };
    info = { pairs, sigma: +sig.toFixed(1) };
  } else if (kind === 'splash') {
    // at rest, with 12–20 density bumps (+80 %, radius 6–20 sites): the opening is their sound rings
    const n = 12 + Math.floor(R() * 9), bumps = Array.from({ length: n }, () => ({ q: R() * nq, r: R() * nr, s: 6 + 14 * R() }));
    ux = new Float32Array(N); uy = new Float32Array(N); rho = new Float32Array(N).fill(1);
    for (const b of bumps) {
      const ext = Math.ceil(4 * b.s / S3) + 1;
      for (let dr = -ext; dr <= ext; dr++) for (let dq = -2 * ext; dq <= 2 * ext; dq++) {
        const q = wrap(Math.round(b.q) + dq, nq), r = wrap(Math.round(b.r) + dr, nr), [dx, dy] = offset(q, r, b.q, b.r, nq, nr), d2 = dx * dx + dy * dy;
        if (d2 < 16 * b.s * b.s) rho[r * nq + q] += 0.8 * Math.exp(-d2 / (2 * b.s * b.s));
      }
    }
    info = { bumps: n };
  } else throw new Error('26: unknown flow start ' + kind);
  if (fn) {
    ux = new Float32Array(N); uy = new Float32Array(N);
    for (let r = 0; r < nr; r++) for (let q = 0; q < nq; q++) { const [a, b] = fn(q, r); ux[r * nq + q] = a; uy[r * nq + q] = b; }
  }
  // S1: the mean subtracted, then the peak scaled to umax
  let mx = 0, my = 0; for (let k = 0; k < N; k++) { mx += ux[k]; my += uy[k]; } mx /= N; my /= N;
  let peak = 0; for (let k = 0; k < N; k++) { ux[k] -= mx; uy[k] -= my; peak = Math.max(peak, Math.hypot(ux[k], uy[k])); }
  const sc = peak > 0 ? umax / peak : 0;
  let s2 = 0, ex = 0, ey = 0; for (let k = 0; k < N; k++) { ux[k] *= sc; uy[k] *= sc; s2 += ux[k] * ux[k] + uy[k] * uy[k]; ex += ux[k]; ey += uy[k]; }
  let rhoRms = 0; if (rho) { let m = 0, m2 = 0; for (let k = 0; k < N; k++) { m += rho[k]; m2 += rho[k] * rho[k]; } m /= N; rhoRms = Math.sqrt(Math.max(0, m2 / N - m * m)); }
  return { kind, ux, uy, rho, info, stats: { maxU: +(peak * sc).toFixed(4), meanU: Math.hypot(ex, ey) / N, rmsU: +Math.sqrt(s2 / N).toFixed(4), rhoRms: +rhoRms.toFixed(4) } };
}
// S3: RMS div / RMS curl of the field's B × B block means
export function fieldDivCurl(field, nq, nr, B = 16) {
  const w = Math.floor(nq / B), h = Math.floor(nr / B), V = [];
  for (let by = 0; by < h; by++) for (let bx = 0; bx < w; bx++) {
    let a = 0, b = 0;
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) { const k = (by * B + j) * nq + bx * B + i; a += field.ux[k]; b += field.uy[k]; }
    V.push([a / (B * B), b / (B * B)]);
  }
  return divCurl(V, w, h, B);
}
// S1 on the particles: total momentum exactly 0. One particle at a time turns 60° (link k+1 → k+2 takes −e_k off
// Σ n_i e_i), always against the link most along the momentum, so |P| falls by ≥ 1 − √3 / 2·2|P|… each turn and ends at 0.
export function zeroMomentum(S, nq, nr, seed) {
  let { pq, pr } = massMomentum(S), turns = 0, probes = 0;
  const R = rng((seed ^ 0x2f6b2a1d) >>> 0), N = S.length;
  while ((pq || pr) && probes < 1e8) {
    const px = pq + pr / 2, py = pr * S3;
    let k = 0, best = -Infinity; for (let i = 0; i < 6; i++) { const d = px * SCREEN[i][0] + py * SCREEN[i][1]; if (d > best) { best = d; k = i; } }
    const a = (k + 1) % 6, b = (k + 2) % 6;
    for (;;) {
      probes++;
      const j = Math.floor(R() * N), s = S[j];
      if ((s >> a) & 1 && !((s >> b) & 1)) { S[j] = (s & ~(1 << a)) | (1 << b); break; }
    }
    pq -= DIRS[k][0]; pr -= DIRS[k][1]; turns++;
  }
  return { turns, probes };
}
// the whole start: the lattice and its numbers (S1–S3; S2's dye change needs the dye, dyeChange below)
export function startLattice(kind, nq, nr, d, seed, opts = {}) {
  const field = startFlow(kind, nq, nr, seed, opts);
  const S = latticeFromFlow(field, nq, nr, d, seed), z = zeroMomentum(S, nq, nr, seed), m = massMomentum(S);
  const dc = kind === 'splash' ? null : fieldDivCurl(field, nq, nr, Math.max(4, Math.round(16 * nq / 2048)));
  return { S, field, info: field.info, stats: { ...field.stats, latticeP: [m.pq, m.pr], latticeMeanU: Math.hypot(m.pq + m.pr / 2, m.pr * S3) / Math.max(1, m.mass),
    turns: z.turns, divCurl: dc ? +dc.ratio.toFixed(4) : null } };
}
// a 32-bit FNV-1a of a lattice (S4)
export function latticeHash(S) { let h = 0x811c9dc5; for (let k = 0; k < S.length; k++) { h ^= S[k]; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }

// ---------- the dye patterns (the page's ADVECT pattern() runs the same; uv = (q / nq, r / nr), wrapping) ----------
// dyeFor(seed, n, start): the pattern of the n-th dye (0 = the opening, then one per section). An auto dye changes
// pattern every section; a chosen one keeps it and changes its hues and phase. Seed 1's opening is today's bands.
export function dyeFor(seed, n, start, nq, nr) {
  seed >>>= 0;
  let pat = Math.max(0, DYE_PATTERNS.indexOf(start.dye));
  if (!start.dyeFixed) for (let k = 1; k <= n; k++) pat = (pat + 1 + hash32((Math.imul(seed, 2654435761) + Math.imul(k, 40503)) >>> 0) % 3) % 4;
  if (seed === 1 && n === 0 && pat === 0 && start.flow === 'vortices') return { pat: 0, name: 'bands', kx: 5, ky: 3, hue: 0.6, c: 0, Kx: 9, Ky: 3, rad: 1, phase: 0, salt: 0 };
  const salt = hash32((seed ^ Math.imul(n + 1, 0x9e3779b9)) >>> 0), R = rng(salt);
  const K = (START_EDDIES[start.flow] || 8) * (0.8 + 0.4 * R()), c = 3 + Math.floor(R() * 3);
  const a = Math.max(1, Math.round(K / c)), b = [-a, -1, 1, a][Math.floor(R() * 4)];
  const Kx = 3 * Math.max(1, Math.round(K / 3)), Ky = 3 * Math.max(1, Math.round(Kx * nr * S3 / nq / 3));
  const rad = 0.35 * Math.min(nq / Kx, nr / Ky) * S3;
  return { pat, name: DYE_PATTERNS[pat], kx: c * a, ky: c * b, hue: +R().toFixed(4), c, Kx, Ky, rad: +rad.toFixed(2), phase: +(R() * TAU).toFixed(4), salt };
}
const clamp01 = x => Math.min(1, Math.max(0, x));
const sstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const mod = (x, y) => x - y * Math.floor(x / y);
const hueRGB = h => [0, 4, 2].map(o => clamp01(Math.abs(mod(h * 6 + o, 6) - 3) - 1));
const tint = h => hueRGB(h).map((v, i) => v * [0.55, 0.30, 0.95][i] + 0.02);
const cellRand = (cx, cy, salt, k) => (hash32((Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ salt ^ k) >>> 0) & 0xffff) / 65535;
// the dye colour at torus uv (linear rgb), D from dyeFor; lat = [nq, nr]
export function dyeAt(u, v, D, lat) {
  u = fract(u); v = fract(v);
  if (D.pat === 0) {
    const t = u * D.kx + v * D.ky + 0.25 * Math.sin(TAU * v * 2 + D.phase);
    const g = sstep(0.08, 0.3, Math.abs(fract(t) - 0.5) * 2), n = Math.floor(t);
    const h = D.c > 0.5 ? D.hue + mod(n, D.c) / D.c : fract(n * 0.37 + D.hue);
    return tint(h).map(x => x * g);
  }
  const px = u * D.Kx, py = v * D.Ky, cx = Math.floor(px), cy = Math.floor(py), fx = px - cx, fy = py - cy;
  if (D.pat === 1) {
    const e = Math.min(fx, 1 - fx, fy, 1 - fy), g = sstep(0.02, 0.08, e);
    return tint(D.hue + mod(cx + cy, 3) / 3).map(x => x * g);
  }
  const off = (ax, ay) => { const dq = ax * lat[0] / D.Kx, dr = ay * lat[1] / D.Ky; return Math.hypot(dq + dr / 2, dr * S3); };
  if (D.pat === 2) {
    const d = off(fx - 0.5, fy - 0.5), w = D.rad / 3, n = Math.floor(d / w);
    const g = sstep(0.08, 0.3, Math.abs(fract(d / w) - 0.5) * 2) * (1 - sstep(D.rad * 0.9, D.rad, d));
    return tint(D.hue + cellRand(cx, cy, D.salt, 1) * 0.33 + n / 3).map(x => x * g);
  }
  const jx = (cellRand(cx, cy, D.salt, 2) - 0.5) * 0.2, jy = (cellRand(cx, cy, D.salt, 3) - 0.5) * 0.2;
  const rr = D.rad * (0.6 + 0.4 * cellRand(cx, cy, D.salt, 4)), d = off(fx - 0.5 - jx, fy - 0.5 - jy);
  const g = 1 - sstep(0.8 * rr, rr, d);
  return tint(D.hue + cellRand(cx, cy, D.salt, 5)).map(x => x * g);
}
// S2's dye half: how much the dye picture changes in one beat of the start's flow (frozen), carried `steps` gas steps
// (the fluid view's 96 a beat × the default mix 3), on a 256 × 144 grid: mean |Δ rgb| ÷ mean rgb
export function dyeChange(field, D, nq, nr, steps = 288, gw = 256, gh = 144) {
  let ch = 0, base = 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const u = (i + 0.5) / gw, v = (j + 0.5) / gh, k = Math.min(nr - 1, Math.floor(v * nr)) * nq + Math.min(nq - 1, Math.floor(u * nq));
    const vx = field.ux[k], vy = field.uy[k], dq = vx - vy / R3, dr = 2 * vy / R3;
    const a = dyeAt(u, v, D, [nq, nr]), b = dyeAt(u - dq * steps / nq, v - dr * steps / nr, D, [nq, nr]);
    for (let c = 0; c < 3; c++) { ch += Math.abs(a[c] - b[c]); base += a[c]; }
  }
  return base > 0 ? ch / base : 0;
}
