// Unit tests for qa/runner/procs.mjs (GPU holders, leftover processes). Linux /proc only.
//   node --test qa/runner/test/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { proc, gpuHolders, fmtHolders, orphans, killOrphans, DRI_RE } from '../procs.mjs';

const linux = fs.existsSync('/proc/self/stat');
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('proc() reads this process', { skip: !linux }, () => {
  const p = proc(process.pid);
  assert.equal(p.pid, process.pid);
  assert.equal(p.ppid, process.ppid);
  assert.ok(p.cmd.includes('node'));
  assert.ok(p.startS > 0);
});

test('gpuHolders() is a list; empty prints "none in the container"', { skip: !linux }, () => {
  assert.ok(Array.isArray(gpuHolders()));
  assert.equal(fmtHolders([]), 'none in the container');
  assert.ok(DRI_RE.test('/dev/dri/renderD128') && DRI_RE.test('/dev/dri/card0') && !DRI_RE.test('/dev/null'));
});

test('orphans() never lists this process or processes with a live parent', { skip: !linux }, async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)', '/x/qa/check-livechild.mjs'], { stdio: 'ignore' });
  await sleep(200);
  const o = orphans();
  assert.ok(!o.some(p => p.pid === process.pid));
  assert.ok(!o.some(p => p.pid === child.pid));   // its parent (this test) is alive
  child.kill('SIGKILL');
});

test('a check script whose parent is gone is found and killed', { skip: !linux }, async t => {
  // sh starts it in the background and exits at once, so it is re-parented (to PID 1 or a subreaper)
  const sh = spawn('sh', ['-c', `"${process.execPath}" -e "setTimeout(() => {}, 20000)" /x/qa/check-orphan-test.mjs & echo $!`], { stdio: ['ignore', 'pipe', 'ignore'] });
  let out = ''; sh.stdout.on('data', d => { out += d; });
  await new Promise(r => sh.on('close', r));
  const pid = parseInt(out, 10);
  await sleep(200);
  const p = proc(pid);
  if (!p) return t.skip('the background process did not start');
  if (p.ppid > 1 && proc(p.ppid)) { try { process.kill(pid, 'SIGKILL'); } catch {} return t.skip(`re-parented to a live subreaper (${p.ppid})`); }
  const only = { match: o => o.pid === pid };   // never touch anything else on the box
  assert.ok(orphans(only).some(o => o.pid === pid));
  const lines = [];
  const killed = killOrphans(l => lines.push(l), only);
  assert.ok(killed.some(o => o.pid === pid));
  assert.match(lines.join('\n'), /leftover/);
  await sleep(200);
  assert.ok(!proc(pid) || /^Z/.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1] || ''));
});
