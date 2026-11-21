// 06 · Lenia + effects, beat lights (Orchestrator's Saturday batch, task 2): a soft neon spot on the mass on each kick,
// behind a switch that is off in the Sunday set (?lights=1, the page's button or L turn it on). Flash safety lives in
// experiments/06-beat.js: at most 3 flashes a second, each flash's brightness jump at most 0.35 (luma), mass only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const B = require('../../../experiments/06-beat.js');
const PAGE = fs.readFileSync(new URL('../../../experiments/06-lenia-effects.html', import.meta.url), 'utf8');
const SET = JSON.parse(fs.readFileSync(new URL('../../../experiments/set.json', import.meta.url), 'utf8'));

// kicks every gapMs for ms milliseconds at 60 fps; returns the state and every frame's light
function run(on, g, gapMs, ms = 10000) {
  const s = B.lightsNew(on), out = [];
  let nextKick = 0;
  for (let now = 0; now <= ms; now += 1000 / 60) {
    const onset = now >= nextKick; if (onset) nextKick += gapMs;
    out.push({ now, ...B.lightsStep(s, now, onset, g) });
  }
  return { s, out };
}

test('06 beat lights: off by default and in the Sunday set; the switch is ?lights=1, the button or L', () => {
  const { s, out } = run(false, 2, 500);
  assert.equal(s.fired, 0); assert.ok(out.every(f => f.amp === 0), 'no light while off');
  const lenia = SET.scenes.find(x => x.page === '06-lenia-effects.html');
  assert.ok(lenia, 'Lenia is in the set');
  assert.ok(!lenia.query || !('lights' in lenia.query), 'the set does not turn the lights on');
  assert.ok(!('lights' in (SET.defaults || {})), 'nor do the set defaults');
  assert.match(PAGE, /setLights\(query\.get\('lights'\) === '1'\)/, 'only ?lights=1 turns them on at load');
  assert.match(PAGE, /const lights = LeniaBeat\.lightsNew\(false\);/);
  assert.match(PAGE, /LeniaBeat\.lightsStep\(lights, now, anyKick, BT\.g\)/, 'driven by the kick and the beat knob');
  assert.match(PAGE, /smoothstep\(0\.05, 0\.35, t\)/, 'the spot lights only the mass');
});

test('06 beat lights: flash safety, at most 3 a second and a brightness jump of at most 0.35, even at 10 kicks a second', () => {
  for (const g of [0.5, 1, 2]) for (const gap of [100, 250, 334, 500]) {
    const { s, out } = run(true, g, gap);
    assert.ok(s.fired > 0, `fires (g ${g}, every ${gap} ms)`);
    assert.ok(s.maxPerSec <= 3, `${s.maxPerSec} flashes in a second (g ${g}, every ${gap} ms)`);
    assert.ok(s.maxJump <= B.LIGHTS.JUMP_MAX + 1e-12, `jump ${s.maxJump}`);
    for (const f of out) assert.ok(f.amp * B.luma(f.col) <= B.LIGHTS.JUMP_MAX + 1e-12, `frame jump at ${f.now}`);
    let fires = []; out.forEach((f, i) => { if (i && f.amp > out[i - 1].amp && out[i - 1].amp < 1e-3) fires.push(f.now); });
    for (let i = 1; i < fires.length; i++) assert.ok(fires[i] - fires[i - 1] >= B.LIGHTS.MIN_GAP_MS - 1000 / 60, 'gap between flashes');
  }
});

test('06 beat lights: the beat knob scales them (g 0 none, g 2 brighter than g 1), and each flash fades out within 1.3 s', () => {
  assert.equal(run(true, 0, 500).s.fired, 0, 'g 0: no light');
  for (let k = 0; k < B.LIGHTS.COLS.length; k++) {
    const peak = g => { const s = B.lightsNew(true); s.k = k - 1; B.lightsStep(s, 0, true, g); return s.peak; };
    assert.ok(peak(1) > 0 && peak(2) > peak(1), `colour ${k}: g 2 > g 1 > 0`);
  }
  const s = B.lightsNew(true); B.lightsStep(s, 0, true, 2);
  assert.ok(B.lightsStep(s, 25, false, 2).amp > 0.3, 'bright at the attack');
  assert.equal(B.lightsStep(s, 1300, false, 2).amp, 0, 'gone 1.3 s later');
});
