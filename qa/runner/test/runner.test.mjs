// Unit tests for the experiment format, gates, probes and the GPU gate. No browser, no network.
//   node --test qa/runner/test/
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'runner-test-'));
process.env.GPU_BUSY_FILE = path.join(tmp, 'busy');
process.env.GPU_LOCK = path.join(tmp, 'gpu.lock');
process.env.GPU_IDLE_SECS = '2';
process.env.GPU_WAIT_MIN = '0.05';
const E = await import('../experiment.mjs');
const G = await import('../gpu.mjs');
const { PROBES } = await import('../probes.mjs');
const example = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'experiments', 'example.json'), 'utf8'));
const min = { version: 1, id: '25-shape-shifter-2' };

test('the example is valid and expands to variants × resolutions', () => {
  const { errors, exp } = E.validate(example);
  assert.deepEqual(errors, []);
  assert.equal(exp.page, '18-little-bang');
  const runs = E.expand(exp);
  assert.equal(runs.length, 6);
  assert.equal(runs[0].label, 'collide@1080p');
  assert.deepEqual(runs.find(r => r.label === 'quench@4k').params, { scene: 'quench' });
  assert.deepEqual(exp.checks, [{ script: 'check-18', args: [] }]);
  assert.equal(exp.swipe.vs, '2ed06a0');
});

test('defaults fill in', () => {
  const { errors, exp } = E.validate(min);
  assert.deepEqual(errors, []);
  assert.equal(exp.page, '25-shape-shifter-2');
  assert.equal(exp.seconds, 12);
  assert.equal(exp.warmup, 4);
  assert.deepEqual(E.expand(exp).map(r => r.label), ['default@1080p']);
});

test('errors name the field', () => {
  const bad = (x, re) => { const { errors } = E.validate({ ...min, ...x }); assert.ok(errors.some(e => re.test(e)), `${JSON.stringify(x)} → ${errors.join(' | ')}`); };
  bad({ colour: 1 }, /unknown field "colour"/);
  bad({ version: 2 }, /version/);
  bad({ id: '../etc' }, /id must/);
  bad({ resolutions: ['8k'] }, /resolution "8k"/);
  bad({ gates: [{ metric: 'speed', min: 1 }] }, /metric "speed"/);
  bad({ gates: [{ metric: 'fps' }] }, /needs min, max or equals/);
  bad({ gates: [{ metric: 'value.x', max: 0 }] }, /value.x/);
  bad({ checks: ['../evil'] }, /check-\*\.mjs/);
  bad({ checks: [{ script: 'check-18', args: ['--x', '../../etc'] }] }, /plain arguments/);
  bad({ checks: [{ script: 'check-18', args: ['a b'] }] }, /plain arguments/);
  bad({ swipe: { vs: 'main; rm' } }, /swipe.vs/);
  bad({ debug: { gdb: true } }, /unknown probe "gdb"/);
  bad({ debug: { screenshotAt: 'soon' } }, /debug.screenshotAt/);
  bad({ variants: [{ name: 'a' }, { name: 'a' }] }, /unique/);
  bad({ sweep: { n: Array.from({ length: 13 }, (_, i) => i) } }, /1–12/);
  bad({ resolutions: ['720p', '1080p', '1440p', '4k'], sweep: { a: [1, 2, 3, 4, 5], b: [1, 2, 3, 4] } }, /80 runs/);
  bad({ seconds: 0, gates: [{ metric: 'fps', min: 1 }] }, /seconds > 0/);
  assert.match(E.validate([]).errors[0], /one JSON object/);
});

test('sweep makes variants and gates follow the parent name', () => {
  const { errors, exp } = E.validate({ ...min, variants: [{ name: 'orbit', params: { cam: 'orbit' } }], sweep: { n: [1, 2] }, gates: [{ metric: 'fps', min: 50, variant: 'orbit' }] });
  assert.deepEqual(errors, []);
  const runs = E.expand(exp);
  assert.deepEqual(runs.map(r => r.label), ['orbit_n-1@1080p', 'orbit_n-2@1080p']);
  assert.deepEqual(runs[1].params, { cam: 'orbit', n: 2 });
  const res = runs.map((r, i) => ({ ...r, metrics: { fps: i ? 40 : 60 } }));
  const [g] = E.evalGates(exp, res);
  assert.equal(g.ok, false);
  assert.match(g.value, /fails on orbit_n-2@1080p/);
});

test('gates: min, max, equals, filters, missing values', () => {
  const { exp } = E.validate({ ...min, resolutions: ['1080p', '4k'], values: { pieces: '__qa.pinch.pieces' }, gates: [
    { metric: 'fps.p05', min: 55, resolution: '1080p' }, { metric: 'clip', max: 1 }, { metric: 'value.pieces', equals: 2 }, { metric: 'errors', max: 0, variant: 'nope' }] });
  const runs = E.expand(exp).map(r => ({ ...r, metrics: r.size.name === '4k' ? { 'fps.p05': 30, clip: 0.5 } : { 'fps.p05': 59, clip: 0.2 }, values: { pieces: 2 } }));
  const g = E.evalGates(exp, runs);
  assert.deepEqual(g.map(x => x.ok), [true, true, true, false]);
  assert.match(g[3].value, /no run matches/);
  runs[0].values = {};
  assert.equal(E.evalGates(exp, runs)[2].ok, false);
});

test('check.md round trip with qa/builds.mjs rules', () => {
  const md = E.checkMd('t', [{ name: 'a | b', ok: true, value: 'x\ny' }, { name: 'c', ok: false, value: '' }], [['GPU', 'idle']]);
  const g = E.gatesFromMd(md);
  assert.deepEqual(g.map(x => [x.name, x.ok]), [['a   b', true], ['c', false]]);
  assert.match(md, /\| GPU \| ℹ️ \| idle \|/);
  assert.deepEqual(E.gatesFromMd('- ✅ ok\n- ❌ bad\n').map(x => x.ok), [true, false]);
});

test('readExpr gives plain JSON and survives a trailing comment', () => {
  const run = e => (0, eval)(E.readExpr(e));
  globalThis.__qa = { a: { b: [1, 2] }, f: () => undefined };
  assert.deepEqual(run('__qa.a'), { b: [1, 2] });
  assert.equal(run('__qa.f()'), null);
  assert.match(run('__qa.nope.x'), /^error: /);
  assert.equal(run('1 + 1 // two'), 2);
});

test('every probe has a check and at least one hook', () => {
  for (const [k, p] of Object.entries(PROBES)) {
    assert.equal(typeof p.check, 'function', k);
    assert.ok(['init', 'start', 'tick', 'end', 'done'].some(h => typeof p[h] === 'function'), k);
    assert.equal(typeof p.about, 'string', k);
  }
  assert.equal(PROBES.qaDump.check({ every: 0.5, read: { cam: '__qa.camera(0)' } }), null);
  assert.ok(PROBES.qaDump.check({ every: 0 }));
  assert.equal(PROBES.screenshotAtFrame.check([120]), null);
  assert.ok(PROBES.screenshotAtFrame.check([0.5]));
});

test('every probe is in the format doc', () => {
  const doc = fs.readFileSync(path.join(here, '..', '..', 'experiments', 'README.md'), 'utf8');
  for (const k of Object.keys(PROBES)) assert.ok(doc.includes('`' + k + '`'), k);
  for (const k of Object.keys(E.METRICS)) assert.ok(doc.includes('`' + k + '`'), k);
});

test('GPU lock: one holder, stale locks are taken over', () => {
  assert.equal(G.tryLock('a'), true);
  assert.equal(G.tryLock('again'), true);                 // same process
  fs.writeFileSync(process.env.GPU_LOCK, '1 someone\n');   // pid 1 is alive
  assert.equal(G.tryLock('b'), false);
  fs.writeFileSync(process.env.GPU_LOCK, '999999 dead\n');
  assert.equal(G.tryLock('c'), true);
  G.unlock();
  assert.equal(fs.existsSync(process.env.GPU_LOCK), false);
});

test('GPU gate waits for idle readings and saves them', async () => {
  fs.writeFileSync(process.env.GPU_BUSY_FILE, '3\n');
  const ok = await G.gpuGate({});
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.readings, [3, 3]);
  G.unlock();
  fs.writeFileSync(process.env.GPU_BUSY_FILE, '99\n');
  const busy = await G.gpuGate({});
  assert.equal(busy.ok, false);
  assert.match(busy.why, /GPU busy/);
  assert.equal(fs.existsSync(process.env.GPU_LOCK), false);  // let go when it gives up
  fs.rmSync(process.env.GPU_BUSY_FILE);
  const none = await G.gpuGate({});
  assert.equal(none.ok, true);
  assert.match(none.note, /no reading/);
  G.unlock();
});
