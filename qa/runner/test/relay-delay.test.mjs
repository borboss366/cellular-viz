// The relay delay report (qa/relay-delay.mjs, docs/BEAT_RELAY_DELAY.md; beat server brief task 6): the percentiles,
// a measurement on one machine (an in-process relay: the number the report's first row takes, printed on every run),
// and the separate test relay serving the browser measure page (experiments/relay-delay.html) at /.
//   node --test qa/runner/test/relay-delay.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as D from '../../relay-delay.mjs';
import * as R from '../../beat-relay.mjs';

test('relay delay: nearest-rank percentiles, lost probes, an empty run', () => {
  const s = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.deepEqual([D.percentile(s, 50), D.percentile(s, 90), D.percentile(s, 99), D.percentile(s, 100)], [50, 90, 99, 100]);
  assert.equal(D.percentile([], 50), null);
  assert.deepEqual(D.summary([3, 1, 2, NaN], 5), { sent: 5, got: 3, lost: 2, p50: 2, p90: 3, p99: 3, max: 3, mean: 2 });
  assert.deepEqual(D.summary([], 4), { sent: 4, got: 0, lost: 4, p50: null, p90: null, p99: null, max: null, mean: null });
});

test('relay delay on one machine: 300 probes through an in-process test relay, none lost; the test relay serves the measure page', async () => {
  const { server, relay } = D.testServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    const res = await D.measure(`ws://127.0.0.1:${port}${R.RELAY_PATH}?v=${R.RELAY_VERSION}`, { n: 300, rate: 100, bytes: 300 });
    console.log(`# relay delay one machine: ${res.got}/${res.sent} at ${res.rate}/s, p50 ${res.p50} ms, p90 ${res.p90} ms, p99 ${res.p99} ms, max ${res.max} ms`);
    assert.equal(res.lost, 0, 'no probe lost');
    assert.ok(res.p50 >= 0 && res.p99 >= res.p50, `p50 ${res.p50}, p99 ${res.p99}`);
    assert.ok(res.p99 < 250, `p99 ${res.p99} ms on loopback (a sanity bound, not the report)`);
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<title>relay delay<\/title>/);
    assert.match(html, /'delay-probe'/); assert.match(html, /'time-ask'/);
    assert.ok(/^[\x09\x0a\x0d\x20-\x7e]*$/.test(html), 'the page is plain ASCII (#205)');
    assert.equal((await fetch(`http://127.0.0.1:${port}/other`)).status, 404);
    const st = await (await fetch(`http://127.0.0.1:${port}/api/relay`)).json();
    assert.ok(st.in >= 300, `the test relay carried the probes (${st.in})`);
  } finally {
    relay.close();
    await new Promise(r => server.close(r));
  }
  // the box script starts this test relay, never conduct-serve; the doc's steps name both commands
  const sh = fs.readFileSync(path.join(D.REPO, 'qa', 'runner', 'relay-test.sh'), 'utf8');
  assert.match(sh, /qa\/relay-delay\.mjs" --serve --socket "\$SOCK"/);
  assert.doesNotMatch(sh, /node [^\n]*conduct-serve/, 'it never starts conduct-serve');
  const doc = fs.readFileSync(path.join(D.REPO, 'docs', 'BEAT_RELAY_DELAY.md'), 'utf8');
  assert.match(doc, /relay-test\.sh/); assert.match(doc, /ssh -N -L 8791:/);
});
