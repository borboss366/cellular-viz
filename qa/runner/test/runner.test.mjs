// Unit tests for the experiment format, gates, probes and the GPU gate. No browser, no network.
//   node --test qa/runner/test/*.test.mjs
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
process.env.GPU_SAMPLE_HZ = '1';                         // the first gate test reads once a second
process.env.GPU_DRI = path.join(tmp, 'dri');             // render-node stubs (#144)
process.env.GPU_PROC = path.join(tmp, 'proc');
process.env.GPU_HOLDER_ALLOW = 'Xorg';
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

test('gates: luminance metrics are known and gate like any other', () => {
  const { exp } = E.validate({ ...min, gates: [{ metric: 'lum.mean', min: 20 }, { metric: 'lum.max', max: 90 }] });
  const runs = E.expand(exp).map(r => ({ ...r, metrics: { 'lum.mean': 25.5, 'lum.max': 95 }, values: {} }));
  assert.deepEqual(E.evalGates(exp, runs).map(x => x.ok), [true, false]);
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
  assert.match(busy.why, /waiting for GPU \(busy 99/); assert.equal(busy.waiting, true);   // #144: still queued, not a failure
  assert.equal(fs.existsSync(process.env.GPU_LOCK), false);  // let go when it gives up
  fs.rmSync(process.env.GPU_BUSY_FILE);
  const none = await G.gpuGate({});
  assert.equal(none.ok, true);
  assert.match(none.note, /no reading/);
  G.unlock();
});

// ---------- #144: GPU idle precondition, foreign render-node holders, the job's tail ----------
const DRI = process.env.GPU_DRI, PROC = process.env.GPU_PROC, NODE = path.join(DRI, 'renderD128');
fs.mkdirSync(DRI, { recursive: true }); fs.writeFileSync(NODE, '');
function fakeProc(pid, comm, { ppid = 1, cmd = comm, holds = true } = {}) {   // a /proc/<pid> stub; holds: an fd linked to the render node
  const d = path.join(PROC, String(pid));
  fs.mkdirSync(path.join(d, 'fd'), { recursive: true });
  fs.writeFileSync(path.join(d, 'comm'), comm + '\n');
  fs.writeFileSync(path.join(d, 'stat'), `${pid} (${comm}) S ${ppid} ${pid} ${pid} 0 -1 0 0 0 0 0 0 0 0 0 20 0 1 0 12345 0 0\n`);
  fs.writeFileSync(path.join(d, 'cmdline'), cmd.split(' ').join('\0'));
  if (holds) fs.symlinkSync(NODE, path.join(d, 'fd', '3'));
  return () => fs.rmSync(d, { recursive: true, force: true });
}
const gpuTiming = over => { const keep = { ...G.GPU }; Object.assign(G.GPU, over); return () => Object.assign(G.GPU, keep); };

test('#144 truth 1: a busy GPU holds the job (shown as waiting); it starts within 4 s of going idle', async () => {
  const restore = gpuTiming({ hz: 4, idleSecs: 3, waitMin: 0.5 });
  fs.writeFileSync(process.env.GPU_BUSY_FILE, '50\n');
  const seen = [];
  let done = null; const t = { at: 0 };
  const p = G.gpuGate({ onWait: w => { if ('busy' in w) seen.push(w.busy); } }).then(g => { done = g; t.at = Date.now(); });
  await new Promise(r => setTimeout(r, 1500));
  assert.equal(done, null, 'not started while busy');
  assert.ok(seen.includes(50), 'waiting state shows the busy reading');
  const idleAt = Date.now(); fs.writeFileSync(process.env.GPU_BUSY_FILE, '0\n');
  await p;
  assert.equal(done.ok, true);
  assert.ok(t.at - idleAt < 4000, `started ${t.at - idleAt} ms after idle`);
  G.unlock(); restore();
});

test('#144: a foreign render-node holder holds the job; the compositor and the runner\'s own children do not', async () => {
  const restore = gpuTiming({ hz: 4, idleSecs: 0.5, waitMin: 0.5 });
  fs.writeFileSync(process.env.GPU_BUSY_FILE, '0\n');
  const rmX = fakeProc(700, 'Xorg'), rmOwn = fakeProc(701, 'chrome', { ppid: process.pid }), rmML = fakeProc(4242, 'python3');
  assert.deepEqual(G.renderHolders().map(h => h.pid).sort(), [4242, 700, 701]);
  assert.deepEqual(G.foreignHolders().map(h => h.pid), [4242]);
  let done = null, holder = [];
  const p = G.gpuGate({ onWait: w => { if (w.holders) holder = w.holders.map(h => h.comm); } }).then(g => { done = g; });
  await new Promise(r => setTimeout(r, 1200));
  assert.equal(done, null, 'not started while python3 holds the render node');
  assert.deepEqual(holder, ['python3']);
  rmML();
  await p;
  assert.equal(done.ok, true);
  G.unlock(); rmX(); rmOwn(); restore();
});

test('#144 truth 2: a foreign holder during the run is reported once (the runner then discards and requeues)', async () => {
  const hits = [];
  const stop = G.watchForeign({ everyMs: 50, onForeign: hs => hits.push(hs.map(h => h.comm)) });
  await new Promise(r => setTimeout(r, 150));
  assert.equal(hits.length, 0);
  const rm = fakeProc(4343, 'blender');
  await new Promise(r => setTimeout(r, 300));
  stop(); rm();
  assert.deepEqual(hits, [['blender']]);
});

test('#144 truth 3: the tail is closed: leftovers of the job let go or are killed before the lock is released', async () => {
  const restore = gpuTiming({ tailSecs: 0.3 });
  const rmX = fakeProc(700, 'Xorg'), rmOld = fakeProc(800, 'python3');   // both there before the job: never touched
  const baseline = new Set(G.renderHolders().map(h => h.pid));
  const rmGpu = fakeProc(5151, 'chrome', { cmd: '/opt/chromium/chrome --type=gpu-process' });   // a slow-exiting GPU process
  const killed = [];
  const tail = await G.closeTail({ baseline, kill: pid => { killed.push(pid); if (pid === 5151) rmGpu(); } });
  assert.deepEqual(killed, [5151]);
  assert.ok(tail.tailMs >= 300 && tail.tailMs < 2000, `tail ${tail.tailMs} ms`);
  assert.deepEqual(tail.left, []);
  assert.deepEqual(G.renderHolders().map(h => h.pid).sort(), [700, 800]);
  const quick = fakeProc(5252, 'chrome', { cmd: 'chrome --type=renderer' });
  setTimeout(quick, 100);                                                  // exits by itself: not killed
  const t2 = await G.closeTail({ baseline, kill: pid => killed.push(pid) });
  assert.equal(killed.length, 1); assert.ok(t2.tailMs < 300);
  rmX(); rmOld(); restore();
});

// ---------- after-build steps: board moves, history entry, report commit ----------
const B = await import('../board.mjs');
const P = await import('../post.mjs');
const bl = (pr, page, round, status, extra = {}) => ({ id: `viz-${pr}-${round}`, pr, page, round, status, commit: 'abc1234', at: `2026-10-27T0${round}:00:00Z`, gates: [], ...extra });

test('board: one status per PR, the worst page wins, newest round per page', () => {
  const s = B.prStatus([bl(57, '25-x', 1, 'failed'), bl(57, '25-x', 2, 'ready'), bl(49, '18-a', 1, 'ready'), bl(49, '17-b', 1, 'running')], { now: Date.parse('2026-10-27T01:30:00Z') });
  assert.equal(s[57].status, 'ready');
  assert.equal(s[49].status, 'running');
});

test('board: plan follows the rules and leaves hand moves alone', () => {
  const items = { 57: { status: 'QA' }, 49: { status: 'Your review' }, 40: { status: 'Your review' }, 22: { status: 'Next' } };
  const states = { 57: 'OPEN', 49: 'OPEN', 40: 'MERGED', 22: 'OPEN', 65: 'OPEN', 23: 'CLOSED' };
  const builds = [bl(57, '25-x', 3, 'failed'), bl(49, '18-a', 5, 'ready')];
  const m = Object.fromEntries(B.plan(items, states, builds).filter(x => !x.noop).map(x => [x.n, x.to]));
  assert.deepEqual(m, { 57: 'In progress', 40: 'Done', 65: 'Ideas' });
  // once applied, a card moved by hand stays until the next build
  const again = B.plan({ ...items, 57: { status: 'Next' } }, states, builds, { 57: 'viz-57-3:failed', 49: 'viz-49-5:ready' });
  assert.equal(again.some(x => x.n === 57), false);
});

test('post: commit message, dirs and sh quoting', () => {
  const b = bl(57, '25-shape-shifter-2', 7, 'failed', { gates: [{ name: 'fps', ok: true }, { name: 'clip ≤ 1', ok: false }],
    report: 'qa/25-shape-shifter-2/runs/2026-10-27-1130-pr57/check.md', swipe: '/run/25-shape-shifter-2/2026-10-27-1130-pr57-swipe/compare' });
  const msg = P.messageFor(b);
  assert.match(msg, /^qa: #57 25-shape-shifter-2 @abc1234 failed 1\/2 \(viz-57-7\)\n/);
  assert.match(msg, /Failed: clip ≤ 1/);
  assert.match(msg, /Made-by: QA runner/);
  assert.deepEqual(P.buildDirs(b), ['qa/25-shape-shifter-2/runs/2026-10-27-1130-pr57', 'qa/25-shape-shifter-2/runs/2026-10-27-1130-pr57-swipe']);
  assert.equal(P.shLine('node', ['a b', "it's", '--x=1']), `node 'a b' 'it'\\''s' --x=1`);
});

test('post: history entry, report files and a commit of only those paths', async () => {
  const { execFileSync } = await import('node:child_process');
  const home = fs.mkdtempSync(path.join(tmp, 'qahome-'));
  const g = (...a) => execFileSync('git', ['-C', home, ...a], { encoding: 'utf8' });
  g('init', '-q'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  const run = path.join(home, 'qa', '25-x', 'runs', 's-pr57');
  fs.mkdirSync(path.join(run, 'stills'), { recursive: true });
  fs.writeFileSync(path.join(run, 'check.md'), '# c\n'); fs.writeFileSync(path.join(run, 'results.json'), '{}');
  const b = bl(57, '25-x', 1, 'ready', { report: 'qa/25-x/runs/s-pr57/check.md' });
  fs.writeFileSync(path.join(run, 'stills', 'a.png'), 'png'); fs.writeFileSync(path.join(home, 'qa', 'builds.json'), JSON.stringify(b) + '\n');
  fs.writeFileSync(path.join(home, 'other.txt'), 'x'); g('add', 'other.txt');          // QA box's own staged work
  const hist = P.historyEntry({ qaHome: home, b, trace: [['git', ['-C', '/w', 'fetch']], ['node', ['exp-run.mjs', '--out', '/t/o']]], result: 'viz-57-1 ready 2/2', checksRef: 'qa/headless-runner' });
  assert.match(fs.readFileSync(path.join(home, hist[1]), 'utf8'), /\ngit -C \/w fetch\nnode exp-run.mjs --out \/t\/o\n$/);
  const files = P.reportFiles(home, P.buildDirs(b));
  assert.deepEqual(files.sort(), ['qa/25-x/runs/s-pr57/check.md', 'qa/25-x/runs/s-pr57/results.json']);
  const r = await P.commitPaths(home, [...hist, ...files, 'qa/builds.json'], P.messageFor(b));
  assert.equal(r.ok, true, r.why);
  const committed = g('show', '--name-only', '--format=', 'HEAD').trim().split('\n').sort();
  assert.equal(committed.length, 5);
  assert.ok(!committed.some(f => f.endsWith('.png') || f === 'other.txt'));
  assert.match(g('diff', '--cached', '--name-only'), /other\.txt/);                   // still staged, untouched
  assert.equal((await P.commitPaths(home, files, 'again')).why, 'nothing changed');
  fs.writeFileSync(path.join(run, 'report.md'), '# r\n');
  const left = await P.commitReports(home);
  assert.equal(left.ok, true, left.why);
  assert.match(g('log', '-1', '--format=%s').trim(), /^qa: #57 25-x @abc1234 ready 0\/0 \(viz-57-1\)$/);
  assert.equal(g('log', '-1', '--format=%an <%ae>').trim(), 't <t@t>');      // the repo's own identity wins when it has one
});

test('post: commits without a git identity in QA_HOME, and a failed commit leaves nothing staged', async () => {
  const { execFileSync } = await import('node:child_process');
  const home = fs.mkdtempSync(path.join(tmp, 'noid-'));
  const g = (...a) => execFileSync('git', ['-C', home, ...a], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' } });
  g('init', '-q');
  fs.mkdirSync(path.join(home, 'qa'));
  fs.writeFileSync(path.join(home, 'qa', 'a.md'), '# a\n');
  const saved = process.env.GIT_CONFIG_GLOBAL; process.env.GIT_CONFIG_GLOBAL = '/dev/null'; process.env.GIT_CONFIG_NOSYSTEM = '1';
  try {
    const r = await P.commitPaths(home, ['qa/a.md'], 'qa: a\n');
    assert.equal(r.ok, true, r.why);
    assert.equal(g('log', '-1', '--format=%an <%ae>').trim(), 'QA box <qa-box@puggie.local>');
    fs.writeFileSync(path.join(home, 'qa', 'b.md'), '# b\n');
    fs.mkdirSync(path.join(home, '.git', 'hooks'), { recursive: true });
    fs.writeFileSync(path.join(home, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const bad = await P.commitPaths(home, ['qa/b.md'], 'qa: b\n');
    assert.equal(bad.ok, false);
    assert.equal(g('diff', '--cached', '--name-only').trim(), '');
  } finally { delete process.env.GIT_CONFIG_NOSYSTEM; if (saved === undefined) delete process.env.GIT_CONFIG_GLOBAL; else process.env.GIT_CONFIG_GLOBAL = saved; }
});

test('board: no-check-script failures and stale running builds say nothing; finished running = passed', () => {
  const now = Date.parse('2026-10-27T12:00:00Z');
  const noScript = bl(21, '07-particle-lenia', 2, 'failed', { gates: [{ name: 'a check script for 07-particle-lenia', ok: false }] });
  assert.equal(B.boardStatus(noScript, { now }), null);
  assert.equal(B.boardStatus(bl(45, '17-x', 1, 'failed', { gates: [{ name: 'groupLaw', ok: false }] }), { now }), 'failed');
  assert.equal(B.boardStatus(bl(39, '13-x', 1, 'running', { started: '2026-10-26T20:30:00Z', finished: '2026-10-26T20:39:00Z' }), { now }), 'passed');
  assert.equal(B.boardStatus(bl(39, '13-x', 1, 'running', { started: '2026-10-26T20:30:00Z' }), { now }), null);
  assert.equal(B.boardStatus(bl(39, '13-x', 1, 'running', { started: '2026-10-27T11:30:00Z' }), { now }), 'running');
});

test('board: the first sync records builds and moves only closed and missing items', () => {
  const items = { 21: { status: 'Your review' }, 45: { status: 'Your review' }, 53: { status: 'Your review' } };
  const states = { 21: 'OPEN', 45: 'OPEN', 53: 'MERGED', 58: 'OPEN' };
  const builds = [bl(45, '17-x', 1, 'failed', { gates: [{ name: 'groupLaw', ok: false }] })];
  const moves = B.plan(items, states, builds, {}, { seed: true });
  assert.deepEqual(moves.filter(m => !m.noop).map(m => [m.n, m.to]), [[53, 'Done'], [58, 'Ideas']]);
  assert.deepEqual(moves.filter(m => m.noop).map(m => [m.n, m.key]), [[45, 'viz-45-1:failed']]);
  // the next build of #45 moves it
  const next = B.plan(items, states, [...builds, bl(45, '17-x', 2, 'failed', { gates: [{ name: 'groupLaw', ok: false }] })], { 45: 'viz-45-1:failed' });
  assert.deepEqual(next.filter(m => !m.noop && m.n === 45).map(m => m.to), ['In progress']);
});

test('board: a closed unmerged PR\'s builds go to Done like merged ones', () => {
  assert.equal(B.TARGET.closed, 'Done');
  assert.equal(B.TARGET.merged, 'Done');
});
