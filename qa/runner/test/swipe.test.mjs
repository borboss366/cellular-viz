// Swipe runs for the grading page (swipe.mjs): the default swipe, the swipe-only experiment file and which builds
// qa/swipe-ready.sh asks for. node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultSwipe, swipeOnlyRaw, swipeCandidates, writeRequest, takeRequests } from '../swipe.mjs';
import { validate } from '../experiment.mjs';

test('default swipe: the first variant, new vs base, 30 s; and the file stays valid', () => {
  const raw = { version: 1, id: '26-lattice-gas', variants: [{ name: 'rain', params: {} }, { name: 'fast', params: { speed: 2 } }],
    gates: [{ metric: 'errors', max: 0 }] };
  assert.deepEqual(defaultSwipe(raw), { vs: 'base', seconds: 30, warmup: 4, variants: ['rain'] });
  assert.deepEqual(defaultSwipe({ version: 1, id: '26-lattice-gas' }).variants, ['default']);
  const v = validate({ ...raw, swipe: defaultSwipe(raw) });
  assert.deepEqual(v.errors, []); assert.deepEqual(v.exp.swipe.variants, ['rain']);
});

test('swipe-only file: no runs, gates, checks or audio; the file\'s own swipe wins; it validates', () => {
  const raw = { version: 1, id: '16-hodge-kaleidoscope', kind: 'audio', warmup: 2, seconds: 16,
    audio: { track: 'darude-sandstorm', from: 30, len: 14 }, shared: { variants: ['x'] }, checks: ['check-16'],
    values: { a: '__qa.x' }, gates: [{ metric: 'value.a', min: 1 }], debug: {} };
  const s = swipeOnlyRaw(raw);
  assert.equal(s.seconds, 0); assert.deepEqual(s.gates, []); assert.deepEqual(s.checks, []); assert.equal(s.kind, 'both');
  assert.equal(s.audio, undefined); assert.equal(s.shared, undefined);
  assert.deepEqual(s.swipe.variants, ['default']);
  assert.deepEqual(validate(s).errors, []);
  const own = swipeOnlyRaw({ version: 1, id: '13-flow-lab', swipe: { vs: 'base', seconds: 40 } });
  assert.deepEqual(own.swipe, { vs: 'base', seconds: 40 });
  assert.equal(raw.seconds, 16, 'the original file object is untouched');
});

const bl = (pr, round, extra = {}) => ({ id: `viz-${pr}-${round}`, pr, page: '26-lattice-gas', commit: 'abc1234', round,
  started: `2026-11-01T1${round}:00:00Z`, finished: `2026-11-01T1${round}:30:00Z`, status: 'ready', swipe: null,
  report: `qa/26-lattice-gas/runs/2026-11-01-1${round}00-pr${pr}/check.md`, gates: [{ name: 'a', ok: true }, { name: 'b', ok: true }], ...extra });

test('swipe-ready picks the newest green round of each PR without a swipe', () => {
  const builds = [
    bl(155, 3), bl(155, 4),                                   // newest round of #155 → asked for
    bl(159, 1, { page: '16-hodge-kaleidoscope', status: 'running' }),   // finished green, still "running" → asked for
    bl(157, 1, { status: 'merged' }),                         // merged: never
    bl(160, 1, { swipe: '/run/x/y/compare' }),                // has a swipe already
    bl(161, 1, { gates: [{ name: 'a', ok: true }, { name: 'b', ok: false }], status: 'failed' }),   // a failed gate
    bl(162, 1, { page: 'pr-162' }),                           // not a page (the experiment file was missing)
    bl(163, 1, { finished: null, status: 'running' }),        // still running
    bl(164, 2), bl(164, 3, { status: 'failed', gates: [{ name: 'a', ok: false }] }),   // newest round failed: no
  ];
  assert.deepEqual(swipeCandidates(builds).map(b => b.id).sort(), ['viz-155-4', 'viz-159-1']);
});

test('swipe requests: written atomically, taken once', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swipe-'));
  try {
    writeRequest(dir, bl(155, 4)); writeRequest(dir, bl(159, 1));
    assert.deepEqual(fs.readdirSync(path.join(dir, 'swipe-requests')).sort(), ['155.json', '159.json']);
    const got = takeRequests(dir);
    assert.deepEqual(got.map(r => r.id).sort(), ['viz-155-4', 'viz-159-1']);
    assert.equal(got.find(r => r.pr === 155).report, 'qa/26-lattice-gas/runs/2026-11-01-1400-pr155/check.md');
    assert.deepEqual(takeRequests(dir), [], 'each request is taken once');
    assert.deepEqual(takeRequests(path.join(dir, 'nope')), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
