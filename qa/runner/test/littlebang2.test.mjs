// 18 · Little Bang 2 (the beamline rebuilt with the scene skill): the maths in experiments/18-little-bang-2-math.mjs, the
// scene module run against a stand-in WebGL2 context (init, frames, dispose frees everything), and the page's wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../../../experiments/18-little-bang-2-math.mjs';
import { createScene, MACROS, TRIGGERS } from '../../../experiments/18-little-bang-2.mjs';

const read = f => fs.readFileSync(new URL(`../../../experiments/${f}`, import.meta.url), 'utf8');
const PAGE = read('18-little-bang-2.html'), SCENE = read('18-little-bang-2.mjs'), MATH = read('18-little-bang-2-math.mjs');
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// a stand-in WebGL2 context: every create* is tracked until its delete*, framebuffers are complete
function fakeGL() {
  const live = new Set(), calls = {};
  const C = { COMPILE_STATUS: 1, LINK_STATUS: 2, ACTIVE_UNIFORMS: 3, FRAMEBUFFER_COMPLETE: 36053, TEXTURE0: 33984 };
  const gl = new Proxy({}, {
    get(_, k) {
      if (typeof k !== 'string') return undefined;
      if (k in C) return C[k];
      if (/^[A-Z0-9_]+$/.test(k)) return k;
      if (k.startsWith('create')) return () => { const o = { kind: k.slice(6) }; live.add(o); return o; };
      if (k.startsWith('delete')) return o => { if (o) live.delete(o); };
      if (k === 'getShaderParameter' || k === 'getProgramParameter') return (o, p) => (p === C.ACTIVE_UNIFORMS ? 0 : true);
      if (k === 'checkFramebufferStatus') return () => C.FRAMEBUFFER_COMPLETE;
      if (k === 'getExtension') return () => ({});
      if (k === 'getShaderInfoLog' || k === 'getProgramInfoLog') return () => '';
      return () => { calls[k] = (calls[k] || 0) + 1; };
    },
  });
  return { gl, live, calls };
}
// n frames at 120 bpm, 60 fps; the clock's kick on every beat (ages in s), as the page passes them
function run(sc, n, { t0 = 0, beats0 = 0, g = 1, w = 1, speed = 0.5, energy = () => ({ kick: 0, level: 0, bands: {} }) } = {}) {
  let out = null;
  for (let f = 0; f < n; f++) {
    const t = t0 + f / 60, beats = beats0 + f / 30, prev = beats0 + (f - 1) / 30;
    const kicks = f > 0 && Math.floor(beats) > Math.floor(prev) ? [(beats - Math.floor(beats)) * 0.5] : [];
    sc.frame({ t, beats, bpb: 4, bpm: 120, now: t * 1000, kicks, beatWeight: w, energy: energy(f), controls: { beatGain: g, speed, intensity: 1 } });
    out = sc.qa.metrics;
  }
  return out;
}

test('18b beat gain: g 1 as designed, 0 removes the kick, the top stays under its caps', () => {
  for (const g of [1, undefined, null, NaN]) assert.deepEqual(M.beatTerms(g), { g: 1, ring: 0.8, ray: 0.5, rayW: 0.6 });
  assert.deepEqual(M.beatTerms(0), { g: 0, ring: 0, ray: 0, rayW: 0 });
  const T3 = M.beatTerms(3);
  assert.equal(T3.ring, 1.6); assert.equal(T3.ray, 1.1); assert.equal(T3.rayW, 1.2); assert.equal(M.beatTerms(9).g, 3);
  assert.equal(M.beatGainOf({}, 1, null), 1); assert.equal(M.beatGainOf({ beatGain: () => null }, 1, null), 1);
  assert.equal(M.beatGainOf({ beatGain: n => (n === 5 ? 0.4 : null) }, 5, null), 0.4, 'knob 5 (slot B)');
  assert.equal(M.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
});

test('18b kicks: rings run to the far end, fast attack and slow release, no flat top, the ray at most 3 a second', () => {
  for (const env of [M.ringEnv, M.rayEnv]) {
    let peak = 0; for (let i = 0; i <= 2000; i++) peak = Math.max(peak, env(i / 4000));
    assert.ok(close(peak, 1, 1e-3), `peak ${peak}`); assert.equal(env(-1), 0); assert.equal(env(NaN), 0);
  }
  assert.equal(M.ringZ(0), M.KICK.Z0); assert.ok(M.ringZ(0.5) >= M.TUBE.Z_IP, 'a ring reaches the far end in a beat at 120 bpm');
  for (const g of [1, 2, 3]) {   // the caps scale the coefficient, not the envelope: after the peak every frame is lower
    const K = M.kicksCreate(); M.kickAdd(K, 0, 1);
    let prev = Infinity;
    for (let f = 6; f < 24; f++) { const u = M.kickUniforms(K, f / 60, M.beatTerms(g)); assert.ok(u.ring < prev && u.ring <= 1.6 + 1e-9, `g ${g} f ${f}`); prev = u.ring; }
  }
  const K = M.kicksCreate();
  for (let i = 0; i < 40; i++) M.kickAdd(K, i * 0.125, 1);   // 8 kicks a second
  assert.ok(M.rayPeaksIn(K, 4.9, 2) <= 6, `ray peaks ${M.rayPeaksIn(K, 4.9, 2)} in 2 s`);
  assert.equal(K.list.length, M.KICK.MAX); assert.equal(M.kickAdd(K, 6, 0), false, 'weight 0 adds nothing');
  const R = M.kicksCreate(); let n = 0;
  for (let f = 0; f < 300; f++) if (M.energyOnset(R, 0.9 * Math.exp(-(f % 30) / 9), f / 60)) n++;
  assert.equal(n, 10, 'no-beat: one onset per heard kick');
});

test('18b speed knob: 0 stops, 1 is 10 R/s, eased with a bounded acceleration; magnets dim when they pass fast', () => {
  assert.equal(M.speedOf(0), 0); assert.equal(M.speedOf(1), 10); assert.ok(close(M.speedOf(0.5), 10 * Math.pow(0.5, 1.5)));
  let v = 0, maxStep = 0;
  for (let f = 0; f < 240; f++) { const nv = M.speedStep(v, 10, 1 / 60); maxStep = Math.max(maxStep, nv - v); v = nv; }
  assert.ok(v > 9.5 && maxStep <= M.SPEED.ACCEL / 60 + 1e-12, `v ${v}, step ${maxStep}`);
  assert.equal(M.hoopAmp(0), 1); assert.ok(M.hoopRate(10) === 2.5 && M.hoopAmp(10) < 0.4);
  const p = M.travelPhases(1234.5);
  assert.ok(p.twist >= 0 && p.twist < 2 * Math.PI && p.band >= 0 && p.band < 1 && p.hoop >= 0 && p.hoop < M.TUBE.HOOP_L);
  assert.ok(close(M.travelPhases(M.TUBE.HOOP_L * 3 + 1).hoop, 1, 1e-9));
});

test('18b camera and collisions: an orthonormal frame, the far end on screen, helices that stay in the tube', () => {
  for (const [y, p] of [[0, 0], [0.12, -0.08], [-0.1, 0.07]]) {
    const c = M.cameraFrame(y, p), dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const v of [c.f, c.r, c.u]) assert.ok(close(dot(v, v), 1, 1e-12));
    assert.ok(Math.abs(dot(c.f, c.r)) < 1e-12 && Math.abs(dot(c.f, c.u)) < 1e-12 && Math.abs(dot(c.r, c.u)) < 1e-12 && c.u[1] > 0);
    const ip = M.project(c, [0, 0, M.TUBE.Z_IP]);
    assert.ok(ip && Math.abs(ip[0]) < 0.6 && Math.abs(ip[1]) < 0.6, 'the far end stays near the middle');
  }
  assert.equal(M.project(M.cameraFrame(0, 0), [0, 0, -1]), null, 'behind the camera');
  const ev = M.collision(1, 12, true), ev2 = M.collision(1, 12, true);
  assert.deepEqual(ev, ev2, 'seeded'); assert.equal(ev.tracks.length, M.COLL.TRACKS_DROP); assert.equal(M.collision(1, 5, false).tracks.length, M.COLL.TRACKS);
  for (const tr of ev.tracks) {
    const tw = M.trackWallTime(tr);
    for (let i = 0; i <= 40; i++) {
      const t = Math.min(tw, M.COLL.LIFE_S) * i / 40, P = M.trackPoint(tr, t);
      assert.ok(Math.hypot(P[0], P[1]) <= M.COLL.WALL + 1e-9, 'inside the tube until it reaches the wall');
    }
    if (Number.isFinite(tw)) assert.ok(close(Math.hypot(...M.trackPoint(tr, tw).slice(0, 2)), M.COLL.WALL, 1e-9));
  }
  let peak = 0; for (let i = 0; i <= 2000; i++) peak = Math.max(peak, M.fireEnv(i / 1000));
  assert.ok(close(peak, 1, 1e-3));
  assert.ok(M.isDrop(12) && M.isDrop(15.9) && !M.isDrop(11.9) && !M.isDrop(16) && M.isDrop(28));
});

test('18b palette, silence and knobs: Oklab sections, a faint tube in silence, the pick-up', () => {
  const lin = h => M.lin(h);
  M.paletteAt(20).forEach((c, i) => c.forEach((v, j) => assert.ok(close(v, lin(M.PALETTES[1][i])[j], 1e-5))));
  M.paletteAt(0).forEach((c, i) => c.forEach((v, j) => assert.ok(close(v, lin(M.PALETTES[0][i])[j], 1e-5))));
  for (const b of [16, 16.5, 17, 33]) for (const c of M.paletteAt(b)) for (const v of c) assert.ok(Number.isFinite(v) && v >= 0);
  let a = 1; for (let f = 0; f < 600; f++) a = M.activityStep(a, 0, 1 / 60);
  assert.ok(a < 0.05 && M.glowOf(a) >= M.ACT.GLOW_MIN && M.glowOf(a) < 0.5, 'silence: the tube stays at about 45 %');
  const p = M.pickupCreate(), knobs = [0.2, 0.0, null, null, null, null, null, null];
  assert.equal(M.pickup(p, 2, knobs), null, 'knob 2 left at 0 by the last scene does not stop the camera');
  knobs[1] = 0.3; assert.equal(M.pickup(p, 2, knobs), 0.3);
  assert.equal(M.knobOr({ knobs: new Array(8).fill(null) }, M.pickupCreate(), 2, 0.5), 0.5);
});

test('18b scene: init, frames with kicks and crossings, g 0, speed 0, no-beat, dispose frees every GL object', () => {
  const { gl, live, calls } = fakeGL(), sc = createScene();
  sc.init(gl, { width: 1920, height: 1080, seed: 1 });
  assert.ok(live.size > 0);
  let m = run(sc, 300);
  assert.equal(m.kicksStarted, 9, '9 kicks in 5 s after the first frame');
  assert.equal(m.collisions, 2, 'the bunches crossed on bars 1 and 2');
  assert.ok(m.beat.g === 1 && m.beat.ringNow > 0 && m.beat.ringNow <= 0.8 + 1e-9);
  assert.ok(close(m.speed, M.speedOf(0.5), 1e-9), 'the first frame starts at the knob\'s speed');
  assert.ok(sc.qa.view.segments > 0, 'tracks drawn');
  assert.equal(calls.drawArrays, 300 * 6, 'tube, 4 downsamples and the final pass a frame');
  m = run(sc, 120, { t0: 5, beats0: 10, g: 0 });
  assert.deepEqual([m.beat.ring, m.beat.ringNow, m.beat.rayNow], [0, 0, 0], 'g 0: no rings, a steady ray');
  m = run(sc, 120, { t0: 7, beats0: 14, speed: 0 });
  assert.ok(m.speed < 0.5 && m.speed >= 0, `speed knob 0 slows to a stop (${m.speed})`);
  const before = sc.qa.metrics.kicksStarted;
  m = run(sc, 300, { t0: 9, beats0: 18, w: 0, energy: f => ({ kick: 0.9 * Math.exp(-(f % 30) / 9), level: 0.5, bands: {} }) });
  assert.ok(m.kicksFromEnergy >= 9 && m.kicksStarted - before === m.kicksFromEnergy, `energy kicks ${m.kicksFromEnergy}`);
  m = run(sc, 600, { t0: 14, beats0: 28, w: 0 });
  assert.ok(m.glow < M.ACT.GLOW_MIN + 0.05, `silence: glow ${m.glow}`);
  const c0 = sc.qa.metrics.collisions; run(sc, 1, { t0: 30, beats0: 400 });
  assert.equal(sc.qa.metrics.collisions, c0, 'a clock jump (forceDrop) is not a crossing');
  assert.equal(sc.press(1, 0, 31000), true); assert.equal(sc.press(2, 0, 31000), true); assert.equal(sc.press(2, 0, 31000), true); assert.equal(sc.press(3, 0, 31000), false);
  run(sc, 1, { t0: 31, beats0: 401 });
  assert.deepEqual(sc.qa.triggerLog.slice(-4).map(e => e.fired), [true, true, false, false]);
  assert.equal(sc.qa.metrics.collisions, c0 + 1, 'trigger 1 crosses the bunches');
  sc.dispose();
  assert.equal(live.size, 0, `left after dispose: ${[...live].map(o => o.kind).join(', ')}`);
  sc.dispose();
});

test('18b conventions: same knobs as the set\'s Little Bang, clock time, seeded, capture, drop hook, #85 manifest', () => {
  for (const [name, src] of [['scene', SCENE], ['maths', MATH], ['page', PAGE]]) {
    assert.ok(!/Math\.random\(/.test(src), `${name}: no Math.random`); assert.ok(!/Date\.now\(/.test(src), `${name}: no Date.now`);
  }
  for (const s of ['panic.js', 'clock.js', 'audio-in.js']) assert.ok(PAGE.includes(`<script src="${s}"></script>`), s);
  assert.ok(PAGE.includes("getContext('webgl2', { antialias: false, alpha: false"));
  assert.ok(PAGE.includes("knobParam('beatKnob', 1)") && PAGE.includes("knobParam('speedKnob', 2)"), 'beat on 1 (slot B 5), speed on 2 (slot B 6)');
  assert.ok(PAGE.includes('M.beatGainOf(clock, params.beatKnob, params.beatGain)'));
  assert.ok(PAGE.includes('window.__qaNextDrop = b => window.__qaSectionDrop(b, 16, 12)'));
  for (const s of ['audio.due(BEAT_LANES)', 'audio.frameStart(now)', 'audio.readEnergy()', 'window.__panicError', "__panic.calm('init error')"]) assert.ok(PAGE.includes(s), s);
  for (const s of ['checkFramebufferStatus', 'getShaderInfoLog', 'EXT_color_buffer_float']) assert.ok(SCENE.includes(s), s);
  assert.deepEqual(MACROS.map(m => m.name), ['speed', 'intensity']);
  assert.deepEqual(TRIGGERS.map(t => t.key), ['Z', 'X'], 'not B or ` (panic.js)');
  const sc = createScene();
  for (const k of ['init', 'resize', 'frame', 'press', 'release', 'dispose', 'reset']) assert.equal(typeof sc[k], 'function', k);
});
