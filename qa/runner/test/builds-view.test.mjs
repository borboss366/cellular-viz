// #162: the viewer's /builds page and the user's notes. Pure parts (qa/builds-view.mjs, qa/notes.mjs) and one end-to-end
// run of qa/serve.mjs on a temporary QA_HOME (the '@' still, the thumbnail, /builds, a note saved over HTTP).
// node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildRows, filterRows, parseFilters, liveLink, buildKind, wouldFail, buildsBody, needsMe } from '../../builds-view.mjs';
import { addNote, loadNotes, requestShare, pendingShares, shareNotes, marker, commentBody } from '../../notes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'bv-'));
const B = (id, extra) => ({ id, kind: 'viz', page: '26-lattice-gas', pr: +id.split('-')[1], commit: 'abc1234', round: +id.split('-')[2],
  started: '2026-11-01T10:00:00Z', finished: null, status: 'queued', gates: [], report: null, swipe: null, waitingOn: 'qa-box', at: '2026-11-01T10:00:00Z', ...extra });
// builds.json as the runner writes it: several snapshot lines per build, the latest wins
const LINES = [
  B('viz-155-1'), B('viz-155-1', { status: 'failed', waitingOn: 'dev', finished: '2026-11-01T10:05:00Z', gates: [{ ok: false }] }),
  B('viz-155-4', { status: 'ready', waitingOn: 'user', finished: '2026-11-01T12:00:00Z', branch: 'page-26-fhp', gates: [{ ok: true }, { ok: true }],
    report: 'qa/26-lattice-gas/runs/2026-11-01-1200-pr155/check.md' }),
  B('viz-159-1', { page: '16-hodge-kaleidoscope', status: 'ready', waitingOn: 'user', finished: '2026-11-01T11:00:00Z', branch: 'audio-16b-fake',
    report: 'qa/16-hodge-kaleidoscope/runs/2026-11-01-1355-pr159/check.md' }),
  B('viz-153-2', { page: '24-paint-pour', status: 'merged', waitingOn: null, finished: '2026-10-31T09:00:00Z', report: 'qa/24-paint-pour/checks/2026-10-31-0900/check.md' }),
  B('viz-150-1', { page: '18-little-bang', status: 'closed', waitingOn: null, finished: '2026-10-30T09:00:00Z', branch: 'x' }),
];

test('every build in builds.json appears exactly once, newest first, with its kind and live link', () => {
  const info = b => (b.id === 'viz-159-1' ? { results: { runs: [{ audio: { frames: 780 } }] } } : b.id === 'viz-155-4'
    ? { checkMd: '| a | ✅ | x |\n| b (report-only) | ℹ️ | would fail · 0.04 |\n| c (report-only) | ℹ️ | would pass · 1 |\n| note | ℹ️ | audio: … |', thumb: true } : {});
  const rows = buildRows(LINES, info), ids = rows.map(r => r.id);
  assert.deepEqual(ids, ['viz-155-4', 'viz-159-1', 'viz-155-1', 'viz-153-2', 'viz-150-1']);
  assert.equal(new Set(ids).size, new Set(LINES.map(b => b.id)).size, 'one row per build id');
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.equal(by['viz-155-1'].status, 'failed', 'the latest line of a build wins');
  assert.equal(by['viz-155-4'].type, 'experiment'); assert.equal(by['viz-159-1'].type, 'audio'); assert.equal(by['viz-153-2'].type, 'page');
  assert.equal(by['viz-155-4'].wouldFail, 1); assert.equal(by['viz-155-4'].thumb, true); assert.equal(by['viz-153-2'].thumb, false);
  assert.equal(by['viz-155-4'].live, 'https://raw.githack.com/borboss366/cellular-viz/page-26-fhp/experiments/26-lattice-gas.html');
  assert.equal(by['viz-153-2'].live, 'https://borboss366.github.io/cellular-viz/experiments/24-paint-pour.html', 'merged: GitHub Pages');
  assert.equal(by['viz-150-1'].live, null, 'closed: no live page'); assert.equal(by['viz-155-1'].live, null, 'no branch recorded: none');
  assert.equal(liveLink(B('viz-1-1', { page: 'pr-1', branch: 'b' })), null, 'no page name: none');
  assert.equal(liveLink(B('viz-1-1', { branch: '../../etc' })), null);
  assert.equal(wouldFail(null), 0); assert.equal(buildKind(B('viz-1-1', { page: 'pr-1' })), 'experiment');
});

test('the filters return the right subsets, and unknown values are ignored', () => {
  const rows = buildRows(LINES);
  const ids = f => filterRows(rows, parseFilters(new URLSearchParams(f))).map(r => r.id);
  assert.deepEqual(ids(''), rows.map(r => r.id));
  assert.deepEqual(ids('scene=26'), ['viz-155-4', 'viz-155-1']);
  assert.deepEqual(ids('status=ready'), ['viz-155-4', 'viz-159-1']);
  assert.deepEqual(ids('kind=experiment'), ['viz-155-4', 'viz-159-1']);
  assert.deepEqual(ids('kind=page'), ['viz-155-1', 'viz-153-2', 'viz-150-1']);
  assert.deepEqual(ids('me=1'), ['viz-155-4', 'viz-159-1']); assert.ok(rows.filter(needsMe).every(r => r.status === 'ready' && r.waitingOn === 'user'));
  assert.deepEqual(ids('scene=26&me=1'), ['viz-155-4']);
  assert.deepEqual(ids('status=<script>&kind=x&scene=../'), rows.map(r => r.id), 'bad filter values are dropped');
  const html = buildsBody(rows, parseFilters(new URLSearchParams('me=1')), () => []);
  assert.match(html, /2 of 5 shown/); assert.ok(!html.includes('id="b-viz-155-1"'));
});

test('a note round-trips: saved, listed; a private note is never posted, a shared one exactly once', async () => {
  const dir = tmp();
  try {
    const a = addNote(dir, 'viz-155-4', '  the gas is too dim\r\nknob: macro2 0.7 ', { now: new Date('2026-11-01T13:00:00Z') });
    const b = addNote(dir, 'viz-155-4', 'second thought', { share: true, now: new Date('2026-11-01T13:05:00Z') });
    assert.deepEqual([a.n, b.n], [1, 2]); assert.equal(a.text, 'the gas is too dim\nknob: macro2 0.7'); assert.equal(a.share, false);
    assert.deepEqual(loadNotes(dir, 'viz-155-4').map(e => [e.n, e.share, e.posted]), [[1, false, null], [2, true, null]]);
    assert.throws(() => addNote(dir, 'viz-155-4', '   '), /empty/); assert.throws(() => addNote(dir, '../x', 'hi'), /bad build id/);
    assert.deepEqual(pendingShares(dir).map(p => p.n), [2], 'only the shared note is pending');
    const posts = [];
    const deps = { prOf: id => (id === 'viz-155-4' ? 155 : null), existing: async () => [], post: async (pr, body) => { posts.push({ pr, body }); return `https://github.com/x/pull/${pr}#c${posts.length}`; } };
    assert.equal((await shareNotes(dir, deps)).length, 1);
    assert.equal((await shareNotes(dir, deps)).length, 0, 'a second round posts nothing');
    assert.equal(posts.length, 1); assert.equal(posts[0].pr, 155);
    assert.match(posts[0].body, /^Note from the user on viz-155-4:\n\nsecond thought\n\n<!-- qa-note viz-155-4 #2 -->$/);
    assert.ok(!posts.some(p => p.body.includes('too dim')), 'the private note never left the box');
    assert.equal(loadNotes(dir, 'viz-155-4')[1].posted.url, 'https://github.com/x/pull/155#c1');
    // pressing Share to PR on the first one posts it, once; knob: lines go out as written
    requestShare(dir, 'viz-155-4', 1); requestShare(dir, 'viz-155-4', 1);
    await shareNotes(dir, deps); await shareNotes(dir, deps);
    assert.equal(posts.length, 2); assert.match(posts[1].body, /\nknob: macro2 0\.7\n/);
    // a crash after posting but before recording: the marker on the PR is found and nothing is posted again
    addNote(dir, 'viz-159-1', 'louder', { share: true });
    const seen = { prOf: () => 159, existing: async () => [{ body: commentBody('viz-159-1', { n: 1, text: 'louder' }), url: 'https://github.com/x/pull/159#c9' }], post: async () => { throw new Error('must not post'); } };
    const done = await shareNotes(dir, seen);
    assert.equal(done[0].how, 'found'); assert.equal(loadNotes(dir, 'viz-159-1')[0].posted.url, 'https://github.com/x/pull/159#c9');
    assert.equal(marker('viz-159-1', 1), '<!-- qa-note viz-159-1 #1 -->');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('serve.mjs: an \'@\' still loads (200), and so do the thumbnail, /builds and a saved note', async () => {
  const home = tmp(), notes = path.join(home, 'notes'), stamp = '2026-11-01-1200-pr155', run = path.join(home, 'qa', '26-lattice-gas', 'runs', stamp);
  fs.mkdirSync(path.join(run, 'stills'), { recursive: true });
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a5b70000000049454e44ae426082', 'hex');
  fs.writeFileSync(path.join(run, 'stills', 'default@1080p-1.png'), png);
  fs.writeFileSync(path.join(run, 'results.json'), JSON.stringify({ id: '26-lattice-gas', pr: 155, runs: [{ label: 'default@1080p', stills: ['stills/default@1080p-1.png'] }], gates: [], checks: [] }));
  fs.writeFileSync(path.join(run, 'check.md'), '# x\n\n| gate | result | detail |\n|---|---|---|\n| a | ✅ | ok |\n');
  fs.writeFileSync(path.join(home, 'qa', 'builds.json'), LINES.map(b => JSON.stringify(b.id === 'viz-155-4' ? { ...b, report: `qa/26-lattice-gas/runs/${stamp}/check.md` } : b)).join('\n') + '\n');
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(process.execPath, [path.join(here, '..', '..', 'serve.mjs'), '--port', String(port)], { env: { ...process.env, QA_HOME: home, QA_NOTES_DIR: notes }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('viewer did not start')), 10e3);
      child.stdout.on('data', d => { if (String(d).includes(`:${port}`)) { clearTimeout(t); resolve(); } }); child.on('exit', c => reject(new Error(`viewer exited ${c}`))); });
    const base = `http://127.0.0.1:${port}`;
    const still = await fetch(`${base}/file/26-lattice-gas/${stamp}/stills/default%401080p-1.png`);
    assert.equal(still.status, 200); assert.equal(still.headers.get('content-type'), 'image/png');
    assert.equal((await fetch(`${base}/thumb/viz-155-4`)).status, 200);
    assert.equal((await fetch(`${base}/thumb/viz-153-2`)).status, 404, 'no still: 404, not a crash');
    const page = await (await fetch(`${base}/builds`)).text();
    for (const id of new Set(LINES.map(b => b.id))) assert.equal(page.split(`id="b-${id}"`).length - 1, 1, `${id} once on /builds`);
    assert.ok(page.includes('/thumb/viz-155-4'));
    const saved = await fetch(`${base}/notes/viz-155-4`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'from the phone' }) });
    assert.equal(saved.status, 200);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(notes, 'viz-155-4.json'), 'utf8')).map(e => [e.n, e.text, e.share]), [[1, 'from the phone', false]]);
    assert.equal((await fetch(`${base}/notes/viz-155-4/1/share`, { method: 'POST' })).status, 200);
    assert.equal(JSON.parse(fs.readFileSync(path.join(notes, 'viz-155-4.json'), 'utf8'))[0].share, true);
    assert.equal((await fetch(`${base}/notes/viz-999-1`, { method: 'POST', body: '{"text":"x"}' })).status, 404, 'no such build');
    assert.ok((await (await fetch(`${base}/builds`)).text()).includes('from the phone'));
    assert.equal((await fetch(`${base}/builds/open`)).status, 200);
  } finally { child.kill(); fs.rmSync(home, { recursive: true, force: true }); }
});
