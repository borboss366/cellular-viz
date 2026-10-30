// 15 P vs NP · the salesman's maths, kept apart from the drawing so it can be checked without a browser:
// the page loads it as a plain <script>, the Held–Karp worker loads it with importScripts, and node's test
// runner loads it with require (qa/runner/test/tsp15a.test.mjs, run by qa/test-pr.sh).
// Spec: cellular-viz #37 comment 6493121591, section 15a. Points are [x, y] in the unit square.
(function (root) {
  'use strict';

  // seeded randomness (mulberry32): the same seed gives the same map everywhere
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // n cities, at least `gap` apart where the rejection sampling allows it (no stacked nodes on screen)
  function makeCities(n, seed, gap = 0.02) {
    const r = rng(seed), pts = [];
    let tries = 0;
    while (pts.length < n) {
      const p = [0.04 + 0.92 * r(), 0.04 + 0.92 * r()];
      if (tries++ < 50 * n && pts.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) < gap)) continue;
      pts.push(p);
    }
    return pts;
  }
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function tourLength(pts, tour) {
    let s = 0;
    for (let i = 0; i < tour.length; i++) s += d(pts[tour[i]], pts[tour[(i + 1) % tour.length]]);
    return s;
  }
  // truth 3: a Hamiltonian cycle visits each of the n cities exactly once
  function isHamiltonian(tour, n) {
    if (tour.length !== n) return false;
    const seen = new Uint8Array(n);
    for (const c of tour) { if (!(c >= 0 && c < n) || seen[c]) return false; seen[c] = 1; }
    return true;
  }
  // proper crossing of segments ab and cd (shared end points don't count)
  function cross(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
  function segmentsCross(a, b, c, e) {
    const d1 = cross(c, e, a), d2 = cross(c, e, b), d3 = cross(a, b, c), d4 = cross(a, b, e);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
  // truth 2: O(n²) count of crossing edge pairs (adjacent edges share a city and can't cross properly)
  function countCrossings(pts, tour) {
    const n = tour.length;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const a = pts[tour[i]], b = pts[tour[(i + 1) % n]];
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        if (segmentsCross(a, b, pts[tour[j]], pts[tour[(j + 1) % n]])) k++;
      }
    }
    return k;
  }
  // 2-opt: remove edges (t[i], t[i+1]) and (t[j], t[j+1]), reconnect by reversing t[i+1..j]
  function twoOptDelta(pts, t, i, j) {
    const n = t.length, a = pts[t[i]], b = pts[t[i + 1]], c = pts[t[j]], e = pts[t[(j + 1) % n]];
    return d(a, c) + d(b, e) - d(a, b) - d(c, e);
  }
  function best2opt(pts, t) {   // the best improving move, or null at a local optimum
    const n = t.length;
    let best = null, bd = -1e-12;
    for (let i = 0; i < n - 2; i++) {
      for (let j = i + 2; j < n; j++) {
        if (i === 0 && j === n - 1) continue;
        const dl = twoOptDelta(pts, t, i, j);
        if (dl < bd) { bd = dl; best = { i, j, delta: dl }; }
      }
    }
    return best;
  }
  function apply2opt(t, i, j) {   // in place; returns the two removed and the two added edges
    const removed = [[t[i], t[i + 1]], [t[j], t[(j + 1) % t.length]]];
    for (let a = i + 1, b = j; a < b; a++, b--) { const x = t[a]; t[a] = t[b]; t[b] = x; }
    const added = [[t[i], t[i + 1]], [t[j], t[(j + 1) % t.length]]];
    return { removed, added };
  }
  function twoOptConverge(pts, tour, maxMoves = 1e6) {   // a copy, polished to a local optimum
    const t = tour.slice();
    for (let k = 0; k < maxMoves; k++) { const m = best2opt(pts, t); if (!m) break; apply2opt(t, m.i, m.j); }
    return t;
  }
  function nearestNeighbour(pts, start = 0) {
    const n = pts.length, used = new Uint8Array(n), t = [start];
    used[start] = 1;
    for (let k = 1; k < n; k++) {
      const p = pts[t[k - 1]];
      let bi = -1, bd = Infinity;
      for (let c = 0; c < n; c++) if (!used[c]) { const dd = d(p, pts[c]); if (dd < bd) { bd = dd; bi = c; } }
      t.push(bi); used[bi] = 1;
    }
    return t;
  }
  // the cheapest place to insert city c into tour t (build-up: new cities join without breaking the cycle)
  function cheapestInsert(pts, t, c) {
    if (t.length < 2) { t.push(c); return; }
    let bi = 0, bd = Infinity;
    for (let i = 0; i < t.length; i++) {
      const a = pts[t[i]], b = pts[t[(i + 1) % t.length]], dd = d(a, pts[c]) + d(pts[c], b) - d(a, b);
      if (dd < bd) { bd = dd; bi = i; }
    }
    t.splice(bi + 1, 0, c);
  }
  // Hilbert index of cell (x, y) on a 2^order grid (the d2xy inverse); the space-filling-curve tour (15b)
  function hilbertIndex(x, y, order) {
    let dd = 0;
    for (let s = 1 << (order - 1); s > 0; s >>= 1) {
      const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
      dd += s * s * ((3 * rx) ^ ry);
      if (ry === 0) { if (rx === 1) { x = s - 1 - x; y = s - 1 - y; } const tmp = x; x = y; y = tmp; }
    }
    return dd;
  }
  function sfcTour(pts, order = 10) {
    const N = 1 << order;
    return pts.map((p, i) => [hilbertIndex(Math.min(N - 1, Math.floor(p[0] * N)), Math.min(N - 1, Math.floor(p[1] * N)), order), i])
      .sort((a, b) => a[0] - b[0]).map(e => e[1]);
  }
  // truth 4: the number of distinct tours (n−1)!/2, exact while it fits on screen, else 10^x
  function routeCount(n) {
    if (n < 3) return { exact: '1', log10: 0 };
    let log10 = -Math.log10(2);
    for (let k = 2; k < n; k++) log10 += Math.log10(k);
    if (n <= 25 && typeof BigInt === 'function') {
      let f = BigInt(1);
      for (let k = 2; k < n; k++) f *= BigInt(k);
      return { exact: (f / BigInt(2)).toString(), log10 };
    }
    return { exact: null, log10 };
  }
  // Held–Karp: the exact optimum by dynamic programming over subsets, O(n²·2ⁿ); n ≤ 13 on the page
  function heldKarp(pts) {
    const n = pts.length;
    if (n < 3) return { length: n === 2 ? 2 * d(pts[0], pts[1]) : 0, tour: [...Array(n).keys()], ops: 0 };
    const m = n - 1, S = 1 << m, D = (a, b) => d(pts[a], pts[b]);
    const dp = new Float64Array(S * m).fill(Infinity), par = new Int8Array(S * m).fill(-1);
    for (let k = 0; k < m; k++) dp[(1 << k) * m + k] = D(0, k + 1);
    let ops = 0;
    for (let s = 1; s < S; s++) {
      for (let k = 0; k < m; k++) {
        if (!(s & (1 << k))) continue;
        const v = dp[s * m + k];
        if (v === Infinity) continue;
        for (let j = 0; j < m; j++) {
          if (s & (1 << j)) continue;
          ops++;
          const ns = s | (1 << j), nv = v + D(k + 1, j + 1);
          if (nv < dp[ns * m + j]) { dp[ns * m + j] = nv; par[ns * m + j] = k; }
        }
      }
    }
    let best = Infinity, last = -1;
    for (let k = 0; k < m; k++) { const v = dp[(S - 1) * m + k] + D(k + 1, 0); if (v < best) { best = v; last = k; } }
    const tour = [];
    for (let s = S - 1, k = last; k >= 0;) { tour.push(k + 1); const pk = par[s * m + k]; s &= ~(1 << k); k = pk; }
    tour.push(0); tour.reverse();
    return { length: best, tour, ops };
  }
  // brute force (QA only, n ≤ 10): every tour from city 0, by Heap's permutations of cities 1..n−1
  function bruteForce(pts) {
    const n = pts.length, a = [...Array(n - 1).keys()].map(k => k + 1), c = new Array(n - 1).fill(0);
    const len = () => { let s = d(pts[0], pts[a[0]]); for (let i = 1; i < a.length; i++) s += d(pts[a[i - 1]], pts[a[i]]); return s + d(pts[a[a.length - 1]], pts[0]); };
    let best = len();
    for (let i = 0; i < a.length;) {
      if (c[i] < i) { const k = i % 2 ? c[i] : 0, x = a[k]; a[k] = a[i]; a[i] = x; best = Math.min(best, len()); c[i]++; i = 0; }
      else { c[i] = 0; i++; }
    }
    return best;
  }
  // Dorigo's ant colony system: m ants, pheromone τ on every edge, one iteration per beat.
  // Global update: every edge evaporates by (1 − ρ), then the best-so-far ant's edges get ρ/L_best.
  // So an edge no ant used decays by exactly (1 − ρ) per iteration (truth 5).
  function antColony(pts, { ants = 8, rho = 0.1, alpha = 1, beta = 2, q0 = 0.9, seed = 1 } = {}) {
    const n = pts.length, tau0 = 1 / (n * tourLength(pts, nearestNeighbour(pts))), tau = new Float64Array(n * n).fill(tau0);
    const eta = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) eta[i * n + j] = i === j ? 0 : Math.pow(1 / Math.max(1e-9, d(pts[i], pts[j])), beta);
    const r = rng(seed), w = (i, j) => (alpha === 1 ? tau[i * n + j] : Math.pow(tau[i * n + j], alpha)) * eta[i * n + j];   // τ^α·η
    const state = { tau, n, rho, best: null, bestLen: Infinity, iter: 0, lastUsed: null, lastAnts: [] };
    state.step = () => {
      const tours = [];
      const used = new Uint8Array(n * n);
      for (let a = 0; a < ants; a++) {
        const start = Math.floor(r() * n), vis = new Uint8Array(n), t = [start];
        vis[start] = 1;
        for (let k = 1; k < n; k++) {
          const i = t[k - 1];
          let pick = -1;
          if (r() < q0) {   // exploit: the best edge
            let bv = -1;
            for (let j = 0; j < n; j++) if (!vis[j]) { const v = w(i, j); if (v > bv) { bv = v; pick = j; } }
          } else {          // explore: roulette on τ^α·η
            let sum = 0;
            for (let j = 0; j < n; j++) if (!vis[j]) sum += w(i, j);
            let x = r() * sum;
            for (let j = 0; j < n; j++) if (!vis[j]) { x -= w(i, j); if (x <= 0) { pick = j; break; } }
            if (pick < 0) for (let j = n - 1; j >= 0; j--) if (!vis[j]) { pick = j; break; }
          }
          t.push(pick); vis[pick] = 1;
        }
        for (let k = 0; k < n; k++) { const i = t[k], j = t[(k + 1) % n]; used[i * n + j] = used[j * n + i] = 1; }
        const L = tourLength(pts, t);
        tours.push(t);
        if (L < state.bestLen) { state.bestLen = L; state.best = t.slice(); }
      }
      for (let e = 0; e < n * n; e++) tau[e] *= (1 - rho);
      const dep = rho / state.bestLen, b = state.best;
      for (let k = 0; k < n; k++) { const i = b[k], j = b[(k + 1) % n]; tau[i * n + j] += dep; tau[j * n + i] = tau[i * n + j]; used[i * n + j] = used[j * n + i] = 1; }
      state.iter++; state.lastUsed = used; state.lastAnts = tours;
      return state;
    };
    return state;
  }

  const api = { rng, makeCities, tourLength, isHamiltonian, segmentsCross, countCrossings, twoOptDelta, best2opt, apply2opt,
    twoOptConverge, nearestNeighbour, cheapestInsert, hilbertIndex, sfcTour, routeCount, heldKarp, bruteForce, antColony };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TSP15 = api;
  // inside the Held–Karp worker: solve what the page posts
  if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    root.onmessage = e => { const t0 = Date.now(), r = heldKarp(e.data.pts); root.postMessage({ id: e.data.id, ...r, ms: Date.now() - t0 }); };
  }
})(typeof self !== 'undefined' ? self : this);
