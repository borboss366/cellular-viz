// 28 · Aurora: the scene as a #85 module (init / resize / frame / press / release / dispose / reset, qa).
// The look (docs/skills/webgl-scene/SKILL.md, section 1; the trial brief's scene): curtains of northern light over a
// dark lake shore, as in a long-exposure photograph of an aurora over still water in Lapland.
//   palette  black sky; a violet fringe #7b5cff, an oxygen-green curtain #2cff9a, a crimson top #ff3b6b (colour knob
//            0); pink #ff5ad1, cyan #36d6ff, violet #9b5bff at knob 1, mixed in Oklab between
//   light    only the curtains emit; their lower edge and the folds (the sheet seen edge-on) are the bright parts, the
//            rest of the frame is black: the sky, the far shore's hills, and the lake that mirrors the curtains dimly
//   motion   within a beat: the kick sends a ripple up the curtains (a bright band climbing from the lower edge with a
//            small sideways kink); across a bar: the rays drift along the curtain and the folds travel sideways;
//            across a 16-bar section: the folds' depth, phases and the three curtains' balance move to new values
//   silence  no beat: the ripple follows the music's own kick; silence leaves a faint slow glow (28 % light, the
//            drift at 35 % speed)
// Drawing: the curtains are a grid of quads (COLS x ROWS per curtain, 3 curtains), placed in the vertex shader from the
// fold sines and blended by adding into a half-size float target; brightness rises where the sheet folds (1/slope).
// Then a small bloom chain (3 downsamples), and the final pass at full size: the hills, the lake's mirror, ACES tone
// map, sRGB by hand, ±0.5/255 dither. Maths in 28-aurora-math.mjs.
import * as M from './28-aurora-math.mjs';

const VS_FULL = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const CURTAIN_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aSV;
uniform vec3 uAmp, uFreq, uPhase;
uniform float uX0, uXS, uBase, uHeight, uLean, uBottomAmp, uBottomPhase, uTopPhase, uFoldMin, uFoldMax;
uniform vec4 uRip[${M.RIPPLE.MAX}];
out float vV; out float vS; out float vFold;
const float TAU = 6.2831853;
void main() {
  float s = aSV.x, v = aSV.y;
  vec3 arg = TAU * uFreq * s + uPhase;
  float x = uX0 + uXS * s + dot(uAmp, sin(arg));
  float dx = uXS + dot(uAmp * TAU * uFreq, cos(arg));
  float yb = uBase + uBottomAmp * sin(TAU * 1.7 * s + uBottomPhase);
  float h = uHeight * (0.78 + 0.22 * sin(TAU * 2.3 * s + uTopPhase));
  float kink = 0.0;
  for (int i = 0; i < ${M.RIPPLE.MAX}; i++) {
    float d = (v - uRip[i].x) / 0.14;
    kink += uRip[i].z * exp(-d * d) * sin(TAU * 5.0 * s + uRip[i].w);
  }
  x += uLean * v + kink;
  vV = v; vS = s; vFold = clamp(uXS / max(abs(dx), 1e-3), uFoldMin, uFoldMax);
  gl_Position = vec4(x * 2.0 - 1.0, (yb + h * v) * 2.0 - 1.0, 0.0, 1.0);
}`;
const CURTAIN_FS = `#version 300 es
precision highp float;
in float vV; in float vS; in float vFold;
uniform vec3 uFringe, uMain, uTop;
uniform float uBright, uRayOff, uRayT, uSeed;
uniform vec4 uRip[${M.RIPPLE.MAX}];
out vec4 o;
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }   // Dave Hoskins, no sin
float vnoise(float x) { float i = floor(x), f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(hash11(i + uSeed), hash11(i + 1.0 + uSeed), u); }
// a noise octave faded to its mean where it would be finer than ~2 pixels (folds squeeze the curtain)
float octave(float x) { float w = fwidth(x); return mix(vnoise(x), 0.5, smoothstep(0.25, 0.6, w)); }
void main() {
  float v = vV, s = vS;
  float prof = smoothstep(0.0, 0.035, v) * (0.12 + 0.88 * exp(-2.4 * v)) * (1.0 - smoothstep(0.82, 1.0, v));
  float r = 0.55 * octave(s * 46.0 + uRayOff) + 0.30 * octave(s * 97.0 - 1.3 * uRayOff + 7.0) + 0.15 * vnoise(s * 9.0 + uRayT);
  float rays = 0.25 + 1.1 * r * r;
  float ends = smoothstep(0.0, 0.08, s) * (1.0 - smoothstep(0.92, 1.0, s));
  float rip = 0.0;
  for (int i = 0; i < ${M.RIPPLE.MAX}; i++) { float d = (v - uRip[i].x) / 0.06; rip += uRip[i].y * exp(-d * d); }
  vec3 col = mix(uFringe, uMain, smoothstep(0.0, 0.07, v));
  col = mix(col, uTop, smoothstep(0.30, 0.85, v));
  o = vec4(col * (prof * rays * ends * vFold * uBright * (1.0 + rip)), 1.0);
}`;
// bloom: dual-Kawase style downsample (the centre and four diagonal taps, bilinear)
const DOWN_FS = `#version 300 es
precision highp float;
uniform sampler2D uSrc; uniform vec2 uDst, uSrcTexel;
out vec4 o;
void main() {
  vec2 uv = gl_FragCoord.xy / uDst, h = uSrcTexel;
  vec3 c = texture(uSrc, uv).rgb * 4.0 + texture(uSrc, uv + vec2(-h.x, -h.y)).rgb + texture(uSrc, uv + vec2(h.x, -h.y)).rgb
    + texture(uSrc, uv + vec2(-h.x, h.y)).rgb + texture(uSrc, uv + vec2(h.x, h.y)).rgb;
  o = vec4(c / 8.0, 1.0);
}`;
const FINAL_FS = `#version 300 es
precision highp float;
uniform sampler2D uAur, uB1, uB2, uB3;
uniform vec2 uRes, uT1, uT2, uT3;
uniform float uHorizon, uTime, uSeed, uFrame, uBloom, uExposure, uOpacity;
out vec4 o;
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(float x) { float i = floor(x), f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(hash11(i + uSeed), hash11(i + 1.0 + uSeed), u); }
// the far shore: low rolling hills with a ragged tree line, above the water line
float ridge(float x) {
  float h = 0.55 * vnoise(x * 2.2) + 0.25 * vnoise(x * 5.3 + 3.0) + 0.12 * vnoise(x * 13.0 + 9.0) + 0.08 * vnoise(x * 41.0 + 1.0);
  return uHorizon + 0.006 + 0.05 * h * h;
}
vec3 tent(sampler2D t, vec2 uv, vec2 h) {
  return 0.25 * (texture(t, uv + vec2(-h.x, -h.y)).rgb + texture(t, uv + vec2(h.x, -h.y)).rgb + texture(t, uv + vec2(-h.x, h.y)).rgb + texture(t, uv + vec2(h.x, h.y)).rgb);
}
vec3 sky(vec2 uv) {
  return texture(uAur, uv).rgb + uBloom * (0.45 * tent(uB1, uv, uT1) + 0.33 * tent(uB2, uv, uT2) + 0.22 * tent(uB3, uv, uT3));
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y, px = 1.0 / uRes.y;
  vec3 c;
  if (uv.y >= uHorizon) {
    float r = ridge(uv.x * aspect), land = 1.0 - smoothstep(r - px, r + px, uv.y);   // 1 on the hills
    c = sky(uv) * (1.0 - land);
  } else {
    float depth = uHorizon - uv.y;
    float wob = 0.004 * (2.0 * vnoise(uv.y * 70.0 + uTime * 0.7) - 1.0) * (0.3 + 4.0 * depth);
    vec2 m = vec2(uv.x + wob, 2.0 * uHorizon - uv.y);
    float rm = ridge(m.x * aspect);
    float land = 1.0 - smoothstep(rm - px, rm + px, m.y);
    float streak = 0.82 + 0.18 * vnoise(uv.y * 34.0 - uTime * 0.2);
    c = sky(m) * (1.0 - land) * max(0.0, 0.34 - 0.9 * depth) * streak;
  }
  c = aces(c * uExposure);
  c = srgb(c) * uOpacity;
  c += (hash12(gl_FragCoord.xy + fract(uFrame * 0.618) * 97.0) - 0.5) / 255.0;   // ±0.5/255: no banding, black stays 0
  o = vec4(max(c, 0.0), 1.0);
}`;

export function createScene() {
  let gl = null, W = 0, H = 0, progs = null, vao = null, gridBuf = null, idxBuf = null, nIdx = 0, T = null, floatOk = false;
  const ripU = new Float32Array(4 * M.RIPPLE.MAX);
  const st = {
    seed: 1, phases: M.seedPhases(1), sec: null, secN: null, act: 0, tau: 0, rayT: 0, lastT: null, prevBeats: null,
    R: M.ripplesCreate(), pending: [], triggerLog: [], triggerEnv: [0, 0], surgeT: -1e9, frames: 0, metrics: {}, view: null,
  };

  function compile(fs, vs = VS_FULL) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('28 aurora shader: ' + log); }
      gl.attachShader(p, s); gl.deleteShader(s);   // flagged: freed with the program
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('28 aurora link: ' + gl.getProgramInfoLog(p));
    const u = {}, nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  function target(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    const make = fl => gl.texImage2D(gl.TEXTURE_2D, 0, fl ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, fl ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    make(floatOk);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!ok && floatOk) { floatOk = false; gl.bindTexture(gl.TEXTURE_2D, t); make(false); ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; }   // 8 bits, dithered at the end
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null);
    if (!ok) { gl.deleteFramebuffer(f); gl.deleteTexture(t); throw new Error(`28 aurora: framebuffer ${w}x${h} incomplete`); }
    return { t, f, w, h };
  }
  function freeTargets() { if (T) for (const x of [T.aur, T.b1, T.b2, T.b3]) { gl.deleteTexture(x.t); gl.deleteFramebuffer(x.f); } T = null; }
  let scale = 0.5;
  function resize(w, h) {
    if (!gl || !(w > 0 && h > 0)) return;
    if (T && W === w && H === h && T.scale === scale) return;
    freeTargets(); W = w; H = h;
    const aw = Math.max(1, Math.round(w * scale)), ah = Math.max(1, Math.round(h * scale));
    const half = n => Math.max(1, n >> 1);
    const aur = target(aw, ah), b1 = target(half(aw), half(ah)), b2 = target(half(half(aw)), half(half(ah))), b3 = target(half(half(half(aw))), half(half(half(ah))));
    T = { aur, b1, b2, b3, scale };
  }
  function setRenderScale(s) { if (Number.isFinite(s)) { scale = Math.max(0.25, Math.min(1, s)); if (gl && W && H) { const w = W, h = H; W = 0; resize(w, h); } } return scale; }
  function init(g, { width, height, seed = 1, renderScale = 0.5 }) {
    gl = g; st.seed = Math.max(1, Math.round(+seed) || 1); st.phases = M.seedPhases(st.seed); scale = Math.max(0.25, Math.min(1, +renderScale || 0.5));
    floatOk = !!gl.getExtension('EXT_color_buffer_float');
    progs = { curtain: compile(CURTAIN_FS, CURTAIN_VS), down: compile(DOWN_FS), final: compile(FINAL_FS) };
    // the curtain grid: (s, v) on COLS x ROWS quads, shared by the three curtains
    const C = M.COLS, Rw = M.ROWS, sv = new Float32Array((C + 1) * (Rw + 1) * 2), idx = new Uint32Array(C * Rw * 6);
    for (let j = 0; j <= Rw; j++) for (let i = 0; i <= C; i++) { const k = 2 * (j * (C + 1) + i); sv[k] = i / C; sv[k + 1] = j / Rw; }
    let n = 0;
    for (let j = 0; j < Rw; j++) for (let i = 0; i < C; i++) {
      const a = j * (C + 1) + i, b = a + 1, c = a + C + 1, d = c + 1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c; idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
    nIdx = n;
    vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gridBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); gl.bufferData(gl.ARRAY_BUFFER, sv, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    resize(width, height);
    reset();
  }
  function dispose() {
    if (!gl) return;
    freeTargets();
    for (const p of Object.values(progs || {})) gl.deleteProgram(p.p);
    gl.deleteBuffer(gridBuf); gl.deleteBuffer(idxBuf); gl.deleteVertexArray(vao);
    progs = null; gridBuf = idxBuf = vao = null; gl = null; W = H = 0;
  }
  // Play pressed (or a new slot): the clock starts again, so the drift and the ripples start clean
  function reset() {
    st.R = M.ripplesCreate(); st.prevBeats = null; st.lastT = null; st.sec = null; st.secN = null; st.surgeT = -1e9; st.pending = [];
  }

  // triggers: 1 ripple (now: a ripple up every curtain, at the beat gain's middle), 2 surge (now: the curtains brighten
  // over 0.25 s and settle over 2.5 s; a press during a surge is ignored, so at most one rise every 1.2 s)
  function press(slot, holdMs = 0, now = performance.now()) {
    const e = { t: now, slot: `trigger${slot}`, holdMs, firedAt: null, quantisedTo: now, fired: null };
    st.triggerLog.push(e); if (st.triggerLog.length > 256) st.triggerLog.shift();
    if (slot !== 1 && slot !== 2) { e.fired = false; return false; }
    st.pending.push({ slot, e });
    return true;
  }
  function release() { return true; }
  const SURGE = { ATTACK_S: 0.25, RELEASE_S: 2.5, AMP: 0.55, REFRACTORY_S: 1.2 };
  const surgeEnv = age => (age < 0 ? 0 : age < SURGE.ATTACK_S ? age / SURGE.ATTACK_S : Math.exp(-(age - SURGE.ATTACK_S) / SURGE.RELEASE_S));

  function frame({ target = null, t, beats, bpb = 4, bpm = 120, controls: ctl = {}, now = performance.now(), kicks, beatWeight, energy }) {
    if (!gl) return;
    const fw = target ? target.width : W, fh = target ? target.height : H;
    resize(fw, fh);
    const tNow = Number.isFinite(t) ? t : now / 1000;
    const dt = st.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, tNow - st.lastT)); st.lastT = tNow;
    const b = Number.isFinite(beats) ? beats : 0;
    let dB = st.prevBeats === null ? 0 : b - st.prevBeats;
    const jumped = !(dB >= 0 && dB <= 4);   // the clock jumped (a seek, forceDrop, Stop): no drift, no kick from it
    if (jumped) dB = 0;
    const w = Number.isFinite(beatWeight) ? M.clamp01(beatWeight) : 1;
    const E = energy || { kick: 0, level: 0 };
    // silence and no-beat mode: the activity sets the glow and the drift
    st.act = M.activityStep(st.act, M.activityTarget(w, E.level), dt);
    const tempo = bpm > 0 ? bpm : 120;
    st.tau += (w * dB * 60 / tempo + (1 - w) * dt) * M.driftRate(st.act) * M.driftOf(ctl.drift ?? 0.5);
    st.rayT += dt * (0.3 + 0.7 * st.act);
    // the section: targets eased over ~6 s, so a jump of the clock never pops the curtains
    const secN = Math.floor(b / bpb / M.SECTION_BARS), tg = M.sectionTarget(st.seed, secN);
    if (st.sec === null) st.sec = tg.map(L => ({ amp: L.amp, shift: L.shift.slice(), bright: L.bright }));
    else st.sec.forEach((L, i) => {
      L.amp = M.smoothTo(L.amp, tg[i].amp, dt, M.SECTION_EASE_S); L.bright = M.smoothTo(L.bright, tg[i].bright, dt, M.SECTION_EASE_S);
      for (let k = 0; k < 3; k++) L.shift[k] = M.smoothTo(L.shift[k], tg[i].shift[k], dt, M.SECTION_EASE_S);
    });
    st.secN = secN;
    // the kick: the clock's kicks this frame (ages in s), else the beat crossing; no-beat: the music's own kick
    if (Array.isArray(kicks)) { for (const age of kicks) M.rippleAdd(st.R, tNow - Math.max(0, +age || 0), w); }
    else if (st.prevBeats !== null && !jumped && Math.floor(b) > Math.floor(st.prevBeats)) M.rippleAdd(st.R, tNow - (b - Math.floor(b)) * 60 / tempo, w);
    if (M.energyOnset(st.R, E.kick, tNow) && w < 0.98) { if (M.rippleAdd(st.R, tNow, (1 - w) * M.clamp01(E.kick))) st.R.fromEnergy++; }
    st.prevBeats = b;
    for (const { slot, e } of st.pending.splice(0)) {
      if (slot === 1) { e.fired = M.rippleAdd(st.R, tNow, 1, true); e.firedAt = now; }
      else if (slot === 2) { const ok = tNow - st.surgeT >= SURGE.REFRACTORY_S; if (ok) st.surgeT = tNow; e.fired = ok; e.firedAt = now; }
    }
    const BT = M.beatTerms(ctl.beatGain);
    const rip = M.rippleUniforms(st.R, tNow, BT, ripU);
    const surge = surgeEnv(tNow - st.surgeT);
    st.triggerEnv[0] = st.R.list.filter(r => r.fixed).reduce((m, r) => Math.max(m, M.rippleEnv(tNow - r.t0)), 0); st.triggerEnv[1] = surge;
    const pal = M.paletteAt(ctl.colour ?? 0), height = M.heightOf(ctl.height ?? 0.55), glow = M.glowOf(st.act) * (1 + SURGE.AMP * surge);
    const BASE = 0.3 * (ctl.intensity ?? 1);

    // ======================= draw
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.aur.f); gl.viewport(0, 0, T.aur.w, T.aur.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    const cp = progs.curtain, cu = cp.u; gl.useProgram(cp.p); gl.bindVertexArray(vao);
    gl.uniform1f(cu.uX0, M.X0); gl.uniform1f(cu.uXS, M.XS); gl.uniform1f(cu.uFoldMin, M.FOLD_MIN); gl.uniform1f(cu.uFoldMax, M.FOLD_MAX);
    gl.uniform3fv(cu.uFringe, pal[0]); gl.uniform3fv(cu.uMain, pal[1]); gl.uniform3fv(cu.uTop, pal[2]);
    gl.uniform4fv(cu.uRip, rip.u); gl.uniform1f(cu.uSeed, st.seed % 97); gl.uniform1f(cu.uRayT, st.rayT * 0.25);
    gl.uniform3fv(cu.uFreq, M.FOLDS.freq);
    const view = [];
    for (let i = 0; i < M.LAYERS; i++) {
      const L = M.LAYER[i], S = st.sec[i], P = st.phases[i];
      const amp = M.FOLDS.amp.map(a => a * L.depth * S.amp), ph = [0, 1, 2].map(k => (P[k] + S.shift[k] + M.FOLDS.speed[k] * M.FOLDS.freq[k] * 6.2831853 * st.tau * (1 + 0.15 * i)) % 6.2831853);
      gl.uniform3fv(cu.uAmp, amp); gl.uniform3fv(cu.uPhase, ph);
      gl.uniform1f(cu.uBase, L.base); gl.uniform1f(cu.uHeight, height * L.depth); gl.uniform1f(cu.uLean, L.lean);
      gl.uniform1f(cu.uBottomAmp, 0.022 * L.depth); gl.uniform1f(cu.uBottomPhase, P[3] + 0.09 * st.tau); gl.uniform1f(cu.uTopPhase, P[3] * 1.7 - 0.06 * st.tau);
      gl.uniform1f(cu.uBright, BASE * L.bright * S.bright * glow); gl.uniform1f(cu.uRayOff, P[4] + 0.55 * st.tau * (i % 2 ? -1 : 1));
      gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0);
      view.push({ amp, phase: ph, bright: BASE * L.bright * S.bright * glow });
    }
    gl.bindVertexArray(null); gl.disable(gl.BLEND);
    // bloom chain
    const dp = progs.down; gl.useProgram(dp.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(dp.u.uSrc, 0);
    for (const [src, dst] of [[T.aur, T.b1], [T.b1, T.b2], [T.b2, T.b3]]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.t);
      gl.uniform2f(dp.u.uDst, dst.w, dst.h); gl.uniform2f(dp.u.uSrcTexel, 1 / src.w, 1 / src.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // the final pass: hills, lake, tone map, sRGB, dither
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null); gl.viewport(0, 0, fw, fh);
    const fp = progs.final, fu = fp.u; gl.useProgram(fp.p);
    [[T.aur, 'uAur'], [T.b1, 'uB1'], [T.b2, 'uB2'], [T.b3, 'uB3']].forEach(([x, name], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, x.t); gl.uniform1i(fu[name], i); });
    gl.uniform2f(fu.uRes, fw, fh); gl.uniform2f(fu.uT1, 1 / T.b1.w, 1 / T.b1.h); gl.uniform2f(fu.uT2, 1 / T.b2.w, 1 / T.b2.h); gl.uniform2f(fu.uT3, 1 / T.b3.w, 1 / T.b3.h);
    gl.uniform1f(fu.uHorizon, M.HORIZON); gl.uniform1f(fu.uTime, st.tau); gl.uniform1f(fu.uSeed, (st.seed * 7) % 97); gl.uniform1f(fu.uFrame, st.frames % 1024);
    gl.uniform1f(fu.uBloom, 0.35); gl.uniform1f(fu.uExposure, 1.0); gl.uniform1f(fu.uOpacity, ctl.opacity ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // leave the GL state as found (#85 GL rules)
    for (let i = 3; i >= 0; i--) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.useProgram(null);
    st.frames++;
    st.view = { section: secN, bars: b / bpb, layers: view, floatTargets: floatOk, render: [T.aur.w, T.aur.h], canvas: [fw, fh] };
    st.metrics = { act: st.act, w, tau: st.tau, glow, surge, height, colour: M.clamp01(ctl.colour ?? 0), ripples: rip.n, ripplesStarted: st.R.started, ripplesFromEnergy: st.R.fromEnergy,
      beat: { g: BT.g, ripple: BT.ripple, kink: BT.kink, now: rip.peak } };
  }

  return {
    id: '28-aurora', title: '28 · Aurora',
    init, resize, frame, dispose, press, release, reset, setRenderScale,
    trigger(name) { const i = ['ripple', 'surge'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: { get view() { return st.view; }, get metrics() { return st.metrics; }, get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; },
      get ripples() { return st.R.list.map(r => ({ ...r })); }, get frames() { return st.frames; }, get renderScale() { return scale; } },
  };
}

// the #85 manifest: macros, triggers, detail inputs (the page and a host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'height', label: 'height', default: 0.55, quantise: 'none' },
  { slot: 'macro2', name: 'colour', label: 'colour', default: 0, quantise: 'none' },
  { slot: 'macro3', name: 'drift', label: 'drift', default: 0.5, quantise: 'none' },
  { slot: 'macro4', name: 'intensity', label: 'intensity', default: 0.75, quantise: 'none' },
];
export const TRIGGERS = [
  { slot: 'trigger1', name: 'ripple', label: 'ripple', key: 'Z', mode: 'tap', timing: 'now', repeats: 'restart', attackMs: 25, decayMs: 450 },
  { slot: 'trigger2', name: 'surge', label: 'surge', key: 'X', mode: 'tap', timing: 'now', repeats: 'ignore', attackMs: 250, decayMs: 2500 },
];
export const DETAIL = [
  { name: 'seed', type: 'long', default: 1, min: 1, max: 1e6 },
  { name: 'renderScale', type: 'float', default: 0.5, min: 0.25, max: 1 },
];
// macro 4 → the curtains' light (0.6 … 1.4 ×)
export const intensityOf = m => 0.6 + 0.8 * M.clamp01(m);
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['seed'], outputs: [],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 1 },
};
