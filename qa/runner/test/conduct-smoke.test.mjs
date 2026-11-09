// The conductor page's headless smoke run (#188 Task 1): on the box only (Playwright from the runner settings' QA_HOME,
// as qa/mix-make.sh finds it; skipped anywhere else). conduct-serve on a temp folder with a synthetic 120 BPM click
// track and its grid, the page in Chromium: start, load, play ~10 s, M (kickIn), M (bar1) then ], Shift+S on the bar
// lamp; the log the server kept must parse as schema v1 and hold the records the scorer needs.
//
// Diagnosis (test-pr 8b5a27d): the browser PROCESS dies with SIGTRAP (a Chromium CHECK) ~310 ms after loading the page
// without its module, after clock.js arrives; about:blank, a static page, page 01, AudioContext, clock.js +
// clock-tracker.js alone and the module imports alone all load. So Chromium is spawned here directly (the same binary
// Playwright uses, its args plus --enable-logging=stderr --v=0) and driven over CDP, so its stderr ("Check failed: …")
// and exit code/signal go to the log file; the page's markup is bisected further; and the two dying steps run once
// more on chrome-headless-shell (what exp-run uses). Output: one compact line per step, the CHECK lines, the log path.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
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
/** chrome-headless-shell (what exp-run's launch uses) beside Playwright's other browsers, newest first */
function headlessShell(fullExe) {
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.dirname(path.dirname(path.dirname(fullExe || ''))), path.join(os.homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const r of roots) {
    let ds = [];
    try { ds = fs.readdirSync(r).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse(); } catch { continue; }
    for (const d of ds) { const p = path.join(r, d, 'chrome-headless-shell-linux64', 'chrome-headless-shell'); if (fs.existsSync(p)) return p; }
  }
  return null;
}
/** a copy of experiments/ (top-level files) and the page's qa modules, plus the bisect's pages */
function bisectRepo(root) {
  const ex = path.join(root, 'experiments'), qa = path.join(root, 'qa');
  fs.mkdirSync(ex, { recursive: true }); fs.mkdirSync(qa, { recursive: true });
  for (const f of fs.readdirSync(path.join(REPO, 'experiments'))) {
    const p = path.join(REPO, 'experiments', f);
    if (fs.statSync(p).isFile() && /\.(html|js|mjs|css|json)$/.test(f)) fs.copyFileSync(p, path.join(ex, f));
  }
  for (const f of [...S.BROWSER_MODULES, 'corpus.json']) fs.copyFileSync(path.join(REPO, 'qa', f), path.join(qa, f));
  const page = fs.readFileSync(path.join(ex, 'clock-conductor.html'), 'utf8');
  const nomod = page.replace(/<script type="module">[\s\S]*?<\/script>/, '<script>document.title = "nomodule ok";</script>');
  const head = nomod.slice(0, nomod.indexOf('<body>')), body = nomod.slice(nomod.indexOf('<body>'));
  const sections = body.match(/<section>[\s\S]*?<\/section>/g) || [];
  const withBody = inner => `${head}<body>${inner}<script>document.title = "variant ok";</script></body></html>`;
  const headerEl = (body.match(/<header>[\s\S]*?<\/header>/) || [''])[0];
  const pages = {
    'b-blank.html': '<!doctype html><title>blank ok</title><p>ok</p>',
    'b-audio.html': '<!doctype html><title>audio</title><script>const c = new AudioContext(); document.title = "audio " + c.state + " " + c.sampleRate;</script>',
    'b-scripts.html': '<!doctype html><title>scripts</title><script src="clock.js"></script><script src="clock-tracker.js"></script><script>document.title = "scripts " + typeof Clock + " " + typeof ClockTracker;</script>',
    'b-imports.html': '<!doctype html><title>imports</title><script type="module">import { snapMark } from "../qa/marks.mjs"; import { ConductLog } from "../qa/conduct-log.mjs"; import * as C from "./conductor.mjs"; document.title = "imports " + typeof snapMark + " " + typeof ConductLog + " " + typeof C.pageKey;</script>',
    'b-nomodule.html': nomod,
    'b-m-head.html': withBody('<p>head only</p>'),                                                   // (a) head: meta, style, the two scripts
    'b-m-nocanvas.html': nomod.replace(/<canvas[\s\S]*?<\/canvas>/g, ''),                            // (b)
    'b-m-nostyle.html': nomod.replace(/<style>[\s\S]*?<\/style>/, ''),                               // (c)
    'b-m-nocontrols.html': nomod.replace(/<(select|button|label)[\s\S]*?<\/\1>/g, '').replace(/<input[^>]*>/g, ''),   // (d) no form controls (no media elements on the page)
    'b-m-noscripts.html': nomod.replace(/<script[\s\S]*?<\/script>/g, ''),                           // (e) no scripts at all
    'b-m-half1.html': withBody(headerEl + '<main>' + sections.slice(0, 2).join('') + '</main>'),     // (f) the body in halves
    'b-m-half2.html': withBody('<main>' + sections.slice(2).join('') + '</main>'),
  };
  for (const [f, s] of Object.entries(pages)) fs.writeFileSync(path.join(ex, f), s);
  return root;
}

test('the conductor page in Chromium: plays, tracks, marks and logs schema v1 (box only)', { timeout: 300e3 }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = createRequire(path.join(home, 'qa', 'x.cjs'))('playwright'); } catch (e) { t.skip(`no Playwright under QA_HOME/qa: ${e.message}`); return; }
  // everything verbose goes to a log file that stays on the box; test-pr's output gets compact lines only
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*$/, '').replace('T', '-');
  let logFile = path.join(home, 'qa', 'history', `conduct-smoke-${stamp}.log`);
  try { fs.mkdirSync(path.dirname(logFile), { recursive: true }); fs.writeFileSync(logFile, `conductor smoke ${new Date().toISOString()}\n`); }
  catch { logFile = path.join(os.tmpdir(), `conduct-smoke-${stamp}.log`); fs.writeFileSync(logFile, ''); }
  const toFile = l => { try { fs.appendFileSync(logFile, l + '\n'); } catch { /* best effort */ } };
  console.log(`# conductor smoke log: ${logFile}`);
  const t0 = Date.now(), errors = [], checks = [];
  const note = s => toFile(`[test ${((Date.now() - t0) / 1000).toFixed(2)}s] ${s}`);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-smoke-')), tracks = path.join(root, 'tracks'), sessions = path.join(root, 'sessions');
  fs.mkdirSync(tracks);
  clickTrack(tracks);
  const bRepo = bisectRepo(path.join(root, 'repo'));
  const srv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: sessions }));
  const bSrv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: sessions, repo: bRepo }));
  // exp-run's env (qa-libs) and its CPU-render flags; Playwright's usual headless args; Chromium's own logging on
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const ARGS = ['--autoplay-policy=no-user-gesture-required', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--mute-audio', '--enable-logging=stderr', '--v=0'];
  const FULL = pw.chromium.executablePath(), SHELL = headlessShell(FULL);
  note(`full ${FULL}; shell ${SHELL}; node ${process.versions.node}; libs ${libs.length}`);

  /** spawn Chromium, read its stderr into the log (and the CHECK lines), connect Playwright over CDP */
  async function spawnBrowser(exe, label) {
    const udd = fs.mkdtempSync(path.join(root, 'udd-'));
    const args = [...ARGS, '--remote-debugging-port=0', `--user-data-dir=${udd}`, ...(/headless-shell/.test(exe) ? [] : ['--headless=new']), 'about:blank'];
    const proc = spawn(exe, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const st = { proc, label, exit: null, browser: null };
    let endpoint, buf = '';
    const ready = new Promise((res, rej) => { endpoint = { res, rej }; setTimeout(() => rej(new Error(`${label}: no DevTools endpoint in 15 s`)), 15e3); });
    const onLine = l => {
      toFile(`[${label} err] ${l}`);
      const m = /DevTools listening on (ws:\/\/\S+)/.exec(l);
      if (m) endpoint.res(m[1]);
      if (/Check failed|FATAL|NOTREACHED|CHECK\(/.test(l)) checks.push(`${label}: ${l.replace(/^\[[^\]]*\]\s*/, '')}`.slice(0, 220));
    };
    proc.stderr.on('data', d => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { onLine(buf.slice(0, i)); buf = buf.slice(i + 1); } });
    proc.stdout.on('data', d => toFile(`[${label} out] ${String(d).trim()}`));
    proc.on('exit', (code, signal) => { st.exit = `code=${code} signal=${signal}`; note(`${label} process exit ${st.exit}`); endpoint.rej(new Error(`${label} exited ${st.exit}`)); });
    const ws = await ready;
    st.browser = await pw.chromium.connectOverCDP(ws);
    st.browser.on('disconnected', () => note(`${label} disconnected`));
    return st;
  }
  const kill = async st => { if (!st) return; await st.browser?.close().catch(() => {}); if (st.exit === null) st.proc.kill('SIGKILL'); };
  const watch = (page, tag) => {
    page.on('pageerror', e => { errors.push(String(e && e.message || e)); note(`${tag} pageerror ${e && e.message || e}`); });
    page.on('console', m => note(`${tag} console.${m.type()} ${m.text()}`));
    page.on('crash', () => note(`${tag} crashed`));
    page.on('requestfailed', r => note(`${tag} requestfailed ${r.url().replace(/^https?:\/\/[^/]+/, '')} ${r.failure() && r.failure().errorText}`));
  };

  const lines = [], printed = new Set();   // each distinct CHECK line printed once, at most 6
  let cur = null;
  /** one bisect step on a fresh page; a dead browser is respawned first */
  async function step(name, url, exe = FULL, label = 'chrome') {
    if (!cur || cur.exit !== null || !cur.browser.isConnected() || cur.label !== label) { await kill(cur); cur = await spawnBrowser(exe, label); }
    const s0 = Date.now(), nChecks = checks.length;
    let ok = false, why = '';
    try {
      const ctx = cur.browser.contexts()[0] || await cur.browser.newContext();
      const page = await ctx.newPage();
      watch(page, name);
      await page.goto(url, { waitUntil: 'load', timeout: 20e3 });
      await page.waitForTimeout(1500);
      why = `"${(await page.title()).slice(0, 40)}"`;
      ok = true;
      await page.close();
    } catch (e) { why = String(e && e.message || e).split('\n')[0].slice(0, 70); }
    await new Promise(r => setTimeout(r, 300));   // let an exit land
    const alive = cur.exit === null && cur.browser.isConnected();
    const line = `step ${lines.length + 1}: ${name} [${label}] ${ok && alive ? 'ok' : alive ? 'FAILED' : 'DIED'} (${Date.now() - s0} ms) alive=${alive}${cur.exit ? ` exit ${cur.exit}` : ''} ${why}`;
    lines.push(line); note(line);
    console.log(`# conductor smoke ${line}`);
    for (const c of checks.slice(nChecks)) { const k = c.replace(/\d+/g, '#'); if (printed.size < 6 && !printed.has(k)) { printed.add(k); console.log(`# conductor smoke check: ${c}`); } }
    return ok && alive;
  }

  try {
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    await new Promise(r => bSrv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`, B = `http://127.0.0.1:${bSrv.address().port}/experiments`;
    const plan = [['about:blank', 'about:blank'], ['static', `${B}/b-blank.html`], ['existing 01', `${B}/01-gray-scott.html`], ['AudioContext', `${B}/b-audio.html`],
      ['clock scripts', `${B}/b-scripts.html`], ['module imports', `${B}/b-imports.html`], ['page without module', `${B}/b-nomodule.html`], ['page', `${B}/clock-conductor.html`],
      ['(a) head only', `${B}/b-m-head.html`], ['(b) no canvas', `${B}/b-m-nocanvas.html`], ['(c) no style', `${B}/b-m-nostyle.html`], ['(d) no form controls', `${B}/b-m-nocontrols.html`],
      ['(e) no scripts', `${B}/b-m-noscripts.html`], ['(f1) body half 1', `${B}/b-m-half1.html`], ['(f2) body half 2', `${B}/b-m-half2.html`]];
    for (const [name, url] of plan) await step(name, url);
    if (SHELL) for (const [name, url] of plan.filter(p => p[0] === 'page without module' || p[0] === 'page')) await step(name, url, SHELL, 'shell');
    else console.log('# conductor smoke: no chrome-headless-shell found beside the full chrome');
    const died = lines.filter(l => / DIED /.test(l)).map(l => l.replace(/^step \d+: /, '').replace(/ DIED.*/, ''));
    console.log(`# conductor smoke bisect summary: ${died.length ? `died at ${died.join('; ')}` : 'every step loaded'}${checks.length ? `; ${checks.length} CHECK line(s) in the log` : ''}`);

    // ---- the smoke run on the real page (full chrome, as the user's laptop runs Chrome) ----
    await kill(cur); cur = await spawnBrowser(FULL, 'chrome');
    errors.length = 0;
    const page = await (cur.browser.contexts()[0] || await cur.browser.newContext()).newPage();
    watch(page, 'smoke');
    try { await smoke(page, base); } catch (e) {
      console.log(`# conductor smoke failed: ${String(e && e.message || e).split('\n')[0].slice(0, 200)}${cur.exit ? ` (browser exit ${cur.exit})` : ''}`);
      for (const c of checks.slice(-3)) console.log(`# conductor smoke check: ${c}`);
      console.log(`# conductor smoke log: ${logFile} (full)`);
      throw e;
    }
  } finally {
    await kill(cur);
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
    const summary = { records: recs.length, pending: state.pending, tracker: state.tracker && state.tracker.state,
      clockBeats: n('beat', r => r.src === 'clock'), shadowBeats: n('beat', r => r.src === 'shadow'), samples: n('sample'), pairs: n('pair'),
      marks: recs.filter(r => r.type === 'mark').map(r => `${r.name}@${r.beat}`), barOk, errors: errors.length };
    console.log(`# conductor smoke: ${JSON.stringify(summary).slice(0, 400)}`);
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
