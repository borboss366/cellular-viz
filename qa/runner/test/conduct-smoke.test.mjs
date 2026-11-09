// The conductor page's headless smoke run (#188 Task 1): on the box only (Playwright from the runner settings' QA_HOME,
// as qa/mix-make.sh finds it; skipped anywhere else). conduct-serve on a temp folder with a synthetic 120 BPM click
// track and its grid, the page in Chromium: start, load, play ~10 s, M (kickIn), M (bar1) then ], Shift+S on the bar
// lamp; the log the server kept must parse as schema v1 and hold the records the scorer needs.
//
// Bisect first (test-pr 73a5b61: the browser disconnected 0.09 s into the page's navigation, nothing logged): the same
// launch opens, one page each, about:blank → a 1-line static page → an existing page (01) → new AudioContext() alone →
// clock.js + clock-tracker.js alone → the page's module imports alone → the page without its module → the page. A dead
// browser is relaunched and the walk goes on, so one run says where it dies (the harness if it dies at the blank page,
// the page if only the later steps die). Chromium's own output is captured with DEBUG=pw:browser*,pw:protocol (teed
// from this process's stderr) and printed with the steps on failure.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import * as S from '../../conduct-serve.mjs';
import { wavBytes } from '../audiocheck.mjs';
import { parseLog } from '../../conduct-score.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** QA_HOME from the runner settings (the box), else null */
function qaHome() {
  const files = [process.env.RUNNER_ENV, path.join(os.homedir(), '.config/cellular-viz-runner.env'), path.join(os.homedir(), '.cache/cellular-viz-runner/runner.env')].filter(Boolean);
  const file = files.find(f => fs.existsSync(f));
  if (!file) return null;
  const line = fs.readFileSync(file, 'utf8').split('\n').filter(l => /^QA_HOME=/.test(l)).pop();
  return line ? line.slice('QA_HOME='.length).trim().replace(/^(['"])(.*)\1$/, '$2') : null;
}
/** a 120 BPM click track (accented 1s) and its v2 grid: beats from 0.25 s, pos 1–4 */
function clickTrack(dir, lenS = 24, sr = 48000, bpm = 120) {
  const pcm = new Int16Array(lenS * sr), P = 60 / bpm, beats = [];
  for (let k = 0, t = 0.25; t < lenS - 0.1; k++, t += P) {
    beats.push({ ms: Math.round(t * 1000), pos: (k % 4) + 1, conf: 1 });
    const a = k % 4 === 0 ? 0.9 : 0.6, s0 = Math.round(t * sr);
    for (let i = 0; i < 0.03 * sr; i++) pcm[s0 + i] = Math.round(32767 * a * Math.exp(-i / (0.004 * sr)) * Math.sin(2 * Math.PI * (k % 4 === 0 ? 1500 : 1000) * i / sr));
  }
  fs.writeFileSync(path.join(dir, 'click-120.wav'), wavBytes(pcm, sr, 1));
  fs.writeFileSync(path.join(dir, 'click-120.beatgrid.json'), JSON.stringify({ version: 2, beats, barOk: false }));
}
/** a copy of the repo's experiments/ (top-level files) and the page's qa modules, plus the bisect's own pages */
function bisectRepo(root) {
  const ex = path.join(root, 'experiments'), qa = path.join(root, 'qa');
  fs.mkdirSync(ex, { recursive: true }); fs.mkdirSync(qa, { recursive: true });
  for (const f of fs.readdirSync(path.join(REPO, 'experiments'))) {
    const p = path.join(REPO, 'experiments', f);
    if (fs.statSync(p).isFile() && /\.(html|js|mjs|css|json)$/.test(f)) fs.copyFileSync(p, path.join(ex, f));
  }
  for (const f of [...S.BROWSER_MODULES, 'corpus.json']) fs.copyFileSync(path.join(REPO, 'qa', f), path.join(qa, f));
  const page = fs.readFileSync(path.join(ex, 'clock-conductor.html'), 'utf8');
  const pages = {
    'b-blank.html': '<!doctype html><title>blank ok</title><p>ok</p>',
    'b-audio.html': '<!doctype html><title>audio</title><script>const c = new AudioContext(); document.title = "audio " + c.state + " " + c.sampleRate;</script>',
    'b-scripts.html': '<!doctype html><title>scripts</title><script src="clock.js"></script><script src="clock-tracker.js"></script><script>document.title = "scripts " + typeof Clock + " " + typeof ClockTracker;</script>',
    'b-imports.html': '<!doctype html><title>imports</title><script type="module">import { snapMark } from "../qa/marks.mjs"; import { ConductLog } from "../qa/conduct-log.mjs"; import * as C from "./conductor.mjs"; document.title = "imports " + typeof snapMark + " " + typeof ConductLog + " " + typeof C.pageKey;</script>',
    'b-nomodule.html': page.replace(/<script type="module">[\s\S]*?<\/script>/, '<script>document.title = "nomodule ok";</script>'),
  };
  for (const [f, s] of Object.entries(pages)) fs.writeFileSync(path.join(ex, f), s);
  return root;
}

test('the conductor page in Chromium: plays, tracks, marks and logs schema v1 (box only)', { timeout: 240e3 }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  // Playwright's own debug output (pw:browser*: the launch line, Chromium's stderr, its exit; pw:protocol) goes to a log
  // file that stays on the box ($QA_HOME/qa/history/conduct-smoke-<stamp>.log), never to test-pr's output: test-pr
  // keeps only a few grepped lines (64a536c: the flood ran past 50 KB and hid everything). The test prints the path,
  // compact step lines and, on failure, the last 20 pw:browser lines.
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  const logDir = path.join(home, 'qa', 'history');
  let logFile = path.join(logDir, `conduct-smoke-${stamp}.log`);
  try { fs.mkdirSync(logDir, { recursive: true }); fs.writeFileSync(logFile, `conductor smoke ${new Date().toISOString()}\n`); }
  catch { logFile = path.join(os.tmpdir(), `conduct-smoke-${stamp}.log`); fs.writeFileSync(logFile, ''); }
  const toFile = l => { try { fs.appendFileSync(logFile, l + '\n'); } catch { /* the log is best effort */ } };
  const browserLines = [];
  process.env.DEBUG = [process.env.DEBUG, 'pw:browser*', 'pw:protocol'].filter(Boolean).join(',');
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, ...rest) => {
    const s = String(chunk);
    if (!/pw:(browser|protocol)/.test(s)) return write(chunk, ...rest);
    for (const l of s.split('\n')) {
      const c = l.replace(/\x1b\[[0-9;]*m/g, '');
      if (!c.trim()) continue;
      toFile(c);
      if (/pw:browser/.test(c)) { browserLines.push(c.slice(0, 150)); if (browserLines.length > 20) browserLines.shift(); }
    }
    const cb = rest.find(x => typeof x === 'function');
    if (cb) cb();
    return true;
  };
  console.log(`# conductor smoke log: ${logFile}`);
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { process.stderr.write = write; t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-smoke-')), tracks = path.join(root, 'tracks'), sessions = path.join(root, 'sessions');
  fs.mkdirSync(tracks);
  clickTrack(tracks);
  const bRepo = bisectRepo(path.join(root, 'repo'));
  const srv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: sessions }));
  const bSrv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: sessions, repo: bRepo }));
  // the launch exp-run uses for a CPU-rendered page (kind "render": SwiftShader) and its env (qa-libs)
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const ARGS = ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
  const t0 = Date.now(), diag = [], errors = [];
  const note = s => { const l = `${((Date.now() - t0) / 1000).toFixed(2)}s ${s}`.slice(0, 400); diag.push(l); toFile(`[test] ${l}`); if (diag.length > 150) diag.shift(); };
  // launchServer + connect so the browser's own process is in hand: its exit code and signal say how it died
  let lastExit = null;
  const launch = async () => {
    const server = await pw.chromium.launchServer({ args: ARGS, env });
    const proc = server.process();
    proc.on('exit', (code, signal) => { lastExit = `code=${code} signal=${signal}`; note(`browser process exit ${lastExit}`); });
    const b = await pw.chromium.connect(server.wsEndpoint());
    b.on('disconnected', () => note('browser disconnected'));
    b._server = server;
    return b;
  };
  const closeBrowser = async b => { if (!b) return; await b.close().catch(() => {}); await b._server.close().catch(() => {}); };
  const watch = (page, tag) => {
    page.on('pageerror', e => { errors.push(String(e && e.message || e)); note(`${tag} pageerror ${e && e.message || e}`); });
    page.on('console', m => note(`${tag} console.${m.type()} ${m.text()}`));
    page.on('crash', () => note(`${tag} crashed`));
    page.on('close', () => note(`${tag} closed`));
    page.on('requestfailed', r => note(`${tag} requestfailed ${r.url().replace(/^https?:\/\/[^/]+/, '')} ${r.failure() && r.failure().errorText}`));
    page.on('response', r => { if (r.status() >= 400) note(`${tag} HTTP ${r.status()} ${r.url().replace(/^https?:\/\/[^/]+/, '')}`); });
  };
  const env0 = { node: process.versions.node, playwright: (() => { try { return createRequire(path.join(home, 'qa', 'x.cjs'))('playwright/package.json').version; } catch { return '?'; } })(),
    executable: (() => { try { return pw.chromium.executablePath(); } catch (e) { return `? ${e.message}`; } })(),
    XDG_RUNTIME_DIR: !!process.env.XDG_RUNTIME_DIR, PULSE_SERVER: !!process.env.PULSE_SERVER, DISPLAY: !!process.env.DISPLAY,
    shmFreeMB: (() => { try { const s = fs.statfsSync('/dev/shm'); return Math.round(s.bavail * s.bsize / 1048576); } catch { return null; } })(), libs: libs.length };
  const bisect = [];
  let browser = null;
  const dump = why => {
    console.log(`# conductor smoke failed: ${why.slice(0, 200)}`);
    console.log(`# conductor smoke env: ${JSON.stringify(env0).slice(0, 400)}`);
    for (const l of diag.filter(l => / (pageerror|crashed|closed|disconnected|exit|requestfailed|HTTP )/.test(l)).slice(-12)) console.log(`# conductor smoke event: ${l.slice(0, 200)}`);
    for (const l of browserLines.slice(-20)) console.log(`# conductor smoke pw:browser: ${l}`);
    console.log(`# conductor smoke log: ${logFile} (full)`);
  };
  try {
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    await new Promise(r => bSrv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`, bBase = `http://127.0.0.1:${bSrv.address().port}`;
    note(`servers ${base} ${bBase}; env ${JSON.stringify(env0)}`);

    // ---- the bisect: one page per step, the browser relaunched after a death ----
    for (const [step, url] of [['about:blank', 'about:blank'], ['static', `${bBase}/experiments/b-blank.html`], ['existing 01', `${bBase}/experiments/01-gray-scott.html`],
      ['AudioContext', `${bBase}/experiments/b-audio.html`], ['clock scripts', `${bBase}/experiments/b-scripts.html`], ['module imports', `${bBase}/experiments/b-imports.html`],
      ['page without module', `${bBase}/experiments/b-nomodule.html`], ['page', `${bBase}/experiments/clock-conductor.html`]]) {
      if (!browser || !browser.isConnected()) { await closeBrowser(browser); browser = await launch(); }
      const s0 = Date.now();
      lastExit = null;
      let ok = false, why = '';
      try {
        const page = await browser.newPage();
        watch(page, step);
        await page.goto(url, { waitUntil: 'load', timeout: 20e3 });
        await page.waitForTimeout(1500);
        why = `"${(await page.title()).slice(0, 40)}"`;
        ok = true;
        await page.close();
      } catch (e) { why = String(e && e.message || e).split('\n')[0].slice(0, 80); }
      await new Promise(r => setTimeout(r, 200));   // let an exit event land
      const alive = browser.isConnected();
      const line = `step ${bisect.length + 1}: ${step} ${ok && alive ? 'ok' : alive ? 'FAILED' : 'DIED'} (${Date.now() - s0} ms) alive=${alive}${lastExit ? ` exit ${lastExit}` : ''} ${why}`;
      bisect.push(line);
      note(line);
      console.log(`# conductor smoke ${line}`);
    }
    const died = bisect.filter(b => / DIED /.test(b)).map(b => b.replace(/^step \d+: /, '').replace(/ DIED.*/, ''));
    console.log(`# conductor smoke bisect summary: ${died.length ? `browser died at ${died.join(', ')}` : 'every step loaded'}`);

    // ---- the smoke run on the real page ----
    if (!browser || !browser.isConnected()) { await closeBrowser(browser); browser = await launch(); }
    errors.length = 0;   // the bisect's pages don't count against the page under test
    const page = await browser.newPage();
    watch(page, 'smoke');
    try { await smoke(page, base); } catch (e) { dump(String(e && e.message || e).split('\n')[0]); throw e; }
  } finally {
    process.stderr.write = write;
    await closeBrowser(browser);
    for (const s of [srv, bSrv]) { if (s.closeAllConnections) s.closeAllConnections(); await new Promise(r => s.close(() => r())); }
    fs.rmSync(root, { recursive: true, force: true });
  }

  async function smoke(page, base) {
    const url = `${base}/experiments/clock-conductor.html`;
    note(`smoke goto ${url}`);
    await page.goto(url, { timeout: 30e3 });
    await page.waitForFunction(() => window.__qa && window.__qa.conductor && window.__qa.conductor.tracks.length > 0, null, { timeout: 15e3 });
    const id = await page.evaluate(async () => {
      const c = window.__qa.conductor;
      await c.start();
      await c.load(0);
      c.play();
      return c.log.id;
    });
    await page.waitForTimeout(10e3);
    await page.evaluate(() => { const c = window.__qa.conductor; c.mark('kickIn'); c.mark('bar1'); });
    await page.keyboard.press('BracketRight');
    const barOk = await page.evaluate(async () => {
      const c = window.__qa.conductor;
      for (let i = 0; i < 150; i++) {
        c.barOk();
        if (c.log.all.some(r => r.type === 'mark' && r.name === 'barOk')) return true;
        await new Promise(r => setTimeout(r, 20));
      }
      return false;
    });
    await page.waitForTimeout(2500);   // two log flushes
    const state = await page.evaluate(() => window.__qa.conductor.state());
    const recs = parseLog(fs.readFileSync(path.join(sessions, `${id}.jsonl`), 'utf8'));
    const n = (type, f = () => true) => recs.filter(r => r.type === type && f(r)).length;
    const summary = { records: recs.length, pending: state.pending, tracker: state.tracker && state.tracker.state, shadow: state.shadow,
      clockBeats: n('beat', r => r.src === 'clock'), shadowBeats: n('beat', r => r.src === 'shadow'), samples: n('sample'), pairs: n('pair'),
      marks: recs.filter(r => r.type === 'mark').map(r => `${r.name}@${r.beat}`), barOk, errors };
    console.log(`# conductor smoke: ${JSON.stringify(summary)}`);
    assert.deepEqual(errors, [], 'no page errors');
    assert.equal(n('session'), 1);
    assert.ok(n('latency') >= 1, 'latency logged (R2)');
    assert.ok(n('track', r => r.event === 'load') === 1 && n('track', r => r.event === 'play') === 1, 'load + play');
    assert.ok(summary.pairs >= 2, `5 s pairs: ${summary.pairs}`);
    assert.ok(summary.samples >= 60, `100 ms samples: ${summary.samples}`);
    assert.ok(summary.shadowBeats >= 8, `the shadow tracker beats on the clicks (R3): ${summary.shadowBeats}`);
    assert.ok(summary.clockBeats >= 8, `the clock's output beats (R2): ${summary.clockBeats}`);
    const mk = recs.filter(r => r.type === 'mark');
    assert.ok(mk.some(r => r.name === 'kickIn' && Number.isInteger(r.beat)), 'kickIn snapped to a beat (R13)');
    const bar1 = mk.filter(r => r.name === 'bar1');
    assert.equal(bar1.length, 2, 'bar1, then ] stepped it');
    assert.equal(bar1[1].beat, bar1[0].beat + 1);
    assert.ok(barOk && mk.some(r => r.name === 'barOk'), 'Shift+S on the bar lamp (A7b)');
    assert.ok(mk.filter(r => r.name === 'barOk').every(r => r.beat % 4 === 0), 'barOk lands on a "1" (pos 1 = every 4th beat here)');
    const late = await page.evaluate(() => window.__qa.clockLate);
    assert.ok(late && typeof late.late === 'number', `__qa.clockLate is exposed (check-shared's row): ${JSON.stringify(late)}`);
  }
});
