// 29 · Neon Tunnel (docs/CELLULAR_VIZ_BRIEF_NEON_TUNNEL.md, part 1): the maths in experiments/29-neon-tunnel-math.mjs (the
// bend, the comfort caps, the ride on the beat, the kick's running light, the path), the scene module run against a
// stand-in WebGL2 context (init, frames, dispose frees everything), and the page's wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../../../experiments/29-neon-tunnel-math.mjs';
import { createScene, MACROS, TRIGGERS } from '../../../experiments/29-neon-tunnel.mjs';

const read = f => fs.readFileSync(new URL(`../../../experiments/${f}`, import.meta.url), 'utf8');
const PAGE = read('29-neon-tunnel.html'), SCENE = read('29-neon-tunnel.mjs'), MATH = read('29-neon-tunnel-math.mjs');
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const DT = 1 / 60;

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
function run(sc, n, { t0 = 0, beats0 = 0, g = 1, w = 1, speed = 0.5, turn = 0.6, qaTarget = null, energy = () => ({ kick: 0, level: 0, bands: {} }) } = {}) {
  for (let f = 0; f < n; f++) {
    const t = t0 + f * DT, beats = beats0 + f / 30, prev = beats0 + (f - 1) / 30;
    const kicks = f > 0 && Math.floor(beats) > Math.floor(prev) ? [(beats - Math.floor(beats)) * 0.5] : [];
    sc.frame({ t, beats, bpb: 4, bpm: 120, now: t * 1000, kicks, beatWeight: w, energy: energy(f), controls: { beatGain: g, speed, turn, colour: 0.5, intensity: 1, qaTarget } });
  }
  return sc.qa.metrics;
}

test('29 comfort caps are the brief\'s numbers', () => {
  assert.ok(close(M.COMFORT.ROLL_MAX, 15 * Math.PI / 180), 'roll at most 15 degrees');
  assert.ok(M.COMFORT.TURN_RATE_MAX <= 0.35 && M.COMFORT.TURN_ACC_MAX <= 0.6 && M.COMFORT.WIDEN_MAX <= 0.12 && M.COMFORT.WIDEN_RATE_MAX <= 0.06);
  assert.ok(close(M.rollTarget(1), -M.COMFORT.ROLL_MAX) && close(M.rollTarget(-1), M.COMFORT.ROLL_MAX), 'a hard turn banks to the cap, no further');
});

test('29 the bend: the far end lands on the target and stays in sight, near rings surround the viewer, the wall depth is found', () => {
  const asp = 16 / 9, F = M.TUN.F0, corners = [[asp, 1], [-asp, 1], [asp, -1], [-asp, -1]];
  for (const t of [{ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0.85, y: 0.75 }, { x: 1, y: 1 }, { x: -1, y: -1 }, { x: -0.4, y: -0.6 }]) {
    const tq = M.toQ(t, asp), far = M.ringCentre(tq, 1e6, F);
    assert.ok(close(far[0], tq[0], 1e-3) && close(far[1], tq[1], 1e-3), 'far away the rings are centred on the target');
    for (const k of [0, 1, 2]) assert.equal(M.wallDepth(tq, tq, F, 1, k, k, 0), M.TUN.Z_MAX, `${M.SHAPES[k]}: at the target you look down the tunnel, never at a wall`);
    const c = M.ringCentre(tq, 0.4, F), r = M.ringRadius(0.4, F);
    for (const p of corners) assert.ok(Math.hypot(p[0] - c[0], p[1] - c[1]) < r, 'the rings within 0.4 R still surround the whole screen');
    let prev = -1; for (let z = 0.2; z < 60; z *= 1.3) { const f = M.bendF(z, Math.hypot(...tq), F); assert.ok(f >= prev); prev = f; }   // the rings nest toward the turn
  }
  assert.ok(M.bendF(2, 0.3, F) < 0.2, 'a gentle turn leaves the ring 2 R ahead nearly centred');
  const q = [1.2, 0.3], A0 = [0, 0];
  for (const k of [0, 1, 2]) {
    const z = M.wallDepth(q, A0, M.TUN.F0, 1, k, k, 0), exact = M.TUN.F0 / M.shapeNorm(q[0], q[1], k);
    assert.ok(Math.abs(z - exact) / exact < 0.01, `${M.SHAPES[k]}: depth ${z} vs ${exact}`);
  }
  for (const k of [0, 1, 2]) assert.ok(close(M.shapeNorm(2, 0, k) * 3, M.shapeNorm(6, 0, k)), 'the norm scales with the point');
});

test('29 the eased target never passes the turn caps, even for a pointer that jumps corner to corner', () => {
  let s = { x: 0, y: 0, vx: 0, vy: 0 }, maxV = 0, maxA = 0, maxStep = 0;
  for (let f = 0; f < 1200; f++) {
    const goal = f % 2 ? { x: 1, y: 1 } : { x: -1, y: -1 };   // the worst input: a jump every frame
    const n = M.easeTarget(s, goal, DT);
    maxV = Math.max(maxV, Math.hypot(n.vx, n.vy)); maxA = Math.max(maxA, Math.hypot(n.vx - s.vx, n.vy - s.vy) / DT);
    maxStep = Math.max(maxStep, Math.hypot(n.x - s.x, n.y - s.y)); s = n;
  }
  assert.ok(maxV <= M.COMFORT.TURN_RATE_MAX + 1e-9 && maxA <= M.COMFORT.TURN_ACC_MAX + 1e-6, `v ${maxV}, a ${maxA}`);
  assert.ok(maxStep <= M.COMFORT.TURN_RATE_MAX * DT + 1e-9, 'never a snap');
  s = { x: 0, y: 0, vx: 0, vy: 0 };
  for (let f = 0; f < 600; f++) s = M.easeTarget(s, { x: -1, y: 0 }, DT);
  assert.ok(Math.abs(s.x + 1) < 0.02 && Math.abs(s.y) < 1e-9, `reaches a held target (${s.x})`);
  // roll and view width under their caps
  let r = 0, rMax = 0, rStep = 0, wd = 0, wStep = 0;
  for (let f = 0; f < 900; f++) { const x = f < 450 ? 1 : -1, nr = M.rollStep(r, x, DT); rStep = Math.max(rStep, Math.abs(nr - r)); r = nr; rMax = Math.max(rMax, Math.abs(r)); const nw = M.widenStep(wd, f < 450 ? 1 : 0, DT); wStep = Math.max(wStep, Math.abs(nw - wd)); wd = nw; }
  assert.ok(rMax <= M.COMFORT.ROLL_MAX + 1e-12 && rStep <= M.COMFORT.ROLL_RATE_MAX * DT + 1e-12);
  assert.ok(wStep <= M.COMFORT.WIDEN_RATE_MAX * DT + 1e-12 && M.widenStep(0.5, 1, 100) <= M.COMFORT.WIDEN_MAX);
});

test('29 a stale pointer hands back to the path smoothly', () => {
  const own = { x: 0.3, y: -0.2 };
  assert.deepEqual(M.pickTarget({ x: -0.9, y: 0.9, t: 10 }, 11.9, own), { x: -0.9, y: 0.9, from: 'pointer' });
  assert.deepEqual(M.pickTarget({ x: -0.9, y: 0.9, t: 10 }, 12.1, own), { x: 0.3, y: -0.2, from: 'path' });
  assert.equal(M.pickTarget(null, 5, own).from, 'path'); assert.equal(M.pickTarget({ x: 5, y: 0, t: 5 }, 5, own).x, 1, 'clamped to the screen');
  let s = { x: -0.9, y: 0.9, vx: 0, vy: 0 }, maxStep = 0;
  for (let f = 0; f < 600; f++) { const t = 11 + f * DT, g = M.pickTarget({ x: -0.9, y: 0.9, t: 10 }, t, own), n = M.easeTarget(s, g, DT); maxStep = Math.max(maxStep, Math.hypot(n.x - s.x, n.y - s.y)); s = n; }
  assert.ok(maxStep <= M.COMFORT.TURN_RATE_MAX * DT + 1e-9 && Math.hypot(s.x - own.x, s.y - own.y) < 0.05, 'glides back, no jump');
});

test('29 one ring a beat at each speed, back on the grid after a change', () => {
  for (const [k, r] of [[0, 0.5], [0.5, 1], [1, 2]]) {
    assert.equal(M.rateOf(k), r);
    let s = { rate: r, phase: 0 };
    for (let f = 1; f <= 64 * 30; f++) s = M.rideStep(s, { dB: 1 / 30, dt: DT, beats: f / 30, w: 1, rateWant: r, act: 1 });
    assert.ok(Math.abs(s.phase - 64 * r) < 1e-6, `rate ${r}: ${s.phase} rings in 64 beats`);
  }
  let s = { rate: 1, phase: 0 };
  for (let f = 1; f <= 16 * 30; f++) s = M.rideStep(s, { dB: 1 / 30, dt: DT, beats: f / 30, w: 1, rateWant: f < 200 ? 1 : 2, act: 1 });
  const d = s.phase - (16 * 2); assert.ok(Math.abs(d - Math.round(d)) < 0.02, `on the grid again: ${s.phase}`);
  let n = { rate: 1, phase: 0 }; for (let f = 0; f < 600; f++) n = M.rideStep(n, { dB: 0, dt: DT, beats: 0, w: 0, rateWant: 1, act: 0 });
  assert.ok(n.phase > 1 && n.phase < 3, `no beat: a calm drift (${n.phase} rings in 10 s)`);
});

test('29 the kick: g scales it under its cap, the light runs down the tunnel ring by ring', () => {
  assert.deepEqual(M.beatTerms(1), { g: 1, kick: 0.9 }); assert.deepEqual(M.beatTerms(0), { g: 0, kick: 0 }); assert.equal(M.beatTerms(3).kick, 1.8);
  assert.equal(M.beatGainOf({}, 1, null), 1); assert.equal(M.beatGainOf({ beatGain: () => 2 }, 1, 0), 0);
  let peak = 0; for (let i = 0; i <= 2000; i++) peak = Math.max(peak, M.kickEnv(i / 2000)); assert.ok(close(peak, 1, 1e-3));
  const K = M.kicksCreate(); M.kickAdd(K, 0, 7.3, 1);
  assert.equal(K.list[0].k0, M.firstRingAhead(7.3)); assert.ok((K.list[0].k0 - 7.3) * M.TUN.L >= M.KICK.Z_START, 'the nearest ring ahead');
  const a = M.kickUniforms(K, 0.1, M.beatTerms(1)), b = M.kickUniforms(K, 0.4, M.beatTerms(1));
  assert.ok(close(b.u[0] - a.u[0], 0.3 * M.KICK.RUN_RATE, 1e-9) && b.u[1] < a.u[1], 'the light runs away and fades');
  for (const g of [1, 3]) { const K2 = M.kicksCreate(); M.kickAdd(K2, 0, 0, 1); let prev = Infinity; for (let f = 6; f < 60; f++) { const u = M.kickUniforms(K2, f / 60, M.beatTerms(g)); assert.ok(u.peak < prev && u.peak <= 1.8 + 1e-9); prev = u.peak; } }
  const K0 = M.kicksCreate(); M.kickAdd(K0, 0, 0, 1); M.kickAdd(K0, 0, 0, 1, true);
  const u0 = M.kickUniforms(K0, 0.05, M.beatTerms(0)); assert.equal(u0.u[1], 0); assert.ok(u0.u[5] > 0.5, 'the section\'s bright ring is not the beat knob\'s');
});

test('29 the path, the colours and the knobs', () => {
  for (let b = 0; b < 200; b += 3.7) { const p = M.pathTarget(1, b, 0); assert.ok(Math.abs(p.x) < 1e-12 && Math.abs(p.y) < 1e-12, 'turn 0: a straight tunnel'); }
  const seen = new Set();
  for (let n = 0; n < 30; n++) { seen.add(M.sectionPlan(1, n).wp); if (n % 3 === 0) assert.equal(M.sectionPlan(1, n).wp, 0, 'every third section at the centre'); }
  assert.ok(seen.size >= 4, `the path visits ${seen.size} places`);
  for (let b = 0; b < 300; b += 1.3) { const p = M.pathTarget(1, b, 1); assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1); }
  assert.deepEqual(M.sectionPlan(4, 9), M.sectionPlan(4, 9), 'seeded');
  let o0 = 0, o1 = 0; for (let r = 0; r < 300; r++) { if (M.runColour(5, r, 0) === 2) o0++; if (M.runColour(5, r, 1) === 2) o1++; }
  assert.equal(o0, 0, 'colour knob 0: pink and cyan only'); assert.ok(o1 > 60 && o1 < 140, `colour knob 1: orange joins (${o1}/300)`);
  assert.ok(M.inBuild(12) && M.inBuild(15.5) && !M.inBuild(11.9) && !M.inBuild(16));
  const p = M.pickupCreate(), knobs = [0.2, 0.9, 0.1, 0.5, null, null, null, null];
  assert.equal(M.pickup(p, 3, knobs), null); knobs[2] = 0.4; assert.equal(M.pickup(p, 3, knobs), 0.4);
});

test('29 scene: init, frames on the beat, turns under the caps, g 0, no-beat, dispose frees every GL object', () => {
  const { gl, live, calls } = fakeGL(), sc = createScene();
  sc.init(gl, { width: 1920, height: 1080, seed: 1 });
  assert.ok(live.size > 0);
  let m = run(sc, 600);
  assert.ok(Math.abs(m.ringsPerBeat - 1) < 0.1, `rings a beat ${m.ringsPerBeat}`);
  assert.equal(m.kicksStarted, 19); assert.ok(m.beat.now > 0 && m.beat.now <= 0.9 + 1e-9);
  assert.ok(m.maxTurn <= M.COMFORT.TURN_RATE_MAX + 1e-9 && m.maxRollDeg <= 15 + 1e-9 && m.maxWidenRate <= M.COMFORT.WIDEN_RATE_MAX + 1e-9);
  assert.equal(calls.drawArrays, 600 * 6, 'the tunnel, 4 downsamples and the final pass a frame');
  m = run(sc, 600, { t0: 10, beats0: 20, qaTarget: [-1, 0] });
  const v = sc.qa.view;
  assert.ok(Math.abs(v.target.x + 1) < 0.02 && Math.abs(v.farEnd.x - v.target.x) < 1e-9 && Math.abs(v.farEnd.y - v.target.y) < 1e-9, `hard left: ${JSON.stringify(v.target)}`);
  assert.ok(m.maxTurn <= M.COMFORT.TURN_RATE_MAX + 1e-9 && m.maxRollDeg <= 15 + 1e-9);
  m = run(sc, 120, { t0: 20, beats0: 40, g: 0 });
  assert.deepEqual([m.beat.kick, m.beat.now], [0, 0], 'g 0: no kick light');
  const before = m.kicksStarted;
  m = run(sc, 300, { t0: 22, beats0: 44, w: 0, energy: f => ({ kick: 0.9 * Math.exp(-(f % 30) / 9), level: 0.5, bands: {} }) });
  assert.ok(m.kicksFromEnergy >= 9 && m.kicksStarted - before === m.kicksFromEnergy, `no-beat: ${m.kicksFromEnergy}`);
  m = run(sc, 600, { t0: 27, beats0: 54, w: 0 });
  assert.ok(m.glow < M.ACT.GLOW_MIN + 0.05 && m.glow >= M.ACT.GLOW_MIN, 'silence: still lit, at half light');
  assert.equal(sc.press(1, 0, 40000), true); assert.equal(sc.press(2, 0, 40000), true); assert.equal(sc.press(5, 0, 40000), false);
  run(sc, 1, { t0: 40, beats0: 80 });
  assert.deepEqual(sc.qa.triggerLog.slice(-3).map(e => e.fired), [true, true, false]);
  assert.equal(sc.qa.view.goal.x, 0, 'recentre'); assert.equal(sc.qa.view.morph < 1, true, 'the next shape morphs in');
  sc.dispose();
  assert.equal(live.size, 0, `left after dispose: ${[...live].map(o => o.kind).join(', ')}`);
  sc.dispose();
});

test('29 conventions: four knobs, clock time, seeded, capture, drop hook, #85 manifest', () => {
  for (const [name, src] of [['scene', SCENE], ['maths', MATH], ['page', PAGE]]) {
    assert.ok(!/Math\.random\(/.test(src), `${name}: no Math.random`); assert.ok(!/Date\.now\(/.test(src), `${name}: no Date.now`);
  }
  for (const s of ['panic.js', 'clock.js', 'audio-in.js']) assert.ok(PAGE.includes(`<script src="${s}"></script>`), s);
  assert.ok(PAGE.includes("getContext('webgl2', { antialias: false, alpha: false"));
  for (const [k, n] of [['beatKnob', 1], ['speedKnob', 2], ['turnKnob', 3], ['colourKnob', 4]]) assert.ok(PAGE.includes(`knobParam('${k}', ${n})`), k);
  assert.ok(PAGE.includes('M.beatGainOf(clock, params.beatKnob, params.beatGain)'));
  assert.ok(PAGE.includes('window.__qaNextDrop = b => window.__qaSectionDrop(b, 16, 12)'));
  for (const s of ['audio.due(BEAT_LANES)', 'audio.frameStart(now)', 'audio.readEnergy()', 'window.__panicError', "__panic.calm('init error')"]) assert.ok(PAGE.includes(s), s);
  for (const s of ['checkFramebufferStatus', 'getShaderInfoLog', 'EXT_color_buffer_float']) assert.ok(SCENE.includes(s), s);
  assert.deepEqual(MACROS.map(m => m.name), ['speed', 'turn', 'colour', 'intensity']);
  assert.deepEqual(TRIGGERS.map(t => t.key), ['Z', 'X'], 'not B or ` (panic.js)');
  const sc = createScene();
  for (const k of ['init', 'resize', 'frame', 'press', 'release', 'dispose', 'reset']) assert.equal(typeof sc[k], 'function', k);
});
