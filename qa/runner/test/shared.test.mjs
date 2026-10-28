// Unit tests for the shared-gates step (qa/runner/shared.mjs). No browser: the check itself is faked.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runShared, section, HEADING } from '../shared.mjs';

// the gate parser qa/builds.mjs uses (same regex), so the test proves the appended rows are gates
const gates = md => md.split('\n').map(l => l.match(/^\| (.+?) \| (✅|❌)[^|]*\|(.*)\|$/)).filter(Boolean).map(m => ({ name: m[1].trim(), ok: m[2] === '✅' }));

function setup({ script = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-test-'));
  const tree = path.join(root, 'tree'), dest = path.join(root, 'dest');
  fs.mkdirSync(path.join(tree, 'qa'), { recursive: true });
  fs.mkdirSync(path.join(tree, 'experiments'), { recursive: true });
  fs.mkdirSync(dest, { recursive: true });
  if (script) fs.writeFileSync(path.join(tree, 'qa', 'check-shared.mjs'), '// fake\n');
  fs.writeFileSync(path.join(dest, 'check.md'), '# check-13\n\n| gate | result | detail |\n|---|---|---|\n| fps p05 ≥ 55 | ✅ | 60 |\n');
  return { tree, dest };
}

test('section drops the title and keeps the rows under the heading', () => {
  const s = section('# shared\n\n| gate | result | detail |\n|---|---|---|\n| flash general | ✅ | 0 |\n');
  assert.ok(s.includes(HEADING));
  assert.ok(!/^# shared/m.test(s));
  assert.deepEqual(gates(s), [{ name: 'flash general', ok: true }]);
});

test('rows of the shared check join the build check.md; ⚠️ and ℹ️ rows stay report only', async () => {
  const { tree, dest } = setup();
  let called = null;
  const run = async (cmd, args, opts) => {
    called = { cmd, args, opts };
    const out = args[args.indexOf('--out') + 1];
    fs.writeFileSync(path.join(out, 'check.md'), '# check-shared\n\n| gate | result | detail |\n|---|---|---|\n' +
      '| flash general ≤ 3 per s | ❌ | 4.0 Hz |\n| flash red | ✅ | 0 |\n| includes a drop | ⚠️ | no __qa.forceDrop |\n| GPU method | ℹ️ | timer query |\n');
    return { code: 1, out: '', err: '' };
  };
  const r = await runShared({ run, tree, page: '13-flow-lab', dest });
  assert.equal(r.ok, true);
  assert.equal(called.cmd, 'node');
  assert.equal(called.opts.cwd, tree);
  assert.equal(called.args[called.args.indexOf('--page') + 1], '13-flow-lab.html');
  assert.equal(called.args[called.args.indexOf('--experiments') + 1], path.join(tree, 'experiments'));
  assert.ok(!called.args.includes('--query'));
  const md = fs.readFileSync(path.join(dest, 'check.md'), 'utf8');
  assert.deepEqual(gates(md), [
    { name: 'fps p05 ≥ 55', ok: true },
    { name: 'flash general ≤ 3 per s', ok: false },
    { name: 'flash red', ok: true },
  ]);
});

test('a host page query is passed through', async () => {
  const { tree, dest } = setup();
  let args = null;
  const run = async (cmd, a) => { args = a; fs.writeFileSync(path.join(a[a.indexOf('--out') + 1], 'check.md'), '| x | ✅ | y |\n'); return { code: 0, out: '', err: '' }; };
  await runShared({ run, tree, page: '30-host', dest, query: 'w=2560&h=1440&dpr=1' });
  assert.equal(args[args.indexOf('--query') + 1], 'w=2560&h=1440&dpr=1');
});

test('no check.md from the shared check is a failed gate', async () => {
  const { tree, dest } = setup();
  const r = await runShared({ run: async () => ({ code: 2, out: '', err: 'Error: boom' }), tree, page: '13-flow-lab', dest });
  assert.equal(r.ok, false);
  const g = gates(fs.readFileSync(path.join(dest, 'check.md'), 'utf8'));
  assert.equal(g.at(-1).ok, false);
  assert.match(g.at(-1).name, /shared check ran/);
});

test('without the script on the checks ref: an ℹ️ row, no gate, nothing run', async () => {
  const { tree, dest } = setup({ script: false });
  let ran = false;
  const r = await runShared({ run: async () => { ran = true; return { code: 0 }; }, tree, page: '13-flow-lab', dest });
  assert.equal(ran, false);
  assert.equal(r.ran, false);
  const md = fs.readFileSync(path.join(dest, 'check.md'), 'utf8');
  assert.ok(md.includes('ℹ️'));
  assert.equal(gates(md).length, 1);   // only the page's own gate
});
