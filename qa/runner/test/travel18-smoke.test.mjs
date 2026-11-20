// 18 · Little Bang, beamline travel mode in Chromium, box only (Playwright from the runner settings' QA_HOME, as
// nobeat-smoke.test.mjs; skipped anywhere else). ?scene=beamline&capture=1&speedKnob=4 at 640x640 on software rendering,
// with a stand-in knob (__qa.fakeKnob): at 0 the camera stops, at 1 it travels; the plasma ray's envelope rises on the
// kicks and stays under its cap; the target stays in bounds; no page error.
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
const atEnd = [];
after(async () => { for (const f of atEnd.splice(0).reverse()) { try { await f(); } catch {} } });

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(import.meta.url);
const T = require('../../../experiments/18-travel.js');
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

test('18 beamline travel in Chromium: knob 0 stops the camera, knob 1 moves it, the ray rises on kicks under its cap (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  const release = await heavyLock('travel18-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'travel18-smoke-'));
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
  const page = await (await browser.newContext({ viewport: { width: 640, height: 640 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/experiments/18-little-bang.html?scene=beamline&capture=1&speedKnob=4&n=10000`, { timeout: 30e3 });
  // Page time, not wall time: under test-pr load the page can run at 1-2 fps and its dt is capped at 0.1 s a frame, so a
  // fixed 4 s wait can end before the eased stop has had its ~1.5 s of page time (that run saw speed 11.6 still).
  await page.waitForFunction(() => window.__qa && window.__qa.camera && window.__qa.camera.travel === true, null, { timeout: 60e3 });
  await page.evaluate(() => window.__qa.fakeKnob(4, 0));
  await page.waitForFunction(() => window.__qa.camera.speed < 1e-3, null, { timeout: 120e3, polling: 100 });
  const res = await page.evaluate(async () => {
    const q = window.__qa, C = 2 * Math.PI * q.ringR;
    const frames = n => new Promise(r => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
    const cam = () => ({ ...q.camera, target: { ...q.camera.target } });
    const a = cam(); await frames(30); const b = cam();
    q.fakeKnob(4, 1);
    let travelled = 0, prev = cam().s, rays = [], targets = [];
    for (let i = 0; i < 120; i++) {   // 120 frames at knob 1 (2 s at 60 fps): unwrap the camera arclength, sample the ray
      await frames(1);
      const c = cam(); let d = c.s - prev; if (d < -C / 2) d += C; if (d > C / 2) d -= C; travelled += d; prev = c.s;
      rays.push({ ...q.ray }); targets.push(c.target);
    }
    return { a, b, end: cam(), travelled, rays, targets, errors: q.errors.slice() };
  });
  const envs = res.rays.map(r => r.env), still = Math.abs(res.b.s - res.a.s);
  t.diagnostic(`corpus: report: travel18 smoke: stopped moved ${still.toFixed(4)}, travelled ${res.travelled.toFixed(2)} in 120 frames at knob 1 (speed ${res.end.speed}), ray env ${Math.min(...envs).toFixed(3)}..${Math.max(...envs).toFixed(3)}, target ${JSON.stringify(res.end.target)}`);
  await page.screenshot({ path: path.join(root, 'travel.png') }).catch(() => {});
  assert.deepEqual(errors, [], 'no page errors'); assert.deepEqual(res.errors, [], 'no frame errors');
  assert.equal(res.a.travel, true, 'travel mode on'); assert.equal(res.a.knob, 0);
  assert.ok(still < 0.05 && res.a.speed < 1e-3, `knob 0: the camera stands (${still}, speed ${res.a.speed})`);
  assert.equal(res.end.knob, 1);
  assert.ok(res.travelled > 10, `knob 1: the camera travels (${res.travelled})`);
  assert.ok(res.rays.every(r => r.on), 'the ray is on');
  assert.ok(Math.max(...envs) - Math.min(...envs) > 0.1, 'the ray rises on the kicks');
  assert.ok(Math.max(...envs) <= T.C.RAY_CAP + 1e-9, 'never over its cap');
  for (const tg of res.targets) assert.ok(Math.abs(tg.x) <= T.C.TARGET_X + 1e-9 && Math.abs(tg.y) <= T.C.TARGET_Y + 1e-9, 'the target in bounds');
});
