// Daily experiment runs on main (daily.mjs): which PRs are due when. node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDaily, hourOf, dailyDue, dayOf, dailyConfig } from '../daily.mjs';
import { swipeCandidates } from '../swipe.mjs';

test('parseDaily: PR numbers only, no duplicates', () => {
  assert.deepEqual(parseDaily('159'), [159]);
  assert.deepEqual(parseDaily(' 159, 160 ,159,x,0,-3'), [159, 160]);
  assert.deepEqual(parseDaily(''), []);
  assert.deepEqual(parseDaily(undefined), []);
  assert.equal(hourOf('9', 8), 9); assert.equal(hourOf('', 8), 8); assert.equal(hourOf('25', 20), 20); assert.equal(hourOf('x', 20), 20);
});

test('dailyDue: once a UTC day, only in the daytime window, not while queued or running', () => {
  const at = iso => new Date(iso);
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-02T07:59:00Z') }), [], 'before 08:00Z');
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-02T08:00:00Z') }), [159]);
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-02T20:00:00Z') }), [], 'from 20:00Z on: the ML window');
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-02T03:30:00Z') }), [], 'night');
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-02T12:00:00Z'), done: { 159: '2026-11-02' } }), [], 'already today');
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-03T08:05:00Z'), done: { 159: '2026-11-02' } }), [159], 'the next day');
  assert.deepEqual(dailyDue({ prs: [159, 160], now: at('2026-11-02T09:00:00Z'), busy: [159] }), [160]);
  assert.deepEqual(dailyDue({ prs: [159], now: at('2026-11-02T06:00:00Z'), from: 6, to: 7 }), [159]);
  assert.equal(dayOf(at('2026-11-02T23:59:59Z')), '2026-11-02');
});

test('dailyConfig: the checked-in daily.json, env keys override, broken file means none', () => {
  const file = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'daily.json'), 'utf8');
  assert.deepEqual(dailyConfig(file, {}), { prs: [159], from: 8, to: 20 });
  assert.deepEqual(dailyConfig(file, { DAILY_EXPERIMENTS: '160', DAILY_FROM_UTC: '9' }), { prs: [160], from: 9, to: 20 });
  assert.deepEqual(dailyConfig('{nope', {}), { prs: [], from: 8, to: 20 });
  assert.deepEqual(dailyConfig('', { DAILY_EXPERIMENTS: '' }), { prs: [], from: 8, to: 20 });
});

test('swipe-ready never asks for a swipe on a daily build', () => {
  const g = [{ name: 'a', ok: true }];
  const daily = { id: 'daily-159-1', kind: 'daily', pr: 159, page: '16-hodge-kaleidoscope', commit: 'abc1234', started: '2026-11-02T08:01:00Z',
    finished: '2026-11-02T08:20:00Z', status: 'ready', swipe: null, report: 'qa/16-hodge-kaleidoscope/runs/2026-11-02-0801-pr159/check.md', gates: g };
  assert.deepEqual(swipeCandidates([daily], { now: Date.parse('2026-11-02T09:00:00Z') }), []);
});
