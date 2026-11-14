// The heavy-box lock and its callers (#231 at e9d7bbd: nobeat-smoke and scene-capture-smoke waited for the lock past
// their own 180 s timeout, then launched Chromium after the test had ended; the file never exited).
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// a lock folder of its own, so this file never blocks the real heavy tests running beside it
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'heavy-lock-test-'));
process.env.HEAVY_LOCK_DIR = path.join(tmp, 'lock');
const L = await import('./fixtures/heavy-lock.mjs');

test('heavyLock: a held lock, then the test ends (aborted signal): it stops waiting at once instead of after LOCK_WAIT_MS', async t => {
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  // held by this (live) process: never broken as stale
  fs.mkdirSync(process.env.HEAVY_LOCK_DIR);
  fs.writeFileSync(path.join(process.env.HEAVY_LOCK_DIR, 'owner'), JSON.stringify({ pid: process.pid, name: 'holder', at: Date.now() }));
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 300);
  const t0 = Date.now();
  const release = await L.heavyLock('waiter', { signal: ac.signal });
  const waited = Date.now() - t0;
  assert.ok(waited < 5000, `stopped after ${waited} ms`);
  assert.equal(typeof release, 'function');
  assert.ok(fs.existsSync(process.env.HEAVY_LOCK_DIR), 'the holder keeps its lock');
  fs.rmSync(process.env.HEAVY_LOCK_DIR, { recursive: true, force: true });
  const mine = await L.heavyLock('free');   // a free lock is taken at once
  assert.ok(fs.existsSync(process.env.HEAVY_LOCK_DIR));
  mine();
  assert.ok(!fs.existsSync(process.env.HEAVY_LOCK_DIR), 'released');
  assert.ok(L.SMOKE_TIMEOUT_MS > L.LOCK_WAIT_MS + 60e3, 'a smoke gets its run time on top of the longest wait');
});

test('every heavyLock caller passes its test signal and checks it, and no test that waits for the lock times out before the wait does', () => {
  const files = fs.readdirSync(HERE).filter(f => f.endsWith('.test.mjs') && f !== 'heavy-lock.test.mjs');
  const callers = files.filter(f => /heavyLock\(/.test(fs.readFileSync(path.join(HERE, f), 'utf8')));
  assert.ok(callers.length >= 5, `callers: ${callers.join(', ')}`);
  const bad = [];
  for (const f of callers) {
    const src = fs.readFileSync(path.join(HERE, f), 'utf8');
    for (const m of src.matchAll(/heavyLock\(([^)]*)\)/g)) if (!/signal:\s*t\.signal/.test(m[1])) bad.push(`${f}: heavyLock(${m[1]}) without signal: t.signal`);
    // a literal test timeout under the lock's wait (the 180 s that hung #231)
    for (const m of src.matchAll(/timeout:\s*([\d.]+)e3\b/g)) {
      const ms = Number(m[1]) * 1000, line = src.slice(0, m.index).split('\n').length;
      const ctx = src.split('\n')[line - 1];
      if (/^\s*(test|it)\(|\btest\(/.test(ctx) && ms <= L.LOCK_WAIT_MS) bad.push(`${f}:${line}: test timeout ${ms} ms <= the lock wait ${L.LOCK_WAIT_MS} ms`);
    }
    // a smoke launches Chromium after taking the lock: it must check the signal first, and also close Chromium from a
    // file-level after() or a finally (a timed-out test's late t.after never runs). (tracker-corpus has no timeout.)
    if (!/smoke/.test(f)) continue;
    if (!/after\(async/.test(src) && !/finally\s*\{[\s\S]*kill\(/.test(src)) bad.push(`${f}: launches Chromium without a file-level after() or finally close`);
    if (!/if \(t\.signal\.aborted\)/.test(src)) bad.push(`${f}: no t.signal.aborted check after the lock`);
  }
  assert.deepEqual(bad, []);
});
