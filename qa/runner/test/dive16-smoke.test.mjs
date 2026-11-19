// 16b · the dive, the burst and the glints in Chromium, box only (Playwright from the runner settings' QA_HOME, as
// nobeat-smoke.test.mjs; skipped anywhere else). 16b ?capture=1&diveKnob=2&glint=1 at 640x360 on software rendering,
// with a stand-in knob (__qa.fakeKnob): rest, a 3 s dive, a hold, a fast turn-down. The page's luminance probe reads
// every frame's mean linear luminance right after its draw. Asserts: no page error, exactly one burst, the depth followed
// the knob, and no frame-to-frame brightness change of 10 % or more, scaled to a 60 fps frame (software frames are slow).
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
/** the largest frame-to-frame change of the mean luminance, relative (floor 0.05) and scaled to a 60 fps frame */
export function worstJump(log) {
  let worst = { rel: 0, at: null };
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i], dt = Math.max(1, b.t - a.t);
    const rel = Math.abs(b.l - a.l) / Math.max(a.l, 0.05) * Math.min(1, (1000 / 60) / dt);
    if (rel > worst.rel) worst = { rel, at: i, from: a, to: b };
  }
  return worst;
}

test('16b dive + burst + glints in Chromium: one burst, the depth follows the knob, no brightness jump ≥ 10 % (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  const release = await heavyLock('dive16-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dive16-smoke-'));
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
  const page = await (await browser.newContext({ viewport: { width: 640, height: 360 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e && e.message || e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/experiments/16-hodge-kaleidoscope.html?capture=1&diveKnob=2&glint=1`, { timeout: 30e3 });
  await page.waitForTimeout(3000);
  // rest 1.5 s, a 3 s dive to 1, a 1.5 s hold, down to 0.05 in 0.15 s, then 4 s for the burst to play and settle
  const res = await page.evaluate(async () => {
    const q = window.__qa, wait = ms => new Promise(r => setTimeout(r, ms)), ramp = async (a, b, ms) => {
      const t0 = performance.now(); for (;;) { const k = Math.min(1, (performance.now() - t0) / ms); q.fakeKnob(2, a + (b - a) * k); if (k >= 1) return; await wait(20); }
    };
    q.lumaProbe(true); q.fakeKnob(2, 0);
    await wait(1500); const restN = q.lumaLog.length;
    await ramp(0, 1, 3000); await wait(1500);
    const deep = q.dive.depth;
    await ramp(1, 0.05, 150); await wait(4000);
    return { log: q.lumaLog.slice(), restN, deep, dive: q.dive, frames: q.frame };
  });
  const rest = worstJump(res.log.slice(0, res.restN)), all = worstJump(res.log.slice(res.restN));
  t.diagnostic(`corpus: report: dive16 smoke: ${res.log.length} frames, depth at the hold ${res.deep.toFixed(3)}, bursts ${res.dive.bursts.length} ${JSON.stringify(res.dive.bursts)}, worst jump at rest ${(rest.rel * 100).toFixed(1)} %, in the dive and burst ${(all.rel * 100).toFixed(1)} % (60 fps scaled)`);
  const still = path.join(root, 'after.png'); await page.screenshot({ path: still });
  assert.deepEqual(errors, [], 'no page errors');
  assert.ok(res.log.length > 20, `the probe saw frames (${res.log.length})`);
  assert.equal(res.dive.bursts.length, 1, 'one fast turn-down, one burst');
  assert.ok(res.deep > 0.8, `the depth followed the knob (${res.deep})`);
  assert.ok(res.dive.depth < 0.3, `and back down after (${res.dive.depth})`);
  assert.ok(all.rel < 0.10, `brightness jump ${(all.rel * 100).toFixed(1)} % at frame ${all.at}: ${JSON.stringify({ from: all.from, to: all.to })}`);
  assert.ok(fs.statSync(still).size > 1000, 'a still');
});
