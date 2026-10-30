// 16c · 27 Neon Lines: the scene as a #85 module (init / resize / frame / trigger / dispose).
// Spec: VIZ research, #37 comment 6444942841, section 16c. Maths: 16-clebsch.mjs (float64, also run by node).
//
// The Clebsch diagonal cubic is an iridescent soap film, ray-traced exactly: along a ray F is a cubic in t, so the
// shader fits it from 4 samples inside the clip ball, splits [t0, t1] at the closed-form critical points and refines
// every sign change (bisection, then Newton), compositing all real roots front to back with Fresnel and thin film.
// The 27 real lines are neon lasers (additive glow beams, clipped to the ball, with faint tails that run towards
// their vanishing points); the 10 Eckardt points are gold diamonds, the 3 at infinity drawn at their vanishing points.
// S5 choreography: even permutations glide along R(s) = exp(s·log Pσ) (3-cycles, double swaps; a 5-cycle on the
// drop), so the surface stays a smooth cubic carrying its lines all the way and lands on itself with the lines
// permuted; colour stays attached to each line. Odd permutations (transpositions) only relabel: a 1-beat mirror wipe.
// Build-up 3 → 7 → 15 → 27: the surface is P² blown up at Klein's six points in pairs c_k ± √u_k·d_k; a pair
// crossing u_k = 0 passes a nodal surface and new lines are born as twins (a soft gold flash per wall).
// The scene reads only beats and beats-per-bar from the clock (bpm is used for the trigger log only).

import * as K from './16-clebsch.mjs';

export const HOLDS = [8, 4, 2, 1, 0.5];                       // bars per glide; shapeRate 0 → 8 bars … 1 → ½ bar (as 16b)
export const holdOf = r => HOLDS[Math.max(0, Math.min(4, Math.round(r * 4)))];
export const LEVELS = [3, 7, 15, 27];
export const levelOf = v => Math.max(0, Math.min(3, Math.round(v * 3)));
export const SECTION_BARS = 32, DROP_BAR = 24;
const WALL_UP = [8, 16, 24], WALL_DOWN = [31.5, 31.25, 31];   // pair k crosses up at bar WALL_UP[k], back down at the section's end
const wallShape = y => { const x = Math.max(-1, Math.min(1, y)); return x * (1.5 - 0.5 * x * x); };   // −1 → +1 over 2 beats, 0 at the crossing
export function autoU(beats, bpb) {
  const len = SECTION_BARS * bpb, sb = ((beats % len) + len) % len;
  return [0, 1, 2].map(k => { const up = WALL_UP[k] * bpb, dn = WALL_DOWN[k] * bpb; return sb < (up + dn) / 2 ? wallShape(sb - up) : -wallShape(sb - dn); });
}
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = x => Math.max(0, Math.min(1, x));

// ---------------------------------------------------------------- the glide clock (16b's shape scheduler, plus the drop)
const newSched = () => ({ next: null, last: null, hold: null, pending: false, cause: 'auto' });
const gridOf = (hb, bpb) => (hb >= bpb ? bpb : 1);
const alignUp = (x, g) => Math.ceil(x / g - 1e-6) * g;
const morphLen = (hb, bpb, cause) => Math.min(bpb, hb / 2, cause === 'trigger' ? 1 : Infinity);
export function schedStep(s, beats, hb, bpb) {
  const g = gridOf(hb, bpb);
  if (s.next === null || beats < s.last - 1e-6 || beats - s.next > 2 * hb + bpb) {   // first frame, the clock jumped back, or far ahead
    s.hold = hb; s.cause = 'auto'; s.last = Math.floor(beats / g + 1e-6) * g; s.next = alignUp(s.last + hb, g);
  }
  if (s.pending !== false) { const p = s.pending === true ? beats : s.pending; s.pending = false; s.next = Math.floor(p + 1e-6) + 1; s.cause = 'trigger'; }
  if (hb !== s.hold) { s.hold = hb; if (s.cause === 'auto') { s.next = alignUp(s.last + hb, g); if (s.next < beats - 1e-6) s.next = alignUp(beats, g); } }
  if (beats + 1e-6 < s.next) return null;
  const ev = { beat: s.next, at: beats, cause: s.cause, hold: hb, morphBeats: morphLen(hb, bpb, s.cause) };
  s.last = s.next; s.next = alignUp(s.last + hb, g); s.cause = 'auto';
  return ev;
}

// ---------------------------------------------------------------- shaders
const MON = K.MON;
const pw = (v, n) => (n === 0 ? '' : n === 1 ? v : n === 2 ? `${v}*${v}` : `${v}*${v}*${v}`);
const term = (coef, e) => { const f = [pw('x', e[0]), pw('y', e[1]), pw('z', e[2])].filter(Boolean); return f.length ? `${coef}*${f.join('*')}` : coef; };
const FEXPR = MON.map((e, i) => term(`uC[${i}]`, e)).join(' + ');
const gradExpr = k => MON.map((e, i) => { if (!e[k]) return null; const d = e.slice(); d[k]--; return term(`${e[k].toFixed(1)}*uC[${i}]`, d); }).filter(Boolean).join(' + ');
const VS_FULL = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const SURF_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec3 uCam, uFwd, uRight, uUp, uCenter; uniform float uFocal, uRadius;
uniform float uC[20];
uniform float uTime, uThick, uFilmOp, uGold, uDim;
out vec4 o;
const float PI = 3.14159265;
const vec3 GOLD = vec3(1.0, 0.784, 0.239);
float F(vec3 p) { float x = p.x, y = p.y, z = p.z; return ${FEXPR}; }
vec3 G(vec3 p) { float x = p.x, y = p.y, z = p.z; return vec3(${gradExpr(0)}, ${gradExpr(1)}, ${gradExpr(2)}); }
vec3 film(float d) { vec3 lam = vec3(650.0, 532.0, 450.0); return 0.5 - 0.5 * cos(4.0 * PI * 1.33 * d / lam); }
float P3(vec4 a, float s) { return a.x + s * (a.y + s * (a.z + s * a.w)); }
float refine(vec4 a, float l, float r) {
  float fl = P3(a, l);
  for (int i = 0; i < 8; i++) { float m = 0.5 * (l + r), fm = P3(a, m); if ((fm < 0.0) == (fl < 0.0)) { l = m; fl = fm; } else r = m; }
  float s = 0.5 * (l + r);
  for (int i = 0; i < 3; i++) { float d = a.y + s * (2.0 * a.z + 3.0 * a.w * s); if (abs(d) > 1e-20) s = clamp(s - P3(a, s) / d, l, r); }
  return s;
}
void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 rd = normalize(uFwd * uFocal + uRight * q.x + uUp * q.y);
  vec3 bg = mix(vec3(0.008, 0.005, 0.022), vec3(0.028, 0.010, 0.052), smoothstep(1.5, 0.0, length(q)));
  vec3 oc = uCam - uCenter; float b = dot(oc, rd), c = dot(oc, oc) - uRadius * uRadius, disc = b * b - c;
  if (disc <= 0.0) { o = vec4(bg, 1.0); return; }
  float sq = sqrt(disc), t0 = max(-b - sq, 0.0), t1 = -b + sq, h = 0.5 * (t1 - t0);
  vec3 pm = uCam + 0.5 * (t0 + t1) * rd, dh = h * rd;
  // F along the ray is a cubic p(s), s in [-1, 1]: exact from 4 samples (nodes -1, -1/3, 1/3, 1)
  float f0 = F(pm - dh), f1 = F(pm - dh / 3.0), f2 = F(pm + dh / 3.0), f3 = F(pm + dh);
  float e = 0.5 * (f0 + f3), g = 0.5 * (f1 + f2), m = 0.5 * (f3 - f0), n = 0.5 * (f2 - f1);
  float a2 = (e - g) * 1.125, a1 = (27.0 * n - m) * 0.125;
  vec4 A = vec4(e - a2, a1, a2, m - a1);
  // split at the critical points (closed form), refine each sign change
  float k0 = 2.0, k1 = 2.0, sc = abs(A.y) + abs(A.z) + abs(A.w);
  if (abs(A.w) > 1e-6 * sc) { float D = A.z * A.z - 3.0 * A.w * A.y; if (D > 0.0) { float sD = sqrt(D), r1 = (-A.z - sD) / (3.0 * A.w), r2 = (-A.z + sD) / (3.0 * A.w); k0 = min(r1, r2); k1 = max(r1, r2); } }
  else if (abs(A.z) > 1e-6 * sc) k0 = -A.y / (2.0 * A.z);
  float bp[4]; bp[0] = -1.0; bp[1] = clamp(k0, -1.0, 1.0); bp[2] = clamp(k1, -1.0, 1.0); bp[3] = 1.0;
  vec3 col = vec3(0.0); float T = 1.0;
  for (int i = 0; i < 3; i++) {
    float l = bp[i], r = bp[i + 1];
    if (r - l < 1e-6) continue;
    if ((P3(A, l) < 0.0) == (P3(A, r) < 0.0)) continue;
    vec3 p = pm + refine(A, l, r) * dh;
    vec3 nrm = normalize(G(p) + vec3(1e-12));
    float cv = abs(dot(nrm, rd)), fr = pow(1.0 - cv, 3.0);
    float d = uThick * (0.62 + 0.30 * nrm.y + 0.18 * sin(7.0 * dot(p, vec3(0.6, 0.5, 0.7)) + 0.7 * uTime));
    float alpha = uFilmOp * (0.10 + 0.55 * fr);
    vec3 em = film(d) * (0.20 + 1.10 * fr) + GOLD * uGold * 0.6;
    col += T * alpha * em; T *= 1.0 - alpha;
  }
  o = vec4(bg * T + col * uDim, 1.0);
}`;
const LINE_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeg; layout(location = 1) in vec4 aInt; layout(location = 2) in vec4 aHue;
uniform vec2 uRes;
out vec2 vP; flat out vec4 vSeg; flat out vec4 vInt; flat out vec4 vHue;
void main() {
  vec2 a = aSeg.xy, b = aSeg.zw, d = b - a; float L = length(d);
  vec2 t = L > 1e-3 ? d / L : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
  float R = aInt.w * 3.0 + aInt.z * 2.0;
  int c = gl_VertexID == 3 ? 0 : gl_VertexID == 4 ? 2 : gl_VertexID == 5 ? 3 : gl_VertexID;
  float along = (c == 1 || c == 2) ? 1.0 : 0.0, side = c >= 2 ? 1.0 : -1.0;
  vec2 p = mix(a - t * R, b + t * R, along) + n * side * R;
  vP = p; vSeg = aSeg; vInt = aInt; vHue = aHue;
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;
const LINE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uFlow, uHueShift, uWipe, uWipeOn, uGain, uGold;
uniform vec3 uPal[4];
in vec2 vP; flat in vec4 vSeg; flat in vec4 vInt; flat in vec4 vHue;
out vec4 o;
vec3 pal(float h) { h = fract(h) * 4.0; int i = int(floor(h)); float f = fract(h); f = f * f * (3.0 - 2.0 * f); return mix(uPal[i], uPal[(i + 1) % 4], f); }
void main() {
  vec2 a = vSeg.xy, d = vSeg.zw - a;
  float u = clamp(dot(vP - a, d) / max(dot(d, d), 1e-6), 0.0, 1.0), dist = length(vP - (a + u * d));
  float w = vInt.z, g = vInt.w, I = mix(vInt.x, vInt.y, u) * vHue.z;
  float core = exp(-(dist * dist) / (w * w)), halo = exp(-dist / g);
  float h = vHue.x;
  if (uWipeOn > 0.5 && dot(vP / uRes.y, vec2(0.857, 0.514)) > uWipe) h = vHue.y;
  vec3 c = pal(h + uHueShift + 0.09 * sin(6.2832 * (1.5 * u - uFlow) + vHue.w));
  c = mix(c, vec3(1.0, 0.784, 0.239), 0.5 * uGold);
  o = vec4(c * I * uGain * (1.6 * core + 0.30 * halo), 1.0);
}`;
const DIAM_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aD;   // x, y (GL px), size px, intensity
uniform vec2 uRes; uniform float uSpin;
out vec2 vQ; flat out float vI;
void main() {
  int c = gl_VertexID == 3 ? 0 : gl_VertexID == 4 ? 2 : gl_VertexID == 5 ? 3 : gl_VertexID;
  vec2 k = vec2((c == 1 || c == 2) ? 1.0 : -1.0, c >= 2 ? 1.0 : -1.0) * 4.0;
  vQ = k; vI = aD.w;
  gl_Position = vec4((aD.xy + k * aD.z) / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;
const DIAM_FS = `#version 300 es
precision highp float;
uniform float uSpin;
in vec2 vQ; flat in float vI;
out vec4 o;
void main() {
  float cs = cos(uSpin), sn = sin(uSpin); vec2 q = mat2(cs, sn, -sn, cs) * vQ;
  float d = abs(q.x) + abs(q.y);
  float facet = 0.75 + 0.25 * sign(q.x * q.y);
  float core = smoothstep(1.0, 0.85, d) * facet, halo = exp(-max(d - 1.0, 0.0) * 1.6) * 0.35;
  float spark = exp(-abs(vQ.x) * 14.0) * exp(-abs(vQ.y) * 0.9) + exp(-abs(vQ.y) * 14.0) * exp(-abs(vQ.x) * 0.9);
  o = vec4(vec3(1.0, 0.784, 0.239) * vI * (1.4 * core + halo + 0.5 * spark), 1.0);
}`;
const FB_FS = `#version 300 es
precision highp float;
uniform sampler2D uCur, uPrev; uniform vec2 uRes; uniform float uDecay, uZoomFb;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 prev = texture(uPrev, (uv - 0.5) / uZoomFb + 0.5).rgb * uDecay, cur = texture(uCur, uv).rgb;
  o = vec4(max(cur, prev), 1.0);
}`;
const SHOW_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uRes, uOff; uniform float uOpacity;
out vec4 o;
void main() {
  vec3 c = texture(uSrc, (gl_FragCoord.xy - uOff) / uRes).rgb;
  float m = max(max(c.r, c.g), c.b);
  if (m > 0.0) c *= min(0.97, 1.25 * m / (1.0 + m)) / m;   // max-channel tone map: hue and saturation kept, never above 0.97
  o = vec4(pow(c, vec3(1.0 / 2.2)) * uOpacity, 1.0);
}`;

// 60s poster palette, cyclic: magenta, tangerine, acid green, cobalt; gold for the diamonds and walls
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => c.map(v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
export const PALETTE = ['#FF1F8E', '#FF8C1A', '#B6FF1A', '#1F4BFF'];
const PAL_LIN = PALETTE.flatMap(h => lin(hex(h)));
// a line's hue on the palette: the 15-line orbit sits on magenta → tangerine, the 12-line orbit on acid → cobalt
export const hueOf = j => (j < 15 ? (j / 15) * 0.25 : 0.5 + ((j - 15) / 12) * 0.25);

// ---------------------------------------------------------------- the scene
export function createScene() {
  let gl = null, W = 0, H = 0, progs = null, vao = null, lineBuf = null, diamBuf = null, T = null, pingA = true;
  const lineData = new Float32Array(27 * 3 * 12), diamData = new Float32Array(16 * 4);
  const st = {
    sched: newSched(), glide: null, pc: [0, 1, 2, 3, 4], slotOf: [...Array(27).keys()], wipe: null,
    rand: K.rng(1), lastSig: null, prevU: null, base: null, baseKey: '', prevCubic: null,
    man: { init: [1, 1, 1], moves: [[], [], []], level: 3, knob: null }, mode: 'auto', pending: [], dropAt: null, dropCount: 0,
    autoShift: 0, prevSec: null, prevURaw: null, uBlend: null, band: [null, null, null], wallCrossings: [],
    peak: { start: -1e9, att: 100, dec: 400, amp: { gold: 0, flare: 0 }, count: 0 }, mirrorAt: null,
    glides: [], walls: [], lastT: null, frames: 0,
    live: { frames: 0, maxRelF: 0, worst: null, lineCountOk: true, countsSeen: {}, eckSeen: {}, pairsChecked: 0, pairsBad: 0 },
    view: null, metrics: {}, triggerLog: [], triggerEnv: [0, 0, 0, 0], lastTrigGlide: -1e9, flareT: -1e9,
  };

  function compile(fs, vs = VS_FULL) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function target(w, h) {
    const floatOk = !!gl.getExtension('EXT_color_buffer_float');
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, floatOk ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, floatOk ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    return { t, f, w, h };
  }
  function freeTargets() { if (T) for (const x of [T.cur, T.a, T.b]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } T = null; }
  function resize(w, h) { if (T && T.w === w && T.h === h) return; freeTargets(); W = w; H = h; T = { w, h, cur: target(w, h), a: target(w, h), b: target(w, h) }; }
  function init(g, { width, height, seed = 1 }) {
    gl = g; st.rand = K.rng(seed);
    gl.getExtension('EXT_color_buffer_float'); gl.getExtension('OES_texture_float_linear');
    progs = { surf: compile(SURF_FS), line: compile(LINE_FS, LINE_VS), diam: compile(DIAM_FS, DIAM_VS), fb: compile(FB_FS), show: compile(SHOW_FS) };
    vao = gl.createVertexArray();
    lineBuf = gl.createBuffer(); diamBuf = gl.createBuffer();
    resize(width, height);
    K.kleinChart();   // the build-up chart, once (≈ tens of ms)
  }
  function dispose() {
    if (!gl) return; freeTargets();
    for (const p of Object.values(progs || {})) gl.deleteProgram(p.p);
    gl.deleteBuffer(lineBuf); gl.deleteBuffer(diamBuf); gl.deleteVertexArray(vao); gl = null;
  }

  // brightness peaks: at most 3 luminance-raising peaks a second for the whole scene (#85 mash safety);
  // a request inside the current rise merges into it, a later one inside 334 ms keeps only its motion
  function requestPeak(kind, amount, now, att = 100, dec = 450) {
    const p = st.peak;
    if (now - p.start >= 334) { p.start = now; p.att = att; p.dec = dec; p.amp = { gold: 0, flare: 0 }; p.amp[kind] = amount; p.count++; return true; }
    if (now - p.start < p.att) { p.amp[kind] = Math.max(p.amp[kind], amount); return true; }
    return false;
  }
  const peakEnv = now => { const p = st.peak, t = now - p.start; return t < 0 ? 0 : t < p.att ? t / p.att : Math.exp(-(t - p.att) / p.dec); };

  // the build-up parameter u: the song schedule (auto), the lines knob (manual) or a fixed ?u=
  function manualU(beats) {
    return [0, 1, 2].map(k => { let v = st.man.init[k]; for (const m of st.man.moves[k]) if (beats >= m.cross - 1) v = m.dir * wallShape(beats - m.cross); return v; });
  }
  function setLevel(level, beats) {
    const m = st.man; m.level = level;
    const finalSign = k => (m.moves[k].length ? m.moves[k][m.moves[k].length - 1].dir : Math.sign(m.init[k]) || -1);
    const want = [0, 1, 2].map(k => (k < level ? 1 : -1));
    const ups = [0, 1, 2].filter(k => want[k] > 0 && finalSign(k) < 0), downs = [2, 1, 0].filter(k => want[k] < 0 && finalSign(k) > 0);
    let cross = Math.floor(beats + 1e-6) + 2;   // moving from the next beat, crossing one beat later; one wall a beat
    for (const k of [...ups, ...downs]) {
      const last = m.moves[k][m.moves[k].length - 1];
      const c = Math.max(cross, last ? last.cross + 2 : -Infinity);
      m.moves[k].push({ cross: c, dir: want[k] }); cross = c + 1;
      // fold finished moves (all but the newest) into the start value
      const arr = m.moves[k], keep = [];
      arr.forEach((x, i) => { if (x.cross + 1 <= beats && i < arr.length - 1) m.init[k] = x.dir; else keep.push(x); });
      m.moves[k] = keep;
    }
  }
  function toManual(uNow) {
    const m = st.man; st.mode = 'manual'; m.init = uNow.map(v => (v > 0 ? 1 : -1)); m.moves = [[], [], []];
    m.level = m.init.filter(v => v > 0).length; m.knob = null;
  }

  // the base surface: exact Clebsch (table lines) when every pair is real at u = 1, else the build-up
  function baseFor(u) {
    const full = u.every(x => x >= 1 - 1e-12);
    const key = full ? 'full' : u.map(x => x.toFixed(12)).join(',');
    if (key === st.baseKey) return st.base;
    let base;
    if (full) base = { full: true, cubic: K.wikiCubic(), lines: K.TABLE_LINES.map((L, j) => ({ ...L, table: j, alpha: 1 })), eck: K.ECKARDT.map(e => e.X), expected: 27, pairs: 135 };
    else {
      const b = K.buildUp(u, st.prevCubic);
      st.prevCubic = b.cubic;
      // lines born at a wall fade in as their pair's u leaves 0; the line through a pair (real all the way) never fades
      const lines = b.lines.map(L => ({ ...L, alpha: L.kind === 'L' && (L.pts[0] ^ 1) === L.pts[1] ? 1 : Math.min(...L.pts.map(i => ease(u[i >> 1] / 0.35))) }));
      // meetings and Eckardt points, away from the walls (twin lines next to a wall would read as false meetings);
      // each wall is the band |u| ≤ φ⁻⁶ ≈ 0.056 (nodal cubics: 3 points collinear, 6 on a conic), so 0.1
      const an = u.every(x => Math.abs(x) >= 0.1) ? K.analyse(lines) : null;
      base = { full: false, cubic: b.cubic, lines, eck: an ? an.eckardt.map(e => e.X) : st.base ? st.base.eck : [], expected: b.expected, pairs: an ? an.pairs : null };
    }
    st.base = base; st.baseKey = key;
    return base;
  }

  function startGlide(sig, beat, len, cause, now) {
    if (st.glide) commitGlide();
    st.glide = { sig, start: beat, len: Math.max(0.25, len), cause, perf: now };
    st.lastSig = sig;
    st.glides.push({ beat, cause, type: K.cycleType(sig), len }); if (st.glides.length > 256) st.glides.shift();
    if (cause === 'trigger') st.lastTrigGlide = now;
  }
  function commitGlide() { if (!st.glide) return; st.pc = K.composePerm(st.glide.sig, st.pc); st.glide = null; }
  function pickSig(kind) {
    const pool = kind === 'drop' ? K.FIVE_CYCLES : st.rand() < 0.2 ? K.DOUBLE_SWAPS : K.THREE_CYCLES;
    for (let n = 0; n < 16; n++) {
      const s = pool[Math.floor(st.rand() * pool.length)];
      if (!st.lastSig || (s.join('') !== st.lastSig.join('') && K.composePerm(s, st.lastSig).join('') !== '01234')) return s;
    }
    return pool[0];
  }

  function press(slot, holdMs = 0, now = performance.now()) {
    const e = { t: now, slot: `trigger${slot}`, holdMs, firedAt: null, quantisedTo: null, fired: null };
    st.triggerLog.push(e); if (st.triggerLog.length > 256) st.triggerLog.shift();
    st.pending.push({ slot, e });
    return true;
  }

  // camera: orbit around the clip ball, one turn per 64 bars at speed ×1, breathing ±2 % per bar
  function camera(bars, ctl) {
    const C = [0.05, 0.05, 0.05], th = 0.6 + 2 * Math.PI * bars / 64 * ctl.speedMul, el = 0.34 + 0.12 * Math.sin(2 * Math.PI * bars / 32);
    const D = 5.5 * (1 - 0.02 * Math.sin(2 * Math.PI * bars));
    const pos = [C[0] + D * Math.cos(el) * Math.cos(th), C[1] + D * Math.sin(el), C[2] + D * Math.cos(el) * Math.sin(th)];
    const fwd = K.unit(K.subv(C, pos)), right = K.unit(K.cross(fwd, [0, 1, 0])), up = K.cross(right, fwd);
    return { pos, fwd, right, up, focal: 1 / Math.tan(19 * Math.PI / 180), C, D };
  }
  function project(cam, p) {   // chart point → GL pixels (origin bottom-left) and depth, or null behind the camera
    const v = K.subv(p, cam.pos), z = K.dot(v, cam.fwd); if (z < 0.05) return null;
    return [W / 2 + K.dot(v, cam.right) / z * cam.focal * H / 2, H / 2 + K.dot(v, cam.up) / z * cam.focal * H / 2, z];
  }
  function projectDir(cam, d) {   // a point at infinity → its vanishing point
    const z = K.dot(d, cam.fwd); if (Math.abs(z) < 1e-6) return null;
    return [W / 2 + K.dot(d, cam.right) / z * cam.focal * H / 2, H / 2 + K.dot(d, cam.up) / z * cam.focal * H / 2];
  }

  function frame({ target = null, t, beats, bpb = 4, bpm = 120, controls: ctl, now = performance.now() }) {
    resize(target ? target.width : W, target ? target.height : H);
    const dt = st.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, t - st.lastT)); st.lastT = t;
    const bars = beats / bpb, hb = holdOf(ctl.macro[0]) * bpb;
    // --- triggers, through their quantise rule
    const msPerBeat = 60000 / bpm, perfOf = b => now - (beats - b) * msPerBeat;
    const nextBeat = Math.floor(beats + 1e-6) + 1, nextBar = (Math.floor(bars + 1e-6) + 1) * bpb;
    for (const { slot, e } of st.pending.splice(0)) {
      if (slot === 1) { st.sched.pending = beats; e.quantisedTo = perfOf(nextBeat); e.target = nextBeat; e.fired = true; }
      else if (slot === 2) { if (st.dropAt === null) { st.dropAt = { beat: nextBar, e, manual: true }; e.quantisedTo = perfOf(nextBar); e.fired = true; } else e.fired = false; }
      else if (slot === 3) { if (st.mirrorAt === null && !st.wipe) { st.mirrorAt = { beat: nextBeat, e }; e.quantisedTo = perfOf(nextBeat); } else e.fired = false; }
      else if (slot === 4) { e.fired = requestPeak('flare', 1, now, 100, 600); e.firedAt = now; e.quantisedTo = now; st.flareT = now; }
    }
    // --- the song clock: 32-bar sections, the drop at bar 24 (auto's build-up and every page's drop follow it)
    const secLen = SECTION_BARS * bpb;
    let dropEv = null;
    if (st.dropAt && beats >= st.dropAt.beat) {   // trigger 2: the next bar becomes the drop (auto: the section jumps there)
      const sb = (((st.dropAt.beat + st.autoShift) % secLen) + secLen) % secLen;
      st.autoShift += DROP_BAR * bpb - sb;
      dropEv = { beat: st.dropAt.beat, cause: 'drop' }; st.dropAt.e.firedAt = now;
      if (st.mode === 'manual' && !ctl.u) { setLevel(3, beats); st.man.knob = levelOf(ctl.macro[2]); }
      st.dropAt = null; st.prevSec = beats + st.autoShift;
    }
    const sec = beats + st.autoShift, prevSec = st.prevSec === null ? sec : st.prevSec; st.prevSec = sec;
    const dropSec = Math.floor(sec / secLen) * secLen + DROP_BAR * bpb;
    if (!dropEv && prevSec < dropSec && sec >= dropSec && sec - dropSec < bpb) dropEv = { beat: beats - (sec - dropSec), cause: 'drop' };
    // --- u: the build-up state (the song schedule, the lines knob, or a fixed ?u=); a jump is eased over 250 ms
    let uRaw;
    if (ctl.u) uRaw = ctl.u.slice();
    else {
      if (ctl.variant !== st.mode) { if (ctl.variant === 'manual') toManual(st.prevU || autoU(sec, bpb)); else st.mode = 'auto'; }
      if (st.mode === 'manual') {
        const kl = levelOf(ctl.macro[2]), m = st.man;
        if (m.knob !== kl) {
          if (m.knob === null && st.frames === 0) { m.init = [0, 1, 2].map(k => (k < kl ? 1 : -1)); m.level = kl; } else setLevel(kl, beats);
          m.knob = kl;
        }
      }
      uRaw = st.mode === 'auto' ? autoU(sec, bpb) : manualU(beats);
    }
    if (st.prevURaw && Math.max(...uRaw.map((v, k) => Math.abs(v - st.prevURaw[k]))) > 0.5) st.uBlend = { from: st.prevU.slice(), t0: now };
    st.prevURaw = uRaw.slice();
    let u = uRaw;
    if (st.uBlend) { const a = ease((now - st.uBlend.t0) / 250); if (a >= 1) st.uBlend = null; else u = uRaw.map((v, k) => st.uBlend.from[k] + (v - st.uBlend.from[k]) * a); }
    if (dropEv && ctl.glides === false) dropEv = null;   // ?glides=0: the choreography stands still (QA)
    if (dropEv) {
      const len = Math.min(bpb, hb);
      startGlide(pickSig('drop'), dropEv.beat, len, 'drop', now);
      st.sched.last = dropEv.beat; st.sched.next = alignUp(dropEv.beat + Math.max(hb, len), gridOf(hb, bpb)); st.sched.cause = 'auto'; st.sched.hold = hb;
      requestPeak('flare', 0.8, now, 120, 700); st.dropCount++;
    }
    // --- glides on the shape clock (half a frame of look-ahead, as 16b)
    const ahead = beats + 0.5 * Math.min(dt || 1 / 60, 1 / 30) * bpm / 60;
    const ev = dropEv || ctl.glides === false ? null : schedStep(st.sched, ahead, hb, bpb);
    if (ev) { startGlide(pickSig(ev.cause), ev.beat, ev.morphBeats, ev.cause, now); const pe = st.triggerLog.find(x => x.slot === 'trigger1' && x.firedAt === null && x.target === ev.beat); if (pe) pe.firedAt = now; }
    if (st.glide && beats < st.glide.start - 2 * bpb) st.glide = null;   // the clock jumped back
    let s = 0;
    if (st.glide) { s = ease((beats - st.glide.start) / st.glide.len); if (s >= 1) { commitGlide(); s = 0; } }
    // --- the base surface for u, then the moving chart: H = K·M·R(s)·Pcur·M⁻¹
    const base = baseFor(u);
    if (st.mirrorAt && beats >= st.mirrorAt.beat) {   // trigger 3: a transposition relabels the lines (a mirror wipe, 1 beat)
      const e = st.mirrorAt.e; st.mirrorAt = null;
      if (base.full) {
        const tau = K.TRANSPOSITIONS[Math.floor(st.rand() * K.TRANSPOSITIONS.length)], lp = K.linePerm(tau).lines;
        const inv = K.invertPerm(st.slotOf), oldHueOfSlot = inv.map(j => hueOf(j));
        st.slotOf = st.slotOf.map(g => lp[g]);
        st.wipe = { start: beats, len: 1, oldHueOfSlot, tau }; e.fired = true; e.firedAt = now;
      } else e.fired = false;   // the build-up surface has no such symmetry
    }
    if (st.wipe && beats - st.wipe.start >= st.wipe.len) st.wipe = null;
    let Q = K.permMatrix(st.pc);
    if (st.glide && s > 0) Q = K.matMul(K.glideMatrix(st.glide.sig, s), Q);
    let Hc = K.chartOfModel(Q);
    if (ctl.chart === 'allFinite') Hc = K.matMul(K.CHART_ALL_FINITE, Hc);
    const Hinv = K.inverse(Hc), cubic = K.normCubic(K.composeCubic(base.cubic, Hinv));
    // --- walls: a soft gold flash where a pair crosses u = 0
    if (st.prevU) for (let k = 0; k < 3; k++) if ((st.prevU[k] > 0) !== (u[k] > 0)) { st.walls.push({ k, beat: beats, up: u[k] > 0 }); if (st.walls.length > 64) st.walls.shift(); requestPeak('gold', 0.55, now, 110, 380); }
    // --- wall crossings for QA (VIZ research's ruling on #124): |u_k| dips below 0.1 and comes back. Logged per
    // crossing: perf times of entering and leaving the band, of the zero crossing, and of the wall beat (the beat the
    // zero crossing rounds to, as heard). Gates: the band lasts ≤ 1 beat, the zero crossing (tCross) is within 40 ms of the
    // wall beat (VIZ research amended: tEnter leads by ~0.067 beat, ~50 ms at 80 BPM). A frame that skips the band counts.
    for (let k = 0; k < 3; k++) {
      const inside = Math.abs(u[k]) < 0.1, flipped = !!st.prevU && (st.prevU[k] > 0) !== (u[k] > 0);
      if (inside && !st.band[k]) st.band[k] = { k, bar: Math.floor(beats / bpb), tEnter: now, beatEnter: beats, tCross: null, wallBeat: null, wallBeatT: null, up: null };
      if (flipped && !st.band[k]) st.band[k] = { k, bar: Math.floor(beats / bpb), tEnter: now, beatEnter: beats, tCross: null, wallBeat: null, wallBeatT: null, up: null, skipped: true };   // jumped the band in one frame
      const c = st.band[k];
      if (c && flipped) { c.tCross = now; c.wallBeat = Math.round(beats); c.bar = Math.floor(c.wallBeat / bpb); c.wallBeatT = perfOf(c.wallBeat); c.up = u[k] > 0; }
      if (c && !inside) {
        c.tExit = now; c.beatExit = beats; st.band[k] = null;
        if (c.tCross !== null) { st.wallCrossings.push(c); if (st.wallCrossings.length > 64) st.wallCrossings.shift(); }   // a dip that turned back is not a crossing
      }
    }
    st.prevU = u.slice();
    // --- envelopes: beat pulse (30 ms attack, ≥ 120 ms tail at 180 bpm), flare and gold through the peak limiter
    const f = beats - Math.floor(beats), pulse = (1 - Math.exp(-f / 0.06)) * Math.exp(-f / 0.36) / 0.62;
    const pk = peakEnv(now), flare = st.peak.amp.flare * pk, gold = st.peak.amp.gold * pk;
    const cam = camera(bars, ctl);
    // --- lasers: each real line, clipped to the ball, plus tails that fade out towards infinity
    const R = ctl.clipRadius, RE = 0.8 * cam.D, glowK = Math.pow(ctl.macro[1], 1.2), sc = H / 1440;
    const width = (1.1 + 3.2 * glowK) * sc * (1 + 0.35 * pulse + 0.5 * flare), glow = (5 + 42 * glowK) * sc * (1 + 0.25 * pulse);
    const inten = (0.45 + 0.8 * ctl.intensity) * (1 + 0.45 * pulse + 1.1 * flare);
    const slotInv = K.invertPerm(st.slotOf);
    let nSeg = 0, nDrawn = 0, energy = 0, maxRel = 0, worst = null;
    const tailAmt = ctl.tails;
    const putSeg = (a, b, i0, i1, hueNew, hueOld, alpha, phase) => {
      const o = nSeg * 12; lineData.set([a[0], a[1], b[0], b[1], i0 * inten, i1 * inten, width, glow, hueNew, hueOld, alpha, phase], o); nSeg++;
      energy += Math.hypot(b[0] - a[0], b[1] - a[1]) * width * inten * alpha * (i0 + i1) / 2;
    };
    for (const L of base.lines) {
      const slot = base.full ? st.slotOf[L.table] : L.table, label = base.full ? L.table : slotInv[L.table];
      const Lb = base.full ? K.TABLE_LINES[slot] : L;
      const P = K.matVec(Hc, Lb.P), Qp = K.matVec(Hc, Lb.Q), wp = P[3], wq = Qp[3];
      const dirH = K.subv(K.scalev(P, wq), K.scalev(Qp, wp)), dir = dirH.slice(0, 3);
      const X = Math.abs(wp) >= Math.abs(wq) ? P : Qp;
      if (Math.abs(X[3]) < 1e-12 || K.norm(dir) < 1e-12) continue;   // a line at infinity
      const p0 = X.slice(0, 3).map(v => v / X[3]), d = K.unit(dir), oc = K.subv(p0, cam.C), b = K.dot(oc, d), cc = K.dot(oc, oc);
      const disc = b * b - (cc - R * R); if (disc <= 0) continue;
      const sq = Math.sqrt(disc), l0 = -b - sq, l1 = -b + sq, sqE = Math.sqrt(Math.max(0, b * b - (cc - RE * RE)));
      const at = l => K.addv(p0, K.scalev(d, l));
      // live truth: the drawn segment lies on the drawn surface (relative |F|, float64)
      for (const l of [l0, 0.5 * (l0 + l1), l1]) {
        const Y = [...at(l), 1], mon = K.monomials(Y); let num = 0, den = 0;
        for (let i = 0; i < 20; i++) { num += cubic[i] * mon[i]; den += Math.abs(cubic[i] * mon[i]); }
        const rel = Math.abs(num) / Math.max(den, 1e-300); if (rel > maxRel) { maxRel = rel; worst = L.label; }
      }
      const A0 = project(cam, at(l0)), A1 = project(cam, at(l1)); if (!A0 || !A1) continue;
      const hNew = hueOf(label), hOld = st.wipe && base.full ? st.wipe.oldHueOfSlot[slot] : hNew, ph = label * 0.73;
      putSeg(A0, A1, 1, 1, hNew, hOld, L.alpha, ph); nDrawn++;
      if (tailAmt > 0.01) {
        const E0 = project(cam, at(-b - sqE)), E1 = project(cam, at(-b + sqE));
        if (E0) putSeg(E0, A0, 0, tailAmt, hNew, hOld, L.alpha, ph);
        if (E1) putSeg(A1, E1, tailAmt, 0, hNew, hOld, L.alpha, ph);
      }
    }
    // --- diamonds: the Eckardt points (finite ones in perspective, the far ones at their vanishing points)
    let nD = 0;
    const dsz = ctl.diamondSize * sc * (1 + 0.12 * pulse);
    for (const E of base.eck) {
      if (nD >= 16) break;
      const Y = K.matVec(Hc, E), w = Y[3], xyz = Y.slice(0, 3), far = Math.abs(w) < 1e-9 * K.norm(xyz) || K.norm(xyz) > 40 * Math.abs(w);
      let p, size;
      if (far) { p = projectDir(cam, xyz); size = dsz * 1.15; }
      else { const q = project(cam, xyz.map(v => v / w)); p = q; size = q ? dsz * Math.max(0.5, Math.min(1.8, cam.D / q[2])) : 0; }
      if (!p || p[0] < -50 || p[0] > W + 50 || p[1] < -50 || p[1] > H + 50) continue;
      diamData.set([p[0], p[1], size, 0.9 * (1 + 0.5 * pulse + 0.8 * flare + 0.6 * gold)], nD * 4); nD++;
    }
    // --- live QA
    const lv = st.live; lv.frames++;
    if (maxRel > lv.maxRelF) { lv.maxRelF = maxRel; lv.worst = worst; }
    lv.countsSeen[base.lines.length] = (lv.countsSeen[base.lines.length] || 0) + 1;
    if (base.lines.length !== base.expected) lv.lineCountOk = false;
    lv.eckSeen[base.eck.length] = (lv.eckSeen[base.eck.length] || 0) + 1;
    if (base.pairs !== null) { lv.pairsChecked++; if (base.pairs !== { 3: 3, 7: 9, 15: 45, 27: 135 }[base.lines.length]) lv.pairsBad++; }
    lv.lastMaxRel = maxRel;
    st.view = { u, full: base.full, lines: base.lines.length, expected: base.expected, drawn: nDrawn, segments: nSeg, eckardt: base.eck.length, diamondsOnScreen: nD, glide: st.glide ? { type: K.cycleType(st.glide.sig), sig: st.glide.sig, s, cause: st.glide.cause } : null, pc: st.pc.slice(), slotOf: st.slotOf.slice(), mode: ctl.u ? 'fixed' : st.mode, level: st.man.level, hold: hb / bpb, bars, beats };
    st.metrics = { lineCount: base.lines.length, laserEnergy: energy / (W * H), glidesStarted: st.glides.length, trail: ctl.macro[3] * 0.97, pulse, flare, gold };
    st.triggerEnv[0] = st.glide && st.glide.cause === 'trigger' ? Math.sin(Math.PI * s) : 0;
    st.triggerEnv[1] = st.glide && st.glide.cause === 'drop' ? Math.max(Math.sin(Math.PI * s), flare) : 0;
    st.triggerEnv[2] = st.wipe ? clamp01((beats - st.wipe.start) / st.wipe.len) * (1 - clamp01((beats - st.wipe.start) / st.wipe.len)) * 4 : 0;
    st.triggerEnv[3] = now - st.flareT < 2000 ? flare : 0;

    // ======================= draw
    const fw = target ? target.width : W, fh = target ? target.height : H;
    resize(fw, fh);
    gl.bindVertexArray(vao); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.cur.f); gl.viewport(0, 0, W, H);
    // surface
    const sp = progs.surf, su = sp.u; gl.useProgram(sp.p);
    gl.uniform2f(su.uRes, W, H); gl.uniform3fv(su.uCam, cam.pos); gl.uniform3fv(su.uFwd, cam.fwd); gl.uniform3fv(su.uRight, cam.right); gl.uniform3fv(su.uUp, cam.up);
    gl.uniform3fv(su.uCenter, cam.C); gl.uniform1f(su.uFocal, cam.focal); gl.uniform1f(su.uRadius, R);
    gl.uniform1fv(su.uC, Float32Array.from(cubic));
    gl.uniform1f(su.uTime, t * ctl.speedMul); gl.uniform1f(su.uThick, ctl.thickness); gl.uniform1f(su.uFilmOp, ctl.film);
    gl.uniform1f(su.uGold, gold); gl.uniform1f(su.uDim, 0.6 + 0.4 * ctl.intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // lasers and diamonds, additive
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    if (nSeg) {
      const lp = progs.line, lu = lp.u; gl.useProgram(lp.p);
      gl.uniform2f(lu.uRes, W, H); gl.uniform1f(lu.uFlow, t * 0.35 * ctl.speedMul); gl.uniform1f(lu.uHueShift, ctl.hue + bars / 16 * ctl.colourSpeed);
      gl.uniform1f(lu.uWipe, st.wipe ? -0.1 + 2.3 * clamp01((beats - st.wipe.start) / st.wipe.len) : 0); gl.uniform1f(lu.uWipeOn, st.wipe ? 1 : 0);
      gl.uniform1f(lu.uGain, 1); gl.uniform1f(lu.uGold, gold); gl.uniform3fv(lu.uPal, PAL_LIN);
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, lineData.subarray(0, nSeg * 12), gl.DYNAMIC_DRAW);
      for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(i, 1); }
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nSeg);
    }
    if (nD) {
      const dp = progs.diam, du = dp.u; gl.useProgram(dp.p);
      gl.uniform2f(du.uRes, W, H); gl.uniform1f(du.uSpin, bars * Math.PI / 8);
      gl.bindBuffer(gl.ARRAY_BUFFER, diamBuf); gl.bufferData(gl.ARRAY_BUFFER, diamData.subarray(0, nD * 4), gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(0, 1);
      for (let i = 1; i < 3; i++) gl.disableVertexAttribArray(i);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nD);
    }
    for (let i = 0; i < 3; i++) { gl.vertexAttribDivisor(i, 0); gl.disableVertexAttribArray(i); }
    gl.disable(gl.BLEND);
    // neon trails: max(new, old × decay), the old one zoomed 1.002
    const src = pingA ? T.a : T.b, dst = pingA ? T.b : T.a; pingA = !pingA;
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f);
    const fp = progs.fb; gl.useProgram(fp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.cur.t); gl.uniform1i(fp.u.uCur, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.t); gl.uniform1i(fp.u.uPrev, 1);
    gl.uniform2f(fp.u.uRes, W, H); gl.uniform1f(fp.u.uDecay, ctl.macro[3] * 0.97); gl.uniform1f(fp.u.uZoomFb, 1.002);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // tone map into the target
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null); gl.viewport(0, 0, fw, fh);
    const shp = progs.show; gl.useProgram(shp.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, dst.t); gl.uniform1i(shp.u.uSrc, 0);
    gl.uniform2f(shp.u.uRes, W, H); gl.uniform2f(shp.u.uOff, 0, 0); gl.uniform1f(shp.u.uOpacity, ctl.opacity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // leave the GL state as found (#85 GL rules)
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.bindVertexArray(null); gl.useProgram(null);
    st.frames++;
  }

  // ---------------------------------------------------------------- QA: the truths, on the page's own maths
  let truthCache = null;
  function truths() {
    if (truthCache) return truthCache;
    const t0 = performance.now(), out = {};
    // 1: the 27 table lines lie on F (float64, t in [−3, 3])
    let maxF = 0; for (const [a, b, c, p, q, r] of K.TABLE) for (let t = -3; t <= 3.0001; t += 0.01) maxF = Math.max(maxF, Math.abs(K.wikiF(p + a * t, q + b * t, r + c * t)));
    out.t1 = { lines: K.TABLE.length, maxF, ok: K.TABLE.length === 27 && maxF < 1e-9 };
    // 2, 3: meetings and Eckardt points
    const an = K.analyse(K.TABLE_LINES), fin = an.eckardt.filter(e => !e.atInfinity).length;
    out.t2 = { pairs: an.pairs, affine: an.finitePairs, atInfinity: an.atInfinity, everyMeets10: an.meets.every(m => m === 10), ok: an.pairs === 135 && an.finitePairs === 126 && an.atInfinity === 9 && an.meets.every(m => m === 10) };
    const listed = K.ECKARDT.map(e => e.X), eckMatch = an.eckardt.every(e => listed.some(X => K.samePoint(X, e.X)));
    out.t3 = { points: an.eckardt.length, finite: fin, atInfinity: an.eckardt.length - fin, matchList: eckMatch, ok: an.eckardt.length === 10 && fin === 7 && eckMatch && an.eckardt.every(e => e.lines.length === 3) };
    // 4: the chart map sends model points onto F = 0; eᵢ − eⱼ go to the Eckardt points
    const r = K.rng(7); let worst4 = 0, cnt = 0;
    for (let k = 0; k < 3000; k++) {
      const a = r() * 4 - 2, b = r() * 4 - 2, c = r() * 4 - 2, s = a + b + c, A = 3 * s, B = 3 * s * s, Cq = s ** 3 - a ** 3 - b ** 3 - c ** 3, disc = B * B - 4 * A * Cq;
      if (disc < 0 || A * A < 1e-6) continue;
      for (const sg of [-1, 1]) { const x5 = (-B + sg * Math.sqrt(disc)) / (2 * A), x4 = -(s + x5), X = K.modelToChart([a, b, c, x4, x5]); if (Math.abs(X[3]) < 1e-2) continue; const v = Math.abs(K.evalCubic(K.wikiCubic(), K.unit(X))); worst4 = Math.max(worst4, v); cnt++; }
    }
    const pt = (i, j) => K.canon(K.ECKARDT.find(e => e.ij[0] === i && e.ij[1] === j).X);
    const e14 = K.samePoint(pt(1, 4), [-1 / 3, 0, 0, 1]), e15 = K.samePoint(pt(1, 5), [0, 1 / 6, 1 / 6, 1]), e45 = K.samePoint(pt(4, 5), [1 / 3, 1 / 3, 1 / 3, 1]);
    const inf = [[1, 2], [1, 3], [2, 3]].every(([i, j]) => Math.abs(pt(i, j)[3]) < 1e-12);
    const ratio = K.cubicOfModel(K.ident(5)).map((x, i) => x - K.wikiCubic()[i]).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    out.t4 = { points: cnt, maxF: worst4, e14, e15, e45, atInfinity: inf, F288: ratio, ok: worst4 < 1e-12 && e14 && e15 && e45 && inf && ratio < 1e-9 };
    // 5: S5 permutes the lines and the diamonds; orbits {15, 12} and {10}; A5 glides keep the lines on F_s
    const perms = K.allPerms(); let allOk = true;
    const parent = [...Array(27).keys()], find = x => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const eckOrbit = new Set([0]);
    for (const sig of perms) { const lp = K.linePerm(sig); if (!lp.ok) allOk = false; lp.lines.forEach((j, i) => { parent[find(i)] = find(j); }); lp.points.forEach((j, i) => { if (eckOrbit.has(i)) eckOrbit.add(j); }); }
    const sizes = {}; for (let i = 0; i < 27; i++) sizes[find(i)] = (sizes[find(i)] || 0) + 1;
    const orbits = Object.values(sizes).sort((a, b) => b - a);
    let glideF = 0, glideCoef = 0;
    for (const sig of K.A5) {
      if (sig.join('') === '01234') continue;
      for (const s of [0.13, 0.5, 0.87]) {
        const Qm = K.glideMatrix(sig, s), Hm = K.chartOfModel(Qm), Fs = K.normCubic(K.cubicOfModel(Qm));
        const Fc = K.normCubic(K.composeCubic(K.wikiCubic(), K.inverse(Hm)));
        glideCoef = Math.max(glideCoef, ...Fs.map((x, i) => Math.abs(x - Fc[i])));
        for (const L of K.TABLE_LINES) { const P = K.matVec(Hm, L.P), Qv = K.matVec(Hm, L.Q); for (let l = -3; l <= 3; l += 0.5) glideF = Math.max(glideF, Math.abs(K.evalCubic(Fs, K.unit(K.addv(P, K.scalev(Qv, l)))))); }
      }
    }
    out.t5 = { perms: perms.length, allPermute: allOk, lineOrbits: orbits, diamondOrbit: eckOrbit.size, glideMaxF: glideF, glideFormulaDiff: glideCoef,
      ok: allOk && orbits.join(',') === '15,12' && eckOrbit.size === 10 && glideF < 1e-9 && glideCoef < 1e-9 };
    // 6: build-up counts, meetings, Eckardt points; general position along the schedule's paths
    const states = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [1, 1, 1]];
    const rows = states.map(uu => { const b = K.buildUp(uu), a = K.analyse(b.lines); let mf = 0; for (const L of b.lines) for (let l = -2; l <= 2; l += 0.5) mf = Math.max(mf, Math.abs(K.evalCubic(b.cubic, K.unit(K.addv(L.P, K.scalev(L.Q, l)))))); return { u: uu, lines: b.lines.length, pairs: a.pairs, eckardt: a.eckardt.length, maxF: mf }; });
    let gp = Infinity, gpConic = Infinity, gpAt = null;
    for (const k of [0, 1, 2]) for (let i = 0; i <= 40; i++) {
      const x = -1 + i / 20; if (Math.abs(x) < 0.1) continue;   // the walls: u = 0 and |u| = φ⁻⁶ (see baseFor)
      const uu = [1, 1, -1].map((v, j) => (j < k ? 1 : j === k ? x : -1)), g = K.generalPosition(uu);
      if (g.minTriple < gp) { gp = g.minTriple; gpAt = { u: uu, triple: g.worstTriple }; }
      gpConic = Math.min(gpConic, g.conic);
    }
    out.t6 = { rows, counts: rows.map(x => x.lines), pairs: rows.map(x => x.pairs), eckardt: rows.map(x => x.eckardt), maxF: Math.max(...rows.map(x => x.maxF)),
      generalPosition: { minTriple: gp, minConic: gpConic, worst: gpAt },
      ok: rows.map(x => x.lines).join(',') === '3,7,15,27' && rows.map(x => x.pairs).join(',') === '3,9,45,135' && rows[3].eckardt === 10 && Math.max(...rows.map(x => x.maxF)) < 1e-9 };
    out.ms = performance.now() - t0;
    out.ok = out.t1.ok && out.t2.ok && out.t3.ok && out.t4.ok && out.t5.ok && out.t6.ok;
    truthCache = out;
    return out;
  }

  return {
    id: '16-neon-lines', title: '16c · 27 Neon Lines',
    init, resize, frame, dispose, press,
    trigger(name) { const i = ['next', 'drop', 'mirror', 'flare'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: { truths, get view() { return st.view; }, get live() { return st.live; }, get metrics() { return st.metrics; }, get glides() { return st.glides; },
      get walls() { return st.walls; }, get wallCrossings() { return st.wallCrossings; }, get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; }, get peaks() { return st.peak.count; },
      get drops() { return st.dropCount; }, schedStep, autoU },
  };
}

// the #85 manifest: macros, triggers, detail params (the standalone page and the host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'shapeRate', label: 'shape rate', default: 1, quantise: 'beat', snap: HOLDS.map((h, i) => ({ value: i / 4, holdBars: h })) },
  { slot: 'macro2', name: 'glow', label: 'laser glow', default: 0.5, quantise: 'none' },
  { slot: 'macro3', name: 'lines', label: 'lines', default: 1, quantise: 'beat', snap: LEVELS.map((n, i) => ({ value: i / 3, lines: n })) },
  { slot: 'macro4', name: 'trails', label: 'trails', default: 0.85, quantise: 'none' },
];
export const TRIGGERS = [
  { slot: 'trigger1', name: 'next', label: 'next glide', key: 'Z', mode: 'tap', timing: 'beat', repeats: 'restart', attackMs: 0, decayMs: 500 },
  { slot: 'trigger2', name: 'drop', label: 'drop', key: 'X', mode: 'tap', timing: 'bar', repeats: 'ignore', attackMs: 120, decayMs: 700 },
  { slot: 'trigger3', name: 'mirror', label: 'mirror', key: 'C', mode: 'tap', timing: 'beat', repeats: 'ignore', attackMs: 0, decayMs: 500 },
  { slot: 'trigger4', name: 'flare', label: 'flare', key: 'V', mode: 'tap', timing: 'now', repeats: 'restart', attackMs: 100, decayMs: 600 },
];
export const DETAIL = [
  { name: 'variant', type: 'long', values: ['auto', 'manual'], default: 'auto' },
  { name: 'chart', type: 'long', values: ['affine', 'allFinite'], default: 'affine' },
  { name: 'film', type: 'float', default: 0.55, min: 0, max: 1 },
  { name: 'filmThickness', type: 'float', default: 520, min: 150, max: 1200 },
  { name: 'clipRadius', type: 'float', default: 1.6, min: 0.6, max: 2.4 },
  { name: 'diamondSize', type: 'float', default: 11, min: 0, max: 30 },
  { name: 'tails', type: 'float', default: 0.35, min: 0, max: 1 },
];
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['film', 'tails'], outputs: ['drop armed', 'glide'],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 1 },
};
