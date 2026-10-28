// Unit tests for qa/runner/todo.mjs: the runner puts ready swipe builds on the user's grading page.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { addTodo, entryFor, swipeRun, todoId } from '../todo.mjs';

function home(clips = 3) {
  const q = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-test-'));
  const run = path.join(q, 'qa', '16-hodge-kaleidoscope', 'runs', '2026-10-28-1901-pr84-swipe');
  fs.mkdirSync(run, { recursive: true });
  fs.writeFileSync(path.join(run, 'results.json'), JSON.stringify({ results: Array.from({ length: clips }, (_, i) => ({ label: `v${i}` })) }));
  fs.writeFileSync(path.join(q, 'qa', 'todo.json'), JSON.stringify([{ id: '16b-hodge-kaleidoscope', from: 'QA box', title: 'by hand' }]));
  return q;
}
const build = (extra = {}) => ({ id: 'viz-84-2', page: '16-hodge-kaleidoscope', pr: 84, commit: '2fcb554', status: 'ready',
  swipe: '/run/16-hodge-kaleidoscope/2026-10-28-1901-pr84-swipe/compare', gates: [{ name: 'a', ok: true }, { name: 'b', ok: true }], ...extra });
const read = q => JSON.parse(fs.readFileSync(path.join(q, 'qa', 'todo.json'), 'utf8'));

test('swipeRun parses the compare url and refuses ..', () => {
  assert.deepEqual(swipeRun('/run/16-hodge-kaleidoscope/2026-10-28-1901-pr84-swipe/compare'),
    { run: '/run/16-hodge-kaleidoscope/2026-10-28-1901-pr84-swipe', dir: path.join('qa', '16-hodge-kaleidoscope', 'runs', '2026-10-28-1901-pr84-swipe') });
  assert.equal(swipeRun('/run/../x/compare'), null);
  assert.equal(swipeRun('https://elsewhere/x'), null);
});

test('only ready builds with a swipe get an entry', () => {
  assert.equal(entryFor(build({ status: 'failed' })), null);
  assert.equal(entryFor(build({ swipe: null })), null);
  assert.equal(entryFor(build()).id, '16-hodge-kaleidoscope-pr84-2fcb554');
  assert.equal(todoId(build({ commit: '2fcb554abcdef' })), '16-hodge-kaleidoscope-pr84-2fcb554');
});

test('2+ clips: compare and watch links; 1 clip: watch only', () => {
  const two = entryFor(build(), { clips: 2, title: '16b Hodge Kaleidoscope' });
  assert.deepEqual(two.links.map(l => l.label), ['⇄ compare', '▶ watch']);
  assert.equal(two.links[0].href, '/run/16-hodge-kaleidoscope/2026-10-28-1901-pr84-swipe/compare');
  assert.match(two.title, /PR #84\): 16b Hodge Kaleidoscope$/);
  assert.match(two.note, /gates 2\/2 passed/);
  const one = entryFor(build(), { clips: 1 });
  assert.deepEqual(one.links.map(l => l.label), ['▶ watch']);
});

test('addTodo appends once, counts clips, and leaves hand-made entries alone', () => {
  const q = home(3);
  const r = addTodo({ qaHome: q, b: build(), title: 'x' });
  assert.equal(r.changed, true);
  const list = read(q);
  assert.equal(list.length, 2);
  assert.equal(list[0].done, undefined);   // the hand-made one is untouched
  assert.equal(list[1].links.length, 2);   // 3 clips → compare + watch
  assert.equal(addTodo({ qaHome: q, b: build() }).changed, false);   // same build again: nothing
  assert.equal(read(q).length, 2);
});

test('a todo.json that does not parse or is not a list is left alone', () => {
  for (const bad of ['[{"id": "half-writ', '{"id": "x"}']) {
    const q = home(2), f = path.join(q, 'qa', 'todo.json');
    fs.writeFileSync(f, bad);
    const r = addTodo({ qaHome: q, b: build() });
    assert.equal(r.changed, false);
    assert.match(r.error, /todo.json unreadable/);
    assert.equal(fs.readFileSync(f, 'utf8'), bad);   // unchanged
  }
});

test('a missing todo.json starts a new list', () => {
  const q = home(2);
  fs.rmSync(path.join(q, 'qa', 'todo.json'));
  assert.equal(addTodo({ qaHome: q, b: build() }).changed, true);
  assert.equal(read(q).length, 1);
});

test('a newer build of the same PR supersedes the runner\'s older open entry', () => {
  const q = home(2);
  addTodo({ qaHome: q, b: build() });
  const r = addTodo({ qaHome: q, b: build({ id: 'viz-84-3', commit: 'abcdef1' }) });
  assert.deepEqual(r.superseded, ['16-hodge-kaleidoscope-pr84-2fcb554']);
  const list = read(q);
  const old = list.find(t => t.id === '16-hodge-kaleidoscope-pr84-2fcb554');
  assert.ok(old.done);
  assert.equal(old.superseded, '16-hodge-kaleidoscope-pr84-abcdef1');
  assert.ok(!list.find(t => t.id === '16-hodge-kaleidoscope-pr84-abcdef1').done);
});
