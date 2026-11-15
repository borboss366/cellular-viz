// ?clock=shared in Chromium (the apartment MVP, Task 1): the shared-clock publisher page (experiments/clock-publish.html,
// a silent metronome at 128 that publishes the way the conductor page does) and scene 13 (flow lab) with
// ?clock=shared, in ONE browser context, so the BroadcastChannel reaches the scene. Box only (Playwright from the
// runner settings' QA_HOME, as conduct-smoke.test.mjs; skipped anywhere else). Checks: the scene locks to the
// publisher (messages, last error), and check-shared's beat-match row on scene 13 holds under ?clock=shared: every
// clock hit on its lanes since Play has exactly one beatLog entry, drawn in the first frame that reaches it.
// Not the conductor itself: its output only exists once it has locked to a played track; the publisher page sends
// the same messages through the same Clock.publish.
//   node --test qa/runner/test/*.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as S from '../../conduct-serve.mjs';
import { heavyLock, SMOKE_TIMEOUT_MS } from './fixtures/heavy-lock.mjs';
// closed when the file ends, even if the test timed out first (#231: a timed-out test's late t.after never ran)
const atEnd = [];
after(async () => { for (const f of atEnd.splice(0).reverse()) { try { await f(); } catch {} } });

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function qaHome() {
  const files = [process.env.RUNNER_ENV, path.join(os.homedir(), '.config/cellular-viz-runner.env'), path.join(os.homedir(), '.cache/cellular-viz-runner/runner.env')].filter(Boolean);
  const file = files.find(f => fs.existsSync(f));
  if (!file) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').filter(l => /^QA_HOME=/.test(l)).pop();
  return line ? line.slice('QA_HOME='.length).trim().replace(/^(['"])(.*)\1$/, '$2') : null;
}
function headlessShell(fullExe) {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.dirname(path.dirname(path.dirname(fullExe || ''))), path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const r of roots) {
    let ds = [];
    try { ds = fs.readdirSync(r).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse(); } catch { continue; }
    for (const d of ds) { const p = path.join(r, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  }
  return null;
}
/** check-shared's beat-match row (contract #95 comment 6533515449), on the numbers the page hands over */
function beatMatch(b) {
  const lanes = b.lanes && b.lanes.length ? b.lanes : [...new Set(b.log.map(e => e.lane))];
  const end = b.now ?? Math.max(-Infinity, ...b.log.map(e => e.now));
  const due = b.hits.filter(h => lanes.includes(h.lane) && h.time <= end - 0.1);
  let missing = 0, dup = 0, early = 0, late = 0;
  for (const h of due) {
    const m = b.log.filter(e => e.lane === h.lane && Math.abs(e.time - h.time) < 1e-6);
    if (!m.length) { missing++; continue; }
    if (m.length > 1) dup++;
    const lag = m[0].now - m[0].time;
    if (lag < 0) early++; else if (!(lag < (m[0].dt || 0) + 0.001)) late++;
  }
  return { lanes, due: due.length, missing, dup, early, late, pass: due.length >= 20 && !missing && !dup && !early && !late };
}

test('?clock=shared in Chromium: scene 13 follows the publisher page in the same browser; the beat-match row holds (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const release = await heavyLock('clock-shared-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-smoke-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tracks')); fs.mkdirSync(path.join(root, 'sessions'));
  const srv = http.createServer(S.createHandler({ tracksDir: path.join(root, 'tracks'), sessionsDir: path.join(root, 'sessions'), repo: REPO }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const closeSrv = () => new Promise(r => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(() => r()); });
  t.after(closeSrv); atEnd.push(closeSrv);
  const base = `http://127.0.0.1:${srv.address().port}/experiments`;
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const SHELL = headlessShell(pw.chromium.executablePath());
  const browser = await pw.chromium.launch({ headless: true, env, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(SHELL ? { executablePath: SHELL } : {}) });
  t.after(() => browser.close().catch(() => {})); atEnd.push(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });   // one context: the channel reaches both pages
  const errors = [];
  const pub = await context.newPage(), scene = await context.newPage();
  for (const [p, tag] of [[pub, 'publisher'], [scene, 'scene']]) p.on('pageerror', e => errors.push(`${tag}: ${String(e && e.message || e)}`));
  await pub.goto(`${base}/clock-publish.html?bpm=128`, { timeout: 20e3 });
  await pub.waitForFunction(() => window.__qa && window.__qa.publisher && window.__qa.publisher.state().sent > 5, null, { timeout: 15e3 });
  await scene.goto(`${base}/13-flow-lab.html?clock=shared`, { timeout: 30e3 });
  await scene.click('#play', { timeout: 5000 });
  await scene.waitForTimeout(15e3);
  const got = await scene.evaluate(() => {
    const qa = window.__qa || {}, ai = qa.audioIn || {};
    return { shared: qa.sharedClock, late: qa.clockLate, badge: (document.getElementById('clockSharedBadge') || {}).textContent || null,
      beat: Array.isArray(qa.beatLog) ? { log: qa.beatLog.map(e => ({ time: e.time, lane: e.lane, now: e.now, dt: e.dt })),
        hits: (qa.events || []).filter(e => e && e.type === 'hit').map(h => ({ time: h.time, lane: h.lane })),
        lanes: Array.isArray(qa.beatLanes) ? qa.beatLanes : null, now: Number.isFinite(ai.now) ? ai.now : null } : null };
  });
  const pubState = await pub.evaluate(() => window.__qa.publisher.state());
  const bm = got.beat ? beatMatch(got.beat) : null;
  const summary = { shared: got.shared && { state: got.shared.state, msgs: got.shared.msgs, lastErrMs: got.shared.lastErrMs, bpm: got.shared.bpm, lost: got.shared.lost },
    badge: got.badge, clockLate: got.late, publisher: pubState, beatMatch: bm, errors: errors.length };
  t.diagnostic(`corpus: report: shared smoke ${JSON.stringify(summary).slice(0, 700)}`);
  assert.deepEqual(errors, [], 'no page errors');
  assert.ok(got.shared, '__qa.sharedClock on the scene');
  assert.equal(got.shared.state, 'locked', `the scene is locked to the publisher: ${JSON.stringify(got.shared)}`);
  assert.ok(got.shared.msgs >= 100, `messages received: ${got.shared.msgs}`);
  assert.ok(Math.abs(got.shared.lastErrMs) < 10, `last error ${got.shared.lastErrMs} ms (audio clocks tick in 128-frame quanta on both pages)`);
  assert.equal(got.shared.bpm, 128);
  assert.equal(got.badge, 'shared', 'the badge');
  assert.ok(bm && bm.pass, `beat match under ?clock=shared: ${JSON.stringify(bm)}`);
  assert.ok(got.late && got.late.late === 0, `clockLate: ${JSON.stringify(got.late)}`);
});
