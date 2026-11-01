// 26 Lattice Gas (FHP): the scene as a #85 module (init / resize / frame / press / release / reset / dispose).
// Spec: VIZ research, #71 (engine and scene F1); mock-ups in docs/proposals/fhp (#51). Engine reference in
// 26-fhp.mjs (node runs it; this file builds its shader tables from it).
//
// F1 Particle rain, the micro view: a 256 × 128 FHP-I torus, about 64 × 36 sites on screen. Every particle is a
// glowing dot gliding along its link between steps (the step's collided state, drawn at x + f·e_i), coloured by
// its direction (6 hues, opposite links complementary), and a white spark marks each site where a collision
// changed the state (head-on pairs and triples), fading over the step. The gas steps on the shared clock:
// stepsPerBeat (macro 2) steps a beat. Kick: a burst of particles at a random spot; hats: brighter sparks; bar 0
// of every 16-bar section: a big burst in the middle (#88's drop). A slow source/sink keeps the mean density at
// the target (macro 1), measured from the GPU every 30 frames without a stall.
// Flash (#88): every spot of the screen sees about ten dots glide past it a second, so a dot is kept below a
// luminance step of 0.1 (the general-flash transition): saturated hues at a fixed linear luminance (dotLum), on
// near black. Sparks are white but small and short, and dim themselves above 16 steps a second.

import * as F from './26-fhp.mjs';

const NQ = 256, NR = 128, RB = 16;           // the live torus; reduction block (16 × 16 sites a texel)
const MAX_STEPS_FRAME = 16;                  // more than this behind (a clock jump): drop the backlog
const STEPS_PER_BEAT = [2, 4, 8, 16];
const SECTION_BARS = 16;
const SPARK_STEPS_PER_S = 16;                // above this rate sparks dim, so a spot stays under 4 sparks a second

// ---------------------------------------------------------------- shaders
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform ivec2 uN;
uniform uint uStep, uSeed;
uniform uint uLut[128];
const float S3 = 0.8660254037844386;
const ivec2 D[6] = ivec2[6](ivec2(1, 0), ivec2(1, -1), ivec2(0, -1), ivec2(-1, 0), ivec2(-1, 1), ivec2(0, 1));
const vec2 E[6] = vec2[6](vec2(1.0, 0.0), vec2(0.5, -S3), vec2(-0.5, -S3), vec2(-1.0, 0.0), vec2(-0.5, S3), vec2(0.5, S3));
uint hash32(uint x) { x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u; return x; }
// wrap onto the torus (GLSL's % is undefined for negative operands, so floor-divide in float: exact below 2^24)
ivec2 wrapA(ivec2 a) {
  ivec2 m = a - uN * ivec2(floor(vec2(a) / vec2(uN)));
  m += uN * ivec2(lessThan(m, ivec2(0))); m -= uN * ivec2(greaterThanEqual(m, uN));
  return m;
}
uint idxOf(ivec2 a) { return uint(a.x) + uint(a.y) * uint(uN.x); }
// the collided state of site a (already wrapped) in step uStep: 26-fhp.mjs's LUT[chirality * 64 + s]
uint collide(ivec2 a, uint s) { uint c = hash32((idxOf(a) + uStep * 0x9E3779B9u) ^ uSeed) & 1u; return uLut[c * 64u + s]; }
float rand01(inout uint h, uint k) { h = hash32(h + k * 0x27d4eb2fu); return float(h >> 8u) / 16777216.0; }
`;
// collide, then propagate as a gather; then the density source/sink (off in the QA lattices)
const STEP = HEAD + `
uniform usampler2D uS;
uniform float uSrcP, uSinkP;
out uint o;
void main() {
  ivec2 x = ivec2(gl_FragCoord.xy);
  uint v = 0u;
  for (int i = 0; i < 6; i++) {
    ivec2 a = wrapA(x - D[i]);
    v |= collide(a, texelFetch(uS, a, 0).r) & (1u << uint(i));
  }
  if (uSrcP > 0.0 || uSinkP > 0.0) {
    uint h = hash32(idxOf(x) ^ hash32(uStep * 0x85EBCA6Bu + uSeed + 0x1234567u));
    for (int i = 0; i < 6; i++) {
      float u = rand01(h, uint(i) + 1u); uint b = 1u << uint(i);
      if ((v & b) != 0u) { if (u < uSinkP) v &= ~b; } else if (u < uSrcP) v |= b;
    }
  }
  o = v;
}`;
// an edit of the current state, applied at once: 1 burst (outward links filled with probability uP inside radius
// uR of the axial point uC), 2 scatter (each site's links turned by a random 1–5 places: mass kept, momentum mixed)
const EDIT = HEAD + `
uniform usampler2D uS;
uniform int uMode;
uniform vec2 uC;
uniform float uR, uP;
uniform uint uKey;
out uint o;
void main() {
  ivec2 x = ivec2(gl_FragCoord.xy);
  uint s = texelFetch(uS, x, 0).r;
  vec2 d = vec2(x) - uC; d -= vec2(uN) * floor(d / vec2(uN) + 0.5);   // the nearest image of the centre
  vec2 w = vec2(d.x + 0.5 * d.y, d.y * S3); float r = length(w);
  if (r > uR) { o = s; return; }
  uint h = hash32(idxOf(x) ^ uKey);
  if (uMode == 1) {
    for (int i = 0; i < 6; i++) {
      float u = rand01(h, uint(i) + 1u);
      if ((r < 0.5 || dot(E[i], w) > 0.35 * r) && u < uP) s |= 1u << uint(i);
    }
  } else if (uMode == 2) {
    uint k = 1u + hash32(h) % 5u;
    s = ((s << k) | (s >> (6u - k))) & 63u;
  }
  o = s;
}`;
// mass and momentum Σ n_i e_i of 16 × 16-site blocks (exact integers), read back and summed on the CPU
const REDUCE = HEAD + `
uniform usampler2D uS;
out ivec4 o;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * ${RB};
  ivec4 acc = ivec4(0);
  for (int j = 0; j < ${RB}; j++) for (int i = 0; i < ${RB}; i++) {
    ivec2 a = b + ivec2(i, j);
    if (a.x >= uN.x || a.y >= uN.y) continue;
    uint s = texelFetch(uS, a, 0).r;
    for (int k = 0; k < 6; k++) if (((s >> uint(k)) & 1u) != 0u) { acc.x += 1; acc.yz += D[k]; }
  }
  o = acc;
}`;
// particles per site, 4 sites a texel (RGBA8: count / 255), for the sound-ring readback
const PACK = HEAD + `
uniform usampler2D uS;
out vec4 o;
float pc(ivec2 a) { uint s = texelFetch(uS, a, 0).r; uint n = 0u; for (int i = 0; i < 6; i++) n += (s >> uint(i)) & 1u; return float(n) / 255.0; }
void main() { ivec2 a = ivec2(int(gl_FragCoord.x) * 4, int(gl_FragCoord.y)); o = vec4(pc(a), pc(a + ivec2(1, 0)), pc(a + ivec2(2, 0)), pc(a + ivec2(3, 0))); }`;
// the picture: for each link direction, the particles gliding along it now sit at site + f·e_i; the 3 sites of the
// triangle holding (pixel − f·e_i) are all the sites within 0.5 of it, which covers the dot's reach (0.5)
const RENDER = HEAD + `
uniform usampler2D uS;
uniform vec2 uCam, uRes;
uniform float uScale, uF, uSpark, uNode, uExposure;
uniform vec3 uHue[6];
uniform vec4 uBurst;     // world x, y, radius, envelope
out vec4 o;
vec2 worldOf(ivec2 a) { return vec2(float(a.x) + 0.5 * float(a.y), float(a.y) * S3); }
void tri(vec2 w, out ivec2 a, out ivec2 b, out ivec2 c) {
  float r = w.y / S3, q = w.x - 0.5 * r, fq = floor(q), fr = floor(r);
  ivec2 z = ivec2(int(fq), int(fr));
  if ((q - fq) + (r - fr) < 1.0) { a = z; b = z + ivec2(1, 0); c = z + ivec2(0, 1); }
  else { a = z + ivec2(1, 0); b = z + ivec2(0, 1); c = z + ivec2(1, 1); }
}
float dotP(float d) { return exp(-d * d * 61.7) + 0.3 * exp(-d * d * 8.68); }   // σ 0.09 core, σ 0.24 halo
vec3 site(ivec2 a, vec2 w, int i, inout float spark, inout float node) {
  ivec2 m = wrapA(a);
  uint s = texelFetch(uS, m, 0).r, c = collide(m, s);
  vec2 p = worldOf(a);
  if (i < 0) {   // the triangle around the pixel itself: sparks and the faint lattice
    float d2 = dot(w - p, w - p);
    if (c != s) spark += exp(-d2 * 34.7);   // σ 0.12
    node += exp(-d2 * 200.0);
    return vec3(0.0);
  }
  if (((c >> uint(i)) & 1u) == 0u) return vec3(0.0);
  return uHue[i] * dotP(length(w - (p + uF * E[i])));
}
void main() {
  vec2 w = uCam + (gl_FragCoord.xy - 0.5 * uRes) * uScale;
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 col = mix(vec3(0.0010, 0.0012, 0.0040), vec3(0.0024, 0.0016, 0.0060), uv.y);
  float spark = 0.0, node = 0.0; ivec2 A, B, C;
  for (int i = 0; i < 6; i++) {
    tri(w - uF * E[i], A, B, C);
    col += site(A, w, i, spark, node) + site(B, w, i, spark, node) + site(C, w, i, spark, node);
  }
  tri(w, A, B, C);
  site(A, w, -1, spark, node); site(B, w, -1, spark, node); site(C, w, -1, spark, node);
  float fade = (1.0 - uF) * (1.0 - uF);
  col += vec3(1.0, 0.95, 0.9) * spark * fade * uSpark + vec3(0.010, 0.012, 0.022) * node * uNode;
  vec2 bd = w - uBurst.xy;
  col += vec3(0.020, 0.012, 0.030) * uBurst.w * exp(-dot(bd, bd) / max(1.0, uBurst.z * uBurst.z));
  col = 1.0 - exp(-col * uExposure);   // a soft shoulder, linear below ~0.2: never clips to white
  vec3 srgb = mix(col * 12.92, 1.055 * pow(col, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, col));
  o = vec4(srgb, 1.0);
}`;

// ---------------------------------------------------------------- palettes (6 hues, opposite links complementary)
const HUES = {
  prism: [[0.0, 0.75, 1.0], [0.15, 0.3, 1.0], [0.55, 0.2, 1.0], [1.0, 0.15, 0.75], [1.0, 0.35, 0.1], [0.75, 1.0, 0.15]],
  ice: [[0.2, 0.9, 1.0], [0.3, 0.5, 1.0], [0.6, 0.6, 1.0], [0.9, 0.95, 1.0], [0.5, 1.0, 0.9], [0.25, 0.7, 0.9]],
};
export const PALETTES = Object.keys(HUES);
const lumOf = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// each hue scaled to the linear luminance L (a dot's peak is 1.3 L: dotP(0) = 1.3)
export const huesAt = (name, L) => (HUES[name] || HUES.prism).map(c => { const k = L / lumOf(c); return c.map(v => v * k); });

// ---------------------------------------------------------------- the scene
export function createScene() {
  let gl = null, W = 1, H = 1, vao = null;
  const P = {}, U = {};
  const st = {
    seed: 1, cur: 0, simStep: 0, base: 0, spb: null, f: 0, first: true, frozen: false, frozenF: 0,
    lastBeats: null, lastSection: null, burstEnv: 0, burstAt: [0, 0, 1], rng: F.rng(1),
    mass: null, massAt: -1, pq: 0, pr: 0, srcP: 0, sinkP: 0, frameNo: 0, pending: null,
    rings: [], triggerLog: [], triggerEnv: [0, 0, 0, 0], trig: [], view: {}, metrics: {}, conserve: false, qaCache: {}, massHistory: [],
  };
  let tex = [], fbo = [], red = null, pbo = null;

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('26 shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(name, fs, uniforms) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('26 link ' + name + ': ' + gl.getProgramInfoLog(p));
    P[name] = p; U[name] = {};
    for (const u of ['uN', 'uStep', 'uSeed', 'uLut', 'uS', ...uniforms]) U[name][u] = gl.getUniformLocation(p, u);
    gl.useProgram(p); gl.uniform1uiv(U[name].uLut, Uint32Array.from(F.LUT)); gl.uniform1i(U[name].uS, 0);
  }
  function stateTex(nq, nr, data) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8UI, nq, nr, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data || null);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, nq, nr };
  }
  function colourTex(w, h, internal, format, type) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.NEAREST);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  const reduceTex = (nq, nr) => colourTex(Math.ceil(nq / RB), Math.ceil(nr / RB), gl.RGBA32I, gl.RGBA_INTEGER, gl.INT);

  // ---- passes on a lattice L = { a: stateTex, b: stateTex } (a holds the current state)
  function pass(name, src, dst, set) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w || dst.nq, dst.h || dst.nr);
    gl.useProgram(P[name]);
    gl.uniform2i(U[name].uN, src.nq, src.nr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t);
    if (set) set(U[name]);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function stepLattice(L, step, seed, srcP = 0, sinkP = 0) {
    pass('step', L.a, L.b, u => { gl.uniform1ui(u.uStep, step >>> 0); gl.uniform1ui(u.uSeed, seed >>> 0); gl.uniform1f(u.uSrcP, srcP); gl.uniform1f(u.uSinkP, sinkP); });
    [L.a, L.b] = [L.b, L.a];
  }
  function editLattice(L, mode, cq, cr, R, p, key) {
    pass('edit', L.a, L.b, u => { gl.uniform1i(u.uMode, mode); gl.uniform2f(u.uC, cq, cr); gl.uniform1f(u.uR, R); gl.uniform1f(u.uP, p); gl.uniform1ui(u.uKey, key >>> 0); });
    [L.a, L.b] = [L.b, L.a];
  }
  // exact mass and momentum, read at once (a GPU sync: QA only)
  function reduceSync(L, rt) {
    pass('reduce', L.a, rt);
    const out = new Int32Array(rt.w * rt.h * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rt.f); gl.readPixels(0, 0, rt.w, rt.h, gl.RGBA_INTEGER, gl.INT, out);
    let mass = 0, pq = 0, pr = 0; for (let k = 0; k < out.length; k += 4) { mass += out[k]; pq += out[k + 1]; pr += out[k + 2]; }
    return { mass, pq, pr };
  }
  // the whole state, bit for bit (QA only)
  function readState(L) {
    const { nq, nr } = L.a, raw = new Uint32Array(nq * nr * 4), S = new Uint8Array(nq * nr);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, L.a.f); gl.readPixels(0, 0, nq, nr, gl.RGBA_INTEGER, gl.UNSIGNED_INT, raw);
    for (let k = 0; k < S.length; k++) S[k] = raw[4 * k];
    return S;
  }
  // particles per site via the RGBA8 pack (a quarter of the bytes of readState's integer read)
  function readCounts(L, pk) {
    pass('pack', L.a, pk);
    const raw = new Uint8Array(pk.w * pk.h * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, pk.f); gl.readPixels(0, 0, pk.w, pk.h, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    return raw;   // row r, site q at raw[r * nq + q] (4 sites a texel, in order)
  }
  const lattice = (nq, nr, S) => ({ a: stateTex(nq, nr, S), b: stateTex(nq, nr, null) });
  const freeLattice = L => { for (const s of [L.a, L.b]) { gl.deleteTexture(s.t); gl.deleteFramebuffer(s.f); } };
  const freeTex = t => { gl.deleteTexture(t.t); gl.deleteFramebuffer(t.f); };
  let live = null;

  // conserve (?qa=conserve): no bursts, no source or sink, no scatter, so the live lattice keeps its mass exactly
  function init(g, { width = 1, height = 1, seed = 1, conserve = false } = {}) {
    gl = g; W = width; H = height; st.seed = seed >>> 0 || 1; st.rng = F.rng(st.seed * 7919 + 13); st.conserve = !!conserve;
    vao = gl.createVertexArray();
    program('step', STEP, ['uSrcP', 'uSinkP']);
    program('edit', EDIT, ['uMode', 'uC', 'uR', 'uP', 'uKey']);
    program('reduce', REDUCE, []);
    program('pack', PACK, []);
    program('render', RENDER, ['uCam', 'uRes', 'uScale', 'uF', 'uSpark', 'uNode', 'uExposure', 'uHue', 'uBurst']);
    live = lattice(NQ, NR, F.randomLattice(NQ, NR, 0.25, st.seed));
    red = reduceTex(NQ, NR);
    pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, red.w * red.h * 16, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    reset();
  }
  function resize(w, h) { W = w; H = h; }
  function dispose() {
    if (!gl) return;
    if (live) freeLattice(live); if (red) freeTex(red);
    for (const p of Object.values(P)) gl.deleteProgram(p);
    gl.deleteBuffer(pbo); gl.deleteVertexArray(vao);
    gl = null;
  }
  // a fresh start (Play): an opening burst in the middle, so the scene never opens static
  function reset() {
    Object.assign(st, { first: true, lastBeats: null, lastSection: null, trig: [], frozen: false });
    const c = viewCentreAxial(); burst(c[0], c[1], 6, 0.85, 'open', performance.now());
  }

  // ---- the view: world units are links; the camera sits at the torus centre
  const camWorld = () => [NQ / 2 + NR / 4, NR / 2 * F.S3];
  function viewCentreAxial() { const [x, y] = camWorld(), r = y / F.S3; return [x - r / 2, r]; }
  function randomSpot(sitesAcross) {   // a random point in the middle 70 % of the view, axial
    const [cx, cy] = camWorld(), vw = sitesAcross, vh = sitesAcross * H / Math.max(1, W);
    const x = cx + (st.rng() - 0.5) * 0.7 * vw, y = cy + (st.rng() - 0.5) * 0.7 * vh, r = y / F.S3;
    return [x - r / 2, r];
  }
  function burst(cq, cr, R, p, cause, now) {
    if (!gl || st.conserve) return null;
    const key = F.hash32((st.simStep * 2654435761 + st.rings.length * 40503 + st.seed) >>> 0);
    editLattice(live, 1, cq, cr, R, p, key);
    const r = cr, x = cq + r / 2, y = r * F.S3;
    st.burstEnv = 1; st.burstAt = [x, y, R];
    const e = { t: now, step: st.simStep, q: +cq.toFixed(2), r: +cr.toFixed(2), x: +x.toFixed(2), y: +y.toFixed(2), radius: R, cause };
    st.rings.push(e); if (st.rings.length > 512) st.rings.shift();
    return e;
  }
  function scatter(now) {
    if (!gl || st.conserve) return;
    const c = viewCentreAxial();
    editLattice(live, 2, c[0], c[1], 1e6, 1, F.hash32(st.simStep ^ 0x5bd1e995));
    st.rings.push({ t: now, step: st.simStep, cause: 'scatter' });
  }

  // ---- the density: async readback of mass every 30 frames, then a gentle source/sink toward the target
  function pollMass(ctl) {
    if (st.pending) {
      const s = gl.getSyncParameter(st.pending, gl.SYNC_STATUS);
      if (s === gl.SIGNALED) {
        const out = new Int32Array(red.w * red.h * 4);
        gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        gl.deleteSync(st.pending); st.pending = null;
        let m = 0, pq = 0, pr = 0; for (let k = 0; k < out.length; k += 4) { m += out[k]; pq += out[k + 1]; pr += out[k + 2]; }
        Object.assign(st, { mass: m, pq, pr, massAt: st.simStep });
        st.massHistory.push({ step: st.simStep, mass: m, pq, pr, conserve: st.conserve }); if (st.massHistory.length > 400) st.massHistory.shift();
        const N = NQ * NR, MT = 6 * N * ctl.density, err = m - MT;
        st.sinkP = st.conserve || err <= 0 ? 0 : Math.min(0.01, err / (32 * Math.max(1, m)));
        st.srcP = st.conserve || err >= 0 ? 0 : Math.min(0.01, -err / (32 * Math.max(1, 6 * N - m)));
      }
    } else if (st.frameNo % 30 === 0) {
      pass('reduce', live.a, red);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, red.f);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.readPixels(0, 0, red.w, red.h, gl.RGBA_INTEGER, gl.INT, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      st.pending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    }
  }

  // ---- triggers (#85): 1 burst (now), 2 big burst (next beat), 3 freeze (hold, now), 4 scatter (next beat)
  function press(slot, holdMs = 0, now = performance.now()) {
    const e = { t: now, slot: `trigger${slot}`, holdMs, firedAt: null, quantisedTo: null, fired: null };
    st.triggerLog.push(e); if (st.triggerLog.length > 256) st.triggerLog.shift();
    st.trig.push({ slot, e, holdMs });
    return true;
  }
  function release(slot, now = performance.now()) {
    if (slot !== 3) return false;
    st.frozen = false; st.triggerEnv[2] = 0;
    const e = [...st.triggerLog].reverse().find(x => x.slot === 'trigger3'); if (e && !e.holdMs) e.holdMs = now - e.t;
    return true;
  }

  function frame({ target = null, beats, bpb = 4, bpm = 120, controls: ctl, kicks = 0, hat = 0, now = performance.now() }) {
    if (!gl) return;
    st.frameNo++;
    st.conserve = !!ctl.conserve;
    const spb = STEPS_PER_BEAT[Math.min(3, Math.floor(ctl.tempo * 4))];
    const stepsPerSec = spb * bpm / 60, sitesAcross = 40 + 72 * ctl.zoom;
    pollMass(ctl);

    // triggers due this frame
    for (const t of st.trig) {
      if (t.done) continue;
      const quant = t.slot === 2 || t.slot === 4;
      if (quant && t.at === undefined) { t.at = beats - Math.floor(beats) < 0.02 ? beats : Math.ceil(beats); t.e.quantisedTo = now + (t.at - beats) * 60000 / bpm; }
      if (quant && beats < t.at) continue;
      t.done = true; t.e.fired = true; t.e.firedAt = now;
      if (t.slot === 1) { const c = randomSpot(sitesAcross); burst(c[0], c[1], ctl.burstSize, 0.8, 'trigger1', now); st.triggerEnv[0] = 1; }
      else if (t.slot === 2) { const c = viewCentreAxial(); burst(c[0], c[1], 2.2 * ctl.burstSize, 0.8, 'trigger2', now); st.triggerEnv[1] = 1; }
      else if (t.slot === 3) { st.frozen = true; st.frozenF = st.f; st.triggerEnv[2] = 1; if (t.holdMs > 0) t.releaseAt = now + t.holdMs; }
      else if (t.slot === 4) { scatter(now); st.triggerEnv[3] = 1; }
    }
    for (const t of st.trig) if (t.releaseAt && now >= t.releaseAt && !t.released) { t.released = true; release(3, now); }
    st.trig = st.trig.filter(t => !t.done || (t.releaseAt && !t.released));

    // the steps the clock asks for: never backwards, at most MAX_STEPS_FRAME a frame
    const x = beats * spb, fl = Math.floor(x);
    if (st.first || spb !== st.spb || st.frozen) { st.base = st.simStep - fl; st.spb = spb; st.first = false; }
    let T = fl + st.base, f = st.frozen ? st.frozenF : x - fl;
    if (T < st.simStep) { if (T < st.simStep - 1) st.base += st.simStep - T; T = st.simStep; f = 0; }   // a step back: hold at the nodes
    let n = 0;
    while (st.simStep < T && n < MAX_STEPS_FRAME) { stepLattice(live, st.simStep, st.seed, st.srcP, st.sinkP); st.simStep++; n++; }
    if (st.simStep < T) st.base -= T - st.simStep;   // a jump ahead: drop the backlog, keep the phase
    st.f = f;

    // the music: a burst per kick reached this frame; the drop (bar 0 of each section) a big one in the middle
    for (let k = 0; k < kicks; k++) { const c = randomSpot(sitesAcross); burst(c[0], c[1], ctl.burstSize, 0.8, 'kick', now); }
    const section = Math.floor(beats / (SECTION_BARS * bpb));
    if (st.lastSection !== null && section === st.lastSection + 1) { const c = viewCentreAxial(); burst(c[0], c[1], 2.2 * ctl.burstSize, 0.85, 'drop', now); }
    st.lastSection = section; st.lastBeats = beats;
    const dt = st.lastNow ? Math.min(0.1, (now - st.lastNow) / 1000) : 0; st.lastNow = now;
    st.burstEnv *= Math.exp(-dt / 0.35);
    for (let i = 0; i < 4; i++) if (i !== 2) st.triggerEnv[i] *= Math.exp(-dt / 0.4);

    // draw
    const fw = target ? target.width : W, fh = target ? target.height : H;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null); gl.viewport(0, 0, fw, fh);
    const u = U.render; gl.useProgram(P.render);
    gl.uniform2i(u.uN, NQ, NR); gl.uniform1ui(u.uStep, st.simStep >>> 0); gl.uniform1ui(u.uSeed, st.seed >>> 0);
    const [cx, cy] = camWorld();
    gl.uniform2f(u.uCam, cx, cy); gl.uniform2f(u.uRes, fw, fh); gl.uniform1f(u.uScale, sitesAcross / Math.max(1, fw));
    gl.uniform1f(u.uF, f);
    const sparkGain = ctl.sparks * (0.6 + 0.9 * Math.max(0, Math.min(1, hat))) * Math.min(1, SPARK_STEPS_PER_S / Math.max(1, stepsPerSec));
    gl.uniform1f(u.uSpark, sparkGain); gl.uniform1f(u.uNode, ctl.nodes); gl.uniform1f(u.uExposure, ctl.exposure);
    gl.uniform3fv(u.uHue, new Float32Array(huesAt(ctl.palette, ctl.dotLum).flat()));
    gl.uniform4f(u.uBurst, st.burstAt[0], st.burstAt[1], st.burstAt[2], st.burstEnv);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, live.a.t);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);

    st.view = { scene: 'F1', step: st.simStep, f: +f.toFixed(3), stepsPerBeat: spb, stepsPerSec: +stepsPerSec.toFixed(2), stepsThisFrame: n,
      sitesAcross: +sitesAcross.toFixed(1), density: st.mass === null ? null : +(st.mass / (6 * NQ * NR)).toFixed(4), target: ctl.density,
      frozen: st.frozen, conserve: st.conserve, bars: beats / bpb, section, spark: +sparkGain.toFixed(3) };
    st.metrics = { mass: st.mass, massAt: st.massAt, momentum: [st.pq, st.pr], srcP: st.srcP, sinkP: st.sinkP, bursts: st.rings.length };
  }

  // ---- QA truths
  // truth 1: a periodic lattice with no source, sink or edits keeps mass and momentum exactly every step, on the
  // GPU; and its state after `steps` steps equals the CPU reference bit for bit (so the GPU runs 26-fhp.mjs's rules)
  function conserveTest({ n = 120, seeds = 6, steps = 40, d = 0.25 } = {}) {
    const rows = [], rt = reduceTex(n, n);
    for (let k = 0; k < seeds; k++) {
      const seed = 1000 + 17 * k, S0 = F.randomLattice(n, n, d, seed), L = lattice(n, n, S0), ref = F.massMomentum(S0);
      let worst = 0, momentumOk = true;
      for (let t = 0; t < steps; t++) {
        stepLattice(L, t, seed);
        const m = reduceSync(L, rt);
        worst = Math.max(worst, Math.abs(m.mass - ref.mass));
        if (m.pq !== ref.pq || m.pr !== ref.pr) momentumOk = false;
      }
      const gpu = readState(L);
      let S = S0, T = new Uint8Array(S0.length); for (let t = 0; t < steps; t++) { F.stepCPU(S, n, n, t, seed, T); [S, T] = [T, S]; }
      let diff = 0; for (let i = 0; i < S.length; i++) if (S[i] !== gpu[i]) diff++;
      rows.push({ seed, mass: ref.mass, massDrift: worst, momentum: [ref.pq, ref.pr], momentumOk, cpuDiffSites: diff });
      freeLattice(L);
    }
    freeTex(rt); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const lut = F.checkLut();
    return { ok: lut.ok && rows.every(r => r.massDrift === 0 && r.momentumOk && r.cpuDiffSites === 0), lutOk: lut.ok, n, steps, rows };
  }
  // truth 3: weak pulses (amp ≤ 0.1) on a d = 0.25 lattice, 64 rings averaged; ring radius at steps 20 and 40
  function soundSpeed({ n = 768, spacing = 96, amp = 0.1, radius = 5, d = 0.25, seed = 7, t1 = 20, t2 = 40 } = {}) {
    const { S, centres } = F.pulseLattice({ nq: n, nr: n, d, amp, radius, spacing, seed });
    const L = lattice(n, n, S), pk = colourTex(n / 4, n, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    const asState = c => { const o = new Uint8Array(c.length); for (let i = 0; i < c.length; i++) o[i] = (1 << c[i]) - 1; return o; };
    let r1 = null;
    for (let t = 0; t < t2; t++) {
      stepLattice(L, t, seed);
      if (t + 1 === t1) r1 = F.ringRadius(F.ringProfile(asState(readCounts(L, pk)), n, n, centres, spacing).E);
    }
    const prof = F.ringProfile(asState(readCounts(L, pk)), n, n, centres, spacing), r2 = F.ringRadius(prof.E);
    freeLattice(L); freeTex(pk); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const speed = (r2.centroid - r1.centroid) / (t2 - t1), theory = Math.SQRT1_2;
    return { ok: Math.abs(speed - theory) / theory <= 0.1, speed: +speed.toFixed(4), speedPeak: +((r2.peak - r1.peak) / (t2 - t1)).toFixed(4), theory: +theory.toFixed(4),
      relErr: +((speed - theory) / theory).toFixed(4), rings: centres.length, amp, r1, r2, profile: Array.from(prof.E, v => +v.toFixed(4)) };
  }
  function check(fresh = false) {
    if (fresh || !st.qaCache.t1) st.qaCache.t1 = conserveTest();
    if (fresh || !st.qaCache.t3) st.qaCache.t3 = soundSpeed();
    const lut = F.checkLut();
    return { t1: st.qaCache.t1, t3: st.qaCache.t3, lut: { ok: lut.ok, changed: lut.changed }, ok: st.qaCache.t1.ok && st.qaCache.t3.ok && lut.ok };
  }

  return {
    id: '26-lattice-gas', title: '26 · Lattice Gas',
    init, resize, frame, dispose, press, release, reset,
    trigger(name) { const i = ['burst', 'bigBurst', 'freeze', 'scatter'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: {
      get view() { return st.view; }, get metrics() { return st.metrics; }, get rings() { return st.rings; }, get step() { return st.simStep; },
      get massHistory() { return st.massHistory; },
      get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; }, lut: Array.from(F.LUT),
      mass() { const m = reduceSync(live, red); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return m.mass; },
      momentum() { const m = reduceSync(live, red); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return [m.pq, m.pr]; },
      conserveTest, soundSpeed, check,
    },
  };
}

// the #85 manifest: macros, triggers, detail inputs (the standalone page and the host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'density', label: 'density', default: 0.5, quantise: 'none' },     // 0.10–0.40 a link (0.25)
  { slot: 'macro2', name: 'tempo', label: 'steps a beat', default: 0.6, quantise: 'none' },  // 2, 4, 8, 16 (8)
  { slot: 'macro3', name: 'sparks', label: 'sparks', default: 0.5, quantise: 'none' },
  { slot: 'macro4', name: 'zoom', label: 'zoom out', default: 1 / 3, quantise: 'none' },     // 40–112 sites across (64)
];
export const TRIGGERS = [
  { slot: 'trigger1', name: 'burst', label: 'burst', key: 'Z', mode: 'tap', timing: 'now', repeats: 'restart', attackMs: 0, decayMs: 400 },
  { slot: 'trigger2', name: 'bigBurst', label: 'big burst', key: 'X', mode: 'tap', timing: 'beat', repeats: 'ignore', attackMs: 0, decayMs: 400 },
  { slot: 'trigger3', name: 'freeze', label: 'freeze', key: 'C', mode: 'hold', timing: 'now', repeats: 'restart', attackMs: 0, decayMs: 0 },
  { slot: 'trigger4', name: 'scatter', label: 'scatter', key: 'V', mode: 'tap', timing: 'beat', repeats: 'restart', attackMs: 0, decayMs: 400 },
];
export const DETAIL = [
  { name: 'palette', type: 'long', values: PALETTES, default: 'prism' },
  { name: 'seed', type: 'long', default: 1, min: 1, max: 1e6 },
  { name: 'dotLum', type: 'float', default: 0.058, min: 0.02, max: 0.12 },
  { name: 'exposure', type: 'float', default: 1, min: 0.5, max: 2 },
  { name: 'burstSize', type: 'float', default: 4, min: 2, max: 8 },
  { name: 'nodes', type: 'float', default: 0.5, min: 0, max: 1 },
];
export const stepsPerBeatOf = m => STEPS_PER_BEAT[Math.min(3, Math.floor(m * 4))];
export const densityOf = m => 0.1 + 0.3 * m;
export const sitesAcrossOf = m => 40 + 72 * m;
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['palette', 'seed'], outputs: ['burst', 'drop'],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 0.5 },
};
