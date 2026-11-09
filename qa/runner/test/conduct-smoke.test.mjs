// The conductor page's headless smoke run (#188 Task 1): on the box only (Playwright from the runner settings' QA_HOME,
// as qa/mix-make.sh finds it; skipped anywhere else). conduct-serve on a temp folder with a synthetic 120 BPM click
// track and its grid, the page in Chromium: start, load, play ~10 s, M (kickIn), M (bar1) then ], Shift+S on the bar
// lamp; the log the server kept must parse as schema v1 and hold the records the scorer needs.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import * as S from '../../conduct-serve.mjs';
import { loadPlaywright } from '../../mix-make.mjs';
import { wavBytes } from '../audiocheck.mjs';
import { parseLog } from '../../conduct-score.mjs';

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

test('the conductor page in Chromium: plays, tracks, marks and logs schema v1 (box only)', { timeout: 120e3 }, async t => {
  const home = qaHome();
  if (!home) { t.skip('no runner settings here (not the box)'); return; }
  let pw;
  try { pw = loadPlaywright({ QA_HOME: home }); } catch (e) { t.skip(`no Playwright: ${e.message}`); return; }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'conduct-smoke-')), tracks = path.join(root, 'tracks'), sessions = path.join(root, 'sessions');
  fs.mkdirSync(tracks);
  clickTrack(tracks);
  const srv = http.createServer(S.createHandler({ tracksDir: tracks, sessionsDir: sessions }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const env = { ...process.env }, libRoot = path.join(os.homedir(), 'qa-libs/root');
  const libs = [path.join(libRoot, 'usr/lib/x86_64-linux-gnu'), path.join(libRoot, 'lib/x86_64-linux-gnu')].filter(p => fs.existsSync(p));
  if (libs.length) env.LD_LIBRARY_PATH = [...libs, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const browser = await pw.chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'], env });
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(String(e && e.message || e)));
    await page.goto(`${base}/`, { timeout: 30e3 });
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
  } finally {
    await browser.close();
    await new Promise(r => srv.close(r));
    fs.rmSync(root, { recursive: true, force: true });
  }
});
