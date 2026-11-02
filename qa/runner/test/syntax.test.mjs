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
