// 28 · Aurora (the skill trial's scene, docs/CELLULAR_VIZ_BRIEF_SKILL_TRIAL.md): the maths in experiments/28-aurora-math.mjs,
// the scene module run against a stand-in WebGL2 context (init, frames, dispose frees everything), and the page's wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../../../experiments/28-aurora-math.mjs';
import { createScene, MACROS, TRIGGERS } from '../../../experiments/28-aurora.mjs';

const read = f => fs.readFileSync(new URL(`../../../experiments/${f}`, import.meta.url), 'utf8');
const PAGE = read('28-aurora.html'), SCENE = read('28-aurora.mjs'), MATH = read('28-aurora-math.mjs');
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
function run(sc, n, { t0 = 0, beats0 = 0, g = 1, w = 1, energy = () => ({ kick: 0, level: 0 }), ctl = {} } = {}) {
  let out = null;
  for (let f = 0; f < n; f++) {
    const t = t0 + f / 60, beats = beats0 + f / 30, prev = beats0 + (f - 1) / 30;
    const kicks = f > 0 && Math.floor(beats) > Math.floor(prev) ? [(beats - Math.floor(beats)) * 0.5] : [];
    sc.frame({ t, beats, bpb: 4, bpm: 120, now: t * 1000, kicks, beatWeight: w, energy: energy(f),
      controls: { beatGain: g, height: 0.55, colour: 0, drift: 0.5, intensity: 1, ...ctl } });
    out = sc.qa.metrics;
  }
  return out;
}

test('28 beat gain: g 1 is the ripple as designed, 0 removes it, the top stays under its caps', () => {
  for (const g of [1, undefined, null, NaN]) assert.deepEqual(M.beatTerms(g), { g: 1, ripple: 0.9, kink: 0.006 });
  assert.deepEqual(M.beatTerms(0), { g: 0, ripple: 0, kink: 0 });
  const T3 = M.beatTerms(3), T2 = M.beatTerms(2);
  assert.equal(T3.ripple, 1.8); assert.equal(T3.kink, 0.014); assert.equal(T2.ripple, 1.8); assert.ok(close(T2.kink, 0.012));
  assert.equal(M.beatTerms(7).g, 3, 'g clamps to 3');
  assert.equal(M.beatGainOf({}, 1, null), 1, 'no clock.beatGain');
  assert.equal(M.beatGainOf({ beatGain: () => null }, 1, null), 1, 'the knob untouched');
  assert.equal(M.beatGainOf({ beatGain: n => (n === 5 ? 0.4 : null) }, 5, null), 0.4, 'knob 5 (slot B)');
  assert.equal(M.beatGainOf({ beatGain: () => 2 }, 1, 0), 0, '?beatGain wins');
  assert.equal(M.beatGainOf({ beatGain: () => { throw new Error('x'); } }, 1, null), 1);
});

test('28 ripple: fast attack, slow release, peak 1; scaled by g, never a flat top; climbs the curtain', () => {
  let peak = 0, peakAt = 0;
  for (let i = 0; i <= 3000; i++) { const a = i / 2000, e = M.rippleEnv(a); if (e > peak) { peak = e; peakAt = a; } }
  assert.ok(close(peak, 1, 1e-4), `peak ${peak}`); assert.ok(peakAt > 0.03 && peakAt < 0.12, `peak at ${peakAt} s`);
  assert.equal(M.rippleEnv(-0.1), 0); assert.equal(M.rippleEnv(NaN), 0);
  assert.ok(M.rippleEnv(1.6) < 0.05, 'gone by its end of life');
  for (const g of [1, 2, 3]) {   // after the peak every frame is lower: the caps scale the coefficient, not the envelope
    const R = M.ripplesCreate(); M.rippleAdd(R, 0, 1);
    let prev = Infinity;
    for (let f = 6; f < 90; f++) { const u = M.rippleUniforms(R, f / 60, M.beatTerms(g)); assert.ok(u.peak < prev, `g ${g} frame ${f}`); assert.ok(u.peak <= 1.8 + 1e-9); prev = u.peak; }
  }
  assert.equal(M.rippleHeight(0), 0); assert.ok(close(M.rippleHeight(M.RIPPLE.RISE_S), 1));
  // g 0: the clock's ripples are gone; a performer's ripple (trigger 1) keeps g 1's size
  const R0 = M.ripplesCreate(); M.rippleAdd(R0, 0, 1); M.rippleAdd(R0, 0, 1, true);
  const u0 = M.rippleUniforms(R0, 0.07, M.beatTerms(0));
  assert.equal(u0.u[1], 0); assert.ok(u0.u[5] > 0.85 && u0.u[5] <= 0.9 + 1e-9);
  // at most MAX at once; amplitude 0 (no beat weight) adds nothing
  const R = M.ripplesCreate(); for (let i = 0; i < 20; i++) M.rippleAdd(R, i * 0.01, 1);
  assert.equal(R.list.length, M.RIPPLE.MAX); assert.equal(M.rippleAdd(R, 1, 0), false);
});

test('28 no-beat mode and silence: the energy kick makes ripples; silence settles to a faint slow glow', () => {
  const R = M.ripplesCreate(); let n = 0;
  for (let f = 0; f < 300; f++) { const k = 0.9 * Math.exp(-(f % 30) / 9); if (M.energyOnset(R, k, f / 60)) n++; }
  assert.equal(n, 10, 'one onset per kick');
  assert.equal(M.activityTarget(1, 0), 1); assert.equal(M.activityTarget(0, 0), 0); assert.equal(M.activityTarget(0, 1), 1);
  assert.ok(close(M.activityTarget(0.5, 0.25), 0.5 + 0.5 * 0.4));
  let a = 1; for (let f = 0; f < 600; f++) a = M.activityStep(a, 0, 1 / 60);
  assert.ok(a < 0.05, `after 10 s of silence ${a}`);
  assert.equal(M.glowOf(0), M.ACT.GLOW_MIN); assert.ok(close(M.glowOf(1), 1)); assert.ok(M.driftRate(0) < 0.4);
});

test('28 curtains: the slope is the derivative, folds happen, fold light is clamped', () => {
  const r = M.mulberry32(5);
  let folds = 0;
  for (let k = 0; k < 200; k++) {
    const p = [r() * 6.283, r() * 6.283, r() * 6.283], a = M.FOLDS.amp, f = M.FOLDS.freq;
    let fold = false;
    for (let i = 0; i <= 400; i++) {
      const s = i / 400, h = 1e-6, num = (M.curtainX(s + h, a, f, p) - M.curtainX(s - h, a, f, p)) / (2 * h);
      assert.ok(Math.abs(num - M.curtainSlope(s, a, f, p)) < 1e-4);
      if (M.curtainSlope(s, a, f, p) < 0) fold = true;
    }
    if (fold) folds++;
  }
  assert.ok(folds > 0, 'the near curtain folds back on itself for some phases');
  assert.equal(M.foldGain(M.XS), 1); assert.equal(M.foldGain(0), M.FOLD_MAX); assert.equal(M.foldGain(-1e9), M.FOLD_MIN);
  assert.deepEqual(M.sectionTarget(3, 9), M.sectionTarget(3, 9), 'seeded');
  assert.notDeepEqual(M.sectionTarget(3, 9), M.sectionTarget(3, 10));
  for (let n = 0; n < 50; n++) for (const L of M.sectionTarget(1, n)) assert.ok(L.amp >= 0.75 && L.amp <= 1.25 && L.bright >= 0.75 && L.bright <= 1.15);
});

test('28 knobs: height and colour ends, Oklab palette, pick-up', () => {
  assert.equal(M.heightOf(0), M.HEIGHT_MIN); assert.ok(close(M.heightOf(1), M.HEIGHT_MAX)); assert.equal(M.heightOf(5), M.heightOf(1));
  const lin = h => M.srgbToLinear(M.hexToSrgb(h));
  M.paletteAt(0).forEach((c, i) => c.forEach((v, j) => assert.ok(close(v, lin(M.PALETTES.classic[i])[j], 1e-5), `classic ${i}`)));
  M.paletteAt(1).forEach((c, i) => c.forEach((v, j) => assert.ok(close(v, lin(M.PALETTES.violet[i])[j], 1e-5), `violet ${i}`)));
  for (const k of [0.25, 0.5, 0.75]) for (const c of M.paletteAt(k)) for (const v of c) assert.ok(Number.isFinite(v) && v >= 0);
  // pick-up: the knobs found on arrival do nothing until one moves
  const p = M.pickupCreate(), knobs = [0.2, 0.9, 0.1, null, null, null, null, null];
  assert.equal(M.pickup(p, 2, knobs), null);
  knobs[1] = 0.85; assert.equal(M.pickup(p, 2, knobs), 0.85); knobs[1] = 0.86; assert.equal(M.pickup(p, 2, knobs), 0.86);
  assert.equal(M.knobOr({ knobs: new Array(8).fill(null) }, M.pickupCreate(), 2, 0.4), 0.4, 'no knobs: the slider');
  assert.equal(M.knobOr(null, M.pickupCreate(), 2, 0.7), 0.7);
});

test('28 scene: init, frames with kicks, g 0 and no-beat, dispose frees every GL object', () => {
  const { gl, live, calls } = fakeGL(), sc = createScene();
  sc.init(gl, { width: 1920, height: 1080, seed: 1 });
  assert.ok(live.size > 0);
  let m = run(sc, 300);
  assert.equal(m.ripplesStarted, 9, '9 kicks in 5 s after the first frame');
  assert.ok(m.beat.now > 0 && m.beat.now <= 0.9 + 1e-9 && m.beat.g === 1, `g 1: ${m.beat.now}`);
  assert.ok(m.act > 0.99 && close(m.glow, m.act * (1 - M.ACT.GLOW_MIN) + M.ACT.GLOW_MIN, 1e-9));
  assert.equal(sc.qa.view.layers.length, 3);
  assert.equal(calls.drawElements, 900, '3 curtains a frame');
  m = run(sc, 120, { t0: 5, beats0: 10, g: 0 });
  assert.equal(m.beat.ripple, 0); assert.equal(m.beat.now, 0, 'g 0: no ripple');
  m = run(sc, 120, { t0: 7, beats0: 14, g: 3 });   // the last kick at frame 90, read at frame 119: 2x g 1's ripple (capped at 1.8)
  assert.ok(close(m.beat.now, 1.8 * M.rippleEnv((7 + 119 / 60) - (7 + 90 / 60))), `g 3: ${m.beat.now}`);
  // no-beat: the clock's kicks carry weight 0, the music's kick makes the ripples
  const before = sc.qa.metrics.ripplesStarted;
  m = run(sc, 300, { t0: 9, beats0: 18, w: 0, energy: f => ({ kick: 0.9 * Math.exp(-(f % 30) / 9), level: 0.5 }) });
  assert.ok(m.ripplesFromEnergy >= 9 && m.ripplesStarted - before === m.ripplesFromEnergy, `energy ripples ${m.ripplesFromEnergy}`);
  // silence: a faint slow glow
  m = run(sc, 600, { t0: 14, beats0: 28, w: 0 });
  assert.ok(m.glow < M.ACT.GLOW_MIN + 0.05 && m.glow >= M.ACT.GLOW_MIN, `glow ${m.glow}`);
  // a clock jump (forceDrop) neither drifts nor pops
  const tau0 = sc.qa.metrics.tau; run(sc, 1, { t0: 30, beats0: 400 });
  assert.ok(sc.qa.metrics.tau - tau0 < 0.1, 'no drift from the jump');
  // triggers: ripple fires now; surge once per 1.2 s
  assert.equal(sc.press(1, 0, 31000), true); assert.equal(sc.press(2, 0, 31000), true); assert.equal(sc.press(2, 0, 31000), true); assert.equal(sc.press(3, 0, 31000), false);
  run(sc, 1, { t0: 31, beats0: 402 });
  assert.deepEqual(sc.qa.triggerLog.slice(-4).map(e => e.fired), [true, true, false, false]);
  sc.dispose();
  assert.equal(live.size, 0, `left after dispose: ${[...live].map(o => o.kind).join(', ')}`);
  sc.dispose();   // twice is fine
});

test('28 conventions: clock time, seeded, knobs, beat gain, capture, drop hook, #85 manifest', () => {
  for (const [name, src] of [['scene', SCENE], ['maths', MATH], ['page', PAGE]]) {
    assert.ok(!/Math\.random\(/.test(src), `${name}: no Math.random`); assert.ok(!/Date\.now\(/.test(src), `${name}: no Date.now`);
  }
  for (const s of ['panic.js', 'clock.js', 'audio-in.js']) assert.match(PAGE, new RegExp(`<script src="${s.replace('.', '\\.')}"></script>`));
  assert.match(PAGE, /getContext\('webgl2', \{ antialias: false, alpha: false/);
  assert.match(PAGE, /M\.beatGainOf\(clock, params\.beatKnob, params\.beatGain\)/);
  assert.match(PAGE, /knobParam\('heightKnob', 2\)/); assert.match(PAGE, /knobParam\('colourKnob', 3\)/); assert.match(PAGE, /knobParam\('beatKnob', 1\)/);
  assert.match(PAGE, /window\.__qaNextDrop = b => window\.__qaSectionDrop\(b, 16, 0\)/);
  assert.match(PAGE, /audio\.due\(BEAT_LANES\)/); assert.match(PAGE, /audio\.frameStart\(now\)/); assert.match(PAGE, /audio\.readEnergy\(\)/);
  assert.match(PAGE, /window\.__panicError/); assert.match(PAGE, /__panic\.calm\('init error'\)/);
  assert.match(SCENE, /checkFramebufferStatus/); assert.match(SCENE, /getShaderInfoLog/);
  assert.match(SCENE, /EXT_color_buffer_float/);
  assert.deepEqual(MACROS.map(m => m.name), ['height', 'colour', 'drift', 'intensity']);
  assert.deepEqual(TRIGGERS.map(t => t.key), ['Z', 'X'], 'not B or ` (panic.js)');
  const sc = createScene();
  for (const k of ['init', 'resize', 'frame', 'press', 'release', 'dispose', 'reset']) assert.equal(typeof sc[k], 'function', k);
});
