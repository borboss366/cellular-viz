// No-beat mode (the apartment MVP, Task 3): audio-in's beat weight (0..1, one-bar smoothstep ramps, never a jump)
// and energy envelopes, and the QA row's arithmetic (qa/nobeat.mjs). No browser: a stand-in clock and explicit times.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const AudioIn = require('../../../experiments/audio-in.js');
const NB = await import('../../nobeat.mjs');
const QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** a clock stand-in: confidence, bpm, playing, beats and (optionally) a shared state the test sets */
function fakeClock(o = {}) {
  const c = { conf: 1, bpm: 120, playing: true, beats: 10, shared: null, ...o };
  return { c, settings: { bpb: 4 }, get playing() { return c.playing; }, get sharedState() { return c.shared; }, ctx: null,
    read: () => ({ confidence: c.conf, bpm: c.bpm, beats: c.beats, kick: 0, snare: 0, hat: 0, level: 0 }) };
}
const mk = o => { const clock = fakeClock(o); return { clock, a: AudioIn.create({ clock, source: 'clock', storage: null, device: null }) }; };
/** step the weight every 1/60 s for secs, from t; returns the w per frame */
function run(a, t0, secs) { const ws = []; for (let t = t0; t <= t0 + secs + 1e-9; t += 1 / 60) ws.push(a.beatWeight(t)); return ws; }

test('beat weight: locked starts at 1; confidence < 0.4 fades it to 0 over one bar (smoothstep, half at half a bar), then back over one bar', () => {
  const { clock, a } = mk();
  assert.equal(a.beatWeight(0), 1, 'locked from the first frame: no fade on load');
  clock.c.conf = 0.39;   // 120 bpm, 4/4: one bar = 2 s
  const down = run(a, 1 / 60, 2.2);
  assert.ok(Math.abs(a.bw.barS - 2) < 1e-9);
  const half = down[59];   // t = 1 s: half a bar
  assert.ok(Math.abs(half - 0.5) < 0.02, `half a bar in: ${half}`);
  assert.equal(down[down.length - 1], 0, 'at 0 after one bar');
  for (let i = 1; i < down.length; i++) assert.ok(down[i] <= down[i - 1] + 1e-12, 'monotone down');
  clock.c.conf = 0.8;
  const up = run(a, 2.3, 2.2);
  assert.equal(up[up.length - 1], 1, 'back to 1 after one bar');
  const steps = [...down, ...up].slice(1).map((w, i) => Math.abs(w - [...down, ...up][i]));
  assert.ok(Math.max(...steps) <= 1.5 / 60 / 2 + 1e-9, `no jump: largest step ${Math.max(...steps)}`);
});

test('beat weight: the shared clock lost (or waiting) is no beat; locked again brings it back; no beats (not playing) is no beat', () => {
  const { clock, a } = mk({ shared: { state: 'locked' } });
  assert.equal(a.beatWeight(0), 1);
  clock.c.shared = { state: 'free-run' };
  run(a, 1 / 60, 2.1);
  assert.equal(a.bw.w, 0); assert.equal(a.bw.lost, true);
  clock.c.shared = { state: 'locked' };
  run(a, 2.2, 2.1);
  assert.equal(a.bw.w, 1); assert.equal(a.bw.lost, false);
  const s = mk({ playing: false, beats: -1 });
  assert.equal(s.a.beatWeight(0), 0, 'before Play: no beats');
  const w = mk({ shared: { state: 'waiting' } });
  assert.equal(w.a.beatWeight(0), 0, 'shared clock waiting for its first message');
});

test('beat weight: the ramp follows the tempo (one bar at 60 bpm = 4 s); a stalled frame moves it at most 1 s; forceConfidence overrides for QA', () => {
  const { clock, a } = mk({ bpm: 60 });
  a.beatWeight(0);
  clock.c.conf = 0;
  a.beatWeight(1);   // 1 s of a 4 s bar: r = 0.75
  assert.ok(Math.abs(a.bw.r - 0.75) < 1e-9, `r ${a.bw.r}`);
  a.beatWeight(9);   // an 8 s stall counts as 1 s
  assert.ok(Math.abs(a.bw.r - 0.5) < 1e-9, `r ${a.bw.r}`);
  const f = mk();
  f.a.beatWeight(0);
  assert.equal(f.a.forceConfidence(0), 0);
  run(f.a, 1 / 60, 2.1);
  assert.equal(f.a.bw.w, 0, 'forced 0 fades out');
  assert.equal(f.a.forceConfidence(null), null);
  run(f.a, 2.2, 2.1);
  assert.equal(f.a.bw.w, 1, 'the clock again');
  assert.equal(f.a.forceConfidence(7), 1, 'clamped');
  const q = AudioIn.qa(f.a, {});
  assert.equal(typeof q.forceConfidence, 'function');
  assert.deepEqual(Object.keys(q.beatWeight).sort(), ['at', 'barS', 'conf', 'forced', 'lost', 'r', 'target', 'w']);
  assert.deepEqual(Object.keys(q.energy).sort(), ['bands', 'kick', 'level']);
});

test('energy envelopes: fast attack, 250 ms release, a kick envelope from the low bands, never NaN', () => {
  const { a } = mk();
  const flat = v => Object.fromEntries(AudioIn.BANDS.map(b => [b, v]));
  let e = a.stepEnergy(flat(0), 0, 0);
  assert.equal(e.level, 0);
  for (let i = 1; i <= 3; i++) e = a.stepEnergy(flat(0.8), i / 60, i / 60);   // 50 ms of loud
  assert.ok(e.bands.mid > 0.79, `attack: ${e.bands.mid}`);
  assert.ok(e.kick > 0, 'a low-band onset: the kick envelope rises');
  for (let i = 4; i <= 18; i++) e = a.stepEnergy(flat(0), i / 60, i / 60);   // 15 frames = 250 ms of silence
  assert.ok(e.bands.mid > 0.8 * Math.exp(-1) - 0.03 && e.bands.mid < 0.8 * Math.exp(-1) + 0.03, `release ~ e^-1: ${e.bands.mid}`);
  e = a.stepEnergy({ ...flat(0.5), mid: NaN, air: undefined }, 0.5, 0.5);
  assert.ok([e.kick, e.level, ...Object.values(e.bands)].every(Number.isFinite), 'NaN in, numbers out');
  assert.deepEqual(Object.keys(e.bands), AudioIn.BANDS);
});

test('the no-beat QA row (qa/nobeat.mjs): at target one bar in, no pop, no NaN, frame budget; each failure named', () => {
  const recs = (fn, secs = 6) => { const r = []; for (let i = 0; i <= secs * 60; i++) { const ts = i * 1000 / 60; r.push({ ts, dt: i ? 1000 / 60 : null, barS: 2, target: 0, ...fn(ts / 1000, i) }); } return r; };
  const fade = t => Math.max(0, 1 - t / 2), sm = r => r * r * (3 - 2 * r);
  const E = [0.1, 0.2, 0, 0, 0, 0, 0, 0, 0, 0];
  const good = NB.phaseRows(recs(t => ({ w: sm(fade(t)), e: E })), { target: 0, secs: 6 });
  assert.equal(good.atTarget, true); assert.equal(good.nan, 0); assert.ok(good.maxStep <= good.maxStepAllowed);
  assert.ok(Math.abs(good.p95 - 1000 / 60) < 1e-6);
  const pop = NB.phaseRows(recs((t, i) => ({ w: i < 100 ? 1 : 0, e: E })), { target: 1, secs: 6 });   // and ends at 0, not 1
  assert.ok(pop.maxStep > pop.maxStepAllowed, 'a jump from 1 to 0 is a pop');
  const nan = NB.phaseRows(recs(() => ({ w: 0, e: [NaN, ...E.slice(1)] })), { target: 0, secs: 6 });
  assert.ok(nan.nan > 0);
  const slow = NB.phaseRows(recs(() => ({ w: 0, e: E })).map(r => ({ ...r, dt: 25 })), { target: 0, secs: 6 });
  const res = { phases: [{ name: 'nobeat-1', target: 0, rows: good, still: '/x/nobeat-1.png' }, { name: 'locked', target: 1, rows: pop, still: null }, { name: 'nobeat-2', target: 0, rows: slow, still: null }], alive: { panic: 'off', lost: 0 } };
  const v = NB.verdict(res, { errors: [], budget: true });
  assert.equal(v.pass, false);
  assert.match(v.lines[0], /^nobeat-1: pass/);
  assert.match(v.lines[1], /a pop/); assert.match(v.lines[1], /not at 1/);
  assert.match(v.lines[2], /frame p95 25 ms > 17.5/);
  assert.doesNotMatch(NB.verdict(res, { errors: [], budget: false }).lines[2], /frame p95 25 ms >/, 'budget report-only on software rendering');
  assert.match(NB.verdict({ ...res, alive: { panic: 'calm', lost: 1 } }, { errors: ['x'] }).lines[3], /scene alive: FAIL/);
  const none = NB.phaseRows(recs(() => ({ w: null, e: null })), { target: 0, secs: 6 });
  assert.ok(none.noHelper > 0);
  assert.deepEqual(NB.PHASES.map(p => [p.name, p.conf, p.target]), [['nobeat-1', 0, 0], ['locked', null, 1], ['nobeat-2', 0, 0]]);
  const cli = fs.readFileSync(path.join(QA, 'check-nobeat.mjs'), 'utf8');
  assert.match(cli, /runNoBeat\(page, \{ phaseSecs: SECS, outDir: out \}\)/);
  assert.match(cli, /arg\('secs', 30\)/, '30 s phases by default');
});

test('the no-beat stills on the grading page: /grade lists the run, its page has one card per phase, verdicts grade it', async () => {
  const os = await import('node:os'), { spawn } = await import('node:child_process');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'nobeat-grade-')), stamp = '2026-11-14-1700';
  const dir = path.join(home, 'qa', '16-hodge-kaleidoscope', 'runs', stamp);
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5b70000000049454e44ae426082', 'hex');
  const rows = { frames: 10 };
  const res = { phases: NB.PHASES.map((p, i) => ({ name: p.name, target: p.target, rows, still: path.join(dir, 'stills', NB.stillName(i, p.name)) })), alive: { panic: 'off', lost: 0 } };
  fs.mkdirSync(path.join(dir, 'stills'), { recursive: true });
  for (const p of res.phases) fs.writeFileSync(p.still, png);
  const run = NB.gradeRun({ page: '16-hodge-kaleidoscope.html', query: 'capture=1', secs: 30, res, verdictLines: ['nobeat-1: pass', 'locked: pass', 'nobeat-2: pass'], pass: true, gpu: 'AMD Radeon 780M', stamp });
  assert.deepEqual(run.results.map(r => [r.label, r.still]), [['nobeat-1', 'stills/01-nobeat-1.png'], ['locked', 'stills/02-locked.png'], ['nobeat-2', 'stills/03-nobeat-2.png']]);
  assert.ok(run.results.every(r => !r.video), 'stills only');
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify(run));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(QA, 'serve.mjs'), '--port', String(port)], { env: { ...process.env, QA_HOME: home, QA_NOTES_DIR: path.join(home, 'notes') }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('viewer did not start')), 10e3);
      child.stdout.on('data', d => { if (String(d).includes(`:${port}`)) { clearTimeout(t); resolve(); } }); child.on('exit', c => reject(new Error(`viewer exited ${c}`))); });
    const base = `http://127.0.0.1:${port}`, link = `/run/16-hodge-kaleidoscope/${stamp}`;
    let grade = await (await fetch(`${base}/grade`)).text();
    assert.ok(grade.includes(`href="${link}"><b>`) && grade.includes('grade the stills'), 'listed to grade, linked to its stills');
    assert.match(grade, /Runs to grade \(1\)/);
    const page = await (await fetch(`${base}${link}`)).text();
    for (const [i, p] of NB.PHASES.entries()) {
      assert.ok(page.includes(`data-label="${p.name}"`), `${p.name}: a card`);
      assert.ok(page.includes(`/file/16-hodge-kaleidoscope/${stamp}/stills/${NB.stillName(i, p.name)}`), `${p.name}: its still`);
    }
    assert.ok(!page.includes('NaN%'), 'no video numbers on a stills card');
    assert.equal((await fetch(`${base}/file/16-hodge-kaleidoscope/${stamp}/stills/02-locked.png`)).status, 200);
    for (const p of NB.PHASES) {
      const r = await fetch(`${base}${link}/verdict`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ label: p.name, verdict: 'keep', note: '' }) });
      assert.equal(r.status, 200);
    }
    grade = await (await fetch(`${base}/grade`)).text();
    assert.match(grade, /Runs to grade \(0\)/); assert.match(grade, /Graded \(1\)/);
  } finally { child.kill(); fs.rmSync(home, { recursive: true, force: true }); }
});
