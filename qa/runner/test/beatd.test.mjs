// beatd, the skeleton (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 2): the Python checks (python3 -m beatd.selftest),
// beatd against a real relay (the fake metronome's source messages reach another client, at most 20 a second, on wall
// time), and tools/start-beatd.sh. Python 3 is on the box; where there is none, the Python parts are skipped.
//   node --test qa/runner/test/beatd.test.mjs
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { connect } from '../../beat-relay.mjs';
import { testServer } from '../../relay-delay.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const hasPython = spawnSync('python3', ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)']).status === 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const kids = [];
after(() => { for (const k of kids) { try { k.kill('SIGKILL'); } catch {} } });

test('beatd selftest: the fake metronome, the message, 20 a second, the frames, the backoff (python3 -m beatd.selftest)', t => {
  if (!hasPython) { t.skip('no python3 here'); return; }
  const r = spawnSync('python3', ['-m', 'beatd.selftest'], { cwd: REPO, encoding: 'utf8', timeout: 30e3 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^beatd selftest: ok \(\d+ checks\)/m);
});

test('beatd -> the relay -> another page: source messages from two fake metronomes, on wall time, at most 20 a second each', { timeout: 30e3 }, async t => {
  if (!hasPython) { t.skip('no python3 here'); return; }
  const { server, relay } = testServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => { relay.close(); server.close(); });
  const url = `ws://127.0.0.1:${server.address().port}/relay?v=1`;
  const page = await connect(url);
  t.after(() => page.peer.destroy());
  await page.wait(m => m.type === 'hello');
  const got = [];
  page.on('msg', m => { if (m && m.type === 'source') got.push({ ...m, at: Date.now() }); });
  const kid = spawn('python3', ['-m', 'beatd', '--relay', url, '--source', 'fake:128', '--source', 'fake:90@slow', '--seconds', '2.5'], { cwd: REPO });
  kids.push(kid);
  let err = '';
  kid.stderr.on('data', d => { err += d; });
  const code = await new Promise(r => kid.on('exit', r));
  await sleep(200);
  assert.equal(code, 0, err);
  assert.match(err, /beatd: relay .*: connected/);
  const by = id => got.filter(m => m.id === id);
  for (const [id, bpm] of [['fake', 128], ['slow', 90]]) {
    const ms = by(id);
    assert.ok(ms.length >= 30 && ms.length <= 52, `${id}: ${ms.length} messages in 2.5 s (20 a second)`);
    for (const m of ms) {
      assert.deepEqual(Object.keys(m).filter(k => !['rt', 'seq', 'at'].includes(k)).sort(), ['beats', 'bpm', 'confidence', 'id', 'state', 't', 'type', 'v']);
      assert.equal(m.v, 1); assert.equal(m.bpm, bpm); assert.equal(m.state, 'locked');
      assert.ok(Math.abs(m.t - m.at) < 1000, `${id}: t on wall time (${m.at - m.t} ms)`);
    }
    for (let i = 1; i < ms.length; i++) {
      assert.ok(ms[i].t - ms[i - 1].t >= 45, `${id}: never faster than 20 a second (${ms[i].t - ms[i - 1].t} ms)`);
      const want = (ms[i].t - ms[i - 1].t) * bpm / 60000;
      assert.ok(Math.abs(ms[i].beats - ms[i - 1].beats - want) < 1e-3, `${id}: beats follow ${bpm} bpm`);
    }
  }
  assert.equal(relay.stats().rejected, 0, 'the relay took every message (type source, v 1)');
});

test('tools/start-beatd.sh: the tunnel relay and the fake by default, any beatd arguments passed on (sh -n, --dry-run)', () => {
  const sh = path.join(REPO, 'tools', 'start-beatd.sh');
  assert.equal(spawnSync('sh', ['-n', sh]).status, 0);
  const dry = (...a) => spawnSync('sh', [sh, '--dry-run', ...a], { encoding: 'utf8', env: { ...process.env, BEATD_RELAY: '' } }).stdout;
  assert.match(dry(), /python3 -m beatd --relay ws:\/\/127\.0\.0\.1:8790\/relay\?v=1 --source fake:120$/m);
  assert.match(dry('--source', 'fake:128'), /python3 -m beatd --relay ws:\/\/127\.0\.0\.1:8790\/relay\?v=1 --source fake:128$/m, 'no default source when one is given');
  assert.match(dry('--relay', 'ws://10.0.0.2:8790/relay?v=1'), /python3 -m beatd --relay ws:\/\/10\.0\.0\.2:8790\/relay\?v=1 --source fake:120$/m);
  const env = spawnSync('sh', [sh, '--dry-run'], { encoding: 'utf8', env: { ...process.env, BEATD_RELAY: 'ws://127.0.0.1:9999/relay?v=1' } }).stdout;
  assert.match(env, /--relay ws:\/\/127\.0\.0\.1:9999\/relay\?v=1/);
  // the protocol doc lists the source message now
  const doc = fs.readFileSync(path.join(REPO, 'docs', 'BEAT_RELAY_PROTOCOL.md'), 'utf8');
  assert.match(doc, /\| `source` \| beatd \(the Mac\) \|/);
});
