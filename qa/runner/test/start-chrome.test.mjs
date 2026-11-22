// tools/start-chrome.sh (the user, 22 Nov): `sh -n`, then --dry-run with a fake ps output (START_CHROME_PS): Chrome not
// running -> start with the flags; running with them -> nothing; running without -> refuse, unless --restart.
//   node --test qa/runner/test/start-chrome.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), REPO = path.join(here, '..', '..', '..');
const SCRIPT = path.join(REPO, 'tools', 'start-chrome.sh');
const MAIN = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HELPER = '/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer) --type=renderer';
const FLAGS = '--disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required';
const START = `> open -na Google Chrome --args ${FLAGS}`;

function run(psLines, args = []) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'start-chrome-'));
  const ps = path.join(d, 'ps');
  fs.writeFileSync(ps, ['/sbin/launchd', ...psLines, ''].join('\n'));
  try {
    return spawnSync('sh', [SCRIPT, '--dry-run', ...args], { encoding: 'utf8', env: { ...process.env, START_CHROME_PS: ps } });
  } finally { fs.rmSync(d, { recursive: true, force: true }); }
}

test('start-chrome.sh: the syntax', () => {
  assert.equal(spawnSync('sh', ['-n', SCRIPT]).status, 0);
});

test('start-chrome.sh: not running -> start with the flags (and the URLs)', () => {
  const r = run([]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), START);
  const u = run([], ['http://localhost:8790/experiments/clock-conductor.html']);
  assert.equal(u.stdout.trim(), `${START} http://localhost:8790/experiments/clock-conductor.html`);
});

test('start-chrome.sh: running with the flags -> nothing to do; a flag on a helper only does not count', () => {
  const r = run([`${MAIN} ${FLAGS}`, HELPER]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^OK: Chrome already runs with/);
  assert.doesNotMatch(r.stdout, /> open/);
  const helperOnly = run([MAIN, `${HELPER} ${FLAGS}`]);
  assert.equal(helperOnly.status, 1);
});

test('start-chrome.sh: running without the flags -> refuse; --restart quits, then starts', () => {
  for (const main of [MAIN, `${MAIN} --disable-backgrounding-occluded-windows`]) {
    const r = run([main, HELPER]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /--restart/);
    assert.doesNotMatch(r.stdout, /> /, 'nothing run');
  }
  const r = run([MAIN, HELPER], ['--restart']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(r.stdout.trim().split('\n'), ['> osascript -e quit app "Google Chrome"', START]);
});
