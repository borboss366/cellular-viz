// 24 Paint Pour: the marbling maths in float64, shared by the scene (24-paint-pour.mjs) and node
// (qa/runner/test/marble24.test.mjs). Spec: VIZ research, #87 (body; comments 6478277852, 6479691254).
//
// Mathematical Marbling (Lu, Jaffer, Jin et al. 2012): every op is a closed-form map of the plane. The image at a
// world point Q is found backwards: walk the ops newest → oldest; a drop that contains Q is the colour, otherwise
// Q moves by that op's inverse. World units are screen heights at zoom 1.
//   DROP  (cx, cy, r, colour)   forward  C + (P−C)·√(1 + r²/|P−C|²); inverse C + (Q−C)·√(1 − r²/|Q−C|²), |Q−C| ≥ r.
//                               Area-preserving outside the disk; adds exactly πr² of its colour.
//   COMB  (bx, by, mx, my, z, u, lam, sp, n)   n parallel tines along the unit direction M, through B + k·sp·N
//                               (k centred on 0, N ⊥ M); displacement z·u^(d/lam) along M, d = distance to the
//                               nearest tine. A shear (depends only on the N coordinate): det J = 1; inverse = −z.
//   SWIRL (cx, cy, z, u, r0, lam, hmin, ring)   rotation about C by α(h) = z·u^(e/lam)/max(h, hmin), h = |P−C|,
//                               e = h − r0 (vortex, ring 0) or |h − r0| (circular tine, ring 1). The angle depends
//                               only on h: det J = 1; inverse = −α. hmin caps the spin at the centre.
// Animated ops (an op runs over [start, start + dur] beats with s ∈ [0, 1]) are exact maps at every s:
//   drop r·√s (a constant area rate, the pour law), comb and swirl z·smoothstep(s); a pour is r = √(rate·t/π).

export const DROP = 1, COMB = 2, SWIRL = 3;
export const TYPE_NAMES = { 1: 'drop', 2: 'comb', 3: 'swirl' };

// ---------------------------------------------------------------- one op, forward and inverse
export function combDist(o, p) {   // p: the coordinate along N; distance to the nearest of the n tines
  const half = (o.n - 1) * o.sp / 2, j = Math.max(0, Math.min(o.n - 1, Math.round((p + half) / o.sp)));
  return Math.abs(p - (j * o.sp - half));
}
export const swirlAngle = (o, h) => o.z * Math.pow(o.u, (o.ring ? Math.abs(h - o.r0) : h - o.r0) / o.lam) / Math.max(h, o.hmin);

export function fwdOp(o, x, y) {
  if (o.type === DROP) {
    const dx = x - o.cx, dy = y - o.cy, h2 = dx * dx + dy * dy;
    if (h2 === 0 || o.r === 0) return [x, y];
    const q = Math.sqrt(1 + o.r * o.r / h2);
    return [o.cx + dx * q, o.cy + dy * q];
  }
  if (o.type === COMB) {
    const p = (x - o.bx) * -o.my + (y - o.by) * o.mx, q = o.z * Math.pow(o.u, combDist(o, p) / o.lam);
    return [x + q * o.mx, y + q * o.my];
  }
  const dx = x - o.cx, dy = y - o.cy, a = swirlAngle(o, Math.hypot(dx, dy)), c = Math.cos(a), s = Math.sin(a);
  return [o.cx + c * dx - s * dy, o.cy + s * dx + c * dy];
}
// the inverse; for a drop, null when Q is inside the disk (Q shows the drop's own colour)
export function invOp(o, x, y) {
  if (o.type === DROP) {
    const dx = x - o.cx, dy = y - o.cy, h2 = dx * dx + dy * dy;
    if (o.r === 0) return [x, y];
    if (h2 < o.r * o.r) return null;
    const q = Math.sqrt(Math.max(0, 1 - o.r * o.r / h2));
    return [o.cx + dx * q, o.cy + dy * q];
  }
  if (o.type === COMB) {
    const p = (x - o.bx) * -o.my + (y - o.by) * o.mx, q = o.z * Math.pow(o.u, combDist(o, p) / o.lam);
    return [x - q * o.mx, y - q * o.my];
  }
  const dx = x - o.cx, dy = y - o.cy, a = -swirlAngle(o, Math.hypot(dx, dy)), c = Math.cos(a), s = Math.sin(a);
  return [o.cx + c * dx - s * dy, o.cy + s * dx + c * dy];
}

// ---------------------------------------------------------------- many ops
// forward through ops oldest → newest (where paint at P ends up)
export function fwd(ops, x, y) { let p = [x, y]; for (const o of ops) p = fwdOp(o, p[0], p[1]); return p; }
// backward trace newest → oldest: { x, y } the traced point, hit = index of the drop that holds Q (or −1),
// d = the distance to the nearest drop boundary passed on the way (world units at that op's stage)
export function trace(ops, x, y) {
  let px = x, py = y, d = Infinity;
  for (let i = ops.length - 1; i >= 0; i--) {
    const o = ops[i];
    if (o.type === DROP && o.r > 0) {
      const h = Math.hypot(px - o.cx, py - o.cy);
      if (h < o.r) return { x: px, y: py, hit: i, d: Math.min(d, o.r - h) };
      d = Math.min(d, h - o.r);
    }
    const q = invOp(o, px, py); px = q[0]; py = q[1];
  }
  return { x: px, y: py, hit: -1, d };
}
// the inverse of fwd: where the paint now at Q came from; null when Q lies in a drop (no paint was there before)
export function inv(ops, x, y) { const t = trace(ops, x, y); return t.hit >= 0 ? null : [t.x, t.y]; }
// det of the Jacobian by central differences (h 2e-6: at 1e-5 the truncation error near a vortex core reached 2e-5)
export function jacobianDet(f, x, y, h = 2e-6) {
  const [ax1, ay1] = f(x + h, y), [ax0, ay0] = f(x - h, y), [bx1, by1] = f(x, y + h), [bx0, by0] = f(x, y - h);
  const a = (ax1 - ax0) / (2 * h), c = (ay1 - ay0) / (2 * h), b = (bx1 - bx0) / (2 * h), d = (by1 - by0) / (2 * h);
  return a * d - b * c;
}

// ---------------------------------------------------------------- animation: an op's parameters at beat b
export const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
export const progress = (op, b) => (op.dur > 0 ? Math.max(0, Math.min(1, (b - op.start) / op.dur)) : b >= op.start ? 1 : 0);
export function effective(op, b) {
  const s = progress(op, b);
  if (op.type === DROP) {
    const r = op.pour ? Math.sqrt(op.pour * Math.max(0, Math.min(b, op.start + op.dur) - op.start) / Math.PI) : op.r * Math.sqrt(s);
    return { ...op, r, s };
  }
  return { ...op, z: op.z * smooth(s), s };
}
// How fast an op moves the paint right now (for the shader's motion damping), per second at bpm:
//   drop: g = (dA/dt)/2π, so paint at distance h outside it moves at g/h; comb, swirl: dz/dt (world or world·rad per s)
export function rateOf(op, b, bpm) {
  const s = progress(op, b), secs = op.dur * 60 / bpm;
  if (s <= 0 || s >= 1 || !(secs > 0)) return 0;
  if (op.type === DROP) return (op.pour ? op.pour * bpm / 60 : Math.PI * op.r * op.r / secs) / (2 * Math.PI);
  return Math.abs(op.z) * 6 * s * (1 - s) / secs;
}
// a swirl's reach: beyond it (|h − r0| for a ring, h − r0 for a vortex) it moves paint by less than 1e-7
export function swirlReach(o) {
  if (Math.abs(o.z) < 1e-12) return -1e9;
  return o.lam * Math.max(0, Math.log(1e-7 / Math.abs(o.z)) / Math.log(o.u));
}

// ---------------------------------------------------------------- colour
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
export const linear = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const luminance = h => { const [r, g, b] = hex2rgb(h).map(linear); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const contrast = (a, b) => { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
export const rgb = hex2rgb;
// Palettes (#87): big = big drops (never L > 0.75), ring = satellites, cell = small cells, veins = lacing options.
// Index 0 of every palette's colour list is the ground; ops carry colour indices into that list.
export const GROUND = '#030207';
const PAL = {
  canada: { big: ['#B8121C', '#5AD6E7', '#E0CC34', '#DF4798'], ring: ['#A95723'], cell: ['#A95723', '#CEE370'],
    veins: { lime: '#CEE370', yellow: '#D3A01B', black: GROUND } },
  psych60s: { big: ['#FF1F8E', '#FF8C1A', '#8FE01A', '#1F4BFF', '#E8B10F', '#5B1A6B'], ring: ['#E8B10F', '#5B1A6B'], cell: ['#FF8C1A', '#8FE01A'],
    veins: { lime: '#8FE01A', yellow: '#E8B10F', black: GROUND } },
  psych70s: { big: ['#CC5500', '#7A8B3A', '#DA9100', '#5C3A21', '#2A7F7F'], ring: ['#DA9100', '#5C3A21'], cell: ['#EFE1C6', '#7A8B3A'],
    veins: { lime: '#7A8B3A', yellow: '#DA9100', black: GROUND, cream: '#EFE1C6' } },
};
export const PALETTE_NAMES = Object.keys(PAL);
export function palette(name = 'canada') {
  const p = PAL[name] || PAL.canada, colours = [GROUND], idx = h => { let i = colours.indexOf(h); if (i < 0) { colours.push(h); i = colours.length - 1; } return i; };
  const big = p.big.map(idx), ring = p.ring.map(idx), cell = p.cell.map(idx), veins = Object.fromEntries(Object.entries(p.veins).map(([k, h]) => [k, idx(h)]));
  return { name: PAL[name] ? name : 'canada', colours, big, ring, cell, veins, L: colours.map(luminance) };
}

// ---------------------------------------------------------------- flash-safe drop growth (#87, QA box's arithmetic)
// A drop grows at a constant area rate over max(1 beat, T_min, T_gov) seconds.
//   T_min = 0.7 s × (r / 0.35 H)² × (ΔL / 0.675)               (the spec's law; ΔL = L(drop) − L(ground), r on screen)
//   T_gov: the area-rate bound that keeps any 10° window's mean rise ≤ 0.20 per 100 ms. A window (fov 40 at 16:9:
//   ¼ of the width × ⅓ of the height, area A_w = 0.148 H²) gains at most ΔL·(dA/dt)·0.1 s / A_w while the drop is
//   inside it, so dA/dt ≤ 2·A_w/ΔL and T_gov = π r² ΔL / (2 A_w). Precomputed per drop, so the op log stays a
//   function of the seed and the beat clock.
// T_move (QA box, viz-134-2: general flash after each drop): a growing drop pushes all the paint around it outward
//   at (dA/dt)/(2πρ), and fine stripes sweeping past at that speed flash. dA/dt ≤ A_MOVE (screen heights² a second)
//   keeps that push slow; the scene also damps contrast where paint still moves fast (shader, uV0/uV1).
export const WINDOW_AREA = (16 / 9 / 4) * (1 / 3), A_MOVE = 0.15;
export function growSeconds(rScreen, dL, beatSec) {
  const d = Math.max(0, dL), a = Math.PI * rScreen * rScreen, tMin = 0.7 * (rScreen / 0.35) ** 2 * (d / 0.675), tGov = a * d / (2 * WINDOW_AREA);
  return Math.max(beatSec, tMin, tGov, a / A_MOVE);
}

// ---------------------------------------------------------------- deterministic randomness
export function rng(seed) {   // mulberry32
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(...xs) {   // a 32-bit hash of integers (seed, kind, beat index …)
  let h = 0x811C9DC5;
  for (const x of xs) { let v = Math.round(x * 4) | 0; for (let k = 0; k < 4; k++) { h ^= v & 0xFF; h = Math.imul(h, 0x01000193); v >>>= 8; } }
  return h >>> 0;
}
export const rngAt = (seed, kind, beat) => rng(hash(seed, kind, beat));

// ---------------------------------------------------------------- the song: 16-bar sections
// bar 0 the drop (a big drop, rings, then a burst of cells over bar 1); bars 0–7 groove (kick → comb, snare →
// vortex, a bass swirl a bar); bars 8–11 breakdown (no new drops: one slow N/S feather comb a bar); bars 12–15 build
// (a slow pour with paint strings, plus the groove's combs and vortices under it). The next section's bar 0 drops.
export const SECTION_BARS = 16, BREAK_BAR = 8, BUILD_BAR = 12;
export const phaseOf = bar => { const k = ((Math.floor(bar) % SECTION_BARS) + SECTION_BARS) % SECTION_BARS; return k < BREAK_BAR ? 'groove' : k < BUILD_BAR ? 'breakdown' : 'build'; };
// the camera: a slow Lissajous drift (≤ 2 % of the screen height a second at 120 BPM) and a gentle zoom
export function cameraAt(beats, bpb, drift = 1) {
  const bars = beats / bpb, A = 0.12 * drift;
  return { x: A * Math.sin(2 * Math.PI * bars / 64), y: 0.6 * A * Math.sin(2 * Math.PI * bars / 48 + 0.7), zoom: 1 + 0.05 * drift * Math.sin(2 * Math.PI * bars / 96) };
}
// the big drop colour of section k: never the same as section k−1's; black (the ground) with probability blackShare
const colourCache = new Map();
export function sectionColour(seed, k, pal, blackShare) {
  const key = `${seed}|${pal.name}|${blackShare}`;
  let seq = colourCache.get(key); if (!seq) { seq = []; colourCache.set(key, seq); }
  for (let j = seq.length; j <= Math.max(0, k); j++) {   // the first drop is never black (black on black)
    const r = rngAt(seed, 101, j), prev = j > 0 ? seq[j - 1] : 0, big = pal.big.filter(x => x !== prev);
    seq.push(j > 0 && prev !== 0 && r() < blackShare ? 0 : big[Math.floor(r() * big.length)]);
  }
  return seq[Math.max(0, k)];
}

// The ops for one event. ev: { kind: 'drop'|'kick'|'snare'|'bar'|'pour', beat, bpb, bpm }. o: the inputs
// (seed, palette, dropScale, cellsPerDrop, blackShare, tines, tineDepth, tineSharp, vortexOn, pourRate, bassSwirl,
// camDrift). Returns op specs { type, start, dur (beats), …params, colour?, role }. Pure: the op log is a function of
// the seed and the beat clock.
export function opsFor(ev, o, pal) {
  const { beat, bpb, bpm } = ev, beatSec = 60 / bpm, bar = Math.floor(beat / bpb + 1e-9), cam = cameraAt(beat, bpb, o.camDrift);
  const r = rngAt(o.seed, { drop: 1, kick: 2, snare: 3, bar: 4, pour: 5 }[ev.kind], beat), out = [];
  const grow = (rad, colour) => growSeconds(rad / cam.zoom, pal.L[colour] - pal.L[0], beatSec) / beatSec;
  if (ev.kind === 'drop') {
    const k = Math.floor(bar / SECTION_BARS), colour = sectionColour(o.seed, k, pal, o.blackShare);
    const R = (0.15 + 0.20 * r()) * o.dropScale * cam.zoom, cx = cam.x + (r() - 0.5) * 0.5 * cam.zoom, cy = cam.y + (r() - 0.5) * 0.4 * cam.zoom;
    const dur = grow(R, colour);
    out.push({ type: DROP, start: beat, dur, cx, cy, r: R, colour, role: 'drop' });
    // 0–2 satellites in the same centre: rings inside the drop (exact by composition)
    const nSat = Math.floor(r() * 3);
    let t = beat + dur;
    for (let j = 0; j < nSat; j++) {
      const ringC = r() < 0.5 ? pal.ring[Math.floor(r() * pal.ring.length)] : pal.big.filter(c => c !== colour)[Math.floor(r() * (pal.big.length - 1))];
      const rs = R * (0.35 + 0.25 * r()), ds = grow(rs, ringC);
      out.push({ type: DROP, start: t, dur: ds, cx, cy, r: rs, colour: ringC, role: 'ring' }); t += ds;
    }
    // a burst of cells over the next bar, around the drop
    const n = Math.round((5 + 20 * r()) * o.cellsPerDrop);
    for (let j = 0; j < n; j++) {
      const a = r() * 2 * Math.PI, rho = R * (1.05 + 0.7 * r()), rc = (0.01 + 0.03 * r()) * cam.zoom, cc = pal.cell[Math.floor(r() * pal.cell.length)];
      out.push({ type: DROP, start: beat + bpb + j * bpb / Math.max(1, n), dur: Math.max(0.25, grow(rc, cc)), cx: cx + rho * Math.cos(a), cy: cy + rho * Math.sin(a), r: rc, colour: cc, role: 'cell' });
    }
  } else if (ev.kind === 'kick' && o.tines > 0) {
    // a comb of 3–7 tines over ½ beat; the direction turns N → E → S → W bar by bar (Jaffer's commutator look)
    const dir = [[0, 1], [1, 0], [0, -1], [-1, 0]][((bar % 4) + 4) % 4], n = 3 + Math.floor(r() * 5);
    out.push({ type: COMB, start: beat, dur: 0.5, bx: cam.x + (r() - 0.5) * 0.6 * cam.zoom, by: cam.y + (r() - 0.5) * 0.6 * cam.zoom, mx: dir[0], my: dir[1],
      z: (0.02 + 0.03 * r()) * o.tineDepth * cam.zoom, u: 0.3 + 0.3 * r(), lam: 0.02 * (1.5 - o.tineSharp) * cam.zoom, sp: (0.08 + 0.07 * r()) * cam.zoom, n, role: 'comb' });
  } else if (ev.kind === 'snare' && o.vortexOn) {
    // a small vortex: an eighth of a turn at its radius over ½ beat, at most a quarter turn at its centre (hmin = r0)
    // (was a quarter turn over ¼ beat with 10 rad at the core: fast swirls of fine stripes flash, viz-134-2)
    const r0 = (0.06 + 0.06 * r()) * cam.zoom, sg = r() < 0.5 ? -1 : 1;
    out.push({ type: SWIRL, start: beat, dur: 0.5, cx: cam.x + (r() - 0.5) * 1.2 * cam.zoom, cy: cam.y + (r() - 0.5) * 0.7 * cam.zoom,
      z: sg * Math.PI / 4 * r0, u: 0.5, r0, lam: r0, hmin: r0, ring: 0, role: 'vortex' });
  } else if (ev.kind === 'bar') {
    const ph = phaseOf(bar);
    if (ph === 'breakdown') {   // one slow alternating N/S feather comb a bar
      const up = bar % 2 === 0 ? 1 : -1;
      out.push({ type: COMB, start: beat, dur: bpb, bx: cam.x + (r() - 0.5) * 0.2 * cam.zoom, by: cam.y, mx: 0, my: up, z: 0.06 * o.tineDepth * cam.zoom, u: 0.6,
        lam: 0.05 * cam.zoom, sp: 0.18 * cam.zoom, n: 9, role: 'feather' });
    } else if (o.bassSwirl > 0) {   // the bass: a large circular tine (r0 ≈ 0.6 H) easing in over the bar
      out.push({ type: SWIRL, start: beat, dur: bpb, cx: cam.x, cy: cam.y, z: (bar % 2 ? -1 : 1) * 0.03 * o.bassSwirl * cam.zoom, u: 0.5, r0: 0.6 * cam.zoom,
        lam: 0.25 * cam.zoom, hmin: 0.2 * cam.zoom, ring: 1, role: 'bass' });
    }
  } else if (ev.kind === 'pour' && o.pourRate > 0) {
    // the slow pour of the build: one drop at a fixed point, r(t) = √(rate·t/π), t in beats, until the next drop
    const k = Math.floor(bar / SECTION_BARS), colour = pal.big.filter(c => c !== sectionColour(o.seed, k, pal, o.blackShare))[Math.floor(r() * (pal.big.length - 1))];
    const len = (SECTION_BARS - BUILD_BAR) * bpb, rate = o.pourRate * cam.zoom * cam.zoom;
    // flash: the pour's area rate is far under the drop bound (rate/beat ≪ 2·A_w·beatSec/ΔL); clamp it anyway
    const maxRate = 2 * WINDOW_AREA * cam.zoom * cam.zoom * beatSec / Math.max(0.05, pal.L[colour] - pal.L[0]);
    out.push({ type: DROP, start: beat, dur: len, cx: cam.x - 0.25 * cam.zoom, cy: cam.y + 0.05 * cam.zoom, r: Math.sqrt(Math.min(rate, maxRate) * len / Math.PI),
      pour: Math.min(rate, maxRate), colour, role: 'pour' });
  }
  return out;
}

// the events a span of beats (a, b] crosses, from the song and the drum hits (hits: [{ lane, beat }])
export function eventsIn(a, b, bpb, hits = []) {
  const out = [];
  for (let k = Math.floor(a / bpb) + 1; k * bpb <= b + 1e-9; k++) {
    const bb = k * bpb, sb = ((k % SECTION_BARS) + SECTION_BARS) % SECTION_BARS;
    if (sb === 0) out.push({ kind: 'drop', beat: bb });
    if (sb === BUILD_BAR) out.push({ kind: 'pour', beat: bb });
    out.push({ kind: 'bar', beat: bb });
  }
  for (const h of hits) if (h.beat > a && h.beat <= b + 1e-9) out.push({ kind: h.lane === 'kick' ? 'kick' : h.lane === 'snare' ? 'snare' : 'hat', beat: h.beat });
  return out.sort((x, y) => x.beat - y.beat);
}
// which kicks make a comb: tines 1 → every kick, ≥ 0.5 → kicks on beats 1 and 3, > 0 → the downbeat only
export function kickMakesComb(beat, bpb, tines) {
  const inBar = ((Math.round(beat) % bpb) + bpb) % bpb;
  if (tines >= 0.99) return true;
  if (tines >= 0.5) return inBar % 2 === 0;
  return tines > 0 && inBar === 0;
}
// the snare's vortex only in the groove and the build (the breakdown is calm)
export const snareMakesSwirl = (beat, bpb) => phaseOf(beat / bpb) !== 'breakdown';
// the song's ops for one event (what the scene queues; the determinism truth replays it)
export function songOps(e, inp, pal, bpb, bpm) {
  const ev = { kind: e.kind, beat: e.beat, bpb, bpm };
  if (e.kind === 'drop' || e.kind === 'pour' || e.kind === 'bar') return opsFor(ev, inp, pal);
  if (e.kind === 'kick') return phaseOf(e.beat / bpb) !== 'breakdown' && kickMakesComb(e.beat, bpb, inp.tines) ? opsFor(ev, inp, pal) : [];
  if (e.kind === 'snare') return snareMakesSwirl(e.beat, bpb) ? opsFor(ev, inp, pal) : [];
  return [];
}
// the metronome's hits as beat positions, for sixteenth steps in (a, b] (pat: { kick, snare, hat } 16-step strings)
export function patternHits(a, b, bpb, pat) {
  const out = [];
  for (let s = Math.floor(a * 4 + 4e-9) + 1; s <= Math.floor(b * 4 + 4e-9); s++) {   // the same edges as eventsIn's
    const inBar = ((s % (bpb * 4)) + bpb * 4) % (bpb * 4);
    for (const lane of ['kick', 'snare', 'hat']) if (pat[lane] && pat[lane][inBar % 16] === 'x') out.push({ lane, beat: s / 4 });
  }
  return out;
}
