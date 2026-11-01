// Build events for QA box's folder trigger (events.mjs): atomic files, names that sort by time, pruning to 500 / 14 days,
// and the fields taken from a build line. node --test qa/runner/test/*.test.mjs (qa/test-pr.sh runs it).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emit, prune, eventName, buildEvent } from '../events.mjs';

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'events-'));

test('emit writes one complete JSON file per event, via <dir>.tmp, and nothing when the folder is unset', () => {
  const root = tmpdir(), dir = path.join(root, 'qa-events');
  try {
    assert.equal(emit('', { type: 'test' }), null);
    const f = emit(dir, { type: 'finished', pr: 155, page: '26-lattice-gas' }, { now: new Date('2026-11-01T17:47:00.123Z') });
    assert.equal(path.dirname(f), dir);
    assert.match(path.basename(f), /^20261101T174700123Z-finished-pr155-[0-9a-f]{6}\.json$/);
    const ev = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.deepEqual(ev, { type: 'finished', pr: 155, page: '26-lattice-gas', at: '2026-11-01T17:47:00.123Z' });
    assert.deepEqual(fs.readdirSync(`${dir}.tmp`), [], 'the temp folder is left empty: every file was renamed in');
    assert.throws(() => emit(dir, { type: 'exploded' }), /unknown event type/);
    assert.match(eventName({ type: 'test' }), /^\d{8}T\d{9}Z-test-[0-9a-f]{6}\.json$/);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('prune keeps the newest 500 and nothing older than 14 days, and leaves other files alone', () => {
  const dir = tmpdir();
  try {
    const now = new Date('2026-11-15T12:00:00Z');
    for (let i = 0; i < 510; i++) emit(dir, { type: 'test' }, { now: new Date(now.getTime() - i * 60e3), keep: 1e9 });
    emit(dir, { type: 'waiting', pr: 1 }, { now: new Date('2026-10-30T12:00:00Z'), keep: 1e9, days: 30 });   // 16 days old
    fs.writeFileSync(path.join(dir, 'README.txt'), 'not an event');
    const gone = prune(dir, { now });
    assert.equal(gone.length, 11, '10 beyond the newest 500, plus the 16-day-old one');
    const left = fs.readdirSync(dir);
    assert.equal(left.filter(f => f.endsWith('.json')).length, 500);
    assert.ok(left.includes('README.txt'));
    assert.ok(!left.some(f => f.startsWith('20261030')), 'the old event is gone');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('buildEvent takes status, gates, report and swipe from the build line, the rest from the job', () => {
  const b = { id: 'viz-155-4', pr: 155, page: '26-lattice-gas', commit: '567a444', status: 'ready', waitingOn: 'user',
    report: 'qa/26-lattice-gas/runs/x/check.md', swipe: '/run/26-lattice-gas/y/compare', gates: [{ ok: true }, { ok: true }, { ok: false }] };
  const ev = buildEvent('finished', b, { pr: 155, kind: 'experiment', sha: '567a4449999' }, { result: 'viz-155-4 ready 2/3' });
  assert.deepEqual(ev, { type: 'finished', pr: 155, page: '26-lattice-gas', kind: 'experiment', id: 'viz-155-4', sha: '567a444',
    status: 'ready', waitingOn: 'user', gates: '2/3', report: 'qa/26-lattice-gas/runs/x/check.md', swipe: '/run/26-lattice-gas/y/compare',
    result: 'viz-155-4 ready 2/3' });
  const w = buildEvent('waiting', null, { pr: 163, page: 'experiment', kind: 'experiment', sha: 'abcdef0123' }, { busy: 40 });
  assert.equal(w.pr, 163); assert.equal(w.sha, 'abcdef0'); assert.equal(w.status, null); assert.equal(w.gates, null); assert.equal(w.busy, 40);
});
