// 24 Paint Pour: the scene as a #85 module (init / resize / frame / press / dispose).
// Spec: VIZ research, #87 (body; comments 6478248242, 6478277852, 6479691254). Maths: 24-marble.mjs (float64, also
// run by node).
//
// Tame Impala-style poured acrylic (CANADA's "The Less I Know The Better"): exact closed-form marbling. The ops list
// (drops, tine combs, vortices, circular tines; ≤ opsMax live) is traced backwards per pixel in one fragment pass:
// the newest drop that holds the traced point gives the colour, else the point moves by each op's inverse, down to
// the baked base layer. On top, in the same pass: coloured veins along every boundary and a thick-paint look (a
// height field from the distance to the nearest boundary, a glossy key light, soft creases), plus paint strings
// during the pour. ?qa=flat (controls.flat) turns off height, gloss, creases and strings.
// When the ops fill up, the finished oldest ops are baked into a base texture in 8 row tiles over 8 frames (the old
// base and all ops keep rendering until the swap), then dropped from the list. colourAt/fwd/inv trace the whole op
// history in float64, so the area and topology truths never see the bake's resampling.
// The scene reads beats, beats per bar and bpm from the clock, and the drum hits as beat positions (frame.hits).

import * as K from './24-marble.mjs';

const MAXOPS = 128, BAKE_TILES = 8, BAKE_HEADROOM = 24, HISTORY_MAX = 4096;
const BASE_RECT = [-1.3, -0.85, 2.6, 1.7];   // world rect the base layer covers (the camera's whole range + margin)
const BASE_DIST_K = 0.04;                     // world units per unit of the base's alpha (distance to a boundary)

// ---------------------------------------------------------------- shaders
const VS = `#version 300 es
void main(){ vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }`;
const TRACE = `#version 300 es
precision highp float;
precision highp int;
layout(std140) uniform Ops { vec4 uOp[${3 * MAXOPS}]; };
uniform int uN;
uniform sampler2D uBase; uniform vec4 uBaseRect; uniform float uBaseOn;
uniform vec3 uPal[16];
// the backward trace: q the traced point, gHit the drop that holds it, gD the signed distance to the nearest
// boundary passed (world units at that op's stage, capped): negative inside the newer drop of that boundary, so it
// crosses 0 at every boundary and its screen derivative is smooth there
float gD; int gHit;
void cand(float s) { if (abs(s) < abs(gD)) gD = s; }
vec2 traceOps(vec2 q) {
  gD = 0.05; gHit = -1;
  for (int i = uN - 1; i >= 0; i--) {
    vec4 a = uOp[3 * i]; int ty = int(a.x + 0.5);
    if (ty == 1) {
      float r = a.w; if (r <= 0.0) continue;
      vec2 dv = q - a.yz; float h2 = dot(dv, dv), h = sqrt(h2);
      if (h < r) { gHit = i; cand(h - r); break; }
      cand(h - r);
      q = a.yz + dv * sqrt(max(0.0, 1.0 - r * r / h2));
    } else if (ty == 2) {
      vec4 b = uOp[3 * i + 1], c = uOp[3 * i + 2];
      vec2 M = vec2(a.w, b.x);
      float p = dot(q - a.yz, vec2(-M.y, M.x)), hf = (c.y - 1.0) * c.x * 0.5;
      float j = clamp(floor((p + hf) / c.x + 0.5), 0.0, c.y - 1.0), d = abs(p - (j * c.x - hf));
      q -= b.y * pow(b.z, d / b.w) * M;
    } else if (ty == 3) {
      vec4 b = uOp[3 * i + 1], c = uOp[3 * i + 2];
      vec2 dv = q - a.yz; float h = length(dv), e = c.x > 0.5 ? abs(h - b.y) : h - b.y;
      float ang = -a.w * pow(b.x, e / b.z) / max(h, b.w), cs = cos(ang), sn = sin(ang);
      q = a.yz + vec2(cs * dv.x - sn * dv.y, sn * dv.x + cs * dv.y);
    }
  }
  return q;
}
// the flat colour (linear) at the traced point; the base's distance joins gD
vec3 colourOf(vec2 q) {
  if (gHit >= 0) return uPal[int(uOp[3 * gHit + 1].x + 0.5)];
  vec2 uv = (q - uBaseRect.xy) / uBaseRect.zw;
  if (uBaseOn > 0.5 && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
    vec4 t = textureLod(uBase, uv, 0.0);   // explicit LOD: this is after a divergent loop
    cand((t.a * 2.0 - 1.0) * ${BASE_DIST_K.toFixed(4)});
    return pow(t.rgb, vec3(2.2));
  }
  return uPal[0];
}
`;
const RENDER_FS = TRACE + `
uniform vec2 uRes; uniform vec3 uCam;            // camera x, y (world), zoom (world units per screen height)
uniform float uFlat, uVeinOn, uVeinW, uBevel, uHeight, uGloss, uKick;
uniform vec3 uVein;
uniform vec4 uStr[2]; uniform vec3 uStrCol; uniform float uStrOn;   // strings: pour point (px), top x (px), sag (px)
out vec4 o;
void main() {
  vec2 Q = uCam.xy + (gl_FragCoord.xy - 0.5 * uRes) / uRes.y * uCam.z;
  vec2 q = traceOps(Q);
  vec3 col = colourOf(q);
  float d = gD;
  vec2 g = vec2(dFdx(d), dFdy(d)); float gn = max(length(g), 1e-12);
  float dpx = abs(d) / gn;                     // distance to the nearest boundary, in screen pixels
  vec2 nd = sign(d) * g / gn;                  // pointing away from that boundary
  if (uVeinOn > 0.5) col = mix(col, uVein, 1.0 - smoothstep(uVeinW - 0.5, uVeinW + 0.5, dpx));
  if (uFlat < 0.5) {
    float x = clamp(dpx / uBevel, 0.0, 1.0), h = x * x * (3.0 - 2.0 * x), slope = uHeight * 6.0 * x * (1.0 - x);
    vec3 n = normalize(vec3(-slope * nd, 1.0));
    vec3 L = normalize(vec3(-0.45, 0.55, 0.70)), Hh = normalize(L + vec3(0.0, 0.0, 1.0));
    float diff = max(dot(n, L), 0.0), ao = mix(0.72, 1.0, h);
    float spec = uGloss * (1.0 + 0.1 * uKick) * pow(max(dot(n, Hh), 0.0), 140.0);
    col = col * (0.82 + 0.55 * (diff - 0.70)) * ao + vec3(spec);
    // paint strings: thin glossy threads from the pour point up out of the frame
    if (uStrOn > 0.5) for (int k = 0; k < 2; k++) {
      vec4 s = uStr[k]; float top = uRes.y + 24.0, span = top - s.y;
      if (span <= 1.0 || gl_FragCoord.y < s.y) continue;
      float t = (gl_FragCoord.y - s.y) / span, xc = s.x + (s.z - s.x) * t * t + s.w * sin(3.14159 * t);
      float dxdy = ((s.z - s.x) * 2.0 * t + s.w * 3.14159 * cos(3.14159 * t)) / span;
      float dist = abs(gl_FragCoord.x - xc) / sqrt(1.0 + dxdy * dxdy), th = mix(4.5, 2.0, t) * uRes.y / 1440.0;
      float a = 1.0 - smoothstep(th - 0.75, th + 0.75, dist);
      float hl = exp(-pow((gl_FragCoord.x - xc + 0.35 * th) / (0.35 * th + 0.3), 2.0));
      col = mix(col, uStrCol * 0.8 + vec3(0.5 * uGloss * hl), a);
    }
  }
  o = vec4(pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2)), 1.0);
}`;
const BAKE_FS = TRACE + `
uniform vec2 uBakeSize; uniform vec4 uBakeRect;
out vec4 o;
void main() {
  vec2 Q = uBakeRect.xy + gl_FragCoord.xy / uBakeSize * uBakeRect.zw;
  vec2 q = traceOps(Q);
  vec3 col = colourOf(q);
  o = vec4(pow(col, vec3(1.0 / 2.2)), 0.5 + 0.5 * clamp(gD / ${BASE_DIST_K.toFixed(4)}, -1.0, 1.0));
}`;
const PROBE_FS = TRACE + `
uniform sampler2D uPts;
out vec4 o;
void main() {
  vec2 Q = texelFetch(uPts, ivec2(gl_FragCoord.xy), 0).xy;
  vec2 q = traceOps(Q);
  o = vec4(q, float(gHit), gD);
}`;

// ---------------------------------------------------------------- the scene
export function createScene() {
  let gl = null, W = 0, H = 0, progs = null, vao = null, ubo = null;
  const opData = new Float32Array(MAXOPS * 12);
  const base = { tex: [null, null], fbo: [null, null], cur: -1, tw: 0, th: 0 };
  const st = {
    pal: K.palette('canada'), palKey: '', live: [], pending: [], history: [], opLog: [], lastBeat: null, frames: 0,
    bake: null, bakes: [], forceBake: false, pour: null, view: null, metrics: {},
    triggerLog: [], triggerEnv: [0, 0, 0, 0], trig: [], lastTrigDrop: -1e9, kickEnv: 0, seed: 1,
  };

  function compile(fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VS], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nu; i++) { const info = gl.getActiveUniform(p, i), loc = gl.getUniformLocation(p, info.name); if (loc) u[info.name.replace(/\[0\]$/, '')] = loc; }
    const known = new Proxy(u, { get: (o, k) => (k in o ? o[k] : null) });   // optimised-out uniforms set as no-ops
    const bi = gl.getUniformBlockIndex(p, 'Ops'); if (bi !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, bi, 0);
    return { p, u: known };
  }
  function baseTex(w, h) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.bindTexture(gl.TEXTURE_2D, null);
    return [t, f];
  }
  function ensureBase(bakeScale) {   // texels per world unit: 1440 × bakeScale (a 1440p screen pixel at scale 1)
    const max = Math.min(8192, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const k = Math.min(1440 * bakeScale, max / BASE_RECT[2], max / BASE_RECT[3]);
    const tw = Math.round(BASE_RECT[2] * k), th = Math.round(BASE_RECT[3] * k);
    if (base.tw === tw && base.th === th) return;
    freeBase();
    for (let i = 0; i < 2; i++) [base.tex[i], base.fbo[i]] = baseTex(tw, th);
    base.tw = tw; base.th = th; base.cur = -1;
  }
  function freeBase() { for (let i = 0; i < 2; i++) { if (base.tex[i]) { gl.deleteTexture(base.tex[i]); gl.deleteFramebuffer(base.fbo[i]); } base.tex[i] = base.fbo[i] = null; } base.tw = base.th = 0; base.cur = -1; }
  function resize(w, h) { W = w; H = h; }
  function init(g, { width, height, seed = 1 }) {
    gl = g; st.seed = seed; W = width; H = height;
    gl.getExtension('EXT_color_buffer_float');
    progs = { render: compile(RENDER_FS), bake: compile(BAKE_FS) };
    vao = gl.createVertexArray();
    ubo = gl.createBuffer(); gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); gl.bufferData(gl.UNIFORM_BUFFER, opData.byteLength, gl.DYNAMIC_DRAW); gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }
  function dispose() {
    if (!gl) return; freeBase();
    for (const p of Object.values(progs || {})) gl.deleteProgram(p.p);
    gl.deleteBuffer(ubo); gl.deleteVertexArray(vao); gl = null;
  }

  // ---------------------------------------------------------------- ops
  const inputsOf = ctl => ({ seed: ctl.seed ?? st.seed, dropScale: ctl.dropScale, cellsPerDrop: ctl.cellsPerDrop, blackShare: ctl.blackShare, tines: ctl.tines,
    tineDepth: ctl.tineDepth, tineSharp: ctl.tineSharp, vortexOn: ctl.vortexOn, pourRate: ctl.pourRate, bassSwirl: ctl.bassSwirl, camDrift: ctl.camDrift });
  function queue(ops, now, cause) { for (const op of ops) { op.cause = cause; op.created = now; st.pending.push(op); } st.pending.sort((a, b) => a.start - b.start); }
  // move ops whose start has come into the live list (newest last; during a pour, below the pour so it stays on top)
  function admit(beats, now, msPerBeat) {
    while (st.pending.length && st.pending[0].start <= beats + 1e-9 && st.live.length < MAXOPS) {
      const op = st.pending.shift();
      op.perfStart = now; op.syncMs = (beats - op.start) * msPerBeat;   // how late after its beat it went live (ms)
      const pi = st.live.findIndex(o => o.role === 'pour' && beats < o.start + o.dur);
      if (pi >= 0 && op.role !== 'pour') st.live.splice(pi, 0, op); else st.live.push(op);
      st.history.push(op); if (st.history.length > HISTORY_MAX) st.history.shift();
      st.opLog.push({ tBeat: op.start, type: K.TYPE_NAMES[op.type], role: op.role, cause: op.cause, epoch: st.epochId, syncMs: op.syncMs, params: paramsOf(op) });
      if (st.opLog.length > HISTORY_MAX) st.opLog.shift();
      if (op.role === 'pour') st.pour = op;
      if (op.role === 'drop') st.lastDropColour = op.colour;
    }
    while (st.pending.length > 512) st.pending.shift();
  }
  const paramsOf = op => { const p = {}; for (const [k, v] of Object.entries(op)) if (!['cause', 'created', 'perfStart', 'syncMs', 'role'].includes(k)) p[k] = typeof v === 'number' ? +v.toPrecision(12) : v; return p; };
  function pack(ops, beats) {
    opData.fill(0);
    ops.forEach((op, i) => {
      const e = K.effective(op, beats), o = i * 12;
      if (e.type === K.DROP) opData.set([1, e.cx, e.cy, e.r, e.colour, 0, 0, 0], o);
      else if (e.type === K.COMB) opData.set([2, e.bx, e.by, e.mx, e.my, e.z, e.u, e.lam, e.sp, e.n, 0, 0], o);
      else opData.set([3, e.cx, e.cy, e.z, e.u, e.r0, e.lam, e.hmin, e.ring, 0, 0, 0], o);
    });
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, opData); gl.bindBuffer(gl.UNIFORM_BUFFER, null);
  }
  function setTrace(pr, n) {
    const u = pr.u; gl.uniform1i(u.uN, n);
    const cols = new Float32Array(48); st.pal.colours.forEach((h, i) => { if (i < 16) cols.set(K.rgb(h).map(K.linear), i * 3); });
    gl.uniform3fv(u.uPal, cols);
    gl.uniform4fv(u.uBaseRect, BASE_RECT); gl.uniform1f(u.uBaseOn, base.cur >= 0 ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, base.cur >= 0 ? base.tex[base.cur] : null); gl.uniform1i(u.uBase, 0);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);
  }

  // a fresh canvas: no paint, no ops (the page calls it on Play, so the song starts from the ground)
  function reset() {
    Object.assign(st, { live: [], pending: [], history: [], opLog: [], lastBeat: null, bake: null, bakes: [], pour: null, trig: [], lastTrigDrop: -1e9, kickBeat: undefined, lastDropColour: undefined });
    base.cur = -1;
  }
  function press(slot, holdMs = 0, now = performance.now()) {
    const e = { t: now, slot: `trigger${slot}`, holdMs, firedAt: null, quantisedTo: null, fired: null };
    st.triggerLog.push(e); if (st.triggerLog.length > 256) st.triggerLog.shift();
    st.trig.push({ slot, e });
    return true;
  }

  function frame({ target = null, beats, bpb = 4, bpm = 120, hits = [], controls: ctl, now = performance.now() }) {
    const fw = target ? target.width : W, fh = target ? target.height : H;
    W = fw; H = fh;
    const msPerBeat = 60000 / bpm, perfOf = b => now - (beats - b) * msPerBeat;
    const pk = `${ctl.palette}|${ctl.seed}`;
    if (pk !== st.palKey) { st.pal = K.palette(ctl.palette); st.palKey = pk; }
    ensureBase(ctl.bakeScale);
    const inp = inputsOf(ctl), ev = { bpb, bpm };
    // --- the song and the drums since the last frame (the clock jumped back or far ahead: start from here)
    // (a jump of more than a bar, as forceDrop makes, starts at the current beat, so a drop it lands on still fires)
    if (st.lastBeat === null || beats < st.lastBeat - 1e-6 || beats - st.lastBeat > bpb) {
      st.lastBeat = Math.floor(beats + 1e-9) - 1e-6;
      st.pending = []; st.epoch = st.lastBeat; st.epochId = (st.epochId || 0) + 1;
    }
    st.inp = inp; st.bpb = bpb; st.bpm = bpm; st.pat = ctl.pattern || null;
    for (const e of K.eventsIn(st.lastBeat, beats, bpb, hits)) {
      if (e.kind === 'kick') st.kickBeat = e.beat;
      const ops = ctl.freeze ? [] : K.songOps(e, inp, st.pal, bpb, bpm);
      if (ops.length) queue(ops, now, e.kind);
    }
    st.lastBeat = Math.max(st.lastBeat, beats);
    // --- triggers: 1 drop (beat; ignored while a trigger drop grows), 2 cells (now), 3 vortex (beat), 4 comb (beat)
    const nextBeat = Math.floor(beats + 1e-6) + 1;
    for (const { slot, e } of st.trig.splice(0)) {
      const at = slot === 2 ? beats : nextBeat;
      let ops = [];
      if (slot === 1) {
        if (beats < st.lastTrigDrop) { e.fired = false; continue; }
        ops = K.opsFor({ ...ev, kind: 'drop', beat: at }, { ...inp, cellsPerDrop: 0 }, st.pal).filter(o => o.role === 'drop');
        for (const o of ops) {   // a colour other than the last big drop's, and its growth time for that colour
          const big = st.pal.big.filter(c => c !== st.lastDropColour); o.colour = big[Math.floor(K.rngAt(inp.seed, 7, at)() * big.length)];
          o.dur = K.growSeconds(o.r / K.cameraAt(at, bpb, inp.camDrift).zoom, st.pal.L[o.colour] - st.pal.L[0], 60 / bpm) * bpm / 60;
        }
        st.lastTrigDrop = at + (ops[0] ? ops[0].dur : 1);
      } else if (slot === 2) ops = K.opsFor({ ...ev, kind: 'drop', beat: at - bpb }, inp, st.pal).filter(o => o.role === 'cell').slice(0, 12).map((o, j) => ({ ...o, start: at + j * 0.08 }));
      else if (slot === 3) ops = K.opsFor({ ...ev, kind: 'snare', beat: at }, { ...inp, vortexOn: true }, st.pal).map(o => ({ ...o, r0: o.r0 * 2, z: o.z * 2, lam: o.lam * 2, hmin: o.hmin * 2, dur: 0.5 }));
      else if (slot === 4) ops = K.opsFor({ ...ev, kind: 'kick', beat: at }, { ...inp, tines: 1 }, st.pal);
      e.fired = ops.length > 0; e.quantisedTo = perfOf(at); e.target = at;
      for (const o of ops) o.trigger = slot;
      queue(ops, now, `trigger${slot}`);
    }
    admit(beats, now, msPerBeat);
    for (const e of st.triggerLog) if (e.fired && e.firedAt === null && e.target !== undefined && beats >= e.target) e.firedAt = now;
    // --- bake: when the ops near opsMax (or forced), bake the finished oldest ops in 8 row tiles, then drop them
    if (!st.bake) {
      const n0 = (() => { let n = 0; while (n < st.live.length && K.progress(st.live[n], beats) >= 1 && !(st.live[n].role === 'pour' && beats < st.live[n].start + st.live[n].dur)) n++; return n; })();
      if ((st.live.length >= Math.min(MAXOPS, ctl.opsMax) - BAKE_HEADROOM || st.forceBake) && n0 > 0) {
        st.bake = { n0, tile: 0, dst: base.cur === 0 ? 1 : 0, ops: st.live.slice(0, n0), t0: now, beat: beats, forced: st.forceBake };
      }
      st.forceBake = false;
    }
    gl.bindVertexArray(vao); gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    if (st.bake) {
      const b = st.bake, bp = progs.bake, rows = Math.ceil(base.th / BAKE_TILES);
      pack(b.ops, beats);
      gl.useProgram(bp.p); setTrace(bp, b.n0);
      gl.uniform2f(bp.u.uBakeSize, base.tw, base.th); gl.uniform4fv(bp.u.uBakeRect, BASE_RECT);
      gl.bindFramebuffer(gl.FRAMEBUFFER, base.fbo[b.dst]); gl.viewport(0, 0, base.tw, base.th);
      gl.enable(gl.SCISSOR_TEST); gl.scissor(0, b.tile * rows, base.tw, rows);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.SCISSOR_TEST);
      b.tile++;
      if (b.tile >= BAKE_TILES) {   // swap: the new base holds exactly what the baked ops drew
        base.cur = b.dst; st.live.splice(0, b.n0);
        st.bakes.push({ t: now, beat: b.beat, ops: b.n0, frames: BAKE_TILES, ms: now - b.t0, forced: b.forced }); if (st.bakes.length > 64) st.bakes.shift();
        st.bake = null;
      }
    }
    // --- envelopes, camera, pour, strings
    const kickAge = st.kickBeat === undefined ? 99 : (beats - st.kickBeat) * msPerBeat / 1000;
    const kick = kickAge >= 0 ? Math.exp(-kickAge / 0.15) : 0;
    const cam = K.cameraAt(beats, bpb, inp.camDrift);
    const toPx = (x, y) => [fw / 2 + (x - cam.x) / cam.zoom * fh, fh / 2 + (y - cam.y) / cam.zoom * fh];
    let strOn = 0; const str = new Float32Array(8), strCol = [0, 0, 0];
    const pour = st.pour && beats < st.pour.start + st.pour.dur + 0.5 && beats >= st.pour.start ? K.effective(st.pour, beats) : null;
    if (pour && ctl.strings > 0 && !ctl.flat) {
      const [px, py] = toPx(pour.cx, pour.cy), sway = Math.sin(2 * Math.PI * beats / 8);
      str.set([px, py, px + 0.06 * fh * sway, 0.04 * fh, px + 0.012 * fh, py, px + 0.12 * fh + 0.03 * fh * sway, -0.03 * fh]);
      strOn = 1; K.rgb(st.pal.colours[pour.colour]).map(K.linear).forEach((v, i) => { strCol[i] = v; });
    }
    // --- draw
    pack(st.live, beats);
    const rp = progs.render, u = rp.u; gl.useProgram(rp.p); setTrace(rp, st.live.length);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null); gl.viewport(0, 0, fw, fh);
    gl.uniform2f(u.uRes, fw, fh); gl.uniform3f(u.uCam, cam.x, cam.y, cam.zoom);
    const vein = ctl.veinColour === 'none' ? -1 : (st.pal.veins[ctl.veinColour] ?? st.pal.veins.lime);
    gl.uniform1f(u.uFlat, ctl.flat ? 1 : 0); gl.uniform1f(u.uVeinOn, vein >= 0 ? 1 : 0); gl.uniform1f(u.uVeinW, ctl.veinWidth * fh / 1440);
    gl.uniform3fv(u.uVein, vein >= 0 ? K.rgb(st.pal.colours[vein]).map(K.linear) : [0, 0, 0]);
    gl.uniform1f(u.uBevel, ctl.bevelWidth * fh / 1440); gl.uniform1f(u.uHeight, ctl.paintHeight); gl.uniform1f(u.uGloss, ctl.gloss); gl.uniform1f(u.uKick, kick);
    gl.uniform4fv(u.uStr, str); gl.uniform3fv(u.uStrCol, strCol); gl.uniform1f(u.uStrOn, strOn);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // leave the GL state as found (#85 GL rules)
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null); gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, null);
    gl.bindVertexArray(null); gl.useProgram(null); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // --- QA state
    const growing = st.live.filter(o => K.progress(o, beats) < 1).length;
    st.view = { beats, bars: beats / bpb, phase: K.phaseOf(beats / bpb), section: Math.floor(beats / bpb / K.SECTION_BARS), live: st.live.length, pending: st.pending.length,
      growing, baking: !!st.bake, bases: st.bakes.length, cam, palette: st.pal.name };
    st.metrics = { ops: st.live.length, history: st.history.length, kick };
    st.triggerEnv[0] = st.live.some(o => o.trigger === 1 && K.progress(o, beats) < 1) ? 1 - K.progress(st.live.find(o => o.trigger === 1 && K.progress(o, beats) < 1), beats) : 0;
    st.triggerEnv[1] = st.live.filter(o => o.trigger === 2 && K.progress(o, beats) < 1).length / 12;
    st.triggerEnv[2] = st.live.some(o => o.trigger === 3 && K.progress(o, beats) < 1) ? 1 : 0;
    st.triggerEnv[3] = st.live.some(o => o.trigger === 4 && K.progress(o, beats) < 1) ? 1 : 0;
    st.beats = beats;
    st.frames++;
  }

  // ---------------------------------------------------------------- QA
  const effAll = ops => ops.map(o => K.effective(o, st.beats ?? 0));
  function traceGPU(points) {   // [[x, y] world] → [{ x, y, hit, d }] from the shader's own trace (live ops + base)
    if (!gl) return null;
    if (!progs.probe) progs.probe = compile(PROBE_FS);
    const n = points.length, w = Math.min(n, 1024), h = Math.ceil(n / w), data = new Float32Array(w * h * 4);
    points.forEach(([x, y], i) => data.set([x, y, 0, 0], i * 4));
    const pt = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, pt);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const ot = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, ot); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ot, 0);
    const pp = progs.probe; gl.useProgram(pp.p);
    pack(st.live, st.beats ?? 0); setTrace(pp, st.live.length);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, pt); gl.uniform1i(pp.u.uPts, 1);
    gl.bindVertexArray(vao); gl.viewport(0, 0, w, h); gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
    const out = new Float32Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, out);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.deleteFramebuffer(fb); gl.deleteTexture(pt); gl.deleteTexture(ot);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, null); gl.bindVertexArray(null); gl.useProgram(null);
    return points.map((_, i) => ({ x: out[i * 4], y: out[i * 4 + 1], hit: Math.round(out[i * 4 + 2]), d: out[i * 4 + 3] }));
  }
  // the same trace on the CPU in float64, over the live ops only (what the shader traces; base below)
  const traceCPU = points => { const ops = effAll(st.live); return points.map(([x, y]) => K.trace(ops, x, y)); };
  // the truth over the whole op history (no bake), float64: the colour index at a world point
  function colourAt(x, y) { const ops = effAll(st.history), t = K.trace(ops, x, y); return t.hit >= 0 ? ops[t.hit].colour : 0; }
  function colourGrid(x0, y0, x1, y1, n) {   // n × n colour indices (row-major, y from y0), for the area and topology truths
    const ops = effAll(st.history), out = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const t = K.trace(ops, x0 + (x1 - x0) * (i + 0.5) / n, y0 + (y1 - y0) * (j + 0.5) / n); out[j * n + i] = t.hit >= 0 ? ops[t.hit].colour : 0; }
    return out;
  }
  const fwdAll = (x, y) => K.fwd(effAll(st.history), x, y), invAll = (x, y) => K.inv(effAll(st.history), x, y);
  // the truths that run in the page (float64 unless said): 1, 3 (GPU), 4, 5, 9, 10
  function check() {
    const out = {}, r = K.rng(11), U = () => r() * 2 - 1;
    // 1: area-preserving: det J = 1 for every op type, 10⁴ points each (drops: outside the disk, away from C)
    const kinds = {
      comb: () => ({ type: K.COMB, bx: U(), by: U(), ...(a => ({ mx: Math.cos(a), my: Math.sin(a) }))(r() * 6.283), z: 0.02 + 0.05 * r(), u: 0.3 + 0.3 * r(), lam: 0.02, sp: 0.1, n: 5 }),
      vortex: () => { const r0 = 0.06 + 0.1 * r(); return { type: K.SWIRL, cx: U(), cy: U(), z: Math.PI / 2 * r0, u: 0.35, r0, lam: r0, hmin: 0.3 * r0, ring: 0 }; },
      ring: () => ({ type: K.SWIRL, cx: U(), cy: U(), z: 0.03, u: 0.5, r0: 0.6, lam: 0.25, hmin: 0.2, ring: 1 }),
      drop: () => ({ type: K.DROP, cx: U(), cy: U(), r: 0.03 + 0.3 * r() }),
    };
    out.t1 = {};
    for (const [name, mk] of Object.entries(kinds)) {
      let w = 0;
      for (let k = 0; k < 50; k++) {
        const o = mk();
        for (let j = 0; j < 200; j++) {
          const x = U() * 2, y = U() * 2, h = Math.hypot(x - (o.cx ?? 1e9), y - (o.cy ?? 1e9));
          if (o.type !== K.COMB && h < 1e-2) continue;
          if (o.type === K.SWIRL && h < 1.05 * o.hmin) continue;   // the capped core (fast spin: finite-difference error, not the map)
          w = Math.max(w, Math.abs(K.jacobianDet((a, b) => K.fwdOp(o, a, b), x, y) - 1));
        }
      }
      out.t1[name] = w;
    }
    out.t1.ok = Object.values(out.t1).every(v => v < 1e-5);
    // 3: the shader's trace against the float64 trace, 2048 points in the view (live ops; the base is below both)
    const cam = st.view ? st.view.cam : { x: 0, y: 0, zoom: 1 }, pts = [];
    for (let k = 0; k < 2048; k++) pts.push([cam.x + U() * 0.9 * cam.zoom, cam.y + U() * 0.5 * cam.zoom]);
    const G = traceGPU(pts), C = traceCPU(pts);
    let maxErr = 0, mism = 0, near = 0;
    if (G) pts.forEach((_, i) => {
      const c = C[i], g = G[i], nearB = Math.abs(c.d) < 1e-3 || Math.abs(g.d) < 1e-3;
      if (c.hit !== g.hit) { if (nearB) near++; else mism++; return; }
      maxErr = Math.max(maxErr, Math.hypot(c.x - g.x, c.y - g.y));
    });
    out.t3 = { points: pts.length, ops: st.live.length, maxErr, hitMismatch: mism, nearBoundary: near, ok: !!G && maxErr < 1e-4 && mism === 0 };
    // 4: a stroke then the same stroke reversed (N then S) is the identity
    let w4 = 0;
    for (let k = 0; k < 200; k++) {
      const a = kinds.comb(), b = { ...a, mx: -a.mx, my: -a.my }, x = U(), y = U(), p = K.fwd([a, b], x, y);
      w4 = Math.max(w4, Math.hypot(p[0] - x, p[1] - y));
    }
    out.t4 = { maxErr: w4, ok: w4 < 1e-6 };
    // 5: the pour law: r = √(rate·t/π)
    const pv = pourView();
    out.t5 = pv ? { ...pv, relErr: pv.expectR > 0 ? Math.abs(pv.r - pv.expectR) / pv.expectR : 0, ok: pv.expectR === 0 || Math.abs(pv.r - pv.expectR) / pv.expectR < 0.005 } : { ok: null, note: 'no pour yet' };
    // 9: determinism: the song's ops since the last clock reset, replayed from the seed and the beat clock alone
    if (st.epoch !== undefined && st.pat) {
      const a = st.epoch, b = st.lastBeat, inp = st.inp, rep = [];
      for (const e of K.eventsIn(a, b, st.bpb, K.patternHits(a, b, st.bpb, st.pat))) for (const op of K.songOps(e, inp, st.pal, st.bpb, st.bpm)) if (op.start <= b + 1e-9) rep.push(op);
      const key = o => `${o.tBeat ?? o.start}|${o.role}|${JSON.stringify(o.params ?? paramsOf(o))}`;
      const logged = st.opLog.filter(o => o.epoch === st.epochId && !/^trigger/.test(o.cause)).map(key).sort(), replay = rep.map(o => key({ ...o, params: paramsOf(o) })).sort();
      let diff = Math.abs(logged.length - replay.length); for (let i = 0; i < Math.min(logged.length, replay.length); i++) if (logged[i] !== replay[i]) diff++;
      out.t9 = { from: a, to: b, logged: logged.length, replayed: replay.length, diff, ok: diff === 0 };
    } else out.t9 = { ok: null, note: 'no beats yet' };
    // 10: contrast against the ground ≥ 3:1 for every colour of the palette
    const ratios = Object.fromEntries(st.pal.colours.slice(1).map(h => [h, +K.contrast(h, K.GROUND).toFixed(2)]));
    out.t10 = { palette: st.pal.name, ratios, min: Math.min(...Object.values(ratios)), ok: Object.values(ratios).every(v => v >= 3), bigMaxL: Math.max(...st.pal.big.map(i => st.pal.L[i])) };
    out.t10.ok = out.t10.ok && out.t10.bigMaxL <= 0.75;
    out.ok = out.t1.ok && out.t3.ok && out.t4.ok && out.t5.ok !== false && out.t9.ok !== false && out.t10.ok;
    return out;
  }
  const opsView = () => st.live.map(o => ({ t: o.perfStart, tBeat: o.start, type: K.TYPE_NAMES[o.type], role: o.role, params: paramsOf(o), s: K.progress(o, st.beats ?? 0) }));
  const pourView = () => { if (!st.pour) return null; const e = K.effective(st.pour, st.beats ?? 0), t = Math.max(0, Math.min(st.beats ?? 0, st.pour.start + st.pour.dur) - st.pour.start); return { rate: st.pour.pour, t, r: e.r, area: Math.PI * e.r * e.r, expectR: Math.sqrt(st.pour.pour * t / Math.PI) }; };

  return {
    id: '24-paint-pour', title: '24 · Paint Pour',
    init, resize, frame, dispose, press, reset,
    trigger(name) { const i = ['drop', 'cells', 'vortex', 'comb'].indexOf(name); return i >= 0 ? press(i + 1) : false; },
    qa: { get view() { return st.view; }, get metrics() { return st.metrics; }, get ops() { return opsView(); }, get opLog() { return st.opLog; },
      get bakes() { return st.bakes; }, get pour() { return pourView(); }, get palette() { return st.pal; },
      get triggerLog() { return st.triggerLog; }, get triggerEnv() { return st.triggerEnv; },
      forceBake() { st.forceBake = true; return true; }, traceGPU, traceCPU, colourAt, colourGrid, fwd: fwdAll, inv: invAll, check },
  };
}

// the #85 manifest: macros, triggers, detail inputs (the standalone page and the host read the same lists)
export const MACROS = [
  { slot: 'macro1', name: 'swirl', label: 'bass swirl', default: 0.5, quantise: 'none' },
  { slot: 'macro2', name: 'tines', label: 'tine depth', default: 0.5, quantise: 'none' },
  { slot: 'macro3', name: 'paint', label: 'thick paint', default: 0.6, quantise: 'none' },
  { slot: 'macro4', name: 'drift', label: 'camera drift', default: 0.5, quantise: 'none' },
];
export const TRIGGERS = [
  { slot: 'trigger1', name: 'drop', label: 'big drop', key: 'Z', mode: 'tap', timing: 'beat', repeats: 'ignore', attackMs: 0, decayMs: 800 },
  { slot: 'trigger2', name: 'cells', label: 'cells', key: 'X', mode: 'tap', timing: 'now', repeats: 'restart', attackMs: 0, decayMs: 600 },
  { slot: 'trigger3', name: 'vortex', label: 'vortex', key: 'C', mode: 'tap', timing: 'beat', repeats: 'restart', attackMs: 0, decayMs: 250 },
  { slot: 'trigger4', name: 'comb', label: 'comb', key: 'V', mode: 'tap', timing: 'beat', repeats: 'restart', attackMs: 0, decayMs: 250 },
];
export const DETAIL = [
  { name: 'palette', type: 'long', values: K.PALETTE_NAMES, default: 'canada' },
  { name: 'veinColour', type: 'long', values: ['lime', 'yellow', 'black', 'none'], default: 'lime' },
  { name: 'seed', type: 'long', default: 1, min: 1, max: 1e6 },
  { name: 'opsMax', type: 'long', default: 96, min: 32, max: 128 },
  { name: 'dropScale', type: 'float', default: 1, min: 0.4, max: 1.4 },
  { name: 'cellsPerDrop', type: 'float', default: 0.5, min: 0, max: 1 },
  { name: 'blackShare', type: 'float', default: 0.3, min: 0, max: 0.6 },
  { name: 'tines', type: 'float', default: 0.5, min: 0, max: 1 },
  { name: 'tineSharp', type: 'float', default: 0.5, min: 0, max: 1 },
  { name: 'vortexOn', type: 'bool', default: true },
  { name: 'pourRate', type: 'float', default: 0.006, min: 0, max: 0.02 },
  { name: 'strings', type: 'float', default: 1, min: 0, max: 1 },
  { name: 'veinWidth', type: 'float', default: 0.9, min: 0.4, max: 3 },
  { name: 'bevelWidth', type: 'float', default: 14, min: 4, max: 30 },
  { name: 'bakeScale', type: 'float', default: 1, min: 0.5, max: 2 },
];
// macro value → inputs
export function macroInputs(m) {
  return { bassSwirl: m[0], tineDepth: 0.3 + 1.4 * m[1], paintHeight: 1.2 * m[2], gloss: 0.6 * m[2], camDrift: 2 * m[3] };
}
const scene = createScene();
export default {
  ...scene,
  inputs: [...MACROS.map(m => ({ name: m.name, type: 'float', default: m.default, min: 0, max: 1, quantise: m.quantise })), ...DETAIL],
  pin: ['palette', 'seed'], outputs: ['drop', 'bake'],
  macros: MACROS, triggers: TRIGGERS, perf: { soloScale: 1, blendScale: 0.5 },
};
