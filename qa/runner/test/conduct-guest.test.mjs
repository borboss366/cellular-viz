// Guest mode on the conductor (docs/SATURDAY_BRIEF.md box task 1): clock-conductor.html?clock=line&in=<label> with no
// playlist and no track loaded. Box only (Playwright from the runner settings' QA_HOME, as conduct-smoke; skipped
// anywhere else). The box has no real input, so getUserMedia and enumerateDevices are faked in the page before its
// scripts run: three devices, and the audio input whose label holds ?in= plays a 120 BPM click from its own
// AudioContext. The four checks:
//   1. the line-in clock opens the input that matches the label (Clock.pickInput, exact deviceId) and locks;
//   2. the shared clock is published (clock and jump messages on the 'cellular-viz-clock' channel);
//   3. every hand fix and hold act with no track: tap x4, x2 and its release, nudge, flip, set 1, reset, hold on and
//      off, restart; "Corrections now" shows the clock time (no "--:--");
//   4. the log the server keeps parses as schema v1 with those fixes, the hold presses and the clock's beats.
//   node --test qa/runner/test/conduct-guest.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import * as S from '../../conduct-serve.mjs';
import { parseLog } from '../../conduct-score.mjs';
import { heavyLock, SMOKE_TIMEOUT_MS } from './fixtures/heavy-lock.mjs';

/** QA_HOME from the runner settings (the box), else null (as conduct-smoke) */
function qaHome() {
  const files = [process.env.RUNNER_ENV, path.join(os.homedir(), '.config/cellular-viz-runner.env'), path.join(os.homedir(), '.cache/cellular-viz-runner/runner.env')].filter(Boolean);
  const file = files.find(f => fs.existsSync(f));
  if (!file) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').filter(l => /^QA_HOME=/.test(l)).pop();
  return line ? line.slice('QA_HOME='.length).trim().replace(/^(['"])(.*)\1$/, '$2') : null;
}
/** chrome-headless-shell beside Playwright's other browsers, newest first (as conduct-smoke) */
function headlessShell(fullExe) {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.dirname(path.dirname(path.dirname(fullExe || ''))), path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const r of roots) {
    let ds = [];
    try { ds = fs.readdirSync(r).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse(); } catch { continue; }
    for (const d of ds) { const p = path.join(r, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  }
  return null;
}

// runs in the page before its own scripts: the fake devices, getUserMedia (the click stream, the constraints kept),
// and a listener on the shared clock's channel
function fakeInputs() {
  const devices = [
    { kind: 'audioinput', deviceId: 'mic', groupId: 'g1', label: 'MacBook Pro Microphone' },
    { kind: 'audioinput', deviceId: 'guest-usb', groupId: 'g2', label: 'USB Audio CODEC (guest)' },
    { kind: 'audiooutput', deviceId: 'spk', groupId: 'g1', label: 'MacBook Pro Speakers' },
  ];
  const guest = { asked: [], clock: 0, jump: 0, kinds: [] };
  window.__guest = guest;
  function clickStream() {
    const ac = new AudioContext(), sr = ac.sampleRate, P = 0.5, buf = ac.createBuffer(1, Math.round(4 * P * sr), sr), d = buf.getChannelData(0);
    for (let k = 0; k < 4; k++) {
      const s0 = Math.round(k * P * sr), a = k === 0 ? 0.9 : 0.6, f = k === 0 ? 1500 : 1000;
      for (let i = 0; i < 0.03 * sr; i++) d[s0 + i] = a * Math.exp(-i / (0.004 * sr)) * Math.sin(2 * Math.PI * f * i / sr);
    }
    const s = ac.createBufferSource(); s.buffer = buf; s.loop = true;
    const dst = ac.createMediaStreamDestination(); s.connect(dst); s.start(); ac.resume();
    guest.ctx = ac;
    return dst.stream;
  }
  let md = navigator.mediaDevices;
  if (!md) { md = {}; Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: md }); }
  md.enumerateDevices = async () => devices.map(x => ({ ...x }));
  md.getUserMedia = async c => { guest.asked.push(JSON.parse(JSON.stringify(c))); return clickStream(); };
  const bc = new BroadcastChannel('cellular-viz-clock');
  bc.onmessage = e => { const m = e.data || {}; if (m.type === 'clock') guest.clock++; if (m.type === 'jump') { guest.jump++; guest.kinds.push(m.kind); } };
}

test('guest mode: ?clock=line&in=<label>, no playlist, no track: the matching input, the shared clock, every fix and hold, the log (box only)', { timeout: SMOKE_TIMEOUT_MS + 120e3 }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const releaseHeavy = await heavyLock('conduct-guest', { signal: t.signal });
  if (t.signal.aborted) { releaseHeavy(); return; }   // never launch Chromium after the test has ended
  t.after(releaseHeavy);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-guest-')), tracks = path.join(root, 'tracks'), sessions = path.join(root, 'sessions');
  fs.mkdirSync(tracks);   // an empty tracks folder: no playlist
  const srv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: sessions }));
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const ARGS = ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const SHELL = headlessShell(pw.chromium.executablePath());
  let browser = null;
  const errors = [];
  try {
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    browser = await pw.chromium.launch({ headless: true, args: ARGS, env, ...(SHELL ? { executablePath: SHELL } : {}) });
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.addInitScript(fakeInputs);
    await page.goto(`${base}/experiments/clock-conductor.html?clock=line&in=${encodeURIComponent('usb audio')}`, { timeout: 30e3 });
    await page.waitForFunction(() => window.__qa && window.__qa.conductor, null, { timeout: 15e3 });
    const id = await page.evaluate(async () => { const c = window.__qa.conductor; await c.start(); return c.log.id; });

    // 1. the input that matches the label, and the clock locks on its clicks
    await page.waitForFunction(() => { const s = window.__qa.conductor.clock.trackerState; return s && s.state === 'locked'; }, null, { timeout: 40e3 });
    const opened = await page.evaluate(() => ({ device: window.__qa.conductor.clock.trackerState.device, asked: window.__guest.asked,
      tracks: window.__qa.conductor.tracks.length, input: document.getElementById('input').textContent }));
    t.diagnostic(`corpus: report: guest mode input ${JSON.stringify(opened).slice(0, 400)}`);
    assert.equal(opened.tracks, 0, 'no playlist');
    assert.equal(opened.input, 'line');
    assert.deepEqual(opened.device, { wanted: 'usb audio', label: 'USB Audio CODEC (guest)', deviceId: 'guest-usb', matched: true });
    assert.ok(opened.asked.length >= 1);
    assert.deepEqual(opened.asked[opened.asked.length - 1].audio.deviceId, { exact: 'guest-usb' }, 'getUserMedia by the matching deviceId');

    // 3. every hand fix and hold, with no track
    const fixes = await page.evaluate(async () => {
      const k = window.__qa.conductor.clock, wait = ms => new Promise(r => setTimeout(r, ms));
      const fx = (kind, arg) => { const j = k.fix(kind, arg, { origin: 'qa' }); return j ? { type: j.type, kind: j.kind, rejected: j.rejected || null, tapBpm: j.tapBpm || null, on: j.on } : null; };
      const retry = async (kind, arg) => { for (let i = 0; i < 6; i++) { const r = fx(kind, arg); if (r) return r; await wait(600); } return null; };
      const out = { taps: [] };
      for (let i = 0; i < 4; i++) { out.taps.push(fx('tap')); await wait(500); }
      out.x2 = fx('x2'); await wait(300);
      out.x2again = fx('x2'); await wait(2500);   // the release lands at the next bar line
      out.nudge = fx('nudge', 10);
      out.flip = await retry('flip'); await wait(2500);   // a flip lands at the next bar line
      out.setOne = fx('setOne');
      out.reset = fx('reset');
      out.holdOn = fx('hold'); await wait(300);
      out.heldOn = !!(k.trackerState.held && k.trackerState.held.on);
      out.holdOff = fx('hold'); await wait(300);
      out.heldOff = !!(k.trackerState.held && k.trackerState.held.on);
      await wait(600);
      out.panel = document.getElementById('corrections').textContent;
      out.restart = fx('restart');
      await wait(2500);   // two log flushes
      out.msgs = { clock: window.__guest.clock, jump: window.__guest.jump, kinds: window.__guest.kinds };
      return out;
    });
    t.diagnostic(`corpus: report: guest mode fixes ${JSON.stringify({ ...fixes, panel: undefined }).slice(0, 600)}`);
    assert.ok(fixes.taps.every(x => x && !x.rejected && x.kind === 'tap'), `4 taps act: ${JSON.stringify(fixes.taps)}`);
    assert.ok(fixes.taps[3].tapBpm > 110 && fixes.taps[3].tapBpm < 130, `the 4th tap sets the tempo: ${fixes.taps[3].tapBpm}`);
    assert.equal(fixes.x2 && fixes.x2.kind, 'x2');
    assert.equal(fixes.x2again && fixes.x2again.type, 'release-scheduled', 'x2 again books the release');
    assert.equal(fixes.nudge && fixes.nudge.kind, 'nudge');
    assert.equal(fixes.flip && fixes.flip.type, 'flip-scheduled');
    assert.equal(fixes.setOne && fixes.setOne.kind, 'setOne');
    assert.equal(fixes.reset && fixes.reset.kind, 'reset');
    assert.ok(fixes.holdOn && fixes.holdOn.on === true && fixes.heldOn, 'hold on');
    assert.ok(fixes.holdOff && fixes.holdOff.on === false && !fixes.heldOff, 'hold off');
    assert.equal(fixes.restart && fixes.restart.type, 'restart');
    assert.ok(!/--:--/.test(fixes.panel) && /tracker took over/.test(fixes.panel), `Corrections now shows the clock time: ${fixes.panel.split('\n')[0]}`);

    // 2. the shared clock went out, with the fixes as jump events
    assert.ok(fixes.msgs.clock >= 20, `clock messages on the shared channel: ${fixes.msgs.clock}`);
    for (const kind of ['tap', 'x2', 'nudge', 'flip', 'setOne', 'reset']) assert.ok(fixes.msgs.kinds.includes(kind), `jump ${kind} published (${fixes.msgs.kinds.join(',')})`);

    // 4. the log
    const recs = parseLog(fs.readFileSync(path.join(sessions, `${id}.jsonl`), 'utf8'));
    const n = (type, f = () => true) => recs.filter(r => r.type === type && f(r)).length;
    const fixKinds = recs.filter(r => r.type === 'fix').map(r => r.kind);
    t.diagnostic(`corpus: report: guest mode log ${recs.length} records, fixes ${fixKinds.join(',')}, clock beats ${n('beat', r => r.src === 'clock')}`);
    assert.equal(n('session'), 1);
    assert.equal(n('track'), 0, 'no track records: nothing was loaded');
    for (const k of ['tap', 'x2', 'nudge', 'flip', 'set1', 'reset', 'restart']) assert.ok(fixKinds.includes(k), `fix ${k} logged (${fixKinds.join(',')})`);
    assert.equal(fixKinds.filter(k => k === 'tap').length, 4);
    assert.ok(recs.some(r => r.type === 'fix' && r.kind === 'x2' && r.release === true), 'the x2 release is marked');
    assert.equal(n('holdPress', r => r.kind === 'hold'), 2, 'hold on and off logged as holdPress');
    assert.ok(n('beat', r => r.src === 'clock') >= 8, `the clock's beats: ${n('beat', r => r.src === 'clock')}`);
    assert.ok(n('state', r => r.to === 'locked') >= 1, 'the lock is logged');
    assert.deepEqual(errors, [], 'no page errors');
  } finally {
    if (browser) await browser.close().catch(() => {});
    if (srv.closeAllConnections) srv.closeAllConnections();
    await new Promise(r => srv.close(() => r()));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
