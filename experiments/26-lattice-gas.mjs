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

const RB = 16;                               // reduction block (16 × 16 sites a texel)
// the live torus (?lattice=): 2048 × 1152 is #71's size; 1024 × 576 the accepted fallback (#155 ruling 2)
export const LATTICES = { 2048: [2048, 1152], 1024: [1024, 576] };
const MAX_STEPS_FRAME = 8;                   // more than this behind (a clock jump): drop the backlog
const STEPS_PER_BEAT = [2, 4, 8, 16];
const SECTION_BARS = 16;
const SPARK_STEPS_PER_S = 16;                // above this rate sparks dim, so a spot stays under 4 sparks a second
const LUM_W = 64, LUM_H = 36;                // the small copy of the picture for the mean luminance
// the bursts' ring hues (#71 round 2: hot, saturated, rotating per kick; linear light)
const SPLASH_HUES = [[1.0, 0.08, 0.45], [1.0, 0.42, 0.04], [1.0, 0.78, 0.08], [0.95, 0.05, 0.12], [1.0, 0.25, 0.85], [0.9, 0.55, 0.0]];

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
// F2's stirring (#165 "mix faster"): a Kolmogorov body force along link uForce.x (0, 1 or 2), varying only across
// it, so it is exactly divergence-free: sin(2π k r / NQ), sin(2π k (q + r) / NQ) or sin(2π k q / NQ) for links 0, 1,
// 2 (each constant along its own link; periodic when k NR / NQ is whole: k 16 on 2048 × 1152, 4 on truth 4's 512²).
// uForce.y the phase, uForce.z the largest flip probability (a particle against the force moves onto the link along
// it: mass kept, momentum given), uForce.w = k. 26-fhp.mjs forceAt / forceFlip mirror it.
uniform vec4 uForce;
out uint o;
void main() {
  ivec2 x = ivec2(gl_FragCoord.xy);
  uint v = 0u;
  for (int i = 0; i < 6; i++) {
    ivec2 a = wrapA(x - D[i]);
    v |= collide(a, texelFetch(uS, a, 0).r) & (1u << uint(i));
  }
  if (uForce.z > 0.0) {
    int ax = int(uForce.x + 0.5);
    float arg = uForce.w / float(uN.x) * float(ax == 0 ? x.y : ax == 1 ? x.x + x.y : x.x);
    float s = sin(6.2831853 * arg + uForce.y);
    uint hf = hash32(idxOf(x) ^ hash32(uStep * 0x2545F491u + uSeed + 0x9E37u));
    if (rand01(hf, 7u) < uForce.z * abs(s)) {
      uint along = 1u << uint(s > 0.0 ? ax : ax + 3), against = 1u << uint(s > 0.0 ? ax + 3 : ax);
      if ((v & against) != 0u && (v & along) == 0u) v = (v & ~against) | along;
    }
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
  } else if (uMode == 3) {   // stir (F2): links along the swirl filled, against it emptied (uP > 0 counter-clockwise)
    vec2 t = r > 0.5 ? vec2(-w.y, w.x) / r * sign(uP) : vec2(0.0);
    float fall = 1.0 - r / uR;
    for (int i = 0; i < 6; i++) {
      float u = rand01(h, uint(i) + 1u), a = dot(E[i], t);
      if (a > 0.5 && u < abs(uP) * fall) s |= 1u << uint(i);
      else if (a < -0.5 && u < abs(uP) * fall) s &= ~(1u << uint(i));
    }
  }
  o = s;
}`;
// F2: mass and screen momentum of 8 × 8-site blocks (RGBA16F: whole numbers ≤ 384 are exact), for the fluid view
const COARSE = HEAD + `
uniform usampler2D uS;
out vec4 o;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 8;
  vec3 acc = vec3(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) {
    uint s = texelFetch(uS, b + ivec2(i, j), 0).r;
    for (int k = 0; k < 6; k++) if (((s >> uint(k)) & 1u) != 0u) acc += vec3(1.0, E[k]);
  }
  o = vec4(acc, 1.0);
}`;
// particles per site averaged over 4 × 4-site blocks (the splash layer's density; bilinear on screen)
const DENS = HEAD + `
uniform usampler2D uS;
out vec4 o;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 4;
  float n = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) {
    uint s = texelFetch(uS, b + ivec2(i, j), 0).r;
    for (int k = 0; k < 6; k++) n += float((s >> uint(k)) & 1u);
  }
  o = vec4(n / 16.0, 0.0, 0.0, 1.0);
}`;
// the block sums averaged in time: next = mix(previous, now, uA), uA = 1 − exp(−dt / τ); mipmapped after, so a
// coarser block B = 8 · 2^lod is one textureLod away (the mip average keeps momentum / mass a velocity)
const EMA = `#version 300 es
precision highp float;
uniform sampler2D uPrevE, uCur;
uniform float uA;
out vec4 o;
void main() { ivec2 p = ivec2(gl_FragCoord.xy); o = mix(texelFetch(uPrevE, p, 0), texelFetch(uCur, p, 0), uA); }`;
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
// It draws into the persistence buffer: out = previous · uDecay + this frame's dots (linear light), so a dot that
// passes leaves a short comet and the screen holds a steady glow instead of a flash at every pass (#155 ruling 1).
const DOTS = HEAD + `
uniform usampler2D uS;
uniform sampler2D uPrev;
uniform vec2 uCam, uRes;
uniform float uScale, uF, uSpark, uNode, uDecay;
// splash contrast (#71 F1 round 2): the density excess ρ − ρ̄ of 4 × 4-site blocks lights the bursts' rings in a hot
// hue (the nearest of the last 4 bursts' rings picks it); the dots dim and desaturate as the knob goes up
uniform sampler2D uDens;
uniform float uMeanRho, uKnee, uScaleE, uSplash, uDotScale, uDesat;
uniform vec4 uB[4];      // world x, y, ring radius, weight
uniform vec4 uBH[4];     // their hues (linear), .w the 70 ms attack (a burst's density jumps at once: no flash step)
uniform vec3 uHue[6];
uniform vec4 uBurst;     // world x, y, radius, envelope
// F2: the fluid layer (the time-averaged block velocity at block size 8 · 2^uLod, carried dye on top)
uniform sampler2D uEma, uDye;
uniform vec2 uLat;       // NQ, NR
uniform float uDotsW, uFieldW, uLod, uFieldGain;
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
  vec3 col = vec3(0.0);
  if (uDotsW > 0.005) {   // the particles (F1); skipped when the zoom has faded them out
    float spark = 0.0, node = 0.0; ivec2 A, B, C;
    for (int i = 0; i < 6; i++) {
      tri(w - uF * E[i], A, B, C);
      col += site(A, w, i, spark, node) + site(B, w, i, spark, node) + site(C, w, i, spark, node);
    }
    tri(w, A, B, C);
    site(A, w, -1, spark, node); site(B, w, -1, spark, node); site(C, w, -1, spark, node);
    float fade = (1.0 - uF) * (1.0 - uF);
    col += vec3(1.0, 0.95, 0.9) * spark * fade * uSpark + vec3(0.010, 0.012, 0.022) * node * uNode;
    col *= uDotsW * uDotScale;
    col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), uDesat);
  }
  if (uSplash > 0.0 && uDotsW > 0.005) {
    float r = w.y / S3, q = w.x - 0.5 * r;
    float ex = textureLod(uDens, vec2(q, r) / uLat, 0.0).r - uMeanRho;
    float e = max(0.0, ex - uKnee) / uScaleE, lit = 1.0 - exp(-e * e);
    if (lit > 0.001) {
      vec3 hue = vec3(1.0, 0.25, 0.55); float wsum = 1.0e-3; vec3 hs = hue * 1.0e-3;
      for (int k = 0; k < 4; k++) { float d = length(w - uB[k].xy) - uB[k].z; float wk = uB[k].w * exp(-d * d / 18.0); hs += uBH[k].rgb * uBH[k].w * wk; wsum += wk; }
      col += hs / wsum * lit * uSplash * uDotsW;
    }
  }
  if (uFieldW > 0.0) {    // the fluid (F2): dye lit by the flow's speed; uFieldW carries the (1 − decay) deposit
    float r = w.y / S3, q = w.x - 0.5 * r;
    vec2 uv = vec2(q, r) / uLat;
    vec4 e = textureLod(uEma, uv, uLod);
    float sp = length(e.gb / max(e.r, 1.0e-3));
    col += textureLod(uDye, uv, 0.0).rgb * (0.3 + 4.0 * sp) * uFieldGain * uFieldW;   // ~2.8x viz-165-2 (fluid L 0.065)
  }
  vec2 bd = w - uBurst.xy;
  col += vec3(0.020, 0.012, 0.030) * uBurst.w * exp(-dot(bd, bd) / max(1.0, uBurst.z * uBurst.z));
  o = vec4(texelFetch(uPrev, ivec2(gl_FragCoord.xy), 0).rgb * uDecay + col, 1.0);
}`;
// T5 live (#171 ruling): the dye averaged over 8 × 8 texels (32-site blocks), read back without a stall
const BLOCK8 = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
out vec4 o;
void main() {
  ivec2 b = ivec2(gl_FragCoord.xy) * 8;
  vec3 s = vec3(0.0);
  for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) s += texelFetch(uSrc, b + ivec2(i, j), 0).rgb;
  o = vec4(s / 64.0, 1.0);
}`;
const VS2 = `#version 300 es
out vec2 vUv;
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); vUv = p; gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
// F2's dye, in torus coordinates (uv = (q / NQ, r / NR), wrapping): carried backwards along the block velocity by
// this frame's steps (screen → axial: dq = vx − vy / √3, dr = 2 vy / √3), and drawn slowly back toward its bands
const ADVECT = `#version 300 es
precision highp float;
uniform sampler2D uDyeOld, uEma;
uniform vec2 uLat;
uniform float uSteps, uReseed;
in vec2 vUv; out vec4 o;
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
vec3 bands(vec2 uv) {
  float t = uv.x * 5.0 + uv.y * 3.0 + 0.25 * sin(6.2831853 * uv.y * 2.0);
  float g = smoothstep(0.08, 0.3, abs(fract(t) - 0.5) * 2.0);   // dark gaps between the colours
  vec3 c = hue(fract(floor(t) * 0.37 + 0.6)) * vec3(0.55, 0.30, 0.95) + vec3(0.02);
  return c * g;
}
void main() {
  vec4 e = textureLod(uEma, vUv, 0.0);
  vec2 v = e.gb / max(e.r, 1.0e-3);
  vec2 ax = vec2(v.x - v.y / 1.7320508, v.y * 2.0 / 1.7320508);
  vec3 d = texture(uDyeOld, vUv - ax * uSteps / uLat).rgb;
  o = vec4(mix(d, bands(vUv), uReseed), 1.0);
}`;
// the bloom: the persistence buffer box-averaged down to 1/8 (every source pixel counts, so moving dots don't
// shimmer in it), then a 13-tap Gaussian each way (σ ≈ 4.5 texels ≈ 1 site at 64 sites across)
const DOWN = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uTexel;   // one source texel in uv
in vec2 vUv; out vec4 o;
void main() {
  vec3 s = vec3(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) s += texture(uSrc, vUv + (vec2(float(i), float(j)) * 2.0 - 3.0) * uTexel).rgb;
  o = vec4(s / 16.0, 1.0);
}`;
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uStep;
in vec2 vUv; out vec4 o;
void main() {
  vec3 s = vec3(0.0); float wsum = 0.0;
  for (int k = -6; k <= 6; k++) { float w = exp(-float(k * k) / 18.0); s += w * texture(uSrc, vUv + float(k) * uStep).rgb; wsum += w; }
  o = vec4(s / wsum, 1.0);
}`;
// the picture: core (the persistence buffer) + bloom, gain, saturation, a soft shoulder that never reaches white
const COMP = `#version 300 es
precision highp float;
uniform sampler2D uAcc, uBloom;
uniform vec2 uRes;
uniform float uCore, uBloomGain, uGain, uSat, uExposure;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = mix(vec3(0.0010, 0.0012, 0.0040), vec3(0.0024, 0.0016, 0.0060), uv.y);
  c += texture(uAcc, uv).rgb * uCore + texture(uBloom, uv).rgb * uBloomGain * uGain;
  float L = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = max(vec3(0.0), vec3(L) + (c - vec3(L)) * uSat);
  c = 0.94 * (1.0 - exp(-c * uExposure / 0.94));   // linear below ~0.2, never above 0.94: no clipped white
  vec3 srgb = mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
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
  let gl = null, W = 1, H = 1, vao = null, NQ = 2048, NR = 1152;
  const P = {}, U = {};
  const st = {
    seed: 1, cur: 0, simStep: 0, base: 0, spb: null, f: 0, first: true, frozen: false, frozenF: 0,
    lastBeats: null, lastSection: null, burstEnv: 0, burstAt: [0, 0, 1], rng: F.rng(1),
    mass: null, massAt: -1, pq: 0, pr: 0, srcP: 0, sinkP: 0, frameNo: 0, pending: null,
    rings: [], triggerLog: [], triggerEnv: [0, 0, 0, 0], trig: [], view: {}, metrics: {}, conserve: false, qaCache: {}, massHistory: [],
    lumMean: null, lumHistory: [], lumPending: null,
    stepAcc: 0, lastBeatsStep: null, zoom: 0, scene: 'auto', fluidQa: false, lastLod: 0, reseed: 1, coarseLog: [],
    splashes: [], splashHue: 0, splashQa: false, splashTest: null, splashLog: [], lumMedian: null,
    fluidSpb: 96, lastBpm: 120, lastBpb: 4, lastMix: 3, lastSplash: 0.8,
  };
  const fl = { coarse: null, ema: [], ei: 0, dye: [], di: 0 };   // F2's textures
  let red = null, pbo = null, lumPbo = null, mixPbo = null;
  const fx = { w: 0, h: 0, half: false, acc: [], bl: [], ai: 0, lum: null };

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('26 shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function program(name, fs, uniforms, vs = VS) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
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
  // force: null, or { axis 0–2, phase, amp } (F2's stirring; never on the QA lattices)
  function stepLattice(L, step, seed, srcP = 0, sinkP = 0, force = null) {
    pass('step', L.a, L.b, u => {
      gl.uniform1ui(u.uStep, step >>> 0); gl.uniform1ui(u.uSeed, seed >>> 0); gl.uniform1f(u.uSrcP, srcP); gl.uniform1f(u.uSinkP, sinkP);
      gl.uniform4f(u.uForce, force ? force.axis : 0, force ? force.phase : 0, force ? force.amp : 0, force ? force.k || 16 : 16);
    });
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
  // lattice (?lattice=2048|1024), scene (auto | F1 | fluid), fluidQa (?qa=fluid: F2 fully zoomed out, no stirs,
  // bursts or drops, for truth 4 and the GPU budget)
  // splashQa (?qa=splash): no kick bursts; a measured burst in the middle every 2 beats (C1–C3)
  function init(g, { width = 1, height = 1, seed = 1, conserve = false, lattice: lat = 2048, scene = 'auto', fluidQa = false, splashQa = false } = {}) {
    st.splashQa = !!splashQa;
    gl = g; W = width; H = height; st.seed = seed >>> 0 || 1; st.rng = F.rng(st.seed * 7919 + 13); st.conserve = !!conserve;
    [NQ, NR] = LATTICES[lat] || LATTICES[2048]; st.scene = scene; st.fluidQa = !!fluidQa;
    vao = gl.createVertexArray();
    program('step', STEP, ['uSrcP', 'uSinkP', 'uForce']);
    program('edit', EDIT, ['uMode', 'uC', 'uR', 'uP', 'uKey']);
    program('reduce', REDUCE, []);
    program('pack', PACK, []);
    program('dots', DOTS, ['uPrev', 'uCam', 'uRes', 'uScale', 'uF', 'uSpark', 'uNode', 'uDecay', 'uHue', 'uBurst', 'uEma', 'uDye', 'uLat', 'uDotsW', 'uFieldW', 'uLod', 'uFieldGain',
      'uDens', 'uMeanRho', 'uKnee', 'uScaleE', 'uSplash', 'uDotScale', 'uDesat', 'uB', 'uBH']);
    program('coarse', COARSE, []);
    program('dens', DENS, []);
    program('block8', BLOCK8, ['uSrc']);
    program('ema', EMA, ['uPrevE', 'uCur', 'uA']);
    program('advect', ADVECT, ['uDyeOld', 'uEma', 'uLat', 'uSteps', 'uReseed'], VS2);
    program('down', DOWN, ['uSrc', 'uTexel'], VS2);
    program('blur', BLUR, ['uSrc', 'uStep'], VS2);
    program('comp', COMP, ['uAcc', 'uBloom', 'uRes', 'uCore', 'uBloomGain', 'uGain', 'uSat', 'uExposure']);
    fx.half = !!gl.getExtension('EXT_color_buffer_float');
    lumPbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, lumPbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, LUM_W * LUM_H * 4, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    // the gas starts in the low-Mach equilibrium of a few large vortices, so the zoom out finds a flow to show
    // #165 "mix faster": about twice the vortices per axis (16 modes up to |m|, |n| ≤ 12), |u| ≤ 0.18 (FHP: ≤ 0.2)
    live = lattice(NQ, NR, F.flowLattice(NQ, NR, 0.25, st.seed, { umax: 0.18, count: 16, kMax: 12 }).S);
    if (fx.half) {   // F2 needs float render targets (the block sums are signed); without them F2 shows the particles only
      fl.coarse = flTex(NQ / 8, NR / 8, false);
      fl.ema = [flTex(NQ / 8, NR / 8, true), flTex(NQ / 8, NR / 8, true)];
      fl.dye = [flTex(NQ / 4, NR / 4, false), flTex(NQ / 4, NR / 4, false)];
      fl.dens = flTex(NQ / 4, NR / 4, false);
      fl.blk = flTex(NQ / 32, NR / 32, false);
      mixPbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, mixPbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, fl.blk.w * fl.blk.h * 16, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    }
    red = reduceTex(NQ, NR);
    pbo = gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, red.w * red.h * 16, gl.STREAM_READ); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    reset();
  }
  function resize(w, h) { W = w; H = h; }
  // an RGBA16F target in torus coordinates: linear, wrapping (REPEAT), optionally with mipmaps
  function flTex(w, h, mips) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.REPEAT);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    return { t, f, w, h, mips, levels: mips ? Math.floor(Math.log2(Math.max(w, h))) + 1 : 1 };
  }
  // F2's per-frame passes: block sums → time average (+ mipmaps) → dye carried by n steps of the flow
  // mix (#165): the dye's time-lapse factor, 1–6× (the gas is unchanged; the dye moves mix steps for each one)
  function fluidPasses(dt, n, emaMs, mix = 1) {
    if (!fl.coarse) return;
    pass('coarse', live.a, fl.coarse);
    const prev = fl.ema[fl.ei], next = fl.ema[1 - fl.ei];
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.f); gl.viewport(0, 0, next.w, next.h);
    gl.useProgram(P.ema);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, prev.t); gl.uniform1i(U.ema.uPrevE, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fl.coarse.t); gl.uniform1i(U.ema.uCur, 1);
    gl.uniform1f(U.ema.uA, st.emaPrimed ? 1 - Math.exp(-dt / Math.max(0.02, emaMs / 1000)) : 1);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, next.t); gl.generateMipmap(gl.TEXTURE_2D);
    fl.ei = 1 - fl.ei; st.emaPrimed = true;
    const dOld = fl.dye[fl.di], dNew = fl.dye[1 - fl.di];
    gl.bindFramebuffer(gl.FRAMEBUFFER, dNew.f); gl.viewport(0, 0, dNew.w, dNew.h);
    gl.useProgram(P.advect);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dOld.t); gl.uniform1i(U.advect.uDyeOld, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, next.t); gl.uniform1i(U.advect.uEma, 1);
    gl.uniform2f(U.advect.uLat, NQ, NR); gl.uniform1f(U.advect.uSteps, n * mix); gl.uniform1f(U.advect.uReseed, st.reseed);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
    fl.di = 1 - fl.di;
    st.reseed = Math.max(0.004, st.reseed * 0.9);   // a drop's reseed (1) fades back to the slow pull in ~1 s
  }
  // truth 4 (#71, gated): is the coarse-grained FHP flow divergence-free at B ≥ 16? On the live lattice the particle
  // noise is as big as the flow's own curl at B = 16 (viz-165-2: ratio 0.70, noise-limited), so the truth runs on its
  // own QA lattices: `replicas` copies of one vortex flow (umax 0.12, large modes, so the compressible part ~ Ma²
  // stays small and the differences stay accurate), each with its own particles and collision seed, stepped on the
  // GPU; the 8 × 8 block sums of the last `window` steps are added up per half of the replicas, and divCurlCross
  // takes the noise out by correlating the two halves.
  // #165 ruling (viz-165-4): next to the vortex flow, a positive control on the same GPU path: the same field turned
  // 90° (a potential flow, all divergence) must read div/curl > 10 at B = 16. Every row reports the raw RMS div and
  // curl, the unclamped cross terms (ddMean < 0 = noise-dominated) and the non-empty blocks; no blocks, or no curl in
  // the vortex flow, fails. Gated at B = 16 on the upper bound (estimate + 2σ) when it is proven there, else at B = 32.
  // #165 "mix faster": the vortex replicas also carry F2's forcing (at the knob's maximum, 0.004, so it shows:
  // the axis cycling per replica, 128-site waves as on the live torus); the potential control is unchanged.
  function fluidTest({ n = 512, replicas = 32, controlReplicas = 16, steps = 64, window = 32, umax = 0.12, kMax = 2, seed = 11, forceAmp = 0.004 } = {}) {
    if (!fx.half) return { ok: false, note: 'no float render targets: truth 4 cannot run' };
    const bw = n / 8, ct = flTex(bw, bw, false), px = new Float32Array(bw * bw * 4);
    const t0 = performance.now();
    // block sums of the last `window` steps, per half of the replicas, for one sampled flow
    const run = (field, count, salt, forced) => {
      const sums = [new Float64Array(bw * bw * 3), new Float64Array(bw * bw * 3)];
      for (let k = 0; k < count; k++) {
        const L = lattice(n, n, F.latticeFromFlow(field, n, n, 0.25, seed * 1000 + salt + k + 1)), acc = sums[k % 2];
        const force = forced && forceAmp > 0 ? { axis: Math.floor(k / 2) % 3, phase: 0.9 * Math.floor(k / 2), amp: forceAmp, k: n / 128 } : null;
        for (let t = 0; t < steps; t++) {
          stepLattice(L, t, (seed * 7919 + (salt + k) * 104729) >>> 0, 0, 0, force);
          if (t < steps - window) continue;
          pass('coarse', L.a, ct);
          gl.bindFramebuffer(gl.READ_FRAMEBUFFER, ct.f); gl.readPixels(0, 0, bw, bw, gl.RGBA, gl.FLOAT, px);
          for (let i = 0; i < bw * bw; i++) { acc[3 * i] += px[4 * i]; acc[3 * i + 1] += px[4 * i + 1]; acc[3 * i + 2] += px[4 * i + 2]; }
        }
        freeLattice(L);
      }
      return sums;
    };
    // blocks of B = 8 f: sum f × f of the 8-blocks, velocity = momentum / mass; empty blocks are counted, not used
    const at = (sums, B) => {
      const f = B / 8, w = bw / f, V = [[], []];
      let nonEmpty = 0;
      for (let h = 0; h < 2; h++) for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        let m = 0, vx = 0, vy = 0;
        for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const o = 3 * ((y * f + j) * bw + x * f + i); m += sums[h][o]; vx += sums[h][o + 1]; vy += sums[h][o + 2]; }
        if (m > 0) nonEmpty++;
        V[h].push(m > 0 ? [vx / m, vy / m] : [0, 0]);
      }
      const r = F.divCurlCross(V[0], V[1], w, w, B);
      const num = v => Number.isFinite(v) ? +v.toPrecision(4) : v;
      return { B, blocks: w * w, nonEmpty: nonEmpty / 2, ratio: num(r.ratio), ratioUpper: num(r.ratioUpper), plainRatio: num(r.plainRatio),
        divRMS: num(r.divRMS), curlRMS: num(r.curlRMS), divSignal: num(r.divSignal), curlSignal: num(r.curlSignal),
        ddMean: num(r.ddMean), ddSigma: num(r.ddSigma), ccMean: num(r.ccMean), noiseDominated: r.ddMean < 0 };
    };
    const vortex = F.flowField(n, n, seed, { umax, kMax });
    const potential = { ux: Float32Array.from(vortex.uy, v => -v), uy: Float32Array.from(vortex.ux) };   // u turned 90°
    const vs = run(vortex, replicas, 0, true), ps = run(potential, controlReplicas, 5000, false);
    freeTex(ct); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const b16 = at(vs, 16), b32 = at(vs, 32), b64 = at(vs, 64), control16 = at(ps, 16);
    const sane = b => b.nonEmpty === b.blocks && b.blocks > 0 && b.curlRMS > 0;
    const controlOk = sane(control16) && control16.divSignal > 0 && control16.ratio > 10;
    const gatedB = b16.ratioUpper < 0.1 ? 16 : b32.ratioUpper < 0.1 ? 32 : null;
    const ok = sane(b16) && sane(b32) && b16.curlSignal > 0 && controlOk && gatedB !== null;
    return { ok, gatedB, controlOk, b16, b32, b64, control16, n, replicas, controlReplicas, steps, window, umax, kMax, forceAmp, ms: Math.round(performance.now() - t0) };
  }
  // the live view's time-averaged block velocity at block size B (8 · 2^k), read back: RMS(div) / RMS(curl)
  // (report-only: noise-limited at small B, see fluidTest)
  function coarse(B = 16) {
    if (!fl.coarse) return { ok: null, note: 'no float render targets: F2 off' };
    const lod = Math.max(0, Math.round(Math.log2(B / 8))), e = fl.ema[fl.ei];
    const w = Math.max(1, e.w >> lod), h = Math.max(1, e.h >> lod), fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, e.t, lod);
    const px = new Float32Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
    const V = []; let sp = 0;
    for (let k = 0; k < w * h; k++) { const m = Math.max(1e-3, px[4 * k]), v = [px[4 * k + 1] / m, px[4 * k + 2] / m]; V.push(v); sp += Math.hypot(v[0], v[1]); }
    const r = F.divCurl(V, w, h, 8 << lod);
    return { B: 8 << lod, blocks: w * h, divRMS: +r.divRMS.toExponential(3), curlRMS: +r.curlRMS.toExponential(3), ratio: +r.ratio.toFixed(4), meanSpeed: +(sp / (w * h)).toFixed(4), ok: r.ratio < 0.1 };
  }

  // ---- the look: a persistence buffer (two, ping-pong) at the canvas size, a 1/8 bloom, a small copy for the mean
  // luminance. RGBA16F when the GPU can render to it (EXT_color_buffer_float), else RGBA8.
  function fxTex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    if (fx.half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const k of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR);
    for (const k of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    return { t, f, w, h };
  }
  function ensureFx(w, h) {
    if (fx.w === w && fx.h === h) return;
    for (const t of [...fx.acc, ...fx.bl]) freeTex(t);
    fx.acc = [fxTex(w, h), fxTex(w, h)]; fx.ai = 0;
    const bw = Math.max(1, Math.ceil(w / 8)), bh = Math.max(1, Math.ceil(h / 8));
    fx.bl = [fxTex(bw, bh), fxTex(bw, bh)];
    if (!fx.lum) fx.lum = colourTex(LUM_W, LUM_H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    fx.w = w; fx.h = h;
  }
  function blit(name, src, dst, set) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h);
    gl.useProgram(P[name]);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(U[name].uSrc, 0);
    if (set) set(U[name]);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function composite(fbo, w, h, acc, look) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h);
    const u = U.comp; gl.useProgram(P.comp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, acc.t); gl.uniform1i(u.uAcc, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fx.bl[0].t); gl.uniform1i(u.uBloom, 1);
    gl.uniform2f(u.uRes, w, h); gl.uniform1f(u.uCore, look.core); gl.uniform1f(u.uBloomGain, look.bloom);
    gl.uniform1f(u.uGain, look.gain); gl.uniform1f(u.uSat, look.sat); gl.uniform1f(u.uExposure, look.exposure);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }
  // the frame's mean luminance (report-only truth, #155 ruling 1: steady state ≥ 0.15): the same picture at
  // 64 × 36, read back without a stall, decoded to linear light
  function lumSample(acc, look) {
    if (st.lumPending) return;
    composite(fx.lum.f, LUM_W, LUM_H, acc, look);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fx.lum.f);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, lumPbo); gl.readPixels(0, 0, LUM_W, LUM_H, gl.RGBA, gl.UNSIGNED_BYTE, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    st.lumPending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  }
  function pollLum() {
    if (!st.lumPending || gl.getSyncParameter(st.lumPending, gl.SYNC_STATUS) !== gl.SIGNALED) return;
    const px = new Uint8Array(LUM_W * LUM_H * 4);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, lumPbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.deleteSync(st.lumPending); st.lumPending = null;
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = []; let s = 0;
    for (let k = 0; k < px.length; k += 4) { const l = 0.2126 * lin(px[k]) + 0.7152 * lin(px[k + 1]) + 0.0722 * lin(px[k + 2]); L.push(l); s += l; }
    L.sort((a, b) => a - b);
    st.lumMean = +(s / (LUM_W * LUM_H)).toFixed(4); st.lumMedian = +L[L.length >> 1].toFixed(4);
    st.lumHistory.push({ t: performance.now(), step: st.simStep, lum: st.lumMean, median: st.lumMedian, zoom: st.zoom }); if (st.lumHistory.length > 400) st.lumHistory.shift();
  }

  // ---- splash QA (?qa=splash, #71 round 2 C1–C3): every 2 beats a burst in the middle, the knob cycling through
  // the default, 0 and 1; a beat later (the disc has opened into a ring) the picture is read at 128 × 72 (a GPU sync: QA only): the brightest
  // ring around the burst (a radial profile) against the frame's median
  function splashQaStep(beats, now, ctl) {
    const slot = Math.floor(beats / 2);
    if (st.splashSlot === undefined) st.splashSlot = slot;
    if (slot !== st.splashSlot && (!st.splashTest || st.splashTest.measured)) {
      st.splashSlot = slot;
      const knob = [ctl.splash, 0, 1][st.splashLog.length % 3], c = viewCentreAxial();
      st.splashTest = { knob, beatAt: beats, measureAt: beats + 1, measured: false, measureNow: false, at: c };
      burst(c[0], c[1], ctl.burstSize, 0.95, 'qa-splash', now);
    }
    if (st.splashTest && !st.splashTest.measured && beats >= st.splashTest.measureAt) st.splashTest.measureNow = true;
  }
  function splashMeasure(acc, look, sitesAcross, fw, fh) {
    const T = st.splashTest; T.measureNow = false; T.measured = true;
    if (!fx.lum2) fx.lum2 = colourTex(128, 72, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE);
    composite(fx.lum2.f, 128, 72, acc, look);
    const px = new Uint8Array(128 * 72 * 4);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fx.lum2.f); gl.readPixels(0, 0, 128, 72, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    // the burst's centre on the small picture: it sits at the camera centre (viewCentreAxial), so the middle
    const cxp = 64, cyp = 36, sum = new Float64Array(40), cnt = new Float64Array(40), all = [];
    for (let y = 0; y < 72; y++) for (let x = 0; x < 128; x++) {
      const k = 4 * (y * 128 + x), l = 0.2126 * lin(px[k]) + 0.7152 * lin(px[k + 1]) + 0.0722 * lin(px[k + 2]);
      all.push(l); const r = Math.floor(Math.hypot(x + 0.5 - cxp, y + 0.5 - cyp));
      if (r < 40) { sum[r] += l; cnt[r]++; }
    }
    all.sort((a, b) => a - b);
    let ring = 0, ringR = -1; for (let r = 2; r < 40; r++) if (cnt[r] && sum[r] / cnt[r] > ring) { ring = sum[r] / cnt[r]; ringR = r; }
    const bg = all[all.length >> 1];
    st.splashLog.push({ knob: +T.knob.toFixed(2), ring: +ring.toFixed(4), ringPx: ringR, ringSites: +(ringR * sitesAcross / 128).toFixed(1), bg: +bg.toFixed(4), ratio: +(ring / Math.max(1e-4, bg)).toFixed(2) });
    if (st.splashLog.length > 60) st.splashLog.shift();
  }
  function splashSummary() {
    const by = k => st.splashLog.filter(e => Math.abs(e.knob - k) < 1e-3).map(e => e.ratio).sort((a, b) => a - b);
    const med = a => a.length ? a[a.length >> 1] : null;
    const def = med(by(st.lastSplash ?? 0.8)), r0 = med(by(0)), r1 = med(by(1));
    // C2: the frame's median luminance at the default knob (each test frame), and the page's own 64 × 36 samples in F1
    const bgDef = st.splashLog.filter(e => Math.abs(e.knob - (st.lastSplash ?? 0.8)) < 1e-3).map(e => e.bg).sort((a, b) => a - b);
    const steady = st.lumHistory.filter(h => h.zoom <= 0.02 && h.median !== undefined).map(h => h.median).sort((a, b) => a - b);
    return { c1: def, c1ok: def !== null && def >= 4, c2: med(bgDef), c2ok: bgDef.length ? med(bgDef) <= 0.05 : null, c2page: med(steady),
      c3: r0 && r1 ? +(r1 / r0).toFixed(2) : null, c3ok: r0 && r1 ? r1 / r0 >= 2 : null, n: st.splashLog.length, log: st.splashLog.slice(-9) };
  }

  // ---- T5/T6 (#165 "mix faster"): the dye's mixing half-time. A QA dye pair starts from the bands and is carried
  // by the live flow (its current time average, held still) for as many frames as it takes the 8 × 8-texel (32-site)
  // block variance to halve; the half-time in bars counts the gas's steps at the fluid rate (st.fluidSpb, bpm)
  function mixHalfTime(mix, { maxIter = 900, every = 10 } = {}) {
    if (!fl.coarse) return null;
    const w = NQ / 4, h = NR / 4, A = flTex(w, h, false), Bt = flTex(w, h, false), px = new Float32Array(w * h * 4);
    const spb = st.fluidSpb || 96, bpm = st.lastBpm || 120, bpb = st.lastBpb || 4, n = spb * bpm / 60 / 60;   // gas steps a 60 fps frame
    const ema = fl.ema[fl.ei];
    const advect = (src, dst, steps, reseed) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h); gl.useProgram(P.advect);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(U.advect.uDyeOld, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, ema.t); gl.uniform1i(U.advect.uEma, 1);
      gl.uniform2f(U.advect.uLat, NQ, NR); gl.uniform1f(U.advect.uSteps, steps); gl.uniform1f(U.advect.uReseed, reseed);
      gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0);
    };
    const blockVar = t => {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, t.f); gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, px);
      const bw = Math.floor(w / 8), bh = Math.floor(h / 8); let s = 0, s2 = 0;
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
        let m = 0;
        for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) { const k = 4 * ((by * 8 + j) * w + bx * 8 + i); m += px[k] + px[k + 1] + px[k + 2]; }
        m /= 64; s += m; s2 += m * m;
      }
      const N = bw * bh, mean = s / N; return s2 / N - mean * mean;
    };
    advect(Bt, A, 0, 1);   // the bands, fresh
    const v0 = blockVar(A);
    let src = A, dst = Bt, half = null, last = v0;
    for (let it = 1; it <= maxIter; it++) {
      advect(src, dst, n * mix, 0); [src, dst] = [dst, src];
      if (it % every === 0) { last = blockVar(src); if (last <= v0 / 2) { half = it; break; } }
    }
    freeTex(A); freeTex(Bt); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const barsPer = n / (spb * bpb);   // bars of music a frame
    return { mix, halfFrames: half, halfBars: half === null ? null : +(half * barsPer).toFixed(3), maxBars: +(maxIter * barsPer).toFixed(2),
      v0: +v0.toExponential(3), vEnd: +last.toExponential(3), stepsPerFrame: +n.toFixed(2) };
  }

  // ---- T5 live (#171 ruling): on the live page, after each drop's fresh dye, the 32-site block variance of the dye
  // is read every 6 frames (async, no stall); its peak in the first half bar is the start, the half-time in bars the
  // first sample at or below half of it. Followed for 6 bars (report-only; the live dye's slow pull back to its bands,
  // 0.4 % a frame, keeps a floor, so `endRatio` says how far it got when it never halves).
  function mixLiveSample(bars) {
    const M = st.mixLive;
    if (st.mixPending && gl.getSyncParameter(st.mixPending, gl.SYNC_STATUS) === gl.SIGNALED) {
      const w = fl.blk.w, h = fl.blk.h, px = new Float32Array(w * h * 4);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, mixPbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.deleteSync(st.mixPending); st.mixPending = null;
      let s = 0, s2 = 0; for (let k = 0; k < w * h; k++) { const m = (px[4 * k] + px[4 * k + 1] + px[4 * k + 2]) / 3; s += m; s2 += m * m; }
      const N = w * h, v = s2 / N - (s / N) * (s / N), at = st.mixPendingBars - M.dropBars;
      M.last = v; M.lastBars = +at.toFixed(3); if (M.samples.length < 200) M.samples.push([+at.toFixed(3), +v.toExponential(3)]);
      if (at <= 0.5) { if (v > M.peak) { M.peak = v; M.peakBars = at; } }
      else if (M.halfBars === null && M.peak > 0 && v <= M.peak / 2) M.halfBars = +(at - M.peakBars).toFixed(3);
    }
    if (st.mixPending || st.frameNo % 6 || bars - M.dropBars > 6) return;
    pass('block8', fl.dye[fl.di], fl.blk, v => gl.uniform1i(v.uSrc, 0));
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fl.blk.f);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, mixPbo); gl.readPixels(0, 0, fl.blk.w, fl.blk.h, gl.RGBA, gl.FLOAT, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    st.mixPending = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); st.mixPendingBars = bars;
  }
  function mixLiveSummary() {
    const M = st.mixLive; if (!M) return { halfBars: null, note: 'no drop yet' };
    return { halfBars: M.halfBars, peak: +M.peak.toExponential(3), peakBars: M.peakBars === null ? null : +M.peakBars.toFixed(3),
      followedBars: M.lastBars, endRatio: M.peak > 0 && M.last !== null ? +(M.last / M.peak).toFixed(3) : null, samples: M.samples.length, trace: M.samples.filter((_, i) => i % 5 === 0) };
  }

  function dispose() {
    if (!gl) return;
    if (live) freeLattice(live); if (red) freeTex(red);
    for (const t of [...fx.acc, ...fx.bl, ...(fx.lum ? [fx.lum] : []), ...(fx.lum2 ? [fx.lum2] : []), ...fl.ema, ...fl.dye, ...(fl.coarse ? [fl.coarse] : []), ...(fl.dens ? [fl.dens] : [])]) freeTex(t);
    if (fl.blk) freeTex(fl.blk); if (mixPbo) gl.deleteBuffer(mixPbo);
    fx.lum2 = null; fl.dens = null; fl.blk = null; mixPbo = null;
    gl.deleteBuffer(lumPbo);
    for (const p of Object.values(P)) gl.deleteProgram(p);
    gl.deleteBuffer(pbo); gl.deleteVertexArray(vao);
    gl = null;
  }
  // a fresh start (Play): an opening burst in the middle, so the scene never opens static
  function reset() {
    Object.assign(st, { first: true, lastBeats: null, lastSection: null, trig: [], frozen: false, lastBeatsStep: null, stepAcc: 0, reseed: 0.15 });
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
    st.splashes.push({ x, y, r0: R, step: st.simStep, t: now, hue: st.splashHue++ });   // its ring's hot hue (#71 round 2)
    const e = { t: now, step: st.simStep, q: +cq.toFixed(2), r: +cr.toFixed(2), x: +x.toFixed(2), y: +y.toFixed(2), radius: R, cause };
    st.rings.push(e); if (st.rings.length > 512) st.rings.shift();
    return e;
  }
  // a stir (F2): a small vortex of radius R, spin > 0 counter-clockwise (links along the swirl filled, against emptied)
  function stir(cq, cr, R, spin, cause, now) {
    if (!gl || st.conserve) return null;
    const key = F.hash32((st.simStep * 2246822519 + st.rings.length * 3266489917 + st.seed) >>> 0);
    editLattice(live, 3, cq, cr, R, spin, key);
    const e = { t: now, step: st.simStep, q: +cq.toFixed(2), r: +cr.toFixed(2), radius: +R.toFixed(1), spin, cause: cause + '-stir' };
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

  function frame({ target = null, beats, bpb = 4, bpm = 120, controls: ctl, kicks = 0, hat = 0, kick = 0, now = performance.now() }) {
    if (!gl) return;
    // the knobs this round added (a host that predates them gets the defaults)
    ctl = { splash: 0.8, mix: 3, sparks: 0.5, zoom: 1 / 3, splashGain: 0.9, force: 0.0008, maxSpb: 96, ...ctl };
    st.frameNo++;
    st.conserve = !!ctl.conserve;
    // the zoom (F2): 0 = F1's micro view, 1 = the whole torus as a fluid. Scene auto runs zoomAt's 16-bar song.
    const bars = beats / bpb;
    if (ctl.scene) st.scene = ctl.scene;
    const z = st.fluidQa || st.scene === 'fluid' ? 1 : st.scene === 'F1' ? 0 : zoomAt(bars);
    st.zoom = z;
    const sMin = 40 + 72 * ctl.zoom, sMax = Math.min(NQ, NR * F.S3 * Math.max(1, W) / Math.max(1, H));
    const sitesAcross = sMin * Math.pow(Math.max(1, sMax / sMin), z);
    // 8 → 96 steps a beat as the view becomes a fluid (#71: 8 micro, 64 fluid; #165 "mix faster": up to 96 if the
    // GPU budget allows, ?maxSpb=)
    const spb = Math.min(ctl.maxSpb, STEPS_PER_BEAT[Math.min(3, Math.floor(ctl.tempo * 4))] * Math.pow(12, z));
    // the splash look (#71 F1 round 2): QA's ?qa=splash alternates the knob between 1 and 0 per test burst (C3)
    const contrast = st.splashQa ? (st.splashTest && st.splashTest.knob !== undefined ? st.splashTest.knob : ctl.splash) : ctl.splash;
    const stepsPerSec = spb * bpm / 60;
    Object.assign(st, { fluidSpb: Math.min(ctl.maxSpb, STEPS_PER_BEAT[Math.min(3, Math.floor(ctl.tempo * 4))] * 12), lastBpm: bpm, lastBpb: bpb, lastMix: ctl.mix, lastSplash: ctl.splash });
    const fieldW = fl.coarse ? smooth01(0.25, 0.5, z) : 0, dotsW = fl.coarse ? 1 - smooth01(0.2, 0.45, z) : 1;
    const blockB = Math.max(8, sitesAcross / 32), lod = Math.min(4, Math.log2(blockB / 8));
    const dt = st.lastNow ? Math.min(0.1, (now - st.lastNow) / 1000) : 0; st.lastNow = now;
    pollMass(ctl);

    // triggers due this frame
    for (const t of st.trig) {
      if (t.done) continue;
      const quant = t.slot === 2 || t.slot === 4;
      if (quant && t.at === undefined) { t.at = beats - Math.floor(beats) < 0.02 ? beats : Math.ceil(beats); t.e.quantisedTo = now + (t.at - beats) * 60000 / bpm; }
      if (quant && beats < t.at) continue;
      t.done = true; t.e.fired = true; t.e.firedAt = now;
      if (t.slot === 1) { const c = randomSpot(sitesAcross); burst(c[0], c[1], ctl.burstSize, 0.8, 'trigger1', now); st.triggerEnv[0] = 1; }
      else if (t.slot === 2) { const c = viewCentreAxial(); burst(c[0], c[1], 1.6 * ctl.burstSize, 0.8, 'trigger2', now); st.triggerEnv[1] = 1; }
      else if (t.slot === 3) { st.frozen = true; st.frozenF = st.f; st.triggerEnv[2] = 1; if (t.holdMs > 0) t.releaseAt = now + t.holdMs; }
      else if (t.slot === 4) { scatter(now); st.triggerEnv[3] = 1; }
    }
    for (const t of st.trig) if (t.releaseAt && now >= t.releaseAt && !t.released) { t.released = true; release(3, now); }
    st.trig = st.trig.filter(t => !t.done || (t.releaseAt && !t.released));

    // the steps the clock asks for: the beats since the last frame × steps a beat (the rate follows the zoom). Never
    // backwards (a step back holds), at most MAX_STEPS_FRAME a frame (a jump ahead drops the backlog, keeps the phase)
    const db = st.lastBeatsStep === null ? 0 : beats - st.lastBeatsStep;
    st.lastBeatsStep = beats;
    if (!st.frozen && db > 0 && db < 4) st.stepAcc += db * spb;
    let n = 0;
    // F2's stirring: a Kolmogorov force in the fluid view, its axis turning every 4 bars, its phase drifting
    const force = fieldW > 0 && !st.conserve && ctl.force > 0 ? { axis: ((Math.floor(bars / 4) % 3) + 3) % 3, phase: 2 * Math.PI * bars / 16, amp: ctl.force * fieldW } : null;
    while (st.stepAcc >= 1 && n < MAX_STEPS_FRAME) { stepLattice(live, st.simStep, st.seed, st.srcP, st.sinkP, force); st.simStep++; st.stepAcc -= 1; n++; }
    if (st.stepAcc >= 1) st.stepAcc %= 1;
    const f = st.frozen ? st.frozenF : st.stepAcc;
    st.f = f;

    // the music: in the micro view a burst per kick reached this frame, in the fluid view a stir (a small vortex,
    // either way round); the drop (bar 0 of each section) a big burst and a vortex pair in the middle, and fresh dye
    // (#165: kick vortices 1.8× the spin and a larger radius; #71 round 2: bursts about 2×, fuller and wider)
    const quiet = st.fluidQa || st.splashQa;
    for (let k = 0; k < kicks && !quiet; k++) {
      const c = randomSpot(sitesAcross);
      if (z > 0.5) stir(c[0], c[1], sitesAcross / 12, (st.rng() < 0.5 ? -1 : 1) * 0.45, 'kick', now);
      else burst(c[0], c[1], ctl.burstSize, 0.95, 'kick', now);
    }
    if (st.splashQa) splashQaStep(beats, now, ctl);
    const section = Math.floor(beats / (SECTION_BARS * bpb));
    if (!quiet && st.lastSection !== null && section === st.lastSection + 1) {
      const c = viewCentreAxial(), d = sitesAcross / 12;
      burst(c[0], c[1], 1.6 * ctl.burstSize, 0.85, 'drop', now);   // 12.8 sites (was 2.2 × 4 = 8.8)
      stir(c[0] - d, c[1], sitesAcross / 10, 0.6, 'drop', now); stir(c[0] + d, c[1], sitesAcross / 10, -0.6, 'drop', now);
      st.reseed = 0.15;
      st.mixLive = { dropBars: bars, peak: 0, peakBars: null, halfBars: null, last: null, lastBars: null, samples: [] };   // T5 live
    }
    st.lastSection = section; st.lastBeats = beats;
    if (fl.coarse) fluidPasses(dt, n, ctl.emaMs, ctl.mix);   // every frame: the dye and the average stay continuous
    if (fl.blk && st.mixLive) mixLiveSample(bars);
    if (fl.dens && contrast > 0 && dotsW > 0.005) pass('dens', live.a, fl.dens);
    st.burstEnv *= Math.exp(-dt / 0.35);
    for (let i = 0; i < 4; i++) if (i !== 2) st.triggerEnv[i] *= Math.exp(-dt / 0.4);

    // draw: this frame's dots into the persistence buffer, its bloom, then the picture
    const fw = target ? target.width : W, fh = target ? target.height : H;
    ensureFx(fw, fh);
    const prev = fx.acc[fx.ai], next = fx.acc[1 - fx.ai];
    gl.bindFramebuffer(gl.FRAMEBUFFER, next.f); gl.viewport(0, 0, fw, fh);
    const u = U.dots; gl.useProgram(P.dots);
    gl.uniform2i(u.uN, NQ, NR); gl.uniform1ui(u.uStep, st.simStep >>> 0); gl.uniform1ui(u.uSeed, st.seed >>> 0);
    const [cx, cy] = camWorld();
    gl.uniform2f(u.uCam, cx, cy); gl.uniform2f(u.uRes, fw, fh); gl.uniform1f(u.uScale, sitesAcross / Math.max(1, fw));
    gl.uniform1f(u.uF, f);
    const sparkGain = ctl.sparks * (0.6 + 0.9 * Math.max(0, Math.min(1, hat))) * Math.min(1, SPARK_STEPS_PER_S / Math.max(1, stepsPerSec));
    const decay = Math.exp(-dt / Math.max(0.01, ctl.persist / 1000));
    // a still dot builds up to 1 / (1 − decay) of its frame value (freeze, slow tempos): the lattice and the burst
    // glow are scaled by (1 − decay) so they sit at their frame value; the moving dots keep theirs (a pass is ~1 frame)
    gl.uniform1f(u.uSpark, sparkGain); gl.uniform1f(u.uNode, ctl.nodes * (1 - decay)); gl.uniform1f(u.uDecay, decay);
    gl.uniform3fv(u.uHue, new Float32Array(huesAt(ctl.palette, ctl.dotLum).flat()));
    gl.uniform4f(u.uBurst, st.burstAt[0], st.burstAt[1], st.burstAt[2], st.burstEnv * (1 - decay));
    gl.uniform2f(u.uLat, NQ, NR); gl.uniform1f(u.uDotsW, dotsW); gl.uniform1f(u.uFieldW, fieldW * (1 - decay));
    gl.uniform1f(u.uLod, Math.max(0, lod)); gl.uniform1f(u.uFieldGain, ctl.fieldGain);
    // the splash layer: excess over the mean particles a site (from the mass readback), a knee at ~2σ of a 4 × 4 block
    // (σ = √(6 d (1 − d)) / 4), the dots at 100 % → 25 % and desaturated as the knob goes 0 → 1
    const dMean = st.mass === null ? ctl.density : st.mass / (6 * NQ * NR), sigma4 = Math.sqrt(6 * dMean * (1 - dMean)) / 4;
    gl.uniform1f(u.uMeanRho, 6 * dMean); gl.uniform1f(u.uKnee, 2 * sigma4); gl.uniform1f(u.uScaleE, 0.5);
    gl.uniform1f(u.uSplash, fl.dens ? ctl.splashGain * contrast * (1 - decay) : 0);
    // the dot floor (#171 ruling: C2 first, before the rings): 100 % → 20 % over the knob's 0 → 0.8, 20 % above
    gl.uniform1f(u.uDotScale, 1 - 0.8 * Math.min(1, contrast / 0.8)); gl.uniform1f(u.uDesat, 0.6 * contrast);
    const B4 = new Float32Array(16), H4 = new Float32Array(16);
    st.splashes = st.splashes.filter(s => now - s.t < 3000).slice(-4);
    st.splashes.forEach((s, k) => {
      B4.set([s.x, s.y, s.r0 + Math.min(80, 0.71 * (st.simStep - s.step)), Math.exp(-(now - s.t) / 800)], 4 * k);   // FHP's c_s ≈ 1/√2
      H4.set([...SPLASH_HUES[s.hue % SPLASH_HUES.length], 1 - Math.exp(-(now - s.t) / 70)], 4 * k);
    });
    gl.uniform4fv(u.uB, B4); gl.uniform4fv(u.uBH, H4);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, fl.dens ? fl.dens.t : null); gl.uniform1i(u.uDens, 4);
    if (fl.coarse) {
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, fl.ema[fl.ei].t); gl.uniform1i(u.uEma, 2);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, fl.dye[fl.di].t); gl.uniform1i(u.uDye, 3);
    } else { gl.uniform1i(u.uEma, 2); gl.uniform1i(u.uDye, 3); }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, prev.t); gl.uniform1i(u.uPrev, 1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, live.a.t);
    gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 3);
    for (const unit of [gl.TEXTURE2, gl.TEXTURE3, gl.TEXTURE4]) { gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.activeTexture(gl.TEXTURE0);
    fx.ai = 1 - fx.ai;
    blit('down', next, fx.bl[0], v => gl.uniform2f(v.uTexel, 1 / fw, 1 / fh));
    blit('blur', fx.bl[0], fx.bl[1], v => gl.uniform2f(v.uStep, 1.5 / fx.bl[0].w, 0));
    blit('blur', fx.bl[1], fx.bl[0], v => gl.uniform2f(v.uStep, 0, 1.5 / fx.bl[0].h));
    // the beat (#155 ruling 1): audio-in's kick envelope (τ 150 ms) lifts the bloom's gain and the saturation; the
    // core is left alone, so a dot's own step stays under the flash transition
    const pulse = Math.max(0, Math.min(1, kick));
    const look = { core: ctl.core, bloom: ctl.bloom * (1 + 0.5 * pulse), gain: 1 + 0.25 * pulse, sat: ctl.sat * (1 + 0.3 * pulse), exposure: ctl.exposure };
    composite(target ? target.fbo : null, fw, fh, next, look);
    if (st.frameNo % 30 === 15) lumSample(next, look);
    pollLum();
    if (st.splashQa && st.splashTest && st.splashTest.measureNow) splashMeasure(next, look, sitesAcross, fw, fh);

    st.view = { scene: z <= 0.02 ? 'F1' : z >= 0.98 ? 'fluid' : 'zoom', zoom: +z.toFixed(3), blockB: +blockB.toFixed(1), dotsW: +dotsW.toFixed(3), fieldW: +fieldW.toFixed(3),
      lattice: `${NQ}x${NR}`, fluidQa: st.fluidQa, step: st.simStep, f: +f.toFixed(3), stepsPerBeat: +spb.toFixed(1), stepsPerSec: +stepsPerSec.toFixed(2), stepsThisFrame: n,
      sitesAcross: +sitesAcross.toFixed(1), density: st.mass === null ? null : +(st.mass / (6 * NQ * NR)).toFixed(4), target: ctl.density,
      frozen: st.frozen, conserve: st.conserve, bars: beats / bpb, section, spark: +sparkGain.toFixed(3),
      pulse: +pulse.toFixed(3), decay: +decay.toFixed(4), lumMean: st.lumMean, lumMedian: st.lumMedian, fxFormat: fx.half ? 'RGBA16F' : 'RGBA8',
      contrast: +contrast.toFixed(2), mix: ctl.mix, force: force ? +force.amp.toExponential(2) : 0 };
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
    return { ok: Math.abs(speed - theory) / theory <= 0.1, speed: +speed.toFixed(4), speedPeak: +((r2.peak - r1.peak) / (t2 - t1)).toFixed(4),
      theory: +theory.toFixed(4),
      relErr: +((speed - theory) / theory).toFixed(4), rings: centres.length, amp, r1, r2, profile: Array.from(prof.E, v => +v.toFixed(4)) };
  }
  function check(fresh = false) {
    if (fresh || !st.qaCache.t1) st.qaCache.t1 = conserveTest();
    if (fresh || !st.qaCache.t3) st.qaCache.t3 = soundSpeed();
    const lut = F.checkLut();
    // truth 4 reads the live flow (it only means something fully zoomed out with no stirs: ?qa=fluid), once a second
    const t = performance.now();
    if (fresh || !st.qaCache.t4live || t - st.qaCache.t4live.at > 1000) {
      const b16 = coarse(16), b32 = coarse(32), b64 = coarse(64);
      st.qaCache.t4live = { at: t, b16, b32, b64, zoom: st.zoom, fluidQa: st.fluidQa };
    }
    if (fresh || !st.qaCache.t4) st.qaCache.t4 = fluidTest();
    // T5 (half-time ≤ 2 bars at the default mix) and T6 (mix knob 0 vs 1, 1× vs 6×: ≥ 3×), report-only first; only
    // meaningful once the fluid has run (the fluid variants)
    if (fresh || !st.qaCache.t5) {
      const d = mixHalfTime(st.lastMix || 3), lo = mixHalfTime(1), hi = mixHalfTime(6);
      // 1× not halved within the 900 frames: the ratio is a lower bound, 900 / the 6× half-time
      const ratio = lo && hi && hi.halfFrames ? (lo.halfFrames || 900) / hi.halfFrames : null;
      st.qaCache.t5 = { t5: d, t5ok: d && d.halfBars !== null ? d.halfBars <= 2 : false,
        t6: { lo, hi, ratio: ratio === null ? null : +ratio.toFixed(2), lowerBound: !!(lo && !lo.halfFrames) }, t6ok: ratio !== null && ratio >= 3 };
    }
    const splash = splashSummary();
    return { t1: st.qaCache.t1, t3: st.qaCache.t3, t4: st.qaCache.t4, t4live: st.qaCache.t4live, t5: st.qaCache.t5, splash, lut: { ok: lut.ok, changed: lut.changed },
      ok: st.qaCache.t1.ok && st.qaCache.t3.ok && st.qaCache.t4.ok !== false && lut.ok };
  }

  return {
    id: '26-lattice-gas', title: '26 · Lattice Gas',
    init, resize, frame, dispose, press, release, reset,
    trigger(name) { const i = ['burst', 'bigBurst', 'freeze', 'scatter'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: {
      get view() { return st.view; }, get metrics() { return st.metrics; }, get rings() { return st.rings; }, get step() { return st.simStep; },
      get massHistory() { return st.massHistory; }, get lumMean() { return st.lumMean; }, get lumHistory() { return st.lumHistory; },
      get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; }, lut: Array.from(F.LUT),
      mass() { const m = reduceSync(live, red); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return m.mass; },
      momentum() { const m = reduceSync(live, red); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return [m.pq, m.pr]; },
      conserveTest, soundSpeed, check, coarse, fluidTest, mixHalfTime, splashSummary,
      get splashLog() { return st.splashLog; }, mixLive: mixLiveSummary,
      get zoom() { return st.zoom; }, get lattice() { return [NQ, NR]; },
    },
  };
}

// the #85 manifest: macros, triggers, detail inputs (the standalone page and the host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'density', label: 'density', default: 0.5, quantise: 'none' },     // 0.10–0.40 a link (0.25)
  { slot: 'macro2', name: 'tempo', label: 'steps a beat', default: 0.6, quantise: 'none' },  // 2, 4, 8, 16 (8)
  // #71 round 2 / #165 "mix faster": the two new knobs take macro3 and macro4; sparks and F1's zoom move to detail
  { slot: 'macro3', name: 'splash', label: 'splash contrast', default: 0.8, quantise: 'none' },  // dots 100 → 25 %, rings lit
  { slot: 'macro4', name: 'mix', label: 'mix speed', default: 0.4, quantise: 'none' },          // the dye's time-lapse 1–6× (3×)
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
  { name: 'dotLum', type: 'float', default: 0.058, min: 0.02, max: 0.12 },   // a dot's own step: kept under 0.1 (flash)
  { name: 'persist', type: 'float', default: 100, min: 30, max: 300 },       // ms: the persistence buffer's decay τ
  { name: 'core', type: 'float', default: 1, min: 0, max: 2 },
  { name: 'bloom', type: 'float', default: 1.6, min: 0, max: 4 },
  { name: 'sat', type: 'float', default: 1.45, min: 0.5, max: 2.5 },
  { name: 'exposure', type: 'float', default: 1, min: 0.5, max: 2 },
  { name: 'burstSize', type: 'float', default: 8, min: 2, max: 12 },          // #71 round 2: 2× (was 4)
  { name: 'sparks', type: 'float', default: 0.5, min: 0, max: 1 },             // was macro3
  { name: 'zoom', type: 'float', default: 1 / 3, min: 0, max: 1 },             // was macro4: F1's 40–112 sites across (64)
  { name: 'splashGain', type: 'float', default: 0.9, min: 0, max: 2 },       // the rings' brightness at full contrast
  { name: 'force', type: 'float', default: 0.0008, min: 0, max: 0.004 },     // F2's Kolmogorov stirring (flip probability)
  { name: 'maxSpb', type: 'long', default: 96, min: 64, max: 128 },          // F2's steps a beat at full zoom-out
  { name: 'scene', type: 'long', values: ['auto', 'F1', 'fluid'], default: 'auto' },
  { name: 'fieldGain', type: 'float', default: 1.3, min: 0, max: 3 },          // F2: the fluid layer's brightness
  { name: 'emaMs', type: 'float', default: 150, min: 20, max: 2000 },        // F2: the block velocity's time average τ
  { name: 'nodes', type: 'float', default: 0.5, min: 0, max: 1 },
];
export const stepsPerBeatOf = m => STEPS_PER_BEAT[Math.min(3, Math.floor(m * 4))];
const smooth01 = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// F2's song (16-bar sections, #71 "build: zoom; drop: fully zoomed out"): bars 0–3 the fluid (landing after the
// drop), 4–7 back in to the particles, 8–11 F1, 12–15 the build pulls back out, faster toward the drop
export function zoomAt(bars) {
  const b = ((bars % SECTION_BARS) + SECTION_BARS) % SECTION_BARS;
  if (b < 4) return 1;
  if (b < 8) return 1 - smooth01(0, 1, (b - 4) / 4);
  if (b < 12) return 0;
  return Math.pow((b - 12) / 4, 1.6);
}
export const densityOf = m => 0.1 + 0.3 * m;
export const sitesAcrossOf = m => 40 + 72 * m;
export const mixOf = m => 1 + 5 * m;   // macro4 → the dye's time-lapse factor
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['palette', 'seed'], outputs: ['burst', 'drop'],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 0.5 },
};
