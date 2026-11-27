// 29 · Neon Tunnel: a #85 module (init / resize / frame / press / release / dispose / reset, qa), built with the scene
// skill (.claude/skills/webgl-scene/SKILL.md) from docs/CELLULAR_VIZ_BRIEF_NEON_TUNNEL.md (#329), part 1: the scene
// with its own seeded path and the turn knob. Maths in 29-neon-tunnel-math.mjs.
// The look (the brief's five lines):
//   reference  a 1980s neon tunnel ride: laser rings and a grid floor, as on synthwave sleeves and arcade racers
//   palette    walls violet-black #07030f; rings hot pink #ff2e88, cyan #22e6ff, orange #ff8a1f in runs of 4; the floor
//              grid orange fading to pink; accent white-blue #dff6ff for the far glow and the kick's ring
//   light      everything is lit by the rings: thin cores, soft halos, a little light spilt on the wall round each ring;
//              between them faint stars and spirals, so no part of the frame is empty; the far glow and the kick's
//              ring are the brightest things and both are small
//   motion     one ring passes per beat (the speed knob: half, one or two a beat); across a bar the tunnel leans into
//              its turn and the colour runs come toward the viewer; every 16 bars the turn target moves, the colours
//              change and the ring shape may change (circle, rounded square, hexagon); the last 4 bars build (the view
//              widens a little) and the next 1 brings one bright ring
//   kick       the nearest ring ahead lights white-blue and the light runs away down the tunnel, ring by ring; no
//              whole-frame brightening; with no beat the music's own kicks do it; silence: a calm drift, still lit
// The bend: on screen the ring at depth z is centred at tq·f(z) (f rises smoothly from 0 at the viewer to 1 far away, the
// least bend that keeps the far end in sight through every ring), so the rings nest off-centre toward the turn; the
// shader finds each pixel's wall depth by a coarse march and a bisection on z·N(q − c(z)) = F·R (N the ring's norm). One full-screen pass at half size into a float target, a 4-level bloom chain, the final
// pass (ACES, sRGB by hand, ±0.5/255 dither). Comfort caps (turn speed and acceleration, roll, view width): the maths.
import * as M from './29-neon-tunnel-math.mjs';

const VS_FULL = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const NRINGS = 40;   // ring colours handed to the shader: the rings from the viewer to past the far end
const TUNNEL_FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uTq, uFar;
uniform float uBendM, uF, uRoll, uR, uPhaseFrac, uKBase, uL, uFog, uNear0, uNear1, uZMax, uGlow, uRingAmp, uTwinkle, uTime, uSeed;
uniform int uShapeA, uShapeB; uniform float uMorph;
uniform vec3 uRingCol[${NRINGS}];
uniform vec3 uPink, uOrange, uAccent, uWall;
uniform vec4 uKick[${M.KICK.MAX}];
uniform float uFarAmp;
out vec4 o;
const float TAU = 6.2831853;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }   // Dave Hoskins, no sin
float shapeN(vec2 v, int k) {
  vec2 a = abs(v);
  if (k == 1) return pow(pow(a.x, 5.0) + pow(a.y, 5.0), 0.2);
  if (k == 2) return max(a.x * 0.8660254 + a.y * 0.5, a.y) / 0.8660254;
  return length(a);
}
float normMix(vec2 v) { return mix(shapeN(v, uShapeA), shapeN(v, uShapeB), uMorph); }
// the ring at depth z is centred at uTq·f(z) on screen, f = 1 - 1/sqrt(1 + u²), u = z|tq| / (M·F) (the maths file)
vec2 centreAt(float z) { float u = z * length(uTq) / (uBendM * uF); return uTq * (1.0 - inversesqrt(1.0 + u * u)); }
float hz(vec2 q, float z) { return z * normMix(q - centreAt(z)) - uF * uR; }
// the wall's depth for this pixel: march out in log steps to the first z past the wall, then bisect
float wallDepth(vec2 q) {
  float prev = 0.3;
  if (hz(q, prev) >= 0.0) return prev;
  for (int k = 1; k <= 15; k++) {
    float z = 0.3 * pow(uZMax / 0.3, float(k) / 15.0);
    if (hz(q, z) >= 0.0) {
      float lo = prev, hi = z;
      for (int i = 0; i < 7; i++) { float m = 0.5 * (lo + hi); if (hz(q, m) >= 0.0) hi = m; else lo = m; }
      return 0.5 * (lo + hi);
    }
    prev = z;
  }
  return uZMax;
}
float aaLine(float d, float w, float fw) { float ww = max(w, fw * 0.8); return exp(-(d * d) / (ww * ww)) * (w / ww); }
void main() {
  vec2 q0 = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float cr = cos(uRoll), sr = sin(uRoll);
  vec2 q = mat2(cr, sr, -sr, cr) * q0;                     // the view's roll (banking)
  float z = wallDepth(q);
  float hole = smoothstep(0.85 * uZMax, uZMax, z);         // looking down the tunnel's open end
  vec2 v = (q - centreAt(z)) * z / uF;                     // the wall point round the bent axis
  vec2 vn = v / max(normMix(v), 1e-5);                     // on the unit ring shape
  float fog = exp(-z / uFog), near = smoothstep(uNear0, uNear1, z);
  // rings: ring k sits at depth (k - phase)·L; rr counts rings from the base ring
  float rr = uPhaseFrac + z / uL, kRel = floor(rr + 0.5), dr = rr - kRel, fr = fwidth(rr);
  vec3 rc = uRingCol[int(clamp(kRel, 0.0, ${NRINGS - 1}.0))];
  float kb = 0.0;
  for (int i = 0; i < ${M.KICK.MAX}; i++) { float d = (kRel - uKick[i].x) / 0.6; kb += uKick[i].y * exp(-d * d); }
  vec3 ringCol = mix(rc, uAccent, min(1.0, 0.6 * kb)) * (1.0 + kb);
  float core = aaLine(dr, 0.035, fr), halo = exp(-abs(dr) / 0.12) * min(1.0, 0.12 / max(fr, 1e-4)), spill = exp(-abs(dr) / 0.4);
  vec3 col = ringCol * uRingAmp * (1.5 * core + 0.25 * halo) * near + rc * 0.035 * spill * uGlow;
  // the floor: a grid in the tunnel's lower part, orange fading to pink with depth
  float floorM = smoothstep(0.55, 0.8, -vn.y);
  float g1 = aaLine(abs(fract(rr * 2.0 + 0.5) - 0.5), 0.03, fwidth(rr * 2.0)), gx = vn.x * 6.0, g2 = aaLine(abs(fract(gx + 0.5) - 0.5), 0.03, fwidth(gx));
  col += mix(uOrange, uPink, smoothstep(2.0, 20.0, z)) * floorM * (g1 + g2) * 0.3 * uGlow * near;
  // the walls: violet-black, faint stars and spirals (periodic round the tunnel and along it)
  float th = atan(vn.y, vn.x), along = rr + mod(uKBase, 64.0);
  vec2 cell = vec2(th / TAU * 28.0, along * 1.5), id = floor(cell);
  vec2 idw = vec2(mod(id.x, 28.0), mod(id.y, 96.0));
  float h = hash12(idw + uSeed), h2 = hash12(idw + uSeed + 17.0);
  vec2 f = fract(cell) - 0.5 - (vec2(h, h2) - 0.5) * 0.5;
  float fwc = max(fwidth(cell.x), fwidth(cell.y)), sw = max(0.09, fwc * 0.8);
  float star = step(0.86, h) * exp(-dot(f, f) / (sw * sw)) * (0.09 / sw) * (0.09 / sw);
  float tw = 0.65 + 0.35 * sin(uTime * 3.0 + h * 40.0) * uTwinkle;
  col += mix(uAccent, uPink, h2) * star * tw * 0.5 * (1.0 - floorM) * uGlow * smoothstep(0.8, 3.0, z);
  float sp = pow(0.5 + 0.5 * sin(3.0 * th + TAU * (rr + mod(uKBase, 10.0)) / 10.0), 12.0);
  col += uPink * 0.03 * sp * (1.0 - floorM) * uGlow + uWall;
  col *= fog * (1.0 - hole);
  // the far glow where the tunnel ends
  vec2 dq = q - uFar;
  col += uAccent * uFarAmp * (exp(-dot(dq, dq) / 0.012) + 0.1 * exp(-length(dq) / 0.2));
  o = vec4(col, 1.0);
}`;
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
uniform sampler2D uMain, uB1, uB2, uB3, uB4;
uniform vec2 uRes, uT1, uT2, uT3, uT4;
uniform float uFrame, uBloom, uExposure, uOpacity;
out vec4 o;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 tent(sampler2D t, vec2 uv, vec2 h) {
  return 0.25 * (texture(t, uv + vec2(-h.x, -h.y)).rgb + texture(t, uv + vec2(h.x, -h.y)).rgb + texture(t, uv + vec2(-h.x, h.y)).rgb + texture(t, uv + vec2(h.x, h.y)).rgb);
}
vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uMain, uv).rgb + uBloom * (0.35 * tent(uB1, uv, uT1) + 0.28 * tent(uB2, uv, uT2) + 0.22 * tent(uB3, uv, uT3) + 0.15 * tent(uB4, uv, uT4));
  c = srgb(aces(c * uExposure)) * uOpacity;
  c += (hash12(gl_FragCoord.xy + fract(uFrame * 0.618) * 97.0) - 0.5) / 255.0;   // ±0.5/255: no banding, black stays 0
  o = vec4(max(c, 0.0), 1.0);
}`;

export function createScene() {
  let gl = null, W = 0, H = 0, progs = null, vao = null, T = null, floatOk = false, scale = 0.5;
  const kickU = new Float32Array(4 * M.KICK.MAX), ringCols = new Float32Array(3 * NRINGS);
  const PAL = [M.lin(M.HEX.pink), M.lin(M.HEX.cyan), M.lin(M.HEX.orange)];
  const st = {
    seed: 1, K: M.kicksCreate(), tgt: { x: 0, y: 0, vx: 0, vy: 0 }, roll: 0, widen: 0, ride: null, act: 0, lastT: null, prevBeats: null,
    sec: null, colPrev: null, colCur: null, colT0: -1e9, shape: { a: 0, b: 0, m: 1, want: 0, t0: 0 }, shapeStep: 0, recentre: null,
    passed: 0, beatsCounted: 0, maxTurn: 0, maxRoll: 0, maxWidenRate: 0, pending: [], triggerLog: [], triggerEnv: [0, 0], frames: 0, metrics: {}, view: null,
  };

  function compile(fs, vs = VS_FULL) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); gl.deleteProgram(p); throw new Error('29 neon tunnel shader: ' + log); }
      gl.attachShader(p, s); gl.deleteShader(s);   // flagged: freed with the program
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error('29 neon tunnel link: ' + log); }
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
    if (!ok) { gl.deleteFramebuffer(f); gl.deleteTexture(t); throw new Error(`29 neon tunnel: framebuffer ${w}x${h} incomplete`); }
    return { t, f, w, h };
  }
  const LEVELS = ['main', 'b1', 'b2', 'b3', 'b4'];
  function freeTargets() { if (T) for (const k of LEVELS) { gl.deleteTexture(T[k].t); gl.deleteFramebuffer(T[k].f); } T = null; }
  function resize(w, h) {
    if (!gl || !(w > 0 && h > 0)) return;
    if (T && W === w && H === h && T.scale === scale) return;
    freeTargets(); W = w; H = h;
    const half = n => Math.max(1, n >> 1);
    let aw = Math.max(1, Math.round(w * scale)), ah = Math.max(1, Math.round(h * scale));
    const t = { scale };
    for (const k of LEVELS) { t[k] = target(aw, ah); aw = half(aw); ah = half(ah); }
    T = t;
  }
  function setRenderScale(s) { if (Number.isFinite(s)) { scale = Math.max(0.25, Math.min(1, s)); if (gl && W && H) { const w = W, h = H; W = 0; resize(w, h); } } return scale; }
  function init(g, { width, height, seed = 1, renderScale = 0.5 }) {
    gl = g; st.seed = Math.max(1, Math.round(+seed) || 1); scale = Math.max(0.25, Math.min(1, +renderScale || 0.5));
    floatOk = !!gl.getExtension('EXT_color_buffer_float');
    progs = { tunnel: compile(TUNNEL_FS), down: compile(DOWN_FS), final: compile(FINAL_FS) };
    vao = gl.createVertexArray();
    resize(width, height);
    reset();
  }
  function dispose() {
    if (!gl) return;
    freeTargets();
    for (const p of Object.values(progs || {})) gl.deleteProgram(p.p);
    gl.deleteVertexArray(vao);
    progs = null; vao = null; gl = null; W = H = 0;
  }
  // Play pressed (or a new slot): the clock starts again; the ride keeps where it is looking (no jump), the counts restart
  function reset() { st.K = M.kicksCreate(); st.prevBeats = null; st.lastT = null; st.pending = []; st.passed = 0; st.beatsCounted = 0; st.recentre = null; }

  // triggers: 1 recentre (the ride turns back to the centre for the rest of the section), 2 the next ring shape
  function press(slot, holdMs = 0, now = performance.now()) {
    const e = { t: now, slot: `trigger${slot}`, holdMs, firedAt: null, quantisedTo: now, fired: null };
    st.triggerLog.push(e); if (st.triggerLog.length > 256) st.triggerLog.shift();
    if (slot !== 1 && slot !== 2) { e.fired = false; return false; }
    st.pending.push({ slot, e });
    return true;
  }
  function release() { return true; }

  function frame({ target = null, t, beats, bpb = 4, bpm = 120, controls: ctl = {}, now = performance.now(), kicks, beatWeight, energy }) {
    if (!gl) return;
    const fw = target ? target.width : W, fh = target ? target.height : H;
    resize(fw, fh);
    const tNow = Number.isFinite(t) ? t : now / 1000;
    const dt = st.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, tNow - st.lastT)); st.lastT = tNow;
    const b = Number.isFinite(beats) ? beats : 0, bars = b / bpb;
    let dB = st.prevBeats === null ? 0 : b - st.prevBeats;
    const jumped = !(dB >= 0 && dB <= 4);   // a seek, forceDrop or Stop
    if (jumped) dB = 0;
    const w = Number.isFinite(beatWeight) ? M.clamp01(beatWeight) : 1, E = energy || { kick: 0, level: 0, bands: {} };
    const tempo = bpm > 0 ? bpm : 120, barS = bpb * 60 / tempo;
    st.act = M.activityStep(st.act, M.activityTarget(w, E.level), dt);
    const glow = M.glowOf(st.act), intensity = ctl.intensity ?? 1;
    // the section: its waypoint, shape and colours; the next 1 after a build brings one bright ring
    const secN = Math.floor(bars / M.SECTION_BARS), plan = M.sectionPlan(st.seed, secN);
    if (st.sec !== secN) {
      const first = st.sec === null;
      st.colPrev = first ? plan.colourSeed : st.colCur; st.colCur = plan.colourSeed; st.colT0 = first ? -1e9 : tNow;
      if (!first) { st.recentre = null; if (st.ride) M.kickAdd(st.K, tNow, st.ride.phase, 1, true); }
      st.sec = secN;
    }
    for (const { slot, e } of st.pending.splice(0)) {   // the buttons, before the target and the shape read them
      if (slot === 1) { st.recentre = { at: tNow }; e.fired = true; e.firedAt = now; }
      else if (slot === 2) { const ok = st.shape.m >= 1; if (ok) st.shapeStep++; e.fired = ok; e.firedAt = now; }   // not while a shape morphs in
    }
    const shapeWant = (plan.shape + st.shapeStep) % M.SHAPES.length;
    if (shapeWant !== st.shape.want) { st.shape = { a: st.shape.m >= 1 ? st.shape.b : st.shape.a, b: shapeWant, m: 0, want: shapeWant, t0: tNow }; }
    if (st.shape.m < 1) st.shape.m = Math.min(1, st.shape.m + dt / barS);   // a new shape morphs in over a bar
    // the target: a pointer (part 2), else the seeded path scaled by the turn knob; recentre; QA's stand-in
    let own = M.pathTarget(st.seed, bars, ctl.turn ?? 0.6);
    if (st.recentre) own = { x: 0, y: 0 };
    if (ctl.qaTarget) own = { x: ctl.qaTarget[0], y: ctl.qaTarget[1] };
    const goal = M.pickTarget(ctl.pointer || null, tNow, own);   // part 2 hands in pointer { x, y, t } on this clock
    const prevRoll = st.roll, prevWiden = st.widen;
    st.tgt = M.easeTarget(st.tgt, goal, dt);
    st.roll = M.rollStep(st.roll, st.tgt.x, dt);
    st.widen = M.widenStep(st.widen, M.inBuild(bars) ? M.COMFORT.WIDEN_MAX : 0, dt);
    if (dt > 0) { st.maxTurn = Math.max(st.maxTurn, Math.hypot(st.tgt.vx, st.tgt.vy)); st.maxWidenRate = Math.max(st.maxWidenRate, Math.abs(st.widen - prevWiden) / dt); }
    st.maxRoll = Math.max(st.maxRoll, Math.abs(st.roll));
    const aspect = fw / Math.max(1, fh), F = M.TUN.F0 * (1 - st.widen);
    const tq = M.toQ(st.tgt, aspect), cr = Math.cos(st.roll), sr = Math.sin(st.roll);
    const tqr = [cr * tq[0] - sr * tq[1], sr * tq[0] + cr * tq[1]];   // the bend is set in the rolled view, so the far end lands on the target
    // the ride on the beat
    const rateWant = M.rateOf(ctl.speed ?? 0.5);
    if (!st.ride) st.ride = { rate: rateWant, phase: b * rateWant };
    const before = Math.floor(st.ride.phase);
    st.ride = M.rideStep(st.ride, { dB, dt, beats: b, w, rateWant, act: st.act });
    if (!jumped && w > 0.5) { st.passed += Math.max(0, Math.floor(st.ride.phase) - before); st.beatsCounted += dB; }
    // kicks: the clock's (ages in s, weight w), else each beat; no-beat: the music's own kick
    if (Array.isArray(kicks)) { for (const age of kicks) M.kickAdd(st.K, tNow - Math.max(0, +age || 0), st.ride.phase, w); }
    else if (st.prevBeats !== null && !jumped && Math.floor(b) > Math.floor(st.prevBeats)) M.kickAdd(st.K, tNow - (b - Math.floor(b)) * 60 / tempo, st.ride.phase, w);
    if (M.energyOnset(st.K, E.kick, tNow) && w < 0.98) { if (M.kickAdd(st.K, tNow, st.ride.phase, (1 - w) * M.clamp01(E.kick))) st.K.fromEnergy++; }
    st.prevBeats = b;
    const BT = M.beatTerms(ctl.beatGain), KU = M.kickUniforms(st.K, tNow, BT, kickU);
    const kBase = Math.floor(st.ride.phase), phaseFrac = st.ride.phase - kBase;
    for (let i = 0; i < M.KICK.MAX; i++) if (kickU[4 * i + 1] > 0) kickU[4 * i] -= kBase;   // relative to the base ring
    // ring colours: runs of 4, crossfaded over a beat when a section changes
    const cx = M.clamp01((tNow - st.colT0) / (60 / tempo)), colour = ctl.colour ?? 0.5;
    for (let i = 0; i < NRINGS; i++) {
      const run = Math.floor((kBase + i) / M.TUN.RUN), c1 = PAL[M.runColour(st.colCur, run, colour)], c0 = PAL[M.runColour(st.colPrev, run, colour)];
      for (let j = 0; j < 3; j++) ringCols[3 * i + j] = c0[j] + (c1[j] - c0[j]) * cx;
    }
    const bass = E.bands ? M.clamp01(((E.bands.sub || 0) + (E.bands.kick || 0)) / 2) : 0, highs = E.bands ? M.clamp01(((E.bands.presence || 0) + (E.bands.air || 0)) / 2) : 0;

    // ======================= draw
    const aw = T.main.w, ah = T.main.h;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    gl.bindVertexArray(vao);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.main.f); gl.viewport(0, 0, aw, ah);
    const tp = progs.tunnel, tu = tp.u; gl.useProgram(tp.p);
    gl.uniform2f(tu.uRes, aw, ah); gl.uniform2f(tu.uTq, tqr[0], tqr[1]); gl.uniform2f(tu.uFar, tqr[0], tqr[1]); gl.uniform1f(tu.uBendM, M.BEND_M);
    gl.uniform1f(tu.uF, F); gl.uniform1f(tu.uRoll, st.roll); gl.uniform1f(tu.uR, 1 + 0.06 * bass);
    gl.uniform1f(tu.uPhaseFrac, phaseFrac); gl.uniform1f(tu.uKBase, kBase % 640); gl.uniform1f(tu.uL, M.TUN.L);
    gl.uniform1f(tu.uFog, M.TUN.FOG); gl.uniform1f(tu.uNear0, M.TUN.NEAR[0]); gl.uniform1f(tu.uNear1, M.TUN.NEAR[1]); gl.uniform1f(tu.uZMax, M.TUN.Z_MAX);
    gl.uniform1f(tu.uGlow, glow * intensity); gl.uniform1f(tu.uRingAmp, 0.6 * glow * intensity); gl.uniform1f(tu.uTwinkle, highs);
    gl.uniform1f(tu.uTime, (tNow % 600)); gl.uniform1f(tu.uSeed, st.seed % 89);
    gl.uniform1i(tu.uShapeA, st.shape.a); gl.uniform1i(tu.uShapeB, st.shape.b); gl.uniform1f(tu.uMorph, st.shape.m);
    gl.uniform3fv(tu.uRingCol, ringCols); gl.uniform3fv(tu.uPink, PAL[0]); gl.uniform3fv(tu.uOrange, PAL[2]);
    gl.uniform3fv(tu.uAccent, M.lin(M.HEX.accent)); gl.uniform3fv(tu.uWall, M.lin(M.HEX.wall));
    gl.uniform4fv(tu.uKick, kickU); gl.uniform1f(tu.uFarAmp, 0.55 * glow * intensity);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // bloom chain
    const dp = progs.down; gl.useProgram(dp.p); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(dp.u.uSrc, 0);
    for (let i = 1; i < LEVELS.length; i++) {
      const src = T[LEVELS[i - 1]], dst = T[LEVELS[i]];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h);
      gl.bindTexture(gl.TEXTURE_2D, src.t);
      gl.uniform2f(dp.u.uDst, dst.w, dst.h); gl.uniform2f(dp.u.uSrcTexel, 1 / src.w, 1 / src.h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // the final pass: tone map, sRGB, dither
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null); gl.viewport(0, 0, fw, fh);
    const fp = progs.final, fu = fp.u; gl.useProgram(fp.p);
    [['main', 'uMain'], ['b1', 'uB1'], ['b2', 'uB2'], ['b3', 'uB3'], ['b4', 'uB4']].forEach(([k, name], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, T[k].t); gl.uniform1i(fu[name], i); });
    gl.uniform2f(fu.uRes, fw, fh);
    gl.uniform2f(fu.uT1, 1 / T.b1.w, 1 / T.b1.h); gl.uniform2f(fu.uT2, 1 / T.b2.w, 1 / T.b2.h); gl.uniform2f(fu.uT3, 1 / T.b3.w, 1 / T.b3.h); gl.uniform2f(fu.uT4, 1 / T.b4.w, 1 / T.b4.h);
    gl.uniform1f(fu.uFrame, st.frames % 1024); gl.uniform1f(fu.uBloom, 0.45); gl.uniform1f(fu.uExposure, 1.0); gl.uniform1f(fu.uOpacity, ctl.opacity ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // leave the GL state as found (#85 GL rules)
    for (let i = 4; i >= 0; i--) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.bindVertexArray(null); gl.useProgram(null);
    st.frames++;
    st.triggerEnv[0] = st.recentre ? 1 : 0; st.triggerEnv[1] = st.shape.m < 1 ? st.shape.m : 0;
    st.view = { bars, section: secN, build: M.inBuild(bars), shape: M.SHAPES[st.shape.b], morph: st.shape.m, waypoint: plan.wp, source: goal.from,
      target: { x: st.tgt.x, y: st.tgt.y }, goal: { x: goal.x, y: goal.y }, farEnd: { x: tq[0] / aspect, y: tq[1] }, roll: st.roll, widen: st.widen, focal: F,
      floatTargets: floatOk, render: [aw, ah], canvas: [fw, fh] };
    st.metrics = { act: st.act, w, glow, rate: st.ride.rate, rateWant, phase: st.ride.phase, ringsPerBeat: st.beatsCounted > 0 ? st.passed / st.beatsCounted : null,
      passed: st.passed, beatsCounted: st.beatsCounted, kicksStarted: st.K.started, kicksFromEnergy: st.K.fromEnergy,
      maxTurn: st.maxTurn, maxRollDeg: st.maxRoll * 180 / Math.PI, maxWidenRate: st.maxWidenRate, rollRate: dt > 0 ? Math.abs(st.roll - prevRoll) / dt : 0,
      beat: { g: BT.g, kick: BT.kick, now: KU.peak } };
  }

  return {
    id: '29-neon-tunnel', title: '29 · Neon Tunnel',
    init, resize, frame, dispose, press, release, reset, setRenderScale,
    trigger(name) { const i = ['recentre', 'shape'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: { get view() { return st.view; }, get metrics() { return st.metrics; }, get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; },
      get frames() { return st.frames; }, get renderScale() { return scale; } },
  };
}

// the #85 manifest: macros, triggers, detail inputs (the page and a host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'speed', label: 'speed (rings a beat)', default: 0.5, quantise: 'beat' },
  { slot: 'macro2', name: 'turn', label: 'turn', default: 0.6, quantise: 'none' },
  { slot: 'macro3', name: 'colour', label: 'colour', default: 0.5, quantise: 'none' },
  { slot: 'macro4', name: 'intensity', label: 'intensity', default: 0.5, quantise: 'none' },
];
export const TRIGGERS = [
  { slot: 'trigger1', name: 'recentre', label: 'recentre', key: 'Z', mode: 'tap', timing: 'now', repeats: 'ignore', attackMs: 0, decayMs: 3000 },
  { slot: 'trigger2', name: 'shape', label: 'next shape', key: 'X', mode: 'tap', timing: 'now', repeats: 'ignore', attackMs: 0, decayMs: 2000 },
];
export const DETAIL = [
  { name: 'seed', type: 'long', default: 1, min: 1, max: 1e6 },
  { name: 'renderScale', type: 'float', default: 0.5, min: 0.25, max: 1 },
];
export const intensityOf = m => 0.6 + 0.8 * M.clamp01(m);   // macro 4 → the light (0.6 … 1.4 ×, 1 in the middle)
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['seed'], outputs: [],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 1 },
};
