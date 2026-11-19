// The slot window in Chromium (19 Nov: two windows for the set). Box only (Playwright from the runner settings'
// QA_HOME, as scene-capture-smoke.test.mjs; skipped anywhere else). The shared-clock publisher page and slot.html?slot=A
// in one browser context; the publisher sends 40 slot commands (Clock.publish slot('A', 1)), one after the other:
//   - every switch loads the next scene of set.json in the slot's single iframe and shows it (no timeout)
//   - each new scene's shared clock is locked within 1 s of its load
//   - no lost WebGL context in a live scene, no "too many WebGL contexts" warning, no page error
//   - one iframe at the end; a command for slot B moves nothing in slot A
// The JS heap before and after is reported (report-only).
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
const SWITCHES = 40, LOCK_MS = 1000, SWITCH_WAIT_MS = 20e3;

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

test('slot.html: 40 switches on the shared channel, each scene locked within 1 s of its load, no lost WebGL context (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const release = await heavyLock('slot-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-smoke-'));
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
  const browser = await pw.chromium.launch({ headless: true, env, args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-precise-memory-info'], ...(SHELL ? { executablePath: SHELL } : {}) });
  t.after(() => browser.close().catch(() => {})); atEnd.push(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const errors = [], glWarnings = [];
  const pub = await context.newPage(), slot = await context.newPage();
  pub.on('pageerror', e => errors.push(`publisher: ${String(e && e.message || e)}`));
  slot.on('pageerror', e => errors.push(`slot: ${String(e && e.message || e)}`));
  // (the old scene's context is lost on purpose before its frame goes, so only the context limit counts here; a live
  // scene's loss is counted by slot.js as __qa.slot.lost)
  slot.on('console', m => { const s = m.text(); if (/too many active webgl contexts/i.test(s)) glWarnings.push(s.slice(0, 160)); });
  await pub.goto(`${base}/clock-publish.html?bpm=128`, { timeout: 20e3 });
  await slot.goto(`${base}/slot.html?slot=A`, { timeout: 30e3 });
  const state = () => slot.evaluate(() => window.__qa && window.__qa.slot);
  const waitShown = async (k) => {
    const t0 = Date.now();
    for (;;) {
      if (t.signal.aborted) throw new Error('aborted');
      const s = await state();
      if (s && s.switches && s.switches.length >= k && !s.loading) return s;
      if (Date.now() - t0 > SWITCH_WAIT_MS) return s;
      await slot.waitForTimeout(50);
    }
  };
  const first = await waitShown(1);
  assert.ok(first && first.switches && first.switches.length === 1, `the first scene loads: ${JSON.stringify(first).slice(0, 300)}`);
  const heap = () => slot.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
  const heap0 = await heap();
  let last = first;
  for (let k = 1; k <= SWITCHES; k++) {
    await pub.evaluate(() => window.__qa.publisher.publisher.slot('A', 1));
    last = await waitShown(k + 1);
    if (!last || last.switches.length < k + 1 || last.loading) break;
  }
  const heap1 = await heap();
  // slot B's command: nothing moves in slot A
  const before = await state();
  await pub.evaluate(() => window.__qa.publisher.publisher.slot('B', 1));
  await slot.waitForTimeout(300);
  const afterB = await state();
  const sw = (last && last.switches) || [];
  const lockMs = sw.filter(s => s.lockedAt !== null && s.loadAt !== null).map(s => Math.round(s.lockedAt - s.loadAt));
  const showMs = sw.filter(s => s.lockedAt !== null).map(s => Math.round(s.lockedAt - s.t0));
  const timeouts = sw.filter(s => s.timeout).map(s => s.name);
  const total = last ? last.switches.length : 0;
  t.diagnostic(`corpus: report: slot smoke ${JSON.stringify({ switches: total, n: last && last.n, lockMaxMs: Math.max(0, ...lockMs), showMaxMs: Math.max(0, ...showMs),
    showMedianMs: showMs.slice().sort((a, b) => a - b)[Math.floor(showMs.length / 2)] || null, timeouts, lost: last && last.lost, frames: last && last.frames,
    heapMB: [heap0, heap1], glWarnings: glWarnings.slice(0, 3), errors: errors.slice(0, 3) })}`);
  assert.deepEqual(errors, [], 'no page errors');
  assert.ok(total >= Math.min(SWITCHES + 1, 64), `all ${SWITCHES} switches done: ${total - 1}`);
  assert.deepEqual(timeouts, [], 'every scene locked (none shown by the 2.5 s timeout)');
  const slow = sw.filter(s => s.lockedAt !== null && s.loadAt !== null && s.lockedAt - s.loadAt > LOCK_MS).map(s => `${s.name} ${Math.round(s.lockedAt - s.loadAt)} ms`);
  assert.deepEqual(slow, [], `each scene locked within ${LOCK_MS} ms of its load`);
  assert.equal(last.lost, 0, 'no lost WebGL context in a live scene');
  assert.deepEqual(glWarnings, [], 'no WebGL context warnings');
  assert.equal(last.frames, 1, 'one iframe at the end');
  assert.equal(last.index, SWITCHES % last.n, 'stepped once per command (wrapping)');
  assert.equal(afterB.index, before.index, 'slot B\'s command moves nothing in slot A');
  assert.equal(afterB.switches.length, before.switches.length);
});
