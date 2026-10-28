import test from 'node:test';
import assert from 'node:assert/strict';
import { putJob, superseded } from '../queue.mjs';

const j = (pr, page, sha) => ({ pr, page, sha });

test('a new job goes to the end', () => {
  const a = j(94, '14-round-point', 'a'), b = j(84, 'experiment', 'b');
  const { queue, replaced } = putJob([a], b);
  assert.deepEqual(queue, [a, b]);
  assert.equal(replaced, null);
});

test('a newer commit replaces the queued job in its place', () => {
  const a = j(94, '14-round-point', 'old'), b = j(94, '18-little-bang', 'old'), c = j(84, 'experiment', 'x');
  const a2 = j(94, '14-round-point', 'new');
  const { queue, replaced } = putJob([a, b, c], a2);
  assert.deepEqual(queue.map(q => `${q.pr} ${q.page} ${q.sha}`), ['94 14-round-point new', '94 18-little-bang old', '84 experiment x']);
  assert.equal(replaced, a);
});

test('the job waiting at the GPU gate is superseded once replaced', () => {
  const a = j(94, '14-round-point', 'old');
  let queue = [a];
  assert.equal(superseded(queue, a), false);
  queue = putJob(queue, j(94, '14-round-point', 'new')).queue;
  assert.equal(superseded(queue, a), true);
  assert.equal(superseded([], a), true);   // dropped (label, PR closed)
});

test('putJob leaves the old queue untouched', () => {
  const q = [j(1, 'p', 'a')];
  putJob(q, j(1, 'p', 'b'));
  assert.equal(q[0].sha, 'a');
});
