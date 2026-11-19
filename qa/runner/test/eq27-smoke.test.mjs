// 27 · EQ calibrate in Chromium, box only (Playwright from the runner settings' QA_HOME, as scene-capture-smoke.test.mjs;
// skipped anywhere else). The shared-clock publisher page (clock-publish.html, 128 bpm) and the scene with
// ?clock=shared&capture=1&kick=1 in one browser context: no page error, the clock locks, the flash fires on its beats,
// the panel is hidden on the 1920x1080 stage, and the bars follow stand-in band levels (__qa.fakeBands). The same page
// without capture keeps its panel.
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

test('27 EQ calibrate on the shared clock in Chromium: no errors, locked, flashes on the beat, capture hides the panel, bars follow fake bands (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  const release = await heavyLock('eq27-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'eq27-smoke-'));
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
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  const pub = await context.newPage(), scene = await context.newPage(), plain = await context.newPage();
  for (const [p, tag] of [[pub, 'publisher'], [scene, 'scene'], [plain, 'plain']]) p.on('pageerror', e => errors.push(`${tag}: ${String(e && e.message || e)}`));
  await pub.goto(`${base}/clock-publish.html?bpm=128`, { timeout: 20e3 });
  await scene.goto(`${base}/27-eq-calibrate.html?clock=shared&capture=1&kick=1`, { timeout: 30e3 });
  await scene.waitForTimeout(5000);
  const a = await scene.evaluate(() => ({ eq: window.__qa.eq, errors: window.__qa.errors.slice(), canvas: [document.getElementById('c').width, document.getElementById('c').height],
    panel: getComputedStyle(document.getElementById('panel')).display, capture: !!(window.__capture && window.__capture.on) }));
  // the bars follow stand-in band levels
  await scene.evaluate(() => window.__qa.fakeBands(Array.from({ length: 16 }, (_, i) => (i === 3 ? -6 : -90))));
  await scene.waitForTimeout(600);
  const b = await scene.evaluate(() => window.__qa.eq);
  await scene.screenshot({ path: path.join(root, 'eq27.png') }).catch(() => {});
  await plain.goto(`${base}/27-eq-calibrate.html?clock=shared`, { timeout: 30e3 });
  await plain.waitForTimeout(1500);
  const p = await plain.evaluate(() => ({ panel: getComputedStyle(document.getElementById('panel')).display, eq: window.__qa.eq }));
  t.diagnostic(`corpus: report: eq27 smoke ${JSON.stringify({ a: { ...a, eq: { state: a.eq.state, flashes: a.eq.flashes, bpm: a.eq.bpm, barBeat: a.eq.barBeat, offsetMs: a.eq.offsetMs } }, bars: [b.bars[3], b.bars[10]], plain: p.panel, errors }).slice(0, 900)}`);
  assert.deepEqual(errors, [], 'no page errors');
  assert.deepEqual(a.errors, [], 'no frame errors');
  assert.equal(a.capture, true);
  assert.deepEqual(a.canvas, [1920, 1080], 'the 1920x1080 stage');
  assert.equal(a.panel, 'none', '?capture=1 hides the panel');
  assert.equal(a.eq.state, 'locked', 'the shared clock locked');
  assert.ok(a.eq.flashes >= 4, `the flash fired on the beats (${a.eq.flashes} in 5 s at 128 bpm)`);
  assert.ok(Math.abs(a.eq.bpm - 128) < 0.5, `bpm ${a.eq.bpm}`);
  assert.equal(a.eq.kickOn, true);
  assert.ok(Math.abs(b.bars[3] + 6) < 0.5 && Math.abs(b.bars[10] + 90) < 0.5, `the bars follow the bands: ${b.bars[3]}, ${b.bars[10]}`);
  assert.notEqual(p.panel, 'none', 'without capture the panel shows');
  assert.equal(p.eq.labels, true, 'the readouts are on by default');
});
