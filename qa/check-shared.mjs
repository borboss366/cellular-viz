// Shared gates for EVERY scene (#88): A) flash limit (WCAG 2.3.1 general + red flash) and the house comfort rule,
// B) GPU budget per scene at 1440p.   node qa/check-shared.mjs --page 18-little-bang.html [--experiments dir]
//   [--query ''] [--warm 120] [--secs 60] [--flashWarm 10] [--flashSecs 90] [--fov 40] [--out dir] [--only flash|perf]
//   [--press 1,2,3,4 --hz 8 --pressSecs 4]   button mash (#85): inside the flash pass, each listed trigger alone for
//   pressSecs at hz presses/s through __qa.pressTrigger(i), then all of them together; no drops; the flash and comfort
//   rows judge the mash, plus a row of presses sent / fires seen per slot (from __qa.triggerLog, performance.now() ms).
//
// Both passes: Chromium on the 780M (ANGLE gl-egl), viewport 2560×1440, dpr 1, #wrap fullscreen, Play pressed.
// Headless has no display: rAF is paced by Chromium's own 60 Hz frame clock, so "vsync" means that clock.
//
// A) Flash (page loaded with &limiter=off). After each frame's rAF callback the scene canvas is copied
//    (GPU→GPU, texImage2D) into my own WebGL2 context, which box-averages it 4×4 in LINEAR light to 640×360 and
//    writes per pixel L (relative luminance), u′, v′ (CIE 1976) and R/(R+G+B). A worker runs, per pixel:
//    - transitions: L moves the other way by ≥ 0.10 from the last extremum, darker state < 0.80; two opposing
//      transitions = one flash (pairs, so 3 Hz on/off = 3 flashes/s).
//    - red transitions: one state has R/(R+G+B) ≥ 0.8 and the u′v′ distance between the states is > 0.2.
//    - 10° window = 640·10/fov wide, 4:3 (160×120 at fov 40), stride ¼ window. Fail frame: in any window,
//      pixels with ≥ 4 flashes in the trailing 1 s cover > 25 % (general and red separately). Gate: 0 frames.
//    - comfort: frame mean L ≤ 0.60, every window mean ≤ 0.80, window mean rises ≤ 0.25 within 100 ms,
//      pixels with L ≥ 0.9 ≤ 5 % of the frame or for at most 3 frames in a row.
//    The capture must keep ≥ 55 analysed frames/s, else the flash rows are ⚠️ not measured.
// B) GPU (plain page). Prefers the page's __qa.perf (#85 host: [{module, gpuMs[], method}]). Otherwise I wrap
//    every rAF callback in a TIME_ELAPSED_EXT query on the scene's WebGL2 context (sequential, never nested,
//    frames with GPU_DISJOINT_EXT dropped), or a fenceSync wall time (upper bound) without the extension.
//    A page that uses the timer extension itself (13) is not wrapped (queries can't nest): it needs __qa.perf.
//    2 min warm-up, then 60 s measured; __qa.forceDrop() at 20 s if the page has it.
//    Solo gate: GPU p95 ≤ 7.0 ms and p99 ≤ 9.0 ms (standard). Ray-march ruling (#88 comment 6491353229): a page with
//    __qa.scales {soloScale ≥ 0.75, blendScale ≥ 0.5} and blendScale < soloScale is "scaled": solo 12/14 ms + 0 rAF
//    frames > 20 ms, then (with __qa.setRenderScale) a second 60 s window at blendScale gated at 7/9. soloOnly: 14/16.
//    rAF interval p99 and frames > 17.5 ms are reported; the pair gate waits for the #85 host (two modules in one context).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const expDir = path.resolve(arg('experiments', path.join(here, '..', 'experiments')));
const pageName = arg('page');
if (!pageName || !/^[\w.-]+\.html$/.test(pageName)) { console.error('usage: --page NN-name.html'); process.exit(2); }
const query = arg('query', '');
const WARM = +arg('warm', 120), SECS = +arg('secs', 60), FWARM = +arg('flashWarm', 10), FSECS = +arg('flashSecs', 90), FOV = +arg('fov', 40);
const only = arg('only', '');
// button mash: stages = each slot alone, then all together; the flash clip covers 1 s lead-in + stages + 2 s tail
const PRESS = arg('press', '') ? String(arg('press')).split(',').map(s => +s.trim()).filter(n => Number.isInteger(n) && n >= 1 && n <= 4) : [];
const HZ = +arg('hz', 8), PSECS = +arg('pressSecs', 4);   // not --secs: that is the GPU pass's measured window
const STAGES = PRESS.length ? [...PRESS.map(s => [s]), ...(PRESS.length > 1 ? [PRESS] : [])] : [];
const FSECS_RUN = PRESS.length && !process.argv.includes('--flashSecs') ? 1 + STAGES.length * PSECS + 2 : FSECS;
const id = pageName.replace(/\.html$/, '');
const pad = n => String(n).padStart(2, '0'), d = new Date();
const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
const out = path.resolve(arg('out', path.join(here, id, 'checks', `${stamp}-shared`)));
fs.mkdirSync(out, { recursive: true });

// Gating (VIZ research, 28 Oct, so #80 auto-merge isn't blocked): pages that existed before #88 are gated only
// once they have __qa.forceDrop(); until then a failing row shows ⚠️ "would fail". New scenes are always gated.
// When the forceDrop hook PR merges, drop the pages it covers from LEGACY so a lost hook fails again.
const LEGACY = new Set(['01-gray-scott', '02-lenia', '03-lenia-audio', '04-lenia-metronome', '05-flow-lenia', '06-lenia-effects', '07-particle-lenia',
  '08-blend', '09-riemann', '10-bsd', '11-riemann-show', '13-flow-lab', '17-bsd-skater', '19-skate-park',
  '23-shape-shifter', '25-shape-shifter-2',
  '16-hodge-kaleidoscope']);   // 12, 14, 18 left with #94 (29c3e9c, 29 Oct): they have __qa.forceDrop
// by file name only (VIZ research's ruling on #124): 16b (#84) was in flight before #88; 16-neon-lines (16c) and every
// later page are new scenes, so their flash and GPU rows are hard gates (❌), never ⚠️
const legacy = LEGACY.has(id);
// the user's ruling (30 Oct 2026, after watching both pages): no visible flash on 23 and 25, so their general-flash row is
// report-only (⚠️, never ❌); every other row on them stays gated
const FLASH_REPORT_ONLY = new Set(['23-shape-shifter', '25-shape-shifter-2']);
// if this check itself breaks, say so in check.md: ⚠️ on pages from before #88 (never blocks them), ❌ on new scenes
const crash = e => {
  try { fs.writeFileSync(path.join(out, 'check.md'), `# Shared gates (#88) · ${pageName} · ${stamp}\n\n| gate | result | detail |\n|---|---|---|\n` +
    `| the shared check ran to the end | ${legacy ? '⚠️' : '❌'} | ${String(e && e.stack || e).split('\n').slice(0, 2).join(' / ').replace(/[|]/g, ' ').slice(0, 280)} |\n`); } catch {}
  console.error(e); console.log(out); process.exit(1);
};
process.on('uncaughtException', crash); process.on('unhandledRejection', crash);
// my own deadline, under the runner's SHARED_TIMEOUT_MIN (12), so a hang is reported here and not as the runner's ❌
setTimeout(() => crash(new Error(`shared check still running after ${+arg('deadlineMin', 11)} min: stopped`)), +arg('deadlineMin', 11) * 60e3).unref();

// static server: the experiments folder, sub-paths allowed (modules, live/), nothing outside it
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.glsl': 'text/plain' };
const server = http.createServer((q, res) => {
  const p = path.resolve(expDir, '.' + decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (!p.startsWith(expDir + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = extra => `http://127.0.0.1:${server.address().port}/${pageName}?${[query, extra].filter(Boolean).join('&')}`;   // host pages: pass w=2560&h=1440&dpr=1 in --query

const R0 = path.join(os.homedir(), 'qa-libs/root');
const browser = await chromium.launch({ env: { ...process.env, LD_LIBRARY_PATH: `${R0}/usr/lib/x86_64-linux-gnu:${R0}/lib/x86_64-linux-gnu`, FONTCONFIG_FILE: path.join(os.homedir(), 'qa-libs/fonts.conf'),
  __EGL_VENDOR_LIBRARY_DIRS: `${R0}/usr/share/glvnd/egl_vendor.d`, LIBGL_DRIVERS_PATH: `${R0}/usr/lib/x86_64-linux-gnu/dri` }, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=gl-egl', '--ignore-gpu-blocklist'] });
const FULL = '#wrap{width:100vw !important;height:100vh !important;aspect-ratio:auto !important;margin:0 !important}';
const errors = [];

// ---------- injected before the page's own scripts: context capture, rAF wrapper, GPU timer, frame tap ----------
const INIT = `(() => {
  const S = window.__qaShared = { on: false, frames: [], gpu: [], disjoint: 0, method: null, bits: null, pageTimer: false, ctxs: [], all: [], tap: null };
  const getCtx = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    const c = getCtx.call(this, type, attrs);
    if (c && !S.all.includes(this)) S.all.push(this);   // any context type: the flash tap reads the biggest canvas
    if (c && type === 'webgl2' && !S.ctxs.some(x => x.gl === c)) {
      const ge = c.getExtension.bind(c);
      c.getExtension = name => { if (name === 'EXT_disjoint_timer_query_webgl2') S.pageTimer = true; return ge(name); };
      S.ctxs.push({ gl: c, canvas: this, ge });
    }
    return c;
  };
  let gl = null, ext = null, lastTs = -1, active = false;
  const pending = [], fences = [];
  S.scene = () => { const v = S.ctxs.filter(x => x.canvas.isConnected).sort((a, b) => b.canvas.width * b.canvas.height - a.canvas.width * a.canvas.height); return v[0] || null; };
  S.start = () => {
    const sc = S.scene(); gl = sc && sc.gl; S.canvas = sc ? [sc.canvas.width, sc.canvas.height] : null;
    ext = gl ? sc.ge('EXT_disjoint_timer_query_webgl2') : null;
    if (ext) { try { S.bits = { stamp: gl.getQuery(ext.TIMESTAMP_EXT, ext.QUERY_COUNTER_BITS_EXT), elapsed: gl.getQuery(ext.TIME_ELAPSED_EXT, ext.QUERY_COUNTER_BITS_EXT) }; } catch (e) { S.bits = { err: String(e) }; } }
    const qp = window.__qa && window.__qa.perf;
    S.method = Array.isArray(qp) && qp.length ? 'page __qa.perf' : !gl ? 'none (no WebGL2 canvas)' : S.pageTimer ? 'page uses the timer itself' : ext ? 'timer-elapsed (whole rAF callback)' : 'fence-cpu (upper bound)';
    S.perf0 = Array.isArray(qp) ? qp.map(m => (m.gpuMs || []).length) : null;
    S.on = true;
  };
  function poll() {
    while (pending.length) {
      const [ts, q] = pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      const dis = gl.getParameter(ext.GPU_DISJOINT_EXT), ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
      gl.deleteQuery(q); pending.shift();
      if (dis) S.disjoint++; else S.gpu.push([ts, ns / 1e6]);
    }
  }
  const mc = new MessageChannel();   // fence fallback: poll fences without the 4 ms timer clamp
  mc.port1.onmessage = () => {
    for (let i = fences.length - 1; i >= 0; i--) { const [ts, t0, s] = fences[i];
      if (gl.getSyncParameter(s, gl.SYNC_STATUS) === gl.SIGNALED) { S.gpu.push([ts, performance.now() - t0]); gl.deleteSync(s); fences.splice(i, 1); } }
    if (fences.length) mc.port2.postMessage(0);
  };
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => {
    const first = ts !== lastTs; lastTs = ts;
    const timing = S.on && gl && !S.pageTimer && S.method && S.method.startsWith('timer') && !active;
    const fencing = S.on && gl && S.method && S.method.startsWith('fence');
    if (first && S.on) { S.frames.push(ts); if (ext && pending.length) try { poll(); } catch (e) {} }
    let q = null; const t0 = performance.now();
    if (timing) try { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); active = true; } catch (e) { q = null; }
    try { cb(ts); } finally {
      if (q) { try { gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push([ts, q]); } catch (e) {} active = false; }
      if (fencing) { const s = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0); gl.flush(); fences.push([ts, t0, s]); if (fences.length === 1) mc.port2.postMessage(0); }
      if (first && S.tap) try { S.tap(ts); } catch (e) { S.tapErr = String(e); }
    }
  });
})();`;

// the flash tap: my own WebGL2 context, linear-light 4×4 box → (L, u′/0.7, v′/0.7, R/(R+G+B)) RGBA8, worker analysis
const FLASH = `(() => {
  const S = window.__qaShared, AW = 640, AH = 360;
  S.flashStart = (fov) => {
    const src = S.all.filter(c => c.isConnected).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (!src) { S.flashErr = 'no canvas with a context'; return; }
    const cv = new OffscreenCanvas(AW, AH), g = cv.getContext('webgl2', { antialias: false, premultipliedAlpha: false });
    const sh = (t, s) => { const o = g.createShader(t); g.shaderSource(o, s); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
    const pr = g.createProgram();
    g.attachShader(pr, sh(g.VERTEX_SHADER, '#version 300 es\\nvoid main(){vec2 p=vec2(gl_VertexID==1?3.:-1.,gl_VertexID==2?3.:-1.);gl_Position=vec4(p,0,1);}'));
    g.attachShader(pr, sh(g.FRAGMENT_SHADER, \`#version 300 es
precision highp float; uniform sampler2D src; uniform vec2 scale; out vec4 o;
vec3 lin(vec3 c){ return mix(c/12.92, pow((c+.055)/1.055, vec3(2.4)), step(vec3(.04045), c)); }
void main(){ ivec2 sz = textureSize(src,0); vec2 b = floor(gl_FragCoord.xy)*scale; vec3 acc = vec3(0); float n = 0.;
  for (int j=0;j<4;j++) for (int i=0;i<4;i++){ ivec2 p = ivec2(b + (vec2(i,j)+.5)*scale/4.); p = clamp(p, ivec2(0), sz-1);
    vec4 t = texelFetch(src, p, 0); acc += lin(t.rgb)*t.a; n += 1.; }
  vec3 c = acc/n; float L = dot(c, vec3(.2126,.7152,.0722));
  float X = dot(c, vec3(.4124,.3576,.1805)), Z = dot(c, vec3(.0193,.1192,.9505)), den = X + 15.*L + 3.*Z, s = c.r+c.g+c.b;
  o = vec4(L, den > 1e-6 ? 4.*X/den/.7 : 0., den > 1e-6 ? 9.*L/den/.7 : 0., s > 1e-6 ? c.r/s : 0.); }\`));
    g.linkProgram(pr); g.useProgram(pr);
    const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
    for (const [k, v] of [[g.TEXTURE_MIN_FILTER, g.NEAREST], [g.TEXTURE_MAG_FILTER, g.NEAREST], [g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE], [g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE]]) g.texParameteri(g.TEXTURE_2D, k, v);
    g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    const ot = g.createTexture(); g.bindTexture(g.TEXTURE_2D, ot); g.texStorage2D(g.TEXTURE_2D, 1, g.RGBA8, AW, AH);
    const fb = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fb); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, ot, 0);
    g.viewport(0, 0, AW, AH); g.uniform1i(g.getUniformLocation(pr, 'src'), 0);
    const uScale = g.getUniformLocation(pr, 'scale');
    const W = new Worker(URL.createObjectURL(new Blob([S.workerSrc], { type: 'text/javascript' })));
    W.postMessage({ init: { AW, AH, fov } });
    S.flash = { n: 0, ms: 0, W, src: [src.width, src.height], inflight: 0, skipped: 0, done: null };
    W.onmessage = e => { if (e.data.ack) S.flash.inflight--; else if (S.flash.done) S.flash.done(e.data); };
    S.tap = ts => {
      if (S.flash.inflight > 20) { S.flash.skipped++; return; }   // the worker is behind: skip, never queue gigabytes
      const t0 = performance.now();
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
      g.uniform2f(uScale, src.width / AW, src.height / AH);
      g.drawArrays(g.TRIANGLES, 0, 3);
      const px = new Uint8Array(AW * AH * 4); g.readPixels(0, 0, AW, AH, g.RGBA, g.UNSIGNED_BYTE, px);
      W.postMessage({ t: ts, px }, [px.buffer]); S.flash.inflight++;
      S.flash.n++; S.flash.ms += performance.now() - t0;
    };
  };
  S.flashStop = () => new Promise(r => { S.tap = null; S.flash.done = d => r({ ...d, tapMs: +(S.flash.ms / Math.max(1, S.flash.n)).toFixed(2), src: S.flash.src, skipped: S.flash.skipped }); S.flash.W.postMessage({ done: true }); });
})();`;

// the worker: per-pixel transition state machines, flash rings, windows, comfort
const WORKER = `
let AW, AH, N, ww, wh, st, nx, ny, A, B, D, tc, ring, ri, rU, rV, rR, rOk, rtc, rring, rri, IL, IM, IR, hist = [], R;
// trace (report-only): the worst general-flash window's mean L and flashing share per frame, from 1 s before to 1 s after its worst frame
let trHist = [], trW = -1, trEnd = -1;
const nwin = () => nx * ny;
onmessage = e => {
  const m = e.data;
  if (m.init) {
    ({ AW, AH } = m.init); N = AW * AH; ww = Math.round(AW * 10 / m.init.fov); wh = Math.round(ww * 3 / 4); st = Math.max(1, Math.round(ww / 4));
    nx = Math.floor((AW - ww) / st) + 1; ny = Math.floor((AH - wh) / st) + 1;
    A = new Float32Array(N); B = new Float32Array(N); D = new Int8Array(N); tc = new Uint8Array(N); ring = new Float64Array(N * 4).fill(-1e9); ri = new Uint8Array(N);
    rU = new Float32Array(N); rV = new Float32Array(N); rR = new Uint8Array(N); rOk = new Uint8Array(N); rtc = new Uint8Array(N); rring = new Float64Array(N * 4).fill(-1e9); rri = new Uint8Array(N);
    IL = new Float64Array((AW + 1) * (AH + 1)); IM = new Int32Array((AW + 1) * (AH + 1)); IR = new Int32Array((AW + 1) * (AH + 1));
    R = { frames: 0, t0: null, t1: null, win: [ww, wh, st, nx * ny], flashFail: 0, redFail: 0, meanFail: 0, winFail: 0, riseFail: 0, whiteFail: 0,
      worst: { flash: { v: 0 }, red: { v: 0 }, mean: { v: 0 }, win: { v: 0 }, rise: { v: 0 }, white: { v: 0, run: 0 } }, whiteRun: 0, perSec: [] };
    return;
  }
  if (m.done) { postMessage(R); return; }
  const px = m.px, t = m.t, first = R.frames === 0;
  if (first) R.t0 = t; R.t1 = t; R.frames++;
  let sumL = 0, white = 0;
  const cut = t - 1000;
  for (let y = 0; y < AH; y++) {
    let rowL = 0, rowM = 0, rowR = 0; const o = (y + 1) * (AW + 1), op = y * (AW + 1);
    for (let x = 0; x < AW; x++) {
      const i = y * AW + x, k = i * 4, L = px[k] / 255;
      sumL += L; if (L >= 0.9) white++;
      // general transitions
      if (first) { A[i] = L; B[i] = L; }
      else if (D[i] === 0) {
        if (L < A[i]) A[i] = L; if (L > B[i]) B[i] = L;
        if (L - A[i] >= 0.1 && A[i] < 0.8) { D[i] = 1; A[i] = L; tr(i, t, tc, ring, ri); }
        else if (B[i] - L >= 0.1 && L < 0.8) { D[i] = -1; A[i] = L; tr(i, t, tc, ring, ri); }
      } else if (D[i] > 0) { if (L > A[i]) A[i] = L; else if (A[i] - L >= 0.1 && L < 0.8) { D[i] = -1; A[i] = L; tr(i, t, tc, ring, ri); } }
      else { if (L < A[i]) A[i] = L; else if (L - A[i] >= 0.1 && A[i] < 0.8) { D[i] = 1; A[i] = L; tr(i, t, tc, ring, ri); } }
      // red transitions; black has no chromaticity, so L < 0.002 counts as the D65 white point (u' .1978, v' .4683):
      // then a red/black strobe is a red flash (red u'v' is ~0.26 away), as it is to the eye
      {
        const dark = L < 0.002, u = dark ? 0.1978 : px[k + 1] / 255 * 0.7, v = dark ? 0.4683 : px[k + 2] / 255 * 0.7, red = !dark && px[k + 3] / 255 >= 0.8 ? 1 : 0;
        if (!rOk[i]) { rOk[i] = 1; rU[i] = u; rV[i] = v; rR[i] = red; }
        else if ((red || rR[i]) && (u - rU[i]) * (u - rU[i]) + (v - rV[i]) * (v - rV[i]) > 0.04) { rU[i] = u; rV[i] = v; rR[i] = red; tr(i, t, rtc, rring, rri); }
      }
      const j = i * 4;
      const fl = ring[j] > cut && ring[j + 1] > cut && ring[j + 2] > cut && ring[j + 3] > cut ? 1 : 0;
      const rf = rring[j] > cut && rring[j + 1] > cut && rring[j + 2] > cut && rring[j + 3] > cut ? 1 : 0;
      rowL += L; rowM += fl; rowR += rf;
      IL[o + x + 1] = IL[op + x + 1] + rowL; IM[o + x + 1] = IM[op + x + 1] + rowM; IR[o + x + 1] = IR[op + x + 1] + rowR;
    }
  }
  const area = ww * wh, means = new Float32Array(nwin()), fs = new Float32Array(nwin());
  let fMax = 0, fAt = null, fW = -1, rMax = 0, rAt = null, wMax = 0, wAt = null;
  for (let wy = 0; wy < ny; wy++) for (let wx = 0; wx < nx; wx++) {
    const x0 = wx * st, y0 = wy * st, x1 = x0 + ww, y1 = y0 + wh;
    const box = I => I[y1 * (AW + 1) + x1] - I[y0 * (AW + 1) + x1] - I[y1 * (AW + 1) + x0] + I[y0 * (AW + 1) + x0];
    const f = box(IM) / area, r = box(IR) / area, mL = box(IL) / area;
    means[wy * nx + wx] = mL; fs[wy * nx + wx] = f;
    if (f > fMax) { fMax = f; fAt = [x0, y0]; fW = wy * nx + wx; } if (r > rMax) { rMax = r; rAt = [x0, y0]; } if (mL > wMax) { wMax = mL; wAt = [x0, y0]; }
  }
  // rise within 100 ms: current window mean minus the lowest of that window over the last 100 ms
  hist.push([t, means]); while (hist.length && hist[0][0] < t - 100) hist.shift();
  let rise = 0, riseAt = null;
  for (let w = 0; w < means.length; w++) { let lo = means[w]; for (const [, mm] of hist) if (mm[w] < lo) lo = mm[w]; if (means[w] - lo > rise) { rise = means[w] - lo; riseAt = [(w % nx) * st, Math.floor(w / nx) * st]; } }
  const mean = sumL / N, wf = white / N;
  R.whiteRun = wf > 0.05 ? R.whiteRun + 1 : 0;
  const ts = +((t - R.t0) / 1000).toFixed(2), at = p => p && [p[0] * 4, p[1] * 4];   // window corner in 1440p pixels
  const note = (key, v, extra) => { if (v > R.worst[key].v) R.worst[key] = { v: +v.toFixed(4), t: ts, ...extra }; };
  trHist.push([ts, means, fs]); while (trHist.length && trHist[0][0] < ts - 1) trHist.shift();
  const tp = (h, w) => [+(h[0] - R.trace.t).toFixed(3), +h[1][w].toFixed(3), +h[2][w].toFixed(3)];
  if (fMax > 0 && fMax > R.worst.flash.v) { R.trace = { t: ts, at: at(fAt), pts: [] }; trW = fW; trEnd = ts + 1; R.trace.pts = trHist.map(h => tp(h, trW)); }
  else if (R.trace && ts <= trEnd) R.trace.pts.push(tp([ts, means, fs], trW));
  if (fMax > 0.25) R.flashFail++; if (rMax > 0.25) R.redFail++; if (mean > 0.60) R.meanFail++; if (wMax > 0.80) R.winFail++; if (rise > 0.25) R.riseFail++; if (R.whiteRun > 3) R.whiteFail++;
  note('flash', fMax, { at: at(fAt) }); note('red', rMax, { at: at(rAt) }); note('mean', mean); note('win', wMax, { at: at(wAt) }); note('rise', rise, { at: at(riseAt) });
  if (wf > R.worst.white.v || R.whiteRun > R.worst.white.run) R.worst.white = { v: +Math.max(wf, R.worst.white.v).toFixed(4), t: ts, run: Math.max(R.whiteRun, R.worst.white.run) };
  const s = Math.floor(ts); const ps = R.perSec[s] ||= [0, 0, 0]; ps[0] = Math.max(ps[0], +mean.toFixed(3)); ps[1] = Math.max(ps[1], +wMax.toFixed(3)); ps[2] = Math.max(ps[2], +rise.toFixed(3));
  postMessage({ ack: 1 });
};
function tr(i, t, c, rg, ix) { c[i] ^= 1; if (c[i] === 0) { rg[i * 4 + ix[i]] = t; ix[i] = (ix[i] + 1) & 3; } }
`;

async function open(extra) {
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript({ content: INIT });
  await page.goto(url(extra)); await page.addStyleTag({ content: FULL }).catch(() => {}); await page.waitForTimeout(800);
  await page.click('#play', { timeout: 3000 }).catch(() => {});
  return page;
}
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2); };
const res = { page: pageName, query, fov: FOV };
res.renderer = await (async () => { const p = await browser.newPage(); const r = await p.evaluate(() => { const g = document.createElement('canvas').getContext('webgl2'); if (!g) return 'no webgl2'; const e = g.getExtension('WEBGL_debug_renderer_info'); return g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER); }); await p.close(); return r; })();
res.chromium = browser.version();

// ---------- B) GPU budget ----------
if (only !== 'flash') {
  const page = await open('');
  await page.waitForTimeout(WARM * 1000);
  // GPU shader clock during the measured windows (amdgpu pp_dpm_sclk, the line marked *), every 250 ms: the timer reads
  // time at whatever clock power management picked (power_dpm_force_performance_level), not time at full clock
  const SCLK = '/sys/class/drm/card0/device/pp_dpm_sclk', clk = [];
  const sclk = () => { try { const l = fs.readFileSync(SCLK, 'utf8').split('\n').find(s => s.includes('*')); const m = l && l.match(/(\d+)\s*Mhz/i); if (m) clk.push(+m[1]); } catch {} };
  const clkTimer = setInterval(sclk, 250);
  res.perf = await page.evaluate(async secs => {
    const S = window.__qaShared; S.start();
    const qa = window.__qa || {}; let drop = null;
    setTimeout(() => { for (const k of ['forceDrop', 'drop']) if (typeof qa[k] === 'function') { try { qa[k](); drop = k; } catch (e) { drop = 'threw: ' + e; } break; } }, Math.min(20, secs / 3) * 1000);
    await new Promise(r => setTimeout(r, secs * 1000)); S.on = false;
    await new Promise(r => setTimeout(r, 300));
    // ray-march ruling (#88 comment 6491353229): a scene declares { soloScale, blendScale } (fractions of 2560×1440 per axis)
    // as __qa.scales, or as a non-array __qa.perf (the array form is the #85 host's per-module timings)
    const decl = qa.scales && typeof qa.scales === 'object' ? qa.scales : (qa.perf && !Array.isArray(qa.perf) && typeof qa.perf === 'object' ? qa.perf : null);
    const scales = decl && (decl.soloScale != null || decl.blendScale != null) ? { soloScale: +(decl.soloScale ?? 1), blendScale: +(decl.blendScale ?? decl.soloScale ?? 1) } : null;
    const setScale = typeof qa.setRenderScale === 'function';
    let blend = null;
    if (scales && scales.blendScale < scales.soloScale && setScale) {   // second window at blendScale: the number the pair gate uses
      const g0 = S.gpu.length, f0 = S.frames.length;
      try { qa.setRenderScale(scales.blendScale); } catch (e) { blend = { err: String(e).slice(0, 160) }; }
      if (!blend) {
        await new Promise(r => setTimeout(r, 3000));
        const g1 = S.gpu.length, f1 = S.frames.length; S.on = true;
        setTimeout(() => { if (typeof qa.forceDrop === 'function') try { qa.forceDrop(); } catch (e) {} }, Math.min(20, secs / 3) * 1000);
        await new Promise(r => setTimeout(r, secs * 1000)); S.on = false;
        await new Promise(r => setTimeout(r, 300));
        const bf = new Map(); for (const [ts, ms] of S.gpu.slice(g1)) bf.set(ts, (bf.get(ts) || 0) + ms);
        const bfr = S.frames.slice(f1);
        blend = { gpu: [...bf.values()], dt: bfr.slice(1).map((x, i) => x - bfr[i]), skipped: [g1 - g0, f1 - f0] };
        try { qa.setRenderScale(scales.soloScale); } catch (e) {}
      }
      S.gpu.length = g0; S.frames.length = f0;   // the solo numbers below stay the first window only
    }
    const byFrame = new Map(); for (const [ts, ms] of S.gpu) byFrame.set(ts, (byFrame.get(ts) || 0) + ms);
    let modules = null; const qp = window.__qa && window.__qa.perf;
    if (Array.isArray(qp) && qp.length) modules = qp.map((m, i) => ({ module: m.module, method: m.method, gpuMs: (m.gpuMs || []).slice(S.perf0 ? S.perf0[i] || 0 : 0) }));
    const fr = S.frames, dt = fr.slice(1).map((x, i) => x - fr[i]);
    return { method: S.method, bits: S.bits, disjoint: S.disjoint, canvas: S.canvas, dpr: devicePixelRatio, soloOnly: !!(window.__qa && window.__qa.soloOnly),
      gpu: [...byFrame.values()], modules, dt, drop, hook: typeof qa.forceDrop === 'function', pageGpuMs: window.__qa && window.__qa.gpuMs, secs, scales, setScale, blend };
  }, SECS);
  clearInterval(clkTimer);
  try { res.perf.dpmLevel = fs.readFileSync('/sys/class/drm/card0/device/power_dpm_force_performance_level', 'utf8').trim(); } catch { res.perf.dpmLevel = null; }
  // grouped in bands; mean and the card's top level (last line of pp_dpm_sclk) for the validity gate under a pinned level
  let top = null; try { const ls = fs.readFileSync(SCLK, 'utf8').match(/(\d+)\s*Mhz/gi) || []; top = Math.max(...ls.map(s => parseInt(s, 10))); } catch {}
  const bands = [[0, 1000, '<1000'], [1000, 1500, '1000–1499'], [1500, 2000, '1500–1999'], [2000, 2500, '2000–2499'], [2500, 1e9, '≥2500']];
  res.perf.sclk = clk.length ? { n: clk.length, mean: Math.round(clk.reduce((a, b) => a + b, 0) / clk.length), top,
    bands: bands.map(([lo, hi, name]) => [name, +(100 * clk.filter(v => v >= lo && v < hi).length / clk.length).toFixed(1)]).filter(b => b[1] > 0) } : null;
  const p = res.perf, mods = p.modules ? p.modules.map(m => ({ module: m.module, method: m.method, n: m.gpuMs.length, p50: q(m.gpuMs, 0.5), p95: q(m.gpuMs, 0.95), p99: q(m.gpuMs, 0.99) })) : null;
  p.stats = { n: p.gpu.length, p50: q(p.gpu, 0.5), p95: q(p.gpu, 0.95), p99: q(p.gpu, 0.99), modules: mods,
    raf: { n: p.dt.length, p50: q(p.dt, 0.5), p95: q(p.dt, 0.95), p99: q(p.dt, 0.99), over20: p.dt.filter(x => x > 20).length, over: p.dt.filter(x => x > 17.5).length, overPct: +(100 * p.dt.filter(x => x > 17.5).length / Math.max(1, p.dt.length)).toFixed(2), fps: +(1000 * p.dt.length / Math.max(1, p.dt.reduce((a, b) => a + b, 0))).toFixed(1) },
    hist: [8, 12, 16, 17.5, 20, 25, 33.4, 50, 1e9].map((hi, i, a) => [i ? a[i - 1] : 0, hi, p.dt.filter(x => x > (i ? a[i - 1] : 0) && x <= hi).length]) };
  if (p.blend && p.blend.gpu) { const b = p.blend; p.blendStats = { n: b.gpu.length, p50: q(b.gpu, 0.5), p95: q(b.gpu, 0.95), p99: q(b.gpu, 0.99), rafOver20: b.dt.filter(x => x > 20).length, rafN: b.dt.length }; delete b.gpu; delete b.dt; }
  delete p.gpu; delete p.dt; if (p.modules) p.modules = p.modules.map(m => ({ module: m.module, method: m.method, n: m.gpuMs.length }));
  await page.close();
}

// ---------- A) flash + comfort ----------
if (only !== 'perf') {
  const page = await open('limiter=off');
  await page.addScriptTag({ content: `window.__qaShared.workerSrc = ${JSON.stringify(WORKER)};` + FLASH });
  await page.waitForTimeout(FWARM * 1000);
  res.flash = await page.evaluate(async ([secs, fov, stages, hz, psecs]) => {
    const S = window.__qaShared; S.flashStart(fov); if (S.flashErr) return { err: S.flashErr };
    const qa = window.__qa || {}; let drops = [], mash = null;
    if (stages.length) {   // button mash instead of drops: presses through the page's own path (quantise, repeats, envelope)
      const t0 = performance.now() + 1000, step = 1000 / hz, sent = {}, threw = {}, plan = [];
      mash = { hook: typeof qa.pressTrigger === 'function', hz, psecs, stages: [], sent, threw, t0 };
      stages.forEach((slots, si) => {
        const s0 = t0 + si * psecs * 1000; mash.stages.push({ slots, start: s0, end: s0 + psecs * 1000 });
        for (let k = 0; k < Math.round(psecs * hz); k++) plan.push([s0 + k * step, slots]);
      });
      if (mash.hook) for (const [at, slots] of plan) setTimeout(() => { for (const i of slots) { sent[i] = (sent[i] || 0) + 1; try { qa.pressTrigger(i); } catch (e) { threw[i] = String(e).slice(0, 120); } } }, Math.max(0, at - performance.now()));
      mash.end = t0 + stages.length * psecs * 1000;
    } else for (const at of [0.3, 0.65]) setTimeout(() => { for (const k of ['forceDrop', 'drop']) if (typeof qa[k] === 'function') { try { qa[k](); drops.push(k); } catch (e) {} break; } }, at * secs * 1000);
    await new Promise(r => setTimeout(r, secs * 1000));
    const r = await S.flashStop();
    if (mash) {   // fires seen: logged presses in the mash (+2 s for quantised fires) with a finite firedAt, per slot
      const log = Array.isArray(qa.triggerLog) ? qa.triggerLog : null;
      mash.log = !!log; mash.fired = {}; mash.logged = {};
      if (log) for (const e of log) { if (!e || !(e.t >= mash.t0 - 5 && e.t <= mash.end + 2000)) continue;
        mash.logged[e.slot] = (mash.logged[e.slot] || 0) + 1; if (Number.isFinite(e.firedAt)) mash.fired[e.slot] = (mash.fired[e.slot] || 0) + 1; }
      mash.slots = Array.isArray(qa.triggers) ? qa.triggers.map(s => ({ slot: s.slot, name: s.name, timing: s.timing, repeats: s.repeats })) : null;
    }
    return { ...r, drops, mash, hook: typeof qa.forceDrop === 'function', tapErr: S.tapErr || null };
  }, [FSECS_RUN, FOV, STAGES, HZ, PSECS]);
  await page.close();
}
await browser.close(); server.close();

// ---------- report ----------
const hook = !!((res.perf && res.perf.hook) || (res.flash && res.flash.hook));
const gated = !legacy || hook;
res.gating = { legacy, hook, gated };
const rows = [], ok = v => v ? '✅' : '❌';
const add = (g, pass, detail) => {
  if (pass === false && !gated) { pass = 'warn'; detail = `would fail; not gated (page from before #88, no __qa.forceDrop yet) · ${detail}`; }
  rows.push(`| ${g} | ${pass === null ? 'ℹ️' : pass === 'warn' ? '⚠️' : ok(pass)} | ${String(detail).replace(/[|\n]/g, ' ')} |`);
};
if (res.perf) {
  // classes (#88 ray-march ruling, VIZ research 29 Oct, comment 6491353229):
  //   standard 7/9 at 1440p · scaled (blendScale < soloScale): solo at soloScale 12/14 + 0 rAF frames > 20 ms, and at blendScale 7/9
  //   · soloOnly 14/16 (never pairs). Floors: soloScale ≥ 0.75, blendScale ≥ 0.5.
  const p = res.perf, s = p.stats, sc = p.scales, scaled = !!sc && sc.blendScale < sc.soloScale && !p.soloOnly;
  const cls = p.soloOnly ? 'soloOnly' : scaled ? 'scaled' : 'standard', lim = p.soloOnly ? [14, 16] : scaled ? [12, 14] : [7, 9];
  const measured = s.modules ? s.modules.some(m => m.n > 100) : s.n > 100;
  const p95 = s.modules ? Math.max(...s.modules.map(m => m.p95 ?? 0)) : s.p95, p99 = s.modules ? Math.max(...s.modules.map(m => m.p99 ?? 0)) : s.p99;
  if (!measured) add('GPU time measured', 'warn', `method: ${p.method}; ${s.n} frames timed${p.pageGpuMs != null ? ` · page's own gpuMs ${(+p.pageGpuMs).toFixed(1)} ms (EMA, not a gate)` : ''}`);
  else add(`GPU p95 ≤ ${lim[0]} ms and p99 ≤ ${lim[1]} ms (${cls}${scaled ? `, solo at soloScale ${sc.soloScale}` : ' at 1440p'})`, p95 <= lim[0] && p99 <= lim[1],
    `p50 ${s.p50 ?? '–'} · p95 ${p95} · p99 ${p99} ms over ${s.modules ? s.modules.map(m => `${m.module} ${m.n}`).join(', ') : s.n + ' frames'} · ${p.method}${p.disjoint ? ` · ${p.disjoint} disjoint dropped` : ''}`);
  add('perf class (#88 ray-march ruling)', null, sc ? `soloScale ${sc.soloScale} · blendScale ${sc.blendScale} → ${cls}` : `${cls} (no __qa.scales declared)`);
  if (sc) add('scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5)', sc.soloScale >= 0.75 && sc.blendScale >= 0.5 && sc.soloScale <= 1 && sc.blendScale <= 1, `soloScale ${sc.soloScale} · blendScale ${sc.blendScale}`);
  if (scaled) {
    add('scaled solo: 0 rAF frames > 20 ms', s.raf.over20 === 0, `${s.raf.over20} of ${s.raf.n} frames > 20 ms`);
    const b = p.blendStats;
    if (!p.setScale) add(`GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale ${sc.blendScale} (pair number)`, 'warn', 'not measured: the page has no __qa.setRenderScale(s)');
    else if (!b) add(`GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale ${sc.blendScale} (pair number)`, false, `blend run failed: ${p.blend && p.blend.err || 'no frames'}`);
    else add(`GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale ${sc.blendScale} (pair number)`, b.n > 100 ? b.p95 <= 7 && b.p99 <= 9 : 'warn',
      `p50 ${b.p50 ?? '–'} · p95 ${b.p95} · p99 ${b.p99} ms over ${b.n} frames · rAF > 20 ms: ${b.rafOver20} of ${b.rafN}`);
  }
  add('canvas 2560×1440 at dpr 1', !!p.canvas && p.canvas[0] === 2560 && p.canvas[1] === 1440 && p.dpr === 1 ? true : 'warn', `${p.canvas ? p.canvas.join('×') : 'none'} · dpr ${p.dpr}`);
  add('rAF interval (solo, headless 60 Hz clock)', null, `p50 ${s.raf.p50} · p95 ${s.raf.p95} · p99 ${s.raf.p99} ms · ${s.raf.over} of ${s.raf.n} > 17.5 ms (${s.raf.overPct} %) · ${s.raf.fps} fps`);
  // #88 ruling (VIZ research, 28 Oct): __qa.forceDrop() is required on every page, so a missing hook fails
  if (!p.hook && legacy) add('__qa.forceDrop() puts a drop inside the measured 60 s', 'warn', 'hook missing (page from before #88)');
  else add('__qa.forceDrop() puts a drop inside the measured 60 s', p.drop === 'forceDrop', p.drop ? `__qa.${p.drop}() at 20 s` : 'no __qa.forceDrop hook (required by #88 for new scenes)');
  add('pair gate (50/50 with the heaviest scene)', null, 'waits for the #85 host: two modules in one context');
  add('GPU clock during the measured windows (report-only)', null, p.sclk ? `mean ${p.sclk.mean} MHz of ${p.sclk.top ?? '?'} · ${p.sclk.bands.map(([b, pc]) => `${b} MHz ${pc} %`).join(' · ')} · ${p.sclk.n} samples · power_dpm_force_performance_level ${p.dpmLevel ?? '–'}` : 'pp_dpm_sclk not readable');
  // #88 clock ruling (VIZ research comment 6498837801; user said yes to pinning, 29 Oct): with the level pinned
  // (profile_peak/high) a GPU-time result counts only if the mean clock was ≥ 90 % of the top level; under auto it is report-only
  const pinned = /^(profile_peak|high)$/.test(p.dpmLevel || '');
  if (p.sclk && p.sclk.top) add('GPU ms measured at a pinned clock (≥ 90 % of top)', pinned ? (p.sclk.mean >= 0.9 * p.sclk.top ? true : 'warn') : 'warn',
    pinned ? `mean ${p.sclk.mean} of ${p.sclk.top} MHz${p.sclk.mean >= 0.9 * p.sclk.top ? '' : ' · invalid run: GPU ms rows above are not judged as real cost'}` : `level ${p.dpmLevel ?? '–'}: ms rows measure the clock governor too (host not pinned yet)`);
  add('timer query bits', null, p.bits ? `TIMESTAMP ${p.bits.stamp ?? p.bits.err} · TIME_ELAPSED ${p.bits.elapsed ?? '–'}` : 'extension not available');
}
if (res.flash) {
  const f = res.flash;
  if (f.err) add('flash analysis ran', false, f.err);
  else {
    const secs = (f.t1 - f.t0) / 1000, fps = f.frames / Math.max(secs, 1e-3), good = fps >= 55, w = f.worst;
    const g = (name, n, detail) => add(name, good ? n === 0 : 'warn', (good ? '' : `not measured: analysed only ${fps.toFixed(1)} fps · `) + `${n} failing frames · ${detail}`);
    add('flash capture', good ? true : 'warn', `${f.frames} frames in ${secs.toFixed(1)} s (${fps.toFixed(1)} fps, ${f.skipped} skipped) · tap ${f.tapMs} ms/frame · scene canvas ${f.src.join('×')} → 640×360 linear · window ${f.win[0]}×${f.win[1]} (${f.win[0] * 4}×${f.win[1] * 4} at 1440p, fov ${FOV}°) · ${f.win[3]} windows${f.tapErr ? ' · tap error ' + f.tapErr : ''}`);
    if (FLASH_REPORT_ONLY.has(id) && good && f.flashFail > 0) add('general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window', 'warn', `report-only (user's ruling 30 Oct: no visible flash on this page) · ${f.flashFail} failing frames · worst ${(100 * w.flash.v).toFixed(1)} %${w.flash.at ? ` at ${w.flash.at} (t ${w.flash.t} s)` : ''}`);
    else g('general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window', f.flashFail, `worst ${(100 * w.flash.v).toFixed(1)} %${w.flash.at ? ` at ${w.flash.at} (t ${w.flash.t} s)` : ''}`);
    g('red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window', f.redFail, `worst ${(100 * w.red.v).toFixed(1)} %${w.red.at ? ` at ${w.red.at} (t ${w.red.t} s)` : ''}`);
    g('frame mean L ≤ 0.60', f.meanFail, `max ${w.mean.v} (t ${w.mean.t ?? '–'} s)`);
    g('10° window mean L ≤ 0.80', f.winFail, `max ${w.win.v}${w.win.at ? ` at ${w.win.at} (t ${w.win.t} s)` : ''}`);
    g('window mean rises ≤ 0.25 in 100 ms', f.riseFail, `max ${w.rise.v}${w.rise.at ? ` at ${w.rise.at} (t ${w.rise.t} s)` : ''}`);
    g('L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row', f.whiteFail, `max ${(100 * w.white.v).toFixed(1)} % · longest run over 5 %: ${w.white.run} frames`);
    if (f.trace && f.trace.pts.length) {
      // report-only: how the worst flash window behaves ±1 s around its worst frame (full per-frame trace in check.json, flash.trace.pts = [dt s, mean L, flashing share])
      const P = f.trace.pts, Ls = P.map(p => p[1]), Fs = P.map(p => p[2]);
      let swings = 0, dir = 0, ref = Ls[0];
      for (const L of Ls) { if (dir >= 0 && L <= ref - 0.02) { if (dir > 0) swings++; dir = -1; ref = L; } else if (dir <= 0 && L >= ref + 0.02) { if (dir < 0) swings++; dir = 1; ref = L; } else if ((dir > 0 && L > ref) || (dir < 0 && L < ref)) ref = L; }
      const span = P.at(-1)[0] - P[0][0], above = Fs.filter(x => x > 0.25).length;
      const ser = P.filter((_, i) => i % 3 === 0).map(p => p[1].toFixed(2)).join(' ');
      add('worst flash window trace ±1 s (report-only)', null, `${f.trace.at} at t ${f.trace.t} s · ${P.length} frames over ${span.toFixed(2)} s · window mean L ${Math.min(...Ls).toFixed(2)}–${Math.max(...Ls).toFixed(2)}, ${swings} swings ≥ 0.02 (${(swings / Math.max(span, 1e-3) / 2).toFixed(1)} Hz) · flashing share > 25 % on ${above} frames, peak ${(100 * Math.max(...Fs)).toFixed(0)} % · mean L every 3rd frame: ${ser}`);
    }
    if (f.mash) {
      const m = f.mash, slots = [...new Set(m.stages.flatMap(s => s.slots))].sort((a, b) => a - b);
      const at = t => { if (t == null) return '–'; const ms = f.t0 + t * 1000, s = m.stages.find(x => ms >= x.start && ms < x.end); return s ? (s.slots.length > 1 ? 'all together' : 'slot ' + s.slots[0]) : 'outside the mash'; };
      add('mash: worst flash and rise fall in', null, `general ${(100 * w.flash.v).toFixed(1)} % (${at(w.flash.t)}) · red ${(100 * w.red.v).toFixed(1)} % (${at(w.red.t)}) · rise ${w.rise.v} (${at(w.rise.t)}) · ${m.stages.length} stages of ${m.psecs} s at ${m.hz} presses/s`);
      if (!m.hook) add('mash: __qa.pressTrigger(i) exists', false, 'no __qa.pressTrigger on the page: nothing was pressed, the flash rows show the plain show');
      else {
        const per = slots.map(i => { const info = (m.slots || []).find(s => s.slot === i); return { i, sent: m.sent[i] || 0, fired: m.fired[i] || 0, logged: m.logged[i] || 0, threw: m.threw[i], info }; });
        const dead = per.filter(p => p.sent > 0 && p.fired === 0);
        add('mash: presses sent / fires seen (quantised and repeat-limited slots fire less by design)', !m.log ? 'warn' : dead.length === 0 && !per.some(p => p.threw),
          (m.log ? '' : 'no __qa.triggerLog: fires not counted · ') + per.map(p => `slot ${p.i}${p.info && p.info.name ? ' ' + p.info.name : ''}: ${p.sent} sent / ${p.fired} fired (${p.logged} logged${p.info ? `, ${p.info.timing ?? '–'}, repeats ${p.info.repeats ?? '–'}` : ''})${p.threw ? ' · threw ' + p.threw : ''}`).join(' · ') +
          (dead.length ? ` · pressed but never fired: ${dead.map(p => p.i).join(', ')}` : ''));
      }
    } else add('drops during the flash clip', null, f.drops.length ? f.drops.map(k => '__qa.' + k + '()').join(', ') : 'no drop hook: the page ran its own show');
  }
}
add('#88 gating for this page', null, gated ? (legacy ? 'gated: page from before #88 that has __qa.forceDrop' : 'gated: new scene') : 'report-only: page from before #88 without __qa.forceDrop');
add('page errors', errors.length === 0, errors.length ? errors.slice(0, 3).join(' / ') : 'none');
fs.writeFileSync(path.join(out, 'check.json'), JSON.stringify(res, null, 1));
fs.writeFileSync(path.join(out, 'check.md'), `# Shared gates (#88) · ${pageName} · ${stamp}\n\n- ${res.renderer} · Chromium ${res.chromium}\n- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock)` +
  `${res.perf ? ` · GPU: warm-up ${WARM} s, measured ${SECS} s` : ''}${res.flash ? ` · flash: ${FSECS_RUN} s with limiter=off` : ''}${STAGES.length ? ` · button mash: triggers ${PRESS.join(',')} at ${HZ}/s, ${PSECS} s each then together` : ''}\n\n| gate | result | detail |\n|---|---|---|\n${rows.join('\n')}\n`);
console.log(path.relative(process.cwd(), out) || out);
