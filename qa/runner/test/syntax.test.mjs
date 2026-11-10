// Every runner module must parse. The unit tests import only some of them, so a clash in runner.mjs (#186 at
// b9dab61: settleLeft imported from queue.mjs and also declared in runner.mjs) passed 237/237 and would have
// crashed the runner on start. node --check parses each file without running it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.mjs')).sort();

test('every qa/runner/*.mjs passes node --check (runner.mjs included)', () => {
  assert.ok(files.includes('runner.mjs'), 'runner.mjs is checked');
  const bad = [];
  for (const f of files) {
    const r = spawnSync(process.execPath, ['--check', path.join(dir, f)], { encoding: 'utf8' });
    if (r.status !== 0) bad.push(`${f}: ${(r.stderr || '').trim().split('\n').slice(0, 5).join(' | ')}`);
  }
  assert.deepEqual(bad, []);
});

// #214 (cceb571): a duplicate `const late` in conduct-smoke.test.mjs stopped that file from loading, so the smoke run
// never ran and node --test reported the file, not a test. The test files, their fixtures and the clock scripts the
// tests load are checked here too, so a clash names its file and line.
test('every qa/runner/test/*.mjs, its fixtures and experiments/clock*.js pass node --check', () => {
  const testDir = path.dirname(fileURLToPath(import.meta.url)), fixDir = path.join(testDir, 'fixtures'), exp = path.join(dir, '..', '..', 'experiments');
  const list = [
    ...fs.readdirSync(testDir).filter(f => f.endsWith('.mjs')).map(f => path.join(testDir, f)),
    ...fs.readdirSync(fixDir).filter(f => /\.(mjs|cjs|js)$/.test(f)).map(f => path.join(fixDir, f)),
    ...['clock.js', 'clock-tracker.js'].map(f => path.join(exp, f)),
  ].sort();
  assert.ok(list.some(f => f.endsWith('conduct-smoke.test.mjs')) && list.some(f => f.endsWith('clock-tracker.js')), 'the smoke test and the tracker are among them');
  const bad = [];
  for (const f of list) {
    const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
    if (r.status !== 0) bad.push(`${path.relative(path.join(dir, '..', '..'), f)}: ${(r.stderr || '').trim().split('\n').slice(0, 5).join(' | ')}`);
  }
  assert.deepEqual(bad, []);
});
