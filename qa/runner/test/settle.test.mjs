import test from 'node:test';
import assert from 'node:assert/strict';
import { settled } from '../settle.mjs';

const b = (o = {}) => ({ id: 'viz-155-4', status: 'running', finished: '2026-11-01T14:35:56Z', swipe: null, waitingOn: 'qa-box',
  gates: [{ name: 'a', ok: true }, { name: 'b', ok: true }], ...o });

test('settled: a finished build whose gated rows all pass is ready, waiting on the user', () => {
  assert.deepEqual(settled(b()), { status: 'ready', waitingOn: 'user' });
});

test('settled: one failing gated row makes it failed, waiting on dev', () => {
  assert.deepEqual(settled(b({ gates: [{ name: 'a', ok: true }, { name: 'b', ok: false }] })), { status: 'failed', waitingOn: 'dev' });
});

test('settled: builds still running, already settled, or with no gate rows are left alone', () => {
  assert.equal(settled(b({ finished: null })), null);               // still measuring
  assert.equal(settled(b({ status: 'ready' })), null);
  assert.equal(settled(b({ status: 'failed' })), null);
  assert.equal(settled(b({ status: 'merged' })), null);
  assert.equal(settled(b({ gates: [] })), null);                    // nothing gated: QA box decides
  assert.equal(settled(null), null);
});
