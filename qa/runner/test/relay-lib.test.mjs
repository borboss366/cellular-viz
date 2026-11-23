// The page side of the beat relay (experiments/relay-lib.js; docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 1 with VIZ
// research's notes 1-3): reconnect backoff with jitter, the min-RTT clock offset, commands applied once, the seq gate
// and the 2 s rule for a late clock. Plain functions, node only.
//   node --test qa/runner/test/relay-lib.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const EX = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../experiments');
const L = require(path.join(EX, 'relay-lib.js'));

test('relay-lib backoff: doubles from 250 ms to an 8 s cap, jitter between half and the whole of it', () => {
  assert.equal(L.backoffMs(0, () => 1), 250);
  assert.equal(L.backoffMs(0, () => 0), 125);
  assert.equal(L.backoffMs(1, () => 1), 500);
  assert.equal(L.backoffMs(3, () => 1), 2000);
  assert.equal(L.backoffMs(5, () => 1), 8000, 'capped');
  assert.equal(L.backoffMs(50, () => 1), 8000, 'still capped far out');
  assert.equal(L.backoffMs(50, () => 0), 4000, 'never below half the cap');
  for (let n = 0; n < 8; n++) {
    const v = L.backoffMs(n);
    const cap = Math.min(8000, 250 * 2 ** n);
    assert.ok(v >= cap / 2 && v <= cap, `attempt ${n}: ${v} in [${cap / 2}, ${cap}]`);
  }
  assert.equal(L.backoffMs(-3, () => 1), 250, 'a bad attempt counts as 0');
});

test('relay-lib offset: one sample is ts minus the midpoint; the smallest round trip wins over queued ones', () => {
  assert.deepEqual(L.offsetSample(100, 1150, 120), { rtt: 20, offset: 1040 });
  assert.equal(L.offsetSample(100, 5, 90), null, 'answered before it was asked: not a sample');
  assert.equal(L.offsetSample(100, NaN, 120), null);
  // the true offset is 1000 ms; each sample's way back is delayed by a queue of q ms
  const truth = 1000, out = 3;
  const mk = (t0, q) => L.offsetSample(t0, t0 + out + truth, t0 + out + out + q);
  const best = L.bestOffset([mk(0, 40), mk(100, 2), mk(200, 25), null, mk(300, 60)]);
  assert.equal(best.rtt, 8, 'the quiet sample');
  assert.ok(Math.abs(best.offset - truth) <= 1.5, `offset ${best.offset} near ${truth}`);
  assert.equal(best.n, 4);
  assert.equal(L.bestOffset([]), null);
});

test('relay-lib offsetTracker: a round of 5 asks at connect, none until 30 s later, unknown answers ignored, stale asks dropped', () => {
  const tr = L.offsetTracker();
  const asks = [];
  let t = 1000;
  for (let i = 0; i < 8; i++) { const a = tr.ask(t); if (a) asks.push(a); }
  assert.equal(asks.length, 5, 'five asks out, then it waits for answers');
  assert.ok(asks.every(a => a.type === 'time-ask' && a.v === 1 && a.t0 === 1000));
  assert.equal(tr.onTime({ type: 'time', id: 999, ts: 5 }, t + 10), null, 'an answer to nothing');
  asks.forEach((a, i) => tr.onTime({ type: 'time', v: 1, id: a.id, t0: a.t0, ts: a.t0 + 500 + 5 + i }, t + 10 + 2 * i));
  assert.ok(tr.estimate, 'an estimate after the round');
  assert.equal(tr.estimate.rtt, 10, 'the fastest answer');
  assert.equal(tr.estimate.offset, 500 + 5 - 5, 'its offset');
  assert.equal(tr.rounds, 1);
  t += 10;
  assert.equal(tr.ask(t + 1000), null, 'not due for 30 s');
  const again = tr.ask(t + 30000);
  assert.ok(again, 'a new round after 30 s');
  // an ask left unanswered past the timeout makes room for another
  const tr2 = L.offsetTracker({ samples: 2 });
  assert.ok(tr2.ask(0)); assert.ok(tr2.ask(0)); assert.equal(tr2.ask(10), null);
  assert.ok(tr2.ask(2500), 'the old asks timed out');
});

test('relay-lib onceFilter and seqGate: a command id applies once, other messages pass; an old seq is not fresh', () => {
  const f = L.onceFilter(3);
  assert.equal(f.first({ type: 'panic', id: 'a', mode: 'blackout' }), true);
  assert.equal(f.first({ type: 'panic', id: 'a', mode: 'blackout' }), false, 'the resend');
  assert.equal(f.first({ type: 'slot', id: 'a' }), true, 'ids count per type');
  assert.equal(f.first({ type: 'panic', mode: 'calm' }), true, 'no id: always (old senders)');
  assert.equal(f.first({ type: 'clock', id: 'a' }), true, 'not a command');
  f.first({ type: 'jump', id: 'j1' }); f.first({ type: 'jump', id: 'j2' }); f.first({ type: 'jump', id: 'j3' });
  assert.equal(f.size, 3, 'only the last 3 kept');
  assert.equal(f.first({ type: 'panic', id: 'a' }), true, 'forgotten after 3 newer');
  const g = L.seqGate();
  assert.equal(g.fresh({ type: 'clock', seq: 5 }), true);
  assert.equal(g.fresh({ type: 'clock', seq: 5, late: true }), false, 'the same state again');
  assert.equal(g.fresh({ type: 'clock', seq: 4 }), false);
  assert.equal(g.fresh({ type: 'knobs', seq: 1 }), true, 'per type');
  assert.equal(g.fresh({ type: 'clock' }), true, 'no seq (the channel): always');
  assert.equal(g.fresh({ type: 'clock', seq: 6 }), true);
  const mk = L.idMaker('cond');
  assert.deepEqual([mk(), mk()], ['cond-1', 'cond-2']);
});

test('relay-lib lateClockUsable: a live clock always, a late one only within 2 s of its own time', () => {
  assert.equal(L.lateClockUsable({ type: 'clock', t: 0 }, 1e9), true, 'live: the receiver handles it as today');
  assert.equal(L.lateClockUsable({ type: 'clock', t: 10000, late: true }, 11500), true);
  assert.equal(L.lateClockUsable({ type: 'clock', t: 10000, late: true }, 12001), false, 'older than 2 s: free-run, no jump');
  assert.equal(L.lateClockUsable({ type: 'knobs', late: true }, 0), false);
  assert.equal(L.STALE_MS, 2000);
});
