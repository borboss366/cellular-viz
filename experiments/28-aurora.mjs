// 28 Aurora: curtains of northern light over a dark horizon, seen from the ground on a clear night (the user's brief,
// 21 Nov 23:00). The scene module (#85 shape: init / resize / frame / dispose, qa); the page is 28-aurora.html.
//
// The look
//   Three curtain layers (near, middle, far: the far ones lower, smaller and dimmer). Each curtain is a vertical sheet
//   whose lower edge wanders in folds across the sky; the screen x maps to the sheet's own coordinate u through a fold
//   warp, and the sheet's brightness goes with |du/dx| (where the sheet turns towards the eye it is seen edge-on and
//   bunches into bright folds). Rays: thin vertical streaks in u (noise in u only, so they stay vertical), shimmering
//   along their height (a slow noise in u and height that rises). Vertical profile: a sharp lower edge, then a slow
//   fall upward and a soft top. Colour: green, a violet / magenta fringe at the lower edge, and a fading red top that
//   grows on the strongest moments. Sky true black with a few faint stars; the ground below the horizon is pure black
//   (a thin dark band), with a faint airglow just above it so the horizon reads as a line. No landscape.
//
// Music
//   - The kick sends a ripple up the curtains: a band of extra light that starts at each curtain's lower edge and
//     travels up its height in about 0.8 s, fading as it goes (RIPPLE). It is a local band, never the whole frame.
//   - Across a bar the folds drift sideways (the drift phase advances DRIFT_PER_BAR a bar). Across a section
//     (SECTION_BARS = 16 bars) the curtains change shape and the colour balance shifts: each section has its own fold
//     frequency, fold depth, edge height, tilt and colour balance (from the seed), and the last MORPH_BARS bars of a
//     section blend into the next one, so the shape never jumps.
//   - No beat (audio-in's beat weight w, 0 = no confident beat): the drift runs on time instead of beats, the glow
//     drops to IDLE_GLOW (+ the music's level), ripples come only from the music's own low-band onsets, smaller.
//     It never goes blank and never stops moving: the shimmer runs on time always.
//
// Knobs (query parameters on the page; the shared clock's controller knobs 1-8)
//   beatKnob   (default 1) the shared beat gain g (clock.beatGain): scales the ripple. g = 0: no ripple at all.
//   heightKnob (default 2) 0: a low thin band near the horizon ... 1: curtains filling the frame.
//   colourKnob (default 3) 0: all green ... 1: the full green, violet and red mix.
//   Both knob reads go through a pick-up (a value already there when the page met the knobs counts only once it moves).
//
// Flash safety: the ripple multiplies the light by at most 1 + RIPPLE_CAP over a band ~RIPPLE_WIDTH of the curtain's
// height, at most one ripple per RIPPLE_MIN_GAP s (3.3 a second; 180 bpm kicks are 3). The band is one front on the
// screen for all three layers (build 1 ran it in each layer's own height, so a pixel where layers overlap lit up to
// three times per kick: 6 flashes/s at 120 bpm, viz-299-1's general flash). So a pixel flashes at most once per
// ripple, under the 4 a second the flash check counts. The drift and the section morph are slow.
export const AUR = {
  HORIZON: 0.065,            // the horizon line, a share of the frame height from the bottom
  SECTION_BARS: 16, MORPH_BARS: 4,
  DRIFT_PER_BAR: 1,          // drift phase units a bar (the shader turns them into a slow sideways travel)
  IDLE_BARS_PER_S: 0.4,      // no beat: the drift phase on time (a slow 96 bpm-like pace)
  IDLE_GLOW: 0.55,           // no beat: the curtains' light (1 with a beat)
  RIPPLE_AMP: 0.5, RIPPLE_CAP: 1.1, RIPPLE_SPEED: 1.35, RIPPLE_LIFE: 1.0, RIPPLE_WIDTH: 0.085, RIPPLE_MIN_GAP: 0.3,
  DROP_BAR: 12,              // #88 forceDrop: the drop is the start of the morph, bar 12 of each 16-bar section
  RIPPLE_ENERGY: 0.6,        // no beat: a ripple from the music's own onset, this share of a beat ripple
  MAX_RIPPLES: 6,
  G_MAX: 3,
};
export const clamp01 = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
const clampG = g => Math.max(0, Math.min(AUR.G_MAX, g));
const smooth = x => { const k = clamp01(x); return k * k * (3 - 2 * k); };
const mix = (a, b, m) => a + (b - a) * m;

// ---------------------------------------------------------------- the beat gain and the knobs
// g: a fixed ?beatGain (a number) wins, else clock.beatGain(n), else 1 (no getter, or the knob not moved yet)
export function beatGainOf(clock, n, fixed) {
  if (fixed !== null && fixed !== undefined && fixed !== '' && Number.isFinite(+fixed)) return clampG(+fixed);
  if (!clock || typeof clock.beatGain !== 'function') return 1;
  let g = null; try { g = clock.beatGain(n); } catch (e) { g = null; }
  return g === null || g === undefined || !Number.isFinite(+g) ? 1 : clampG(+g);
}
// the pick-up: the knob values the page found on arrival (the last scene's) count as not moved until that knob moves
// by more than PICK_EPS; until then (or with no knobs at all) the fallback (?height / ?colour) holds
export const PICK_EPS = 0.02;
export const pickupCreate = () => ({ snap: null, live: {} });
export function pickup(p, n, knobs) {
  const k = Math.round(+n);
  if (!p || !(k >= 1 && k <= 8) || !Array.isArray(knobs)) return null;
  const val = x => (x !== null && x !== undefined && Number.isFinite(+x) ? clamp01(+x) : null);
  if (p.snap === null) {
    if (!knobs.some(x => val(x) !== null)) return null;
    p.snap = Array.from({ length: 8 }, (_, i) => val(knobs[i]));
  }
  const v = val(knobs[k - 1]);
  if (p.live[k]) return v;
  if (v === null) return null;
  const v0 = p.snap[k - 1];
  if (v0 === null || Math.abs(v - v0) > PICK_EPS) { p.live[k] = true; return v; }
  return null;
}
export function knobValue(p, clock, n, fallback) {
  const k = Math.round(+n);
  if (k >= 1 && k <= 8 && clock) {
    let all = null;
    try { all = Array.isArray(clock.knobs) ? clock.knobs : null; } catch (e) { all = null; }
    const v = all ? pickup(p, k, all) : null;
    if (v !== null) return v;
  }
  return clamp01(+fallback);
}

// ---------------------------------------------------------------- the knobs' meanings
// height 0: a low band (curtain 0.12 of the frame tall, its edge just over the horizon) ... 1: the frame filled
export function heightShape(h) {
  const k = clamp01(h);
  return { H: 0.12 + 0.8 * k, base: 0.012 + 0.05 * k, rayLen: 0.6 + 0.4 * k };
}
// colour 0: all green (fringe and top stay green) ... 1: violet fringe at full and the red top on strong moments
export function colourMix(c, strength) {
  const k = clamp01(c), s = clamp01(strength);
  return { violet: Math.pow(k, 0.8), red: smooth((k - 0.25) / 0.75) * (0.25 + 0.75 * s), green: 1 };
}

// ---------------------------------------------------------------- sections (16 bars), from the seed
const hashU = (a, b) => {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul((b | 0) + 0x7f4a7c15, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d) >>> 0; h ^= h >>> 15; h = Math.imul(h, 0x846ca68b) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};
export function sectionParams(s, seed = 1) {
  const r = i => hashU(seed * 977 + i, s);
  return {
    foldFreq: 0.7 + 1.0 * r(1),      // folds across the frame
    foldAmp: 0.18 + 0.22 * r(2),     // fold depth (sets how bright and tight the folds bunch)
    baseOff: 0.05 * r(3),            // the lower edge's height
    tilt: (r(4) - 0.5) * 0.1,        // the edge slopes a little
    hue: (r(5) - 0.5) * 0.06,        // green leans yellow or teal
    violet: 0.7 + 0.6 * r(6),        // the fringe's share this section
    layer: 10 * r(7),                // the layers' offsets
    peak: 0.4 + 0.6 * r(8),          // how strong the section's middle gets (the red top)
  };
}
// the shape at drift phase `bars` (bars of music, or the no-beat stand-in): this section's, blending into the next
// over the last MORPH_BARS bars (smoothstep, so it never jumps)
export function sectionShape(bars, seed = 1) {
  const L = AUR.SECTION_BARS, b = Number.isFinite(bars) ? bars : 0, s = Math.floor(b / L), inSec = b - s * L;
  const m = smooth((inSec - (L - AUR.MORPH_BARS)) / AUR.MORPH_BARS);
  const A = sectionParams(s, seed), B = sectionParams(s + 1, seed), out = { section: s, inSection: inSec, m };
  for (const k of Object.keys(A)) out[k] = mix(A[k], B[k], m);
  // the section's arc: quiet at its ends, strongest in its middle (the red top follows it)
  out.arc = Math.pow(Math.sin(Math.PI * inSec / L), 2) * out.peak;
  return out;
}

// ---------------------------------------------------------------- the drift phase (beats, or time with no beat)
// v advances by the bars the clock moved at w = 1 and by IDLE_BARS_PER_S on time at w = 0 (mixed in between), so it
// never stops and never jumps when w changes. A clock jump (more than 8 bars, or backwards) moves it by nothing.
// jump: bars QA's forceDrop moved the clock this frame (#88); the phase takes them whole, at any w, so the drop shows.
export const phaseCreate = () => ({ v: null, lastBars: null, adv: 0, jumped: 0 });
export function phaseStep(p, { bars, dt, w, jump = 0 }) {
  const ww = clamp01(w), d = Math.max(0, Math.min(0.25, Number.isFinite(dt) ? dt : 0));
  const j = Number.isFinite(jump) && jump > 0 ? jump : 0;
  if (p.v === null) { p.v = Number.isFinite(bars) ? bars : 0; p.lastBars = bars; return p.v; }
  let db = Number.isFinite(bars) && Number.isFinite(p.lastBars) ? bars - p.lastBars - j : 0;
  if (db < 0 || db > 8) db = 0;
  p.lastBars = bars;
  const step = ww * db + (1 - ww) * d * AUR.IDLE_BARS_PER_S;
  p.v += step + j; p.adv += step; p.jumped += j;
  return p.v;
}

// ---------------------------------------------------------------- ripples
export const rippleAmp = g => Math.min(AUR.RIPPLE_CAP, AUR.RIPPLE_AMP * clampG(Number.isFinite(g) ? g : 1));
export const ripplesCreate = () => ({ list: [], lastT: -1e9, fired: 0, env: 0, at: null });
// one frame: beat kicks (the clock's, count) weighted by w, the music's own onset weighted by 1 - w; at most one new
// ripple per RIPPLE_MIN_GAP; old ones leave after RIPPLE_LIFE. env: a slow sum of the ripples (the red top).
export function rippleStep(R, { t, kicks = 0, onset = false, g = 1, w = 1 }) {
  const ww = clamp01(w), base = rippleAmp(g);
  let amp = 0;
  if (kicks > 0) amp = Math.max(amp, base * ww);
  if (onset) amp = Math.max(amp, base * (1 - ww) * AUR.RIPPLE_ENERGY);
  const dt = R.at === null ? 0 : Math.max(0, Math.min(0.25, t - R.at)); R.at = t;
  R.env *= Math.exp(-dt / 1.5);
  if (amp > 0.02 && t - R.lastT >= AUR.RIPPLE_MIN_GAP - 1e-6) {
    R.list.push({ t0: t, amp }); R.lastT = t; R.fired++; R.env += amp;
    while (R.list.length > AUR.MAX_RIPPLES) R.list.shift();
  }
  R.list = R.list.filter(r => t - r.t0 < AUR.RIPPLE_LIFE);
  return R;
}
// a ripple's front (in curtain heights above the lower edge) and its strength now
export function rippleFront(r, t) {
  const age = t - r.t0;
  if (!(age >= 0) || age >= AUR.RIPPLE_LIFE) return null;
  return { front: age * AUR.RIPPLE_SPEED - 0.04, amp: r.amp * Math.pow(1 - age / AUR.RIPPLE_LIFE, 1.5) };
}

// ---------------------------------------------------------------- the shader
const VS = `#version 300 es
void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime, uPhase, uHorizon, uH, uBase, uRayLen, uGlow, uStrength;
uniform vec4 uShapeA;   // foldFreq, foldAmp, baseOff, tilt
uniform vec4 uShapeB;   // hue, violet, red, layer offset
uniform vec4 uRip[${AUR.MAX_RIPPLES}];   // front, amp, width, -
out vec4 o;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float n1(float x) { float i = floor(x), f = fract(x); float u = f * f * (3.0 - 2.0 * f); return mix(h1(i), h1(i + 1.0), u); }
float n2(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y); }
float fbm(float x) { float s = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { s += a * n1(x); x = x * 2.03 + 1.7; a *= 0.5; } return s; }
// the fold warp of layer k at sheet position xs (drift phase ph)
float warp(float xs, float k, float ph) {
  float f = uShapeA.x, A = uShapeA.y;
  return A * (0.55 * sin(xs * f * 3.3 + ph * 2.0 + 2.1 * k) + 0.9 * (fbm(xs * f * 1.4 + ph * 0.6 + 7.0 * k) - 0.5));
}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y, x = (uv.x - 0.5) * asp, y = uv.y;
  vec3 col = vec3(0.0);
  if (y < uHorizon) { o = vec4(0.0, 0.0, 0.0, 1.0); return; }   // the ground: black
  // faint airglow just above the horizon, so the dark ground reads as a line
  col += vec3(0.004, 0.010, 0.012) * exp(-(y - uHorizon) * 30.0);
  float total = 0.0;
  // the ripple: one band on the screen for all layers, in the front layer's heights (no per-layer wiggle), so each
  // pixel lights once per ripple even where the layers overlap
  float dr = (y - (uHorizon + uBase + uShapeA.z + uShapeA.w * x)) / uH, rip = 0.0;
  for (int i = 0; i < ${AUR.MAX_RIPPLES}; i++) { vec4 R = uRip[i]; if (R.y > 0.0) { float z = (dr - R.x) / R.z; rip += R.y * exp(-z * z); } }
  for (int L = 0; L < 3; L++) {
    float k = float(L), sc = 1.0 - 0.24 * k, bright = (L == 0 ? 1.0 : (L == 1 ? 0.62 : 0.4));
    float ph = uPhase * (0.11 - 0.025 * k);                      // the drift: farther layers drift slower
    float xs = x * (1.0 + 0.4 * k) + uShapeB.w + 3.7 * k;
    float e = 0.004, w0 = warp(xs, k, ph), w1 = warp(xs + e, k, ph);
    float u = xs + w0, dudx = 1.0 + (w1 - w0) / e;
    float fold = pow(clamp(abs(dudx), 0.18, 3.2), 0.85);         // edge-on parts of the sheet bunch up bright
    float base = uHorizon + (uBase + uShapeA.z) * sc + uShapeA.w * x + 0.045 * sc * (fbm(xs * 0.8 + ph * 0.2 + 3.0 * k) - 0.5) * (0.4 + uH);
    float H = uH * sc;
    float d = (y - base) / H;                                    // 0 at the lower edge, 1 at the top
    if (d < -0.08 || d > 1.35) continue;
    float lower = smoothstep(-0.035, 0.012, d);
    float prof = lower * exp(-max(d, 0.0) * 2.0 / uRayLen) * (1.0 - smoothstep(0.6, 1.05, d));
    float upper = lower * smoothstep(0.3, 0.75, d) * (1.0 - smoothstep(0.9, 1.3, d));
    // rays: streaks in u only (vertical), two scales, slow sideways creep
    float r = 0.62 * n1(u * 34.0 + uTime * 0.08 + 13.0 * k) + 0.38 * n1(u * 91.0 - uTime * 0.13 + 5.0 * k);
    float rays = 0.25 + 1.6 * r * r;
    // shimmer: rises along the rays
    float sh = 0.7 + 0.6 * n2(vec2(u * 26.0, d * 3.2 - uTime * 0.85 + 4.0 * k));
    float along = 0.45 + 0.55 * fbm(u * 1.7 + ph * 0.25 + 5.0 * k);   // some stretches of the curtain glow more
    float I = prof * rays * sh * fold * along * bright;
    I *= 1.0 + rip;
    float red = upper * sqrt(rays * fold) * along * bright * uShapeB.z * (0.6 + 0.4 * rip);
    // colour: green, a violet fringe at the lower edge, red at the top
    float fringe = lower * (1.0 - smoothstep(0.0, 0.13, d)) * uShapeB.y;
    vec3 green = vec3(0.12 + uShapeB.x, 1.0, 0.36 - uShapeB.x);
    vec3 violet = vec3(0.72, 0.16, 1.0);
    col += I * mix(green, violet, clamp(fringe, 0.0, 0.85)) + red * vec3(1.0, 0.1, 0.12) * 0.55;
    total += I;
  }
  col *= uGlow * 0.42;
  // stars: a few faint points, dimmed where the aurora is bright and near the horizon
  float cell = max(2.0, uRes.y / 540.0 * 1.6);
  vec2 g = floor(gl_FragCoord.xy / cell);
  float hs = h2(g + 17.0);
  if (hs > 0.9975) {
    float tw = 0.75 + 0.25 * sin(uTime * (0.6 + 2.0 * fract(hs * 911.0)) + hs * 50.0);
    col += vec3(0.85, 0.9, 1.0) * (0.035 + 0.08 * fract(hs * 7919.0)) * tw * smoothstep(uHorizon, uHorizon + 0.08, y) * (1.0 - clamp(total * 1.5, 0.0, 1.0));
  }
  col = 1.0 - exp(-col * 1.25);               // soft shoulder: bright folds never clip
  o = vec4(pow(col, vec3(1.0 / 2.2)), 1.0);   // to the display's gamma
}`;

// ---------------------------------------------------------------- the scene
export function createScene() {
  let gl = null, prog = null, vao = null, U = {}, W = 1, H = 1, seed = 1;
  const st = { phase: phaseCreate(), rip: ripplesCreate(), strength: 0.3, last: null, view: {}, metrics: {}, frames: 0 };
  function init(g, { width = 1, height = 1, seed: sd = 1 } = {}) {
    gl = g; W = width; H = height; seed = sd > 0 ? sd | 0 : 1;
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
    for (const n of ['uRes', 'uTime', 'uPhase', 'uHorizon', 'uH', 'uBase', 'uRayLen', 'uGlow', 'uStrength', 'uShapeA', 'uShapeB', 'uRip']) U[n] = gl.getUniformLocation(prog, n);
    vao = gl.createVertexArray();
  }
  function resize(w, h) { W = Math.max(1, w | 0); H = Math.max(1, h | 0); }
  // one frame. t: seconds; beats / bpb: the clock; dt: seconds since the last frame; controls: { g, height, colour,
  // w (beat weight), level (the music's mean band level), kicks (the clock's kicks this frame), onset (the music's),
  // jump (bars QA's forceDrop moved the clock this frame) }
  function frame({ t, beats, bpb = 4, dt = 1 / 60, controls: c = {} }) {
    const w = clamp01(Number.isFinite(c.w) ? c.w : 1), g = Number.isFinite(c.g) ? clampG(c.g) : 1;
    const bars = (Number.isFinite(beats) ? beats : 0) / (bpb > 0 ? bpb : 4);
    const ph = phaseStep(st.phase, { bars, dt, w, jump: c.jump });
    const S = sectionShape(ph, seed), hs = heightShape(c.height), lvl = clamp01(c.level);
    rippleStep(st.rip, { t, kicks: c.kicks || 0, onset: !!c.onset, g, w });
    // strength: the section's arc, the recent ripples and (no beat) the music's level; slow, so the red top breathes
    const target = clamp01(0.15 + 0.45 * S.arc + 0.35 * Math.min(1, st.rip.env / 1.2) + 0.3 * (1 - w) * lvl);
    const a = 1 - Math.exp(-Math.max(0, Math.min(0.25, dt)) / 1.2);
    st.strength += (target - st.strength) * a;
    const C = colourMix(c.colour, st.strength);
    const glow = mix(AUR.IDLE_GLOW + 0.35 * lvl, 1, w);
    const rips = st.rip.list.map(r => rippleFront(r, t)).filter(Boolean);
    st.frames++;
    st.view = { bars, phase: ph, section: S.section, inSection: +S.inSection.toFixed(3), morph: +S.m.toFixed(3), w, g, glow, strength: st.strength,
      height: clamp01(c.height), colour: clamp01(c.colour), H: hs.H, violet: C.violet * S.violet, red: C.red, ripples: rips.length };
    st.metrics = { g, w, ripplesFired: st.rip.fired, ripplesLive: rips.length, rippleAmp: rippleAmp(g), driftBars: st.phase.adv, jumpedBars: st.phase.jumped, strength: st.strength, frames: st.frames };
    if (!gl) return;
    gl.viewport(0, 0, W, H);
    gl.useProgram(prog); gl.bindVertexArray(vao);
    gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uTime, t % 3600); gl.uniform1f(U.uPhase, ph * AUR.DRIFT_PER_BAR);
    gl.uniform1f(U.uHorizon, AUR.HORIZON); gl.uniform1f(U.uH, hs.H); gl.uniform1f(U.uBase, hs.base); gl.uniform1f(U.uRayLen, hs.rayLen);
    gl.uniform1f(U.uGlow, glow); gl.uniform1f(U.uStrength, st.strength);
    gl.uniform4f(U.uShapeA, S.foldFreq, S.foldAmp, S.baseOff, S.tilt);
    gl.uniform4f(U.uShapeB, S.hue * (1 - 0.5 * (1 - clamp01(c.colour))), Math.min(1.2, C.violet * S.violet), C.red, S.layer);
    const R = new Float32Array(4 * AUR.MAX_RIPPLES);
    rips.forEach((r, i) => { R.set([r.front, r.amp, AUR.RIPPLE_WIDTH, 0], 4 * i); });
    gl.uniform4fv(U.uRip, R);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function dispose() { if (gl && prog) gl.deleteProgram(prog); if (gl && vao) gl.deleteVertexArray(vao); prog = vao = null; }
  return {
    id: '28-aurora', title: '28 Aurora',
    init, resize, frame, dispose,
    qa: { get view() { return st.view; }, get metrics() { return st.metrics; }, get ripples() { return st.rip.list.slice(); } },
  };
}

// the #85 manifest: the knobs this scene reads (by query: ?beatKnob, ?heightKnob, ?colourKnob), no triggers
export const KNOBS = [
  { param: 'beatKnob', name: 'beat', default: 1 },
  { param: 'heightKnob', name: 'height', default: 2 },
  { param: 'colourKnob', name: 'colour', default: 3 },
];
const scene = createScene();
export default {
  ...scene,
  inputs: [{ name: 'height', type: 'float', default: 0.6, min: 0, max: 1 }, { name: 'colour', type: 'float', default: 0.6, min: 0, max: 1 }],
  macros: [], triggers: [], knobs: KNOBS, perf: { soloScale: 1, blendScale: 1 },
};
