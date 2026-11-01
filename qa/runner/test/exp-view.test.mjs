import test from 'node:test';
import assert from 'node:assert/strict';
import { isExpRun, expRunBody, safePart, runLinkOf } from '../../exp-view.mjs';

// an exp-run results.json as viz-155-4 wrote it (qa/26-lattice-gas/runs/2026-11-01-1420-pr155), trimmed
const d = {
  id: '26-lattice-gas', page: '26-lattice-gas', pr: 155, sha: '567a444048389ae80af4a035b6ad3317756a7471', at: '2026-11-01T14:35:56Z', hasGpu: true,
  runs: [
    { label: 'default@1080p', size: { w: 1920, h: 1080 }, url: '26-lattice-gas.html?qa=1', metrics: { fps: 60.01, 'frameMs.p95': 17.2, errors: 0 }, values: { mass: 1234 },
      stills: ['stills/default@1080p-1.png', 'stills/default@1080p-2.png'], errors: [] },
    { label: 'track@1080p', skipped: 'darude-sandstorm.flac', metrics: {}, values: {}, stills: [], errors: [] },
  ],
  checks: [{ script: 'check-events', dir: 'checks/check-events', gates: [] }],
  swipe: null,
  gates: [{ name: 'fps ≥ 58', ok: true, value: '60.01' }, { name: 'errors = 0', ok: false, value: '2' }, { name: 'clip', ok: true, skipped: true }],
  notes: ['tracks: 4/4'],
};
const files = new Set(['check.md', 'report.md', 'stills/default@1080p-1.png', 'checks/check-events/check.md', 'shared/check.md']);
const has = rel => files.has(rel);

test('isExpRun: exp-run folders (runs[]) vs qa/run.mjs sweeps (results[])', () => {
  assert.equal(isExpRun(d), true);
  assert.equal(isExpRun({ meta: {}, results: [] }), false);
  assert.equal(isExpRun(null), false);
});

test('safePart: \'@\' still names pass; dots-only, slashes and empty parts do not', () => {
  assert.equal(safePart('default@1080p-1.png'), true);
  assert.equal(safePart('2026-11-01-1420-pr155'), true);
  for (const bad of ['..', '.', '', 'a/b', 'a b', '%2e', undefined]) assert.equal(safePart(bad), false, String(bad));
});

test('expRunBody: stills that exist, URL-encoded \'@\', check links, failing gate first, no swipe', () => {
  const html = expRunBody('26-lattice-gas', '2026-11-01-1420-pr155', d, has, { sharedDirs: ['shared', 'shared-fast'] });
  assert.match(html, /<img src="\/file\/26-lattice-gas\/2026-11-01-1420-pr155\/stills\/default%401080p-1\.png"/);
  assert.doesNotMatch(html, /default%401080p-2\.png/);                        // not on disk: no broken image
  assert.match(html, /href="\/report\/qa\/26-lattice-gas\/runs\/2026-11-01-1420-pr155\/check\.md"/);
  assert.match(html, /href="\/report\/qa\/26-lattice-gas\/runs\/2026-11-01-1420-pr155\/checks\/check-events\/check\.md"/);
  assert.match(html, /href="\/report\/qa\/26-lattice-gas\/runs\/2026-11-01-1420-pr155\/shared\/check\.md"/);
  assert.doesNotMatch(html, /shared-fast\/check\.md/);                         // its check.md isn't there
  assert.match(html, /<b>1\/2 gates pass<\/b>/);
  assert.ok(html.indexOf('errors = 0') < html.indexOf('fps ≥ 58'), 'the failing gate is listed first');
  assert.match(html, /skipped: track missing \(darude-sandstorm\.flac\)/);
  assert.match(html, /No swipe run for this build/);
});

test('expRunBody: a swipe run gets its link; paths with .. never become links', () => {
  const html = expRunBody('26-lattice-gas', 's', { ...d, swipe: { url: '/run/26-lattice-gas/s-swipe/compare', old: 'abc1234', new: d.sha },
    runs: [{ ...d.runs[0], stills: ['../../etc/passwd', 'stills/default@1080p-1.png'] }] }, () => true);
  assert.match(html, /href="\/run\/26-lattice-gas\/s-swipe\/compare"/);
  assert.doesNotMatch(html, /passwd/);
  assert.doesNotMatch(html, /No swipe run/);
});

test('runLinkOf: a build\'s check.md path gives its run page', () => {
  assert.equal(runLinkOf('qa/26-lattice-gas/runs/2026-11-01-1420-pr155/check.md'), '/run/26-lattice-gas/2026-11-01-1420-pr155');
  assert.equal(runLinkOf('qa/../runs/x/check.md'), null);
  assert.equal(runLinkOf(null), null);
});
