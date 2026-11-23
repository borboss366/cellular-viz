// The shared clock through the beat relay in two separate browser processes (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md
// task 2): conduct-serve with its relay (makeServer: the pages get the cookie cvrelay=1, so clock.js loads
// shared-link.js and opens /relay). Browser A: the publisher page (clock-publish.html, a silent metronome at 128 that
// publishes as the conductor does) and scene 13 on ?clock=shared, one context, so A's scene hears the channel AND the
// socket. Browser B: another process with scene 13 on ?clock=shared; the channel does not reach it, only the socket
// does (what a page in OBS's browser gets). Checks: B locks through the relay; a hand jump on the publisher (a nudge
// of half a beat: the metronome has no flip, the shared path is the same) lands once on both scenes at the same
// beat; panic reaches both and its release too; B measured its offset to the publisher once (report only).
// Box only (Playwright from the runner settings' QA_HOME, as clock-shared-smoke.test.mjs; skipped anywhere else).
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
// closed when the file ends, even if the test timed out first (#231)
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
// what a scene page shows of its shared clock, its link, its jumps and its panic mode
const sceneState = () => {
  const qa = window.__qa || {}, sh = qa.sharedClock || null;
  return { shared: sh && { state: sh.state, msgs: sh.msgs, lastErrMs: sh.lastErrMs, bpm: sh.bpm, link: sh.link },
    jumps: (qa.events || []).filter(e => e && e.type === 'jump').map(j => ({ kind: j.kind, origin: j.origin, fromBeats: j.fromBeats, toBeats: j.toBeats })),
    panic: window.__panic ? window.__panic.mode : null };
};

test('the shared clock through the relay in two browser processes: the socket-only scene locks, a jump lands once on both, panic reaches both (box only)', { timeout: SMOKE_TIMEOUT_MS }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  if (!fs.existsSync('/etc/fonts/fonts.conf')) assert.fail('fontconfig missing in the runner container (see #205)');
  const release = await heavyLock('relay-smoke', { signal: t.signal });
  if (t.signal.aborted) { release(); return; }
  t.after(release);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relay-smoke-'));
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
  const browserA = await launch(), browserB = await launch();   // two processes: no BroadcastChannel between them
  for (const b of [browserA, browserB]) { t.after(() => b.close().catch(() => {})); atEnd.push(() => b.close()); }
  const ctxA = await browserA.newContext({ viewport: { width: 960, height: 540 } }), ctxB = await browserB.newContext({ viewport: { width: 960, height: 540 } });
  const errors = [];
  const pub = await ctxA.newPage(), sceneA = await ctxA.newPage(), sceneB = await ctxB.newPage();
  for (const [p, tag] of [[pub, 'publisher'], [sceneA, 'sceneA'], [sceneB, 'sceneB']]) p.on('pageerror', e => errors.push(`${tag}: ${String(e && e.message || e)}`));
  await pub.goto(`${base}/clock-publish.html?bpm=128`, { timeout: 20e3 });
  await pub.waitForFunction(() => window.__qa && window.__qa.publisher && window.__qa.publisher.state().sent > 5 && window.__qa.publisher.publisher.link && window.__qa.publisher.publisher.link.socket === 'open', null, { timeout: 15e3 });
  for (const s of [sceneA, sceneB]) {
    await s.goto(`${base}/13-flow-lab.html?clock=shared`, { timeout: 30e3 });
    await s.click('#play', { timeout: 5000 });
  }
  for (const s of [sceneA, sceneB]) {
    await s.waitForFunction(() => { const sh = window.__qa && window.__qa.sharedClock; return sh && sh.state === 'locked' && sh.link && sh.link.socket === 'open'; }, null, { timeout: 20e3 });
  }
  await sceneB.waitForTimeout(6e3);
  const before = { a: await sceneA.evaluate(sceneState), b: await sceneB.evaluate(sceneState) };
  // a hand jump on the publisher: half a beat back
  await pub.evaluate(() => window.__qa.publisher.clock.fix('nudge', -1000 * 30 / 128, { origin: 'qa' }));
  await sceneB.waitForTimeout(2e3);
  const afterJump = { a: await sceneA.evaluate(sceneState), b: await sceneB.evaluate(sceneState) };
  // panic and its release, from the publisher through Clock.publish (channel and socket)
  await pub.evaluate(() => window.__qa.publisher.publisher.panic('blackout'));
  await sceneB.waitForTimeout(800);
  const black = { a: await sceneA.evaluate(() => window.__panic && window.__panic.mode), b: await sceneB.evaluate(() => window.__panic && window.__panic.mode) };
  await pub.evaluate(() => window.__qa.publisher.publisher.panic('clear'));
  await sceneB.waitForTimeout(800);
  const clear = { a: await sceneA.evaluate(() => window.__panic && window.__panic.mode), b: await sceneB.evaluate(() => window.__panic && window.__panic.mode) };
  const stats = relay.stats();
  const nudges = s => s.jumps.filter(j => j.kind === 'nudge');
  const summary = { b: before.b.shared, aLink: before.a.shared && before.a.shared.link, nudgesA: nudges(afterJump.a), nudgesB: nudges(afterJump.b), black, clear,
    relay: { clients: stats.clients, in: stats.in, out: stats.out, duplicates: stats.duplicates }, errors: errors.length };
  t.diagnostic(`corpus: report: relay smoke ${JSON.stringify(summary).slice(0, 1200)}`);
  const off = before.b.shared && before.b.shared.link && before.b.shared.link.conductorOffset;
  t.diagnostic(`corpus: report: relay offset scene B to the publisher (report only): ${JSON.stringify(off)}`);
  assert.deepEqual(errors, [], 'no page errors');
  // B hears the socket only, and is locked through it
  const lb = before.b.shared.link;
  assert.equal(before.b.shared.state, 'locked', `scene B is locked: ${JSON.stringify(before.b.shared)}`);
  assert.equal(lb.fromChannel, 0, 'nothing reaches B by the channel (another process)');
  assert.ok(lb.fromSocket >= 50, `B's messages came by the socket: ${lb.fromSocket}`);
  assert.ok(Math.abs(before.b.shared.lastErrMs) < 10, `B's last error ${before.b.shared.lastErrMs} ms`);
  assert.equal(before.b.shared.bpm, 128);
  // A hears both, each message once
  const la = before.a.shared.link;
  assert.ok(la.fromChannel > 0 && la.dropped.copy > 0, `A takes the channel's copy and drops the socket's: ${JSON.stringify(la)}`);
  // the jump: once on each, at the same beat
  const na = nudges(afterJump.a), nb = nudges(afterJump.b);
  assert.equal(na.length, 1, `one jump on A: ${JSON.stringify(afterJump.a.jumps)}`);
  assert.equal(nb.length, 1, `one jump on B: ${JSON.stringify(afterJump.b.jumps)}`);
  assert.equal(na[0].origin, 'shared:qa'); assert.equal(nb[0].origin, 'shared:qa');
  assert.ok(Math.abs(na[0].toBeats - nb[0].toBeats) < 1e-6, `to the same beat: ${na[0].toBeats} / ${nb[0].toBeats}`);
  assert.ok(Math.abs(na[0].fromBeats - nb[0].fromBeats) < 0.02, `from the same beat: ${na[0].fromBeats} / ${nb[0].fromBeats}`);
  // panic and its release reach both
  assert.deepEqual(black, { a: 'blackout', b: 'blackout' }, 'the blackout reaches both (B by the socket)');
  assert.deepEqual(clear, { a: 'off', b: 'off' }, 'and its release');
  // the offset to the conductor (here the publisher): measured once on B, report only
  assert.ok(lb.conductorPing === 'done' && off && Number.isFinite(off.ms), `B measured its offset to the publisher: ${lb.conductorPing} ${JSON.stringify(off)}`);
});
