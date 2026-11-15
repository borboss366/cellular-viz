// No-beat mode QA row in Chromium (the apartment MVP, Task 3), box only (Playwright from the runner settings' QA_HOME,
// as clock-shared-smoke.test.mjs; skipped anywhere else). Scene 16b ?capture=1 at 1280x720 on software rendering, the
// three phases of qa/nobeat.mjs at 6 s each (the CLI qa/check-nobeat.mjs runs 30 s each on the 780M): the beat weight
// at 0 / 1 / 0 one bar into each phase, no pop, no NaN, the scene alive, a still per phase. The frame budget is
// report-only here (software WebGL); check-nobeat.mjs gates it on the GPU.
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
const NB = await import('../../nobeat.mjs');

test('no-beat QA row on 16b in Chromium: weight 0 / 1 / 0 by phase, no pop, no NaN, alive, three stills (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const release = await heavyLock('nobeat-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nobeat-smoke-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tracks')); fs.mkdirSync(path.join(root, 'sessions'));
  const srv = http.createServer(S.createHandler({ tracksDir: path.join(root, 'tracks'), sessionsDir: path.join(root, 'sessions'), repo: REPO }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const closeSrv = () => new Promise(r => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(() => r()); });
  t.after(closeSrv); atEnd.push(closeSrv);
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const SHELL = headlessShell(pw.chromium.executablePath());
  const browser = await pw.chromium.launch({ headless: true, env, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(SHELL ? { executablePath: SHELL } : {}) });
  t.after(() => browser.close().catch(() => {})); atEnd.push(() => browser.close());
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/experiments/16-hodge-kaleidoscope.html?capture=1`, { timeout: 30e3 });
  await page.waitForTimeout(3000);
  const stills = path.join(root, 'stills');
  const res = await NB.runNoBeat(page, { phaseSecs: 6, outDir: stills });
  const v = NB.verdict(res, { errors, budget: false });
  for (const l of v.lines) t.diagnostic(`corpus: report: nobeat smoke 16b ${l}`);
  assert.deepEqual(errors, [], 'no page errors');
  for (const p of res.phases) {
    assert.ok(fs.existsSync(p.still) && fs.statSync(p.still).size > 1000, `${p.name}: a still`);
    assert.equal(p.rows.noHelper, 0, `${p.name}: __qa.beatWeight and __qa.energy every frame`);
    assert.equal(p.rows.nan, 0, `${p.name}: no NaN`);
    assert.equal(p.rows.atTarget, true, `${p.name}: weight at ${p.target} one bar in: ${JSON.stringify(p.rows)}`);
    assert.ok(p.rows.maxStep <= p.rows.maxStepAllowed, `${p.name}: no pop: ${JSON.stringify(p.rows)}`);
  }
  assert.equal(v.pass, true, v.lines.join(' | '));
});
