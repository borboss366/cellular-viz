// ?capture=1 and the conductor's panic in Chromium (the apartment MVP, Task 2). Box only (Playwright from the runner
// settings' QA_HOME, as conduct-smoke.test.mjs; skipped anywhere else). Scene 16 (Hodge Kaleidoscope, in set.json)
// with ?clock=shared&capture=1 in a 1000x800 window, and the shared-clock publisher page in the same browser context:
//   - the layout: a 1920x1080 canvas, the stage letterboxed to 1000x562.5 in the window's middle, nothing else
//     visible, no cursor, black page
//   - the page keys still work (B blackout on and off)
//   - a panic sent by Clock.publish(...).panic() on the publisher page reaches the scene (blackout, then clear)
//   - set.html lists set.json's scenes with the right URLs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as S from '../../conduct-serve.mjs';
import { heavyLock } from './fixtures/heavy-lock.mjs';

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

test('?capture=1 layout and the panic over the shared clock channel, in Chromium (box only)', { timeout: 180e3 }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const release = await heavyLock('scene-capture-smoke');
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'capture-smoke-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tracks')); fs.mkdirSync(path.join(root, 'sessions'));
  const srv = http.createServer(S.createHandler({ tracksDir: path.join(root, 'tracks'), sessionsDir: path.join(root, 'sessions'), repo: REPO }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => { if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(() => r()); }));
  const base = `http://127.0.0.1:${srv.address().port}/experiments`;
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const SHELL = headlessShell(pw.chromium.executablePath());
  const browser = await pw.chromium.launch({ headless: true, env, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(SHELL ? { executablePath: SHELL } : {}) });
  t.after(() => browser.close().catch(() => {}));
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const errors = [];
  const pub = await context.newPage(), scene = await context.newPage();
  for (const [p, tag] of [[pub, 'publisher'], [scene, 'scene']]) p.on('pageerror', e => errors.push(`${tag}: ${String(e && e.message || e)}`));
  await pub.goto(`${base}/clock-publish.html?bpm=128`, { timeout: 20e3 });
  await scene.goto(`${base}/16-hodge-kaleidoscope.html?clock=shared&capture=1`, { timeout: 30e3 });
  await scene.waitForTimeout(3000);
  const lay = await scene.evaluate(() => {
    const stage = document.querySelector('.captureStage'), r = stage ? stage.getBoundingClientRect() : null, c = document.getElementById('c');
    const visible = [...document.querySelectorAll('body *')].filter(e => {
      if (e === c || e === stage || e.closest('#panicOverlay')) return false;   // the scene canvas, its stage, the panic overlay
      const cs = getComputedStyle(e), rr = e.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && rr.width > 0 && rr.height > 0;
    }).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : ''));
    return { capture: window.__capture && window.__capture.state ? window.__capture.state() : null, rect: r && { x: r.x, y: r.y, w: r.width, h: r.height },
      canvas: c && [c.width, c.height], visible: visible.slice(0, 20), cursor: getComputedStyle(c || document.body).cursor,
      bg: getComputedStyle(document.body).backgroundColor, badge: !!document.getElementById('clockSharedBadge'), playing: !!(window.__qa && window.__qa.audioIn && window.__qa.audioIn.playing) };
  });
  // the page keys: B blackout on, B off
  await scene.keyboard.press('b');
  const keyOn = await scene.evaluate(() => window.__panic.mode);
  await scene.keyboard.press('b');
  const keyOff = await scene.evaluate(() => window.__panic.mode);
  // the conductor's panic (Clock.publish().panic) from the other page
  await pub.evaluate(() => window.__qa.publisher.publisher.panic('blackout'));
  await scene.waitForTimeout(300);
  const remoteOn = await scene.evaluate(() => ({ mode: window.__panic.mode, received: window.__panic.received }));
  await pub.evaluate(() => window.__qa.publisher.publisher.panic('clear'));
  await scene.waitForTimeout(300);
  const remoteOff = await scene.evaluate(() => ({ mode: window.__panic.mode, received: window.__panic.received }));
  // set.html from set.json
  const setPage = await context.newPage();
  setPage.on('pageerror', e => errors.push(`set: ${String(e && e.message || e)}`));
  await setPage.goto(`${base}/set.html`, { timeout: 20e3 });
  await setPage.waitForFunction(() => window.__qa && window.__qa.set && (window.__qa.set.urls.length || window.__qa.set.errors.length), null, { timeout: 10e3 }).catch(() => {});
  const set = await setPage.evaluate(() => ({ urls: window.__qa.set.urls, errors: window.__qa.set.errors, rows: document.querySelectorAll('#list tr').length }));
  const want = JSON.parse(fs.readFileSync(path.join(REPO, 'experiments', 'set.json'), 'utf8'));
  t.diagnostic(`corpus: report: capture smoke ${JSON.stringify({ lay, keyOn, keyOff, remoteOn, remoteOff, set, errors: errors.length }).slice(0, 900)}`);
  assert.deepEqual(errors, [], 'no page errors');
  assert.ok(lay.capture, '__capture.state()');
  assert.deepEqual(lay.canvas, [1920, 1080], 'a 1920x1080 canvas in a 1000x800 window');
  const near = (a, b) => Math.abs(a - b) <= 1;
  assert.ok(lay.rect && near(lay.rect.x, 0) && near(lay.rect.w, 1000) && near(lay.rect.h, 562.5) && near(lay.rect.y, (800 - 562.5) / 2), `letterboxed: ${JSON.stringify(lay.rect)}`);
  assert.deepEqual(lay.visible, [], 'nothing but the canvases is visible');
  assert.equal(lay.cursor, 'none');
  assert.equal(lay.bg, 'rgb(0, 0, 0)');
  assert.equal(lay.badge, false, 'no shared badge under ?capture=1');
  assert.equal(lay.playing, true, 'Play was pressed by itself');
  assert.deepEqual([keyOn, keyOff], ['blackout', 'off'], 'the page keys still work');
  assert.deepEqual(remoteOn, { mode: 'blackout', received: 1 }, 'the panic reached the scene');
  assert.deepEqual(remoteOff, { mode: 'off', received: 2 });
  assert.deepEqual(set.errors, []);
  assert.equal(set.rows, want.scenes.length);
  assert.deepEqual(set.urls, want.scenes.map(s => `${s.page}?clock=shared&audio=line&in=BlackHole&capture=1`));
});
