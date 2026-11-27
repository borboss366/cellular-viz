// 18 · Little Bang 2: the beamline rebuilt with the scene skill (.claude/skills/webgl-scene/SKILL.md), as a #85 module
// (init / resize / frame / press / release / dispose / reset, qa). Maths in 18-little-bang-2-math.mjs.
// The look (skill section 1):
//   reference  riding the beam pipe of a ring collider toward the interaction point, as in CERN's LHC fly-through
//              animations, with the crossing drawn as a CMS event display at the far end (gold tracks curling out)
//   palette    black at the far end; the neon wires in two hues a section (cobalt #1f4bff / magenta #ff1f8e, then cyan /
//              violet, magenta / tangerine, acid / cobalt), cyan ring magnets #7fe8ff, a faint cobalt wall #3a4cff;
//              the accent is gold #ffc83d (the ray, the fireball, the tracks)
//   light      the tube is lit by its own wires: thin cores with soft halos fill the frame (dark, never empty), the
//              ring magnets are thin hoops, the wall between them a faint panel glow; the bright parts are small: the
//              thin ray on the axis, the light rings, the collision at the far end
//   motion     within a beat: the kick's light ring runs down the tube to the far end and the ray pulses; across a
//              bar: the magnets stream past at the speed knob's pace, the hue bands flow along the wires, the bunches
//              cross on every downbeat; across a 16-bar section: the wires change hue pair (eased over 2 bars), the far
//              end wanders across the screen, and bars 12-15 are the drop (a rainbow sweep, bigger collisions)
//   kick       a light ring leaves the camera and the ray brightens and thickens a little (at most 3 a second); with
//              no beat the rings follow the music's own kick; silence leaves the tube at 45 % light, the ray steady
// Drawing: one full-screen pass at half size into a float target (ray-cylinder from inside: wires, hoops, rings, panels,
// the ray as the distance between the pixel's ray and the axis, the fireball), then the tracks as instanced quads
// added on top, a 4-level bloom chain, and the final pass (ACES, sRGB by hand, ±0.5/255 dither).
import * as M from './18-little-bang-2-math.mjs';

const VS_FULL = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;

const TUBE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uOff;
uniform vec3 uF, uR, uU;
uniform float uFocal, uTwist, uWireN, uWireW, uWireGlow, uHoopL, uHoopAmp, uFog, uPanelAmp, uFlow, uSweep, uGlow, uBreath, uSeed;
// the camera's travel as phases (each wraps where its pattern repeats, so a long night never loses precision or pops)
uniform float uTwPh, uBandPh, uRainPh, uSHoop, uSPanel;
uniform vec3 uColA, uColB, uHoop, uRing, uRay, uPanel, uFire;
uniform vec4 uRings[${M.KICK.MAX}];
uniform float uRayAmp, uRayW, uRayStart, uZip;
uniform vec3 uIP;      // the interaction point on screen: q.x, q.y, the fireball's radius (q units)
uniform float uFireAmp, uSpot;
out vec4 o;
const float TAU = 6.2831853;
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }   // Dave Hoskins, no sin
// value noise, periodic in x (the wall's angle wraps round) and in y (the travel phase wraps)
float vnP(vec2 x, float Px, float Py) {
  vec2 i = floor(x), f = fract(x); vec2 u = f * f * (3.0 - 2.0 * f);
  float i0 = mod(i.x, Px), i1 = mod(i.x + 1.0, Px), j0 = mod(i.y, Py), j1 = mod(i.y + 1.0, Py);
  float a = hash12(vec2(i0, j0) + uSeed), b = hash12(vec2(i1, j0) + uSeed), c = hash12(vec2(i0, j1) + uSeed), d = hash12(vec2(i1, j1) + uSeed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// a thin line of width w (in its own units) at distance d, kept at least ~1 pixel wide (fw: the units per pixel) with
// its light kept the same: no shimmer where the lines crowd together far away
float aaLine(float d, float w, float fw) { float ww = max(w, fw * 0.8); return exp(-(d * d) / (ww * ww)) * (w / ww); }
void main() {
  vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 rd = normalize(uF * uFocal + uR * q.x + uU * q.y);
  vec2 o2 = uOff, d = rd.xy;
  float a = max(dot(d, d), 1e-9), b = dot(o2, d), c = dot(o2, o2) - 1.0;
  float t = (-b + sqrt(max(b * b - a * c, 0.0))) / a;     // the wall, from inside
  vec2 p = o2 + t * d;
  float zr = t * rd.z;                                     // depth ahead of the camera
  float fog = exp(-max(zr, 0.0) / uFog);
  float near = smoothstep(1.2, 4.5, zr);                   // things that sweep past the camera stay dim
  // wires (with the AA width from the wrap-free derivative: the angle jumps by 2 pi at its seam)
  float wu = (atan(p.y, p.x) + zr * uTwist + uTwPh) * uWireN / TAU;
  float wi = floor(wu + 0.5), wd = abs(wu - wi), wim = mod(wi, uWireN);   // wim: the same wire across the seam
  float fw = min(fwidth(wu), fwidth(fract(wu + 0.5)));
  float core = aaLine(wd, uWireW, fw), halo = exp(-wd / max(uWireGlow, fw)) * min(1.0, uWireGlow / max(fw, 1e-4));
  float band = 0.5 + 0.5 * sin(TAU * (zr / 7.0 + uBandPh - uFlow) + wim * 1.3);
  float odd = mod(wim, 2.0);
  vec3 wcol = mix(mix(uColA, uColB, band), mix(uColB, uColA, band), odd);
  vec3 rainbow = 0.5 + 0.5 * cos(TAU * (zr / 22.0 + uRainPh - 2.0 * uFlow + vec3(0.0, 0.33, 0.67)));
  wcol = mix(wcol, rainbow * 0.9, uSweep);
  vec3 wires = wcol * (1.6 * core + 0.22 * halo * (1.0 + uBreath));
  // ring magnets: thin cyan hoops every uHoopL
  float hu = (zr + uSHoop) / uHoopL, hd = abs(hu - floor(hu + 0.5)), fz = fwidth(hu);
  vec3 hoops = uHoop * aaLine(hd, 0.012, fz) * uHoopAmp * near;
  // the kick's light rings
  float fzr = fwidth(zr), rings = 0.0;
  for (int i = 0; i < ${M.KICK.MAX}; i++) rings += uRings[i].y * aaLine(zr - uRings[i].x, 0.22, fzr);
  // the wall between: faint panels, so the frame is never empty
  float pn = vnP(vec2(wu * 0.5, (zr + uSPanel) * 0.7), uWireN * 0.5, 14.0);
  vec3 panel = uPanel * uPanelAmp * (0.45 + 0.55 * pn);
  vec3 col = (wires * uGlow + hoops + uRing * rings * near + panel * uGlow) * fog;
  // the ray: the distance between this pixel's ray and the tube's axis, on the stretch ahead of the camera
  float dl = max(length(d), 1e-5), distA = abs(o2.x * rd.y - o2.y * rd.x) / dl;
  float tc = -dot(o2, d) / (dl * dl), zc = tc * rd.z;
  float seg = step(0.0, tc) * step(zc, zr) * smoothstep(uRayStart, uRayStart + 1.5, zc) * (1.0 - smoothstep(uZip - 3.0, uZip, zc));
  float fwd = fwidth(distA);
  float rayL = aaLine(distA, uRayW, fwd) + 0.12 * exp(-distA / (6.0 * uRayW + fwd));
  col += uRay * rayL * uRayAmp * seg * mix(1.0, exp(-max(zc, 0.0) / (2.5 * uFog)), 0.5);
  // the interaction point: a steady faint spot where the bunches cross, and the fireball on each downbeat
  float r = length(q - uIP.xy) / max(uIP.z, 1e-4);
  col += uFire * (uSpot * exp(-r * r * 4.0) + uFireAmp * (exp(-r * r) + 0.12 * exp(-r)));
  o = vec4(col, 1.0);
}`;
const TRACK_VS = `#version 300 es
precision highp float;
layout(location = 0) in vec4 aSeg; layout(location = 1) in vec4 aCol;
uniform vec2 uRes;
out vec2 vP; flat out vec4 vSeg; flat out vec4 vCol;
void main() {
  vec2 a = aSeg.xy, b = aSeg.zw, d = b - a; float L = length(d);
  vec2 t = L > 1e-3 ? d / L : vec2(1.0, 0.0), n = vec2(-t.y, t.x);
  float R = aCol.w * 3.0;
  int c = gl_VertexID == 3 ? 0 : gl_VertexID == 4 ? 2 : gl_VertexID == 5 ? 3 : gl_VertexID;
  float along = (c == 1 || c == 2) ? 1.0 : 0.0, side = c >= 2 ? 1.0 : -1.0;
  vec2 p = mix(a - t * R, b + t * R, along) + n * side * R;
  vP = p; vSeg = aSeg; vCol = aCol;
  gl_Position = vec4(p / uRes * 2.0 - 1.0, 0.0, 1.0);
}`;
const TRACK_FS = `#version 300 es
precision highp float;
in vec2 vP; flat in vec4 vSeg; flat in vec4 vCol;
out vec4 o;
void main() {
  vec2 a = vSeg.xy, d = vSeg.zw - a;
  float u = clamp(dot(vP - a, d) / max(dot(d, d), 1e-6), 0.0, 1.0), dist = length(vP - (a + u * d)), w = vCol.w;
  o = vec4(vCol.rgb * exp(-(dist * dist) / (w * w)), 1.0);
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

const SEGS = 14;   // segments per track
const MAX_INST = 2 * M.COLL.TRACKS_DROP * SEGS;

export function createScene() {
  let gl = null, W = 0, H = 0, progs = null, vao = null, trackVao = null, trackBuf = null, T = null, floatOk = false, scale = 0.5;
  const ringU = new Float32Array(4 * M.KICK.MAX), inst = new Float32Array(MAX_INST * 8);
  const st = {
    seed: 1, ph: M.seedPhases(1), K: M.kicksCreate(), v: null, s: 0, tau: 0, flow: 0, act: 0, lastT: null, prevBeats: null,
    events: [], collisions: 0, pending: [], triggerLog: [], triggerEnv: [0, 0], flareT: -1e9, frames: 0, metrics: {}, view: null,
  };

  function compile(fs, vs = VS_FULL) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); gl.deleteShader(s); gl.deleteProgram(p); throw new Error('18 little bang 2 shader: ' + log); }
      gl.attachShader(p, s); gl.deleteShader(s);   // flagged: freed with the program
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(p); gl.deleteProgram(p); throw new Error('18 little bang 2 link: ' + log); }
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
    if (!ok) { gl.deleteFramebuffer(f); gl.deleteTexture(t); throw new Error(`18 little bang 2: framebuffer ${w}x${h} incomplete`); }
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
    gl = g; st.seed = Math.max(1, Math.round(+seed) || 1); st.ph = M.seedPhases(st.seed); scale = Math.max(0.25, Math.min(1, +renderScale || 0.5));
    floatOk = !!gl.getExtension('EXT_color_buffer_float');
    progs = { tube: compile(TUBE_FS), track: compile(TRACK_FS, TRACK_VS), down: compile(DOWN_FS), final: compile(FINAL_FS) };
    vao = gl.createVertexArray();
    trackVao = gl.createVertexArray(); gl.bindVertexArray(trackVao);
    trackBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, trackBuf); gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
    for (let i = 0; i < 2; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, i * 16); gl.vertexAttribDivisor(i, 1); }
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    resize(width, height);
    reset();
  }
  function dispose() {
    if (!gl) return;
    freeTargets();
    for (const p of Object.values(progs || {})) gl.deleteProgram(p.p);
    gl.deleteBuffer(trackBuf); gl.deleteVertexArray(trackVao); gl.deleteVertexArray(vao);
    progs = null; trackBuf = trackVao = vao = null; gl = null; W = H = 0;
  }
  // Play pressed (or a new slot): the clock starts again, so the kicks and the collisions start clean
  function reset() { st.K = M.kicksCreate(); st.prevBeats = null; st.lastT = null; st.events = []; st.pending = []; st.flareT = -1e9; }

  // triggers: 1 crossing (now: the bunches cross at once, a collision as on a downbeat), 2 flare (now: the wires glow up
  // over 0.2 s and settle over 1.5 s; a press inside 1 s is ignored)
  function press(slot, holdMs = 0, now = performance.now()) {
    const e = { t: now, slot: `trigger${slot}`, holdMs, firedAt: null, quantisedTo: now, fired: null };
    st.triggerLog.push(e); if (st.triggerLog.length > 256) st.triggerLog.shift();
    if (slot !== 1 && slot !== 2) { e.fired = false; return false; }
    st.pending.push({ slot, e });
    return true;
  }
  function release() { return true; }
  const FLARE = { ATTACK_S: 0.2, RELEASE_S: 1.5, AMP: 0.5, REFRACTORY_S: 1 };
  const flareEnv = age => (age < 0 ? 0 : age < FLARE.ATTACK_S ? age / FLARE.ATTACK_S : Math.exp(-(age - FLARE.ATTACK_S) / FLARE.RELEASE_S));
  function addCollision(bar, t0, drop) { st.events.push({ ...M.collision(st.seed, bar, drop), t0 }); st.collisions++; while (st.events.length > 2) st.events.shift(); }

  function frame({ target = null, t, beats, bpb = 4, bpm = 120, controls: ctl = {}, now = performance.now(), kicks, beatWeight, energy }) {
    if (!gl) return;
    const fw = target ? target.width : W, fh = target ? target.height : H;
    resize(fw, fh);
    const tNow = Number.isFinite(t) ? t : now / 1000;
    const dt = st.lastT === null ? 1 / 60 : Math.min(0.1, Math.max(0, tNow - st.lastT)); st.lastT = tNow;
    const b = Number.isFinite(beats) ? beats : 0, bars = b / bpb;
    let dB = st.prevBeats === null ? 0 : b - st.prevBeats;
    const jumped = !(dB >= 0 && dB <= 4);   // a seek, forceDrop or Stop: no wander step, no crossing from it
    if (jumped) dB = 0;
    const w = Number.isFinite(beatWeight) ? M.clamp01(beatWeight) : 1, E = energy || { kick: 0, level: 0, bands: {} };
    const tempo = bpm > 0 ? bpm : 120;
    st.act = M.activityStep(st.act, M.activityTarget(w, E.level), dt);
    const glow = M.glowOf(st.act) * (1 + FLARE.AMP * flareEnv(tNow - st.flareT));
    // the camera: speed from the knob (eased), the far end wandering in beat time
    const vT = M.speedOf(ctl.speed ?? M.SPEED.DEFAULT);
    st.v = st.v === null ? vT : M.speedStep(st.v, vT, dt);
    st.s += st.v * dt;
    st.tau += w * dB + (1 - w) * dt * tempo / 60;
    st.flow += dt * 0.18 * (0.5 + 0.5 * st.act);
    const wd = M.wander(st.tau, st.ph), cam = M.cameraFrame(wd.yaw, wd.pitch);
    // kicks: the clock's (ages in s, weight w), else each beat; no-beat: the music's own kick
    if (Array.isArray(kicks)) { for (const age of kicks) M.kickAdd(st.K, tNow - Math.max(0, +age || 0), w); }
    else if (st.prevBeats !== null && !jumped && Math.floor(b) > Math.floor(st.prevBeats)) M.kickAdd(st.K, tNow - (b - Math.floor(b)) * 60 / tempo, w);
    if (M.energyOnset(st.K, E.kick, tNow) && w < 0.98) { if (M.kickAdd(st.K, tNow - 0, (1 - w) * M.clamp01(E.kick))) st.K.fromEnergy++; }
    // the bunches cross on every downbeat
    if (st.prevBeats !== null && !jumped && Math.floor(bars) > Math.floor(st.prevBeats / bpb)) {
      const bar = Math.floor(bars); addCollision(bar, tNow - (bars - bar) * bpb * 60 / tempo, M.isDrop(bar));
    }
    st.prevBeats = b;
    for (const { slot, e } of st.pending.splice(0)) {
      if (slot === 1) { addCollision(Math.floor(bars) + 7919 * (st.collisions + 1), tNow, M.isDrop(bars)); e.fired = true; e.firedAt = now; }
      else if (slot === 2) { const ok = tNow - st.flareT >= FLARE.REFRACTORY_S; if (ok) st.flareT = tNow; e.fired = ok; e.firedAt = now; }
    }
    const BT = M.beatTerms(ctl.beatGain), KU = M.kickUniforms(st.K, tNow, BT, ringU);
    const drop = M.isDrop(bars), pal = M.paletteAt(bars);
    const intensity = ctl.intensity ?? 1;
    // the far end: where the bunches cross, and the fireball (the newest crossing)
    const ip = M.project(cam, [0, 0, M.TUBE.Z_IP]);
    let fireAmp = 0, fireR = 0.03;
    const ev = st.events[st.events.length - 1];
    if (ev && ip) { const age = tNow - ev.t0, e = M.fireEnv(age); fireAmp = (ev.drop ? M.COLL.FIRE_DROP : M.COLL.FIRE) * e * (0.5 + 0.5 * st.act); fireR = M.COLL.FIRE_R * (1 + 1.5 * Math.min(1, age)) / ip[2] * M.TUBE.FOCAL; }
    // the tracks: helices from the crossing, drawn as segments in the half-size target's pixels
    const aw = T.main.w, ah = T.main.h, gold = M.lin(M.GOLD);
    let nInst = 0;
    for (const evt of st.events) {
      const age = tNow - evt.t0;
      if (age < 0 || age > M.COLL.LIFE_S) continue;
      const fade = Math.exp(-age / 0.6) * (evt.drop ? 1.2 : 0.9) * (0.5 + 0.5 * st.act) * intensity;
      for (const tr of evt.tracks) {
        const tEnd = Math.min(age, M.trackWallTime(tr)), tStart = Math.max(0, tEnd - M.COLL.TRAIL_S);
        if (!(tEnd > tStart)) continue;
        const tint = M.lin(tr.q > 0 ? '#ffd46b' : '#ff9a3d');
        let prev = null;
        for (let k = 0; k <= SEGS; k++) {
          const tt = tStart + (tEnd - tStart) * k / SEGS, P = M.trackPoint(tr, tt);
          const pr = M.project(cam, [P[0], P[1], M.TUBE.Z_IP + P[2]]);
          const px = pr ? [aw / 2 + pr[0] * ah / 2, ah / 2 + pr[1] * ah / 2] : null;
          if (px && prev && nInst < MAX_INST) {
            const head = k / SEGS, I = fade * (0.25 + 0.75 * head) * 0.9, o = nInst * 8;
            inst[o] = prev[0]; inst[o + 1] = prev[1]; inst[o + 2] = px[0]; inst[o + 3] = px[1];
            inst[o + 4] = tint[0] * I; inst[o + 5] = tint[1] * I; inst[o + 6] = tint[2] * I; inst[o + 7] = Math.max(1.1, 1.6 * ah / 540);
            nInst++;
          }
          prev = px;
        }
      }
    }
    const bass = E.bands ? M.clamp01(((E.bands.sub || 0) + (E.bands.kick || 0)) / 2) : 0;

    // ======================= draw
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.main.f); gl.viewport(0, 0, aw, ah);
    const tp = progs.tube, tu = tp.u; gl.useProgram(tp.p); gl.bindVertexArray(vao);
    gl.uniform2f(tu.uRes, aw, ah); gl.uniform2f(tu.uOff, M.TUBE.OFF[0], M.TUBE.OFF[1]);
    gl.uniform3fv(tu.uF, cam.f); gl.uniform3fv(tu.uR, cam.r); gl.uniform3fv(tu.uU, cam.u);
    gl.uniform1f(tu.uFocal, M.TUBE.FOCAL); gl.uniform1f(tu.uTwist, M.TUBE.TWIST);
    const ph = M.travelPhases(st.s);
    gl.uniform1f(tu.uTwPh, ph.twist); gl.uniform1f(tu.uBandPh, ph.band); gl.uniform1f(tu.uRainPh, ph.rainbow); gl.uniform1f(tu.uSHoop, ph.hoop); gl.uniform1f(tu.uSPanel, ph.panel);
    gl.uniform1f(tu.uWireN, M.TUBE.WIRES); gl.uniform1f(tu.uWireW, M.TUBE.WIRE_W); gl.uniform1f(tu.uWireGlow, M.TUBE.WIRE_GLOW);
    gl.uniform1f(tu.uHoopL, M.TUBE.HOOP_L); gl.uniform1f(tu.uHoopAmp, 0.9 * M.hoopAmp(st.v) * glow * intensity); gl.uniform1f(tu.uFog, M.TUBE.FOG);
    gl.uniform1f(tu.uPanelAmp, 0.05 * intensity); gl.uniform1f(tu.uFlow, st.flow % 1); gl.uniform1f(tu.uSweep, drop ? 0.55 : 0);
    gl.uniform1f(tu.uGlow, 0.5 * glow * intensity); gl.uniform1f(tu.uBreath, 0.6 * bass); gl.uniform1f(tu.uSeed, st.seed % 89);
    gl.uniform3fv(tu.uColA, pal[0]); gl.uniform3fv(tu.uColB, pal[1]); gl.uniform3fv(tu.uHoop, M.lin(M.HOOP_HEX)); gl.uniform3fv(tu.uRing, M.lin(M.RING_HEX));
    gl.uniform3fv(tu.uRay, gold); gl.uniform3fv(tu.uPanel, M.lin(M.PANEL_HEX)); gl.uniform3fv(tu.uFire, gold);
    gl.uniform4fv(tu.uRings, KU.u);
    gl.uniform1f(tu.uRayAmp, (0.9 * glow + KU.ray) * intensity); gl.uniform1f(tu.uRayW, 0.018 * (1 + KU.rayW + 0.25 * bass));
    gl.uniform1f(tu.uRayStart, M.TUBE.RAY_START); gl.uniform1f(tu.uZip, M.TUBE.Z_IP);
    gl.uniform3f(tu.uIP, ip ? ip[0] : 0, ip ? ip[1] : 0, ip ? fireR : 0.03); gl.uniform1f(tu.uFireAmp, ip ? fireAmp * intensity : 0); gl.uniform1f(tu.uSpot, ip ? 0.25 * glow * intensity : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (nInst) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      const kp = progs.track; gl.useProgram(kp.p); gl.uniform2f(kp.u.uRes, aw, ah);
      gl.bindVertexArray(trackVao); gl.bindBuffer(gl.ARRAY_BUFFER, trackBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst.subarray(0, nInst * 8));
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst);
      gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.disable(gl.BLEND);
    }
    gl.bindVertexArray(vao);
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
    gl.uniform1f(fu.uFrame, st.frames % 1024); gl.uniform1f(fu.uBloom, 0.4); gl.uniform1f(fu.uExposure, 1.0); gl.uniform1f(fu.uOpacity, ctl.opacity ?? 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // leave the GL state as found (#85 GL rules)
    for (let i = 4; i >= 0; i--) { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, null); }
    gl.bindVertexArray(null); gl.useProgram(null);
    st.frames++;
    st.triggerEnv[0] = ev ? M.fireEnv(tNow - ev.t0) : 0; st.triggerEnv[1] = flareEnv(tNow - st.flareT);
    st.view = { bars, section: Math.floor(bars / M.SECTION_BARS), drop, ip: ip ? [ip[0], ip[1]] : null, fireR, segments: nInst, events: st.events.length,
      floatTargets: floatOk, render: [aw, ah], canvas: [fw, fh], yaw: wd.yaw, pitch: wd.pitch };
    st.metrics = { act: st.act, w, glow, speed: st.v, speedTarget: vT, s: st.s, hoopRate: M.hoopRate(st.v), hoopAmp: M.hoopAmp(st.v),
      kicks: KU.n, kicksStarted: st.K.started, kicksFromEnergy: st.K.fromEnergy, rayPeaks: M.rayPeaksIn(st.K, tNow, 2), collisions: st.collisions, fire: fireAmp,
      beat: { g: BT.g, ring: BT.ring, ray: BT.ray, rayW: BT.rayW, ringNow: KU.ring, rayNow: KU.ray } };
  }

  return {
    id: '18-little-bang-2', title: '18 · Little Bang 2',
    init, resize, frame, dispose, press, release, reset, setRenderScale,
    trigger(name) { const i = ['crossing', 'flare'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: { get view() { return st.view; }, get metrics() { return st.metrics; }, get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; },
      get events() { return st.events.map(e => ({ bar: e.bar, t0: e.t0, drop: e.drop, tracks: e.tracks.length })); }, get frames() { return st.frames; }, get renderScale() { return scale; } },
  };
}

// the #85 manifest: macros, triggers, detail inputs (the page and a host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'speed', label: 'speed', default: M.SPEED.DEFAULT, quantise: 'none' },
  { slot: 'macro2', name: 'intensity', label: 'intensity', default: 0.5, quantise: 'none' },
];
export const TRIGGERS = [
  { slot: 'trigger1', name: 'crossing', label: 'crossing', key: 'Z', mode: 'tap', timing: 'now', repeats: 'restart', attackMs: 50, decayMs: 700 },
  { slot: 'trigger2', name: 'flare', label: 'flare', key: 'X', mode: 'tap', timing: 'now', repeats: 'ignore', attackMs: 200, decayMs: 1500 },
];
export const DETAIL = [
  { name: 'seed', type: 'long', default: 1, min: 1, max: 1e6 },
  { name: 'renderScale', type: 'float', default: 0.5, min: 0.25, max: 1 },
];
export const intensityOf = m => 0.6 + 0.8 * M.clamp01(m);   // macro 2 → the light (0.6 … 1.4 ×, 1 in the middle)
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['seed'], outputs: [],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 1 },
};
