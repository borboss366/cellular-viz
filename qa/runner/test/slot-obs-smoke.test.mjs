// A slot window as an OBS Browser Source (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 5): slot.html?slot=A&obs=1 in a
// browser process of its own, with no microphone permission and no channel to the conductor (what OBS's browser
// gives it), on conduct-serve with the relay (makeServer). The conductor's stand-in is the publisher page
// (clock-publish.html) in another browser process. Checks: the slot's scene URL is the OBS one (audio=shared, no in=,
// relay=1); the scene locks to the publisher through the socket alone and opens no audio input; a slot command, a
// panic and its release from the publisher reach the slot through the relay. Box only (Playwright from the runner
// settings' QA_HOME, as relay-smoke.test.mjs; skipped anywhere else).
//   node --test qa/runner/test/*.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
// the slot page and the scene in its frame
const slotState = () => (window.__qa && window.__qa.slot ? { index: window.__qa.slot.index, url: window.__qa.slot.url, panicMode: window.__qa.slot.panicMode, loads: window.__qa.slot.loads, error: window.__qa.slot.error || null } : null);
const sceneState = () => {
  const qa = window.__qa || {}, sh = qa.sharedClock || null, ai = qa.audioIn || {};
  return { shared: sh && { state: sh.state, link: sh.link }, audio: { source: ai.source, status: ai.status, error: ai.error || null, device: ai.device || null },
    panic: window.__panic ? window.__panic.mode : null };
};

test('slot.html?obs=1 as a Browser Source: the scene on audio=shared locks through the relay alone; slot steps and panic arrive (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const release = await heavyLock('slot-obs-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'slot-obs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tracks')); fs.mkdirSync(path.join(root, 'sessions'));
  const { server: srv, relay } = S.makeServer({ tracksDir: path.join(root, 'tracks'), sessionsDir: path.join(root, 'sessions'), repo: REPO });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const closeSrv = () => new Promise(r => { relay.close(); if (srv.closeAllConnections) srv.closeAllConnections(); srv.close(() => r()); });
  t.after(closeSrv); atEnd.push(closeSrv);
  const base = `http://127.0.0.1:${srv.address().port}/experiments`;
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const SHELL = headlessShell(pw.chromium.executablePath());
  const launch = () => pw.chromium.launch({ headless: true, env, args: ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(SHELL ? { executablePath: SHELL } : {}) });
  const browserA = await launch(), browserB = await launch();
  for (const b of [browserA, browserB]) { t.after(() => b.close().catch(() => {})); atEnd.push(() => b.close()); }
  const pub = await (await browserA.newContext()).newPage();
  const ctxB = await browserB.newContext({ viewport: { width: 1280, height: 720 }, permissions: [] });   // no microphone, like OBS
  const slot = await ctxB.newPage();
  const errors = [];
  for (const [p, tag] of [[pub, 'publisher'], [slot, 'slot']]) p.on('pageerror', e => errors.push(`${tag}: ${String(e && e.message || e)}`));
  await pub.goto(`${base}/clock-publish.html?bpm=128`, { timeout: 20e3 });
  await pub.waitForFunction(() => window.__qa && window.__qa.publisher && window.__qa.publisher.publisher.link && window.__qa.publisher.publisher.link.socket === 'open', null, { timeout: 15e3 });
  await slot.goto(`${base}/slot.html?slot=A&obs=1`, { timeout: 20e3 });
  await slot.waitForFunction(() => window.__qa && window.__qa.slot && window.__qa.slot.loads >= 1, null, { timeout: 20e3 });
  const sceneFrame = () => slot.frames().find(f => /16-hodge-kaleidoscope\.html|\.html\?/.test(f.url()) && f !== slot.mainFrame());
  // the scene: Play (OBS has no key press; capture=1 presses it), then locked through the socket
  await slot.waitForTimeout(1500);
  let fr = sceneFrame();
  assert.ok(fr, 'the scene frame');
  await fr.waitForFunction(() => { const sh = window.__qa && window.__qa.sharedClock; return sh && sh.state === 'locked' && sh.link && sh.link.socket === 'open'; }, null, { timeout: 20e3 });
  await slot.waitForTimeout(3000);
  const first = { slot: await slot.evaluate(slotState), scene: await fr.evaluate(sceneState) };
  // a slot step from the publisher (the controller's upper button 4 on the conductor), through the relay
  await pub.evaluate(() => window.__qa.publisher.publisher.slot('A', 1));
  await slot.waitForFunction(i => window.__qa.slot.index !== i, first.slot.index, { timeout: 10e3 });
  await slot.waitForTimeout(3000);
  const stepped = await slot.evaluate(slotState);
  // panic and its release
  await pub.evaluate(() => window.__qa.publisher.publisher.panic('blackout'));
  await slot.waitForTimeout(1000);
  fr = sceneFrame();
  const black = { slot: (await slot.evaluate(slotState)).panicMode, scene: fr ? (await fr.evaluate(sceneState)).panic : null };
  await pub.evaluate(() => window.__qa.publisher.publisher.panic('clear'));
  await slot.waitForTimeout(1000);
  const clear = { slot: (await slot.evaluate(slotState)).panicMode, scene: fr ? (await fr.evaluate(sceneState)).panic : null };
  t.diagnostic(`corpus: report: slot obs smoke ${JSON.stringify({ first, stepped, black, clear, relay: relay.stats().clients, errors: errors.length }).slice(0, 1400)}`);
  assert.deepEqual(errors, [], 'no page errors');
  const u = first.slot.url;
  assert.match(u, /[?&]audio=shared(&|$)/, u); assert.match(u, /[?&]relay=1(&|$)/, u); assert.doesNotMatch(u, /[?&]in=/, u);
  const sc = first.scene;
  assert.equal(sc.shared.state, 'locked', `the scene is locked: ${JSON.stringify(sc.shared)}`);
  assert.equal(sc.shared.link.fromChannel, 0, 'nothing by the channel (another process, as in OBS)');
  assert.ok(sc.shared.link.fromSocket > 20, `by the socket: ${sc.shared.link.fromSocket}`);
  assert.equal(sc.audio.source, 'shared', 'audio-in on the conductor\'s levels');
  assert.equal(sc.audio.error, null, 'no audio input was opened (or refused)');
  assert.equal(sc.audio.device, null, 'no device picked');
  assert.equal(stepped.index, (first.slot.index + 1) % 7, 'the slot stepped on the publisher\'s command (the relay)');
  assert.ok(stepped.loads >= 2);
  assert.deepEqual(black, { slot: 'blackout', scene: 'blackout' }, 'the blackout reached the slot and its scene');
  assert.deepEqual(clear, { slot: 'off', scene: 'off' }, 'and its release');
});
