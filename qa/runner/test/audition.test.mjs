// The audition page (docs/CELLULAR_VIZ_BRIEF_SET_RELEASE.md Task 1): qa/audition.mjs's rules on the repo's real pages
// and on fake check results, and conduct-serve's /api/audition routes (the rows, the verdict file in the sessions
// folder). No browser.
//   node --test qa/runner/test/audition.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import * as A from '../../audition.mjs';
import * as S from '../../conduct-serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.join(here, '..', '..', '..'), EXP = path.join(REPO, 'experiments');
const src = f => fs.readFileSync(path.join(EXP, f), 'utf8');

test('audition: a scene page is NN-name.html that loads panic.js; the tool pages are not; the set\'s scenes are', () => {
  const all = fs.readdirSync(EXP).filter(f => f.endsWith('.html'));
  const scenes = all.filter(f => A.isScenePage(f, src(f)));
  assert.ok(scenes.length >= 20, `${scenes.length} scenes`);
  for (const f of ['clock-conductor.html', 'set.html', 'setup-check.html', 'audition.html', 'clock-publish.html', 'clock-truth.html']) assert.ok(!scenes.includes(f), `${f} is not a scene`);
  const set = JSON.parse(src('set.json'));
  for (const s of set.scenes) assert.ok(scenes.includes(s.page), `${s.page} (set.json) is a scene`);
  // every numbered page that obeys the panic key is in the list, and only those
  assert.deepEqual(scenes, all.filter(f => A.SCENE_FILE.test(f) && src(f).includes('<script src="panic.js"></script>')));
  assert.equal(A.isScenePage('16-hodge-kaleidoscope.html', '<p>no panic here</p>'), false);
});

test('audition: no-beat mode and the declared controls come from the page source; none declared is null', () => {
  for (const f of ['06-lenia-effects.html', '12-mass-gap.html', '16-hodge-kaleidoscope.html']) assert.equal(A.hasNoBeat(src(f)), 'yes', f);
  assert.equal(A.hasNoBeat(src('01-gray-scott.html')), 'no');
  const pp = A.parseControls(src('24-paint-pour.html'));
  assert.deepEqual(pp.knobs.map(k => k.n), [1, 2, 3, 4]);
  assert.equal(pp.knobs[0].name, 'bass swirl');
  assert.deepEqual(pp.buttons.map(b => b.n), [1, 2, 3, 4]);
  assert.equal(pp.buttons[0].name, 'big drop');
  const hk = A.parseControls(src('16-hodge-kaleidoscope.html'));
  assert.deepEqual(hk.knobs.map(k => k.name), ['shape rate', 'spin', 'tiles', 'trails']);
  assert.deepEqual(hk.buttons, []);
  assert.equal(A.parseControls(src('01-gray-scott.html')), null);
  assert.equal(A.controlsText(null), 'none declared');
  assert.match(A.controlsText(pp), /^knobs: macro1 bass swirl, .*; buttons: 1 big drop, /);
  assert.equal(A.parseControls(src('15-traveller.html')).knobs.length, 4);
});

test('audition: check.md rows -> beat match and frame time; a missing row is null (shown as unknown)', () => {
  const md = ['# Shared gates (#88) . x', '', '| gate | result | detail |', '|---|---|---|',
    '| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | \u2705 | lanes kick . 40 clock hits |',
    '| GPU p95 <= 7 ms and p99 <= 9 ms (standard at 1440p) | \u274c | p95 8.1 ms |',
    '| 1080p p95 <= 16.8 ms (hard) | \u2705 | 9.2 ms |', '| a | b | c | d |'].join('\n');
  const rows = A.checkRows(md);
  assert.equal(rows.length, 3, 'three-column rows only, no header');
  assert.deepEqual(A.beatMatchOf(rows), { value: 'pass', detail: 'lanes kick . 40 clock hits' });
  assert.equal(A.frameOf(rows, '1080p').value, 'pass');
  assert.equal(A.frameOf(rows, '4K'), null);
  assert.equal(A.beatMatchOf(A.checkRows('| beat match: x | \u2139\ufe0f | not measured (flash-only run) |')).value, 'not measured');
  assert.equal(A.beatMatchOf([]), null);
});

test('audition: scene URL with the set defaults, controller buttons 3 and 4, stepping, verdict file rules, keeps', () => {
  assert.equal(A.sceneUrl('12-mass-gap.html'), '12-mass-gap.html?clock=shared&audio=line&in=BlackHole');
  assert.throws(() => A.sceneUrl('../x.html'));
  assert.equal(A.midiStep([0xB0, 40, 127]), 1);
  assert.equal(A.midiStep([0xB0, 39, 127]), -1);
  assert.equal(A.midiStep([0xB0, 40, 0]), 0, 'the release does nothing');
  for (const cc of [37, 38, 41, 45]) assert.equal(A.midiStep([0xB0, cc, 127]), 0, `CC ${cc} is not ours`);
  assert.equal(A.midiStep([0xB1, 40, 127]), 0);
  assert.deepEqual([A.stepIndex(0, 5, -1), A.stepIndex(4, 5, 1), A.stepIndex(2, 5, 1), A.stepIndex(0, 0, 1)], [4, 0, 3, -1]);
  const good = { version: 1, stamp: 'audition-20261116-181500', verdicts: { '12-mass-gap.html': { verdict: 'keep', note: 'yes' }, '06-lenia-effects.html': { verdict: null } } };
  assert.deepEqual(A.checkVerdicts(good), []);
  assert.match(A.checkVerdicts({ ...good, verdicts: { 'set.html': { verdict: 'keep' } } })[0], /not a scene page name/);
  assert.match(A.checkVerdicts({ ...good, verdicts: { '12-mass-gap.html': { verdict: 'love' } } })[0], /keep, maybe or drop/);
  assert.match(A.checkVerdicts({ ...good, verdicts: { '12-mass-gap.html': { note: 'x'.repeat(501) } } })[0], /at most 500/);
  assert.match(A.checkVerdicts({ ...good, stamp: 'x' })[0], /stamp/);
  assert.equal(A.keepCount(good.verdicts), 1);
  assert.deepEqual(A.keepOnly([{ page: '12-mass-gap.html' }, { page: '06-lenia-effects.html' }], good.verdicts).map(s => s.page), ['12-mass-gap.html']);
  assert.match(A.auditionStamp(new Date(2026, 10, 16, 18, 5, 9)), /^audition-20261116-180509$/);
  assert.equal(A.AUDITION_TARGET, 7);
});

test('audition: conduct-serve GET /api/audition (facts from the newest checks, else unknown) and the verdict file', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audition-')), qaHome = path.join(root, 'home'), sessions = path.join(root, 'sessions');
  const chk = (stamp, body) => { const d = path.join(qaHome, 'qa', '16-hodge-kaleidoscope', 'checks', stamp); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'check.md'), body); };
  chk('2026-11-01-1000', '| gate | result | detail |\n|---|---|---|\n| 1080p p95 <= 16.8 ms (hard) | \u2705 | 9.2 ms |\n');
  chk('2026-11-10-1200-shared', '| gate | result | detail |\n|---|---|---|\n| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | \u274c | missing 2 |\n| GPU p95 <= 7 ms and p99 <= 9 ms (standard at 1440p) | \u2705 | p95 5.0 ms |\n');
  chk('2026-11-09-1200-shared', '| gate | result | detail |\n|---|---|---|\n| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | \u2705 | old |\n');
  assert.ok(S.BROWSER_MODULES.includes('audition.mjs'), 'the page imports it through the server');
  const srv = http.createServer(S.createHandler({ tracksDir: path.join(root, 'tracks'), sessionsDir: sessions, repo: REPO, qaHome }));
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    const j = await (await fetch(`${base}/api/audition`)).json();
    assert.equal(j.target, 7);
    const by = Object.fromEntries(j.scenes.map(s => [s.page, s]));
    const hk = by['16-hodge-kaleidoscope.html'];
    assert.equal(hk.noBeat, 'yes');
    assert.deepEqual([hk.beatMatch.value, hk.beatMatch.source], ['fail', 'qa/16-hodge-kaleidoscope/checks/2026-11-10-1200-shared/check.md'], 'the newest shared check');
    assert.equal(hk.gpu1440.value, 'pass');
    assert.deepEqual([hk.frame1080.value, hk.frame1080.source], ['pass', 'qa/16-hodge-kaleidoscope/checks/2026-11-01-1000/check.md']);
    const mg = by['12-mass-gap.html'];
    assert.deepEqual([mg.beatMatch.value, mg.frame1080.value, mg.gpu1440.value], ['unknown', 'unknown', 'unknown'], 'no checks: unknown, never a guess');
    assert.equal(by['set.html'], undefined);
    assert.equal((await fetch(`${base}/qa/audition.mjs`)).status, 200);
    assert.equal((await fetch(`${base}/experiments/audition.html`)).status, 200);
    const stamp = 'audition-20261116-181500', body = { version: 1, stamp, verdicts: { '16-hodge-kaleidoscope.html': { verdict: 'keep', note: 'fast' } } };
    const post = b => fetch(`${base}/api/audition/${stamp}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof b === 'string' ? b : JSON.stringify(b) });
    const ok = await post(body);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, file: `${stamp}.json`, keeps: 1 });
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(sessions, `${stamp}.json`), 'utf8')), body, 'in the sessions folder');
    assert.deepEqual(await (await fetch(`${base}/api/audition/${stamp}`)).json(), body, 'the download');
    assert.equal((await post({ ...body, stamp: 'audition-20261116-181501' })).status, 400, 'the stamp must match the address');
    assert.equal((await post({ ...body, verdicts: { 'x.html': {} } })).status, 400);
    assert.equal((await post('not json')).status, 400);
    assert.equal((await fetch(`${base}/api/audition/../x`)).status, 404);
  } finally { await new Promise(r => srv.close(r)); fs.rmSync(root, { recursive: true, force: true }); }
});

test('audition.html: plain ASCII, imports qa/audition.mjs, buttons on CC 39 / 40 through midiStep, no scene file changed by it', () => {
  const html = src('audition.html');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(html), 'plain ASCII (#205)');
  assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(fs.readFileSync(path.join(REPO, 'qa', 'audition.mjs'), 'utf8')), 'qa/audition.mjs plain ASCII');
  assert.match(html, /import \* as A from '\.\.\/qa\/audition\.mjs';/);
  assert.match(html, /fetch\('\/api\/audition'\)/);
  assert.match(html, /A\.midiStep\(e\.data\)/);
  assert.match(html, /A\.sceneUrl\(s\.page, defaults\)/);
  assert.match(html, /fetch\(`\/api\/audition\/\$\{stamp\}`, \{ method: 'POST'/);
  assert.equal(A.isScenePage('audition.html', html), false);
});
