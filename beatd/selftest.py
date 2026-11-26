"""beatd's Python checks, no network and no audio: python3 -m beatd.selftest (the node test runs it on the box).

  - the fake metronome: beats = elapsed * bpm / 60000 from its first reading, within 1e-6
  - the message: type source, v 1, the id, numbers, a known state; a bad reading raises
  - the loop: at most 20 a second per source on a fake clock, no burst after a stall
  - the frame: a masked client text frame decodes back to the payload (short, 16-bit and 64-bit lengths)
  - the backoff: 250 ms doubling to 8 s, jitter inside 75-100 %
Exit 0 and one line 'beatd selftest: ok (N checks)', else the first failure.
"""
import json
import struct
import sys

from . import core, sources
from .relay import backoff_s, frame

checks = 0


def ok(cond, what):
    global checks
    if not cond:
        print(f'beatd selftest: FAIL {what}')
        sys.exit(1)
    checks += 1


def unframe(data):
    b0, b1 = data[0], data[1]
    n, i = b1 & 0x7F, 2
    if n == 126:
        n, i = struct.unpack('!H', data[2:4])[0], 4
    elif n == 127:
        n, i = struct.unpack('!Q', data[2:10])[0], 10
    mask, i = data[i:i + 4], i + 4
    return b0, bool(b1 & 0x80), bytes(b ^ mask[k % 4] for k, b in enumerate(data[i:i + n]))


def main():
    f = sources.make('fake:128@fake-b')
    ok(f.id == 'fake-b' and f.bpm == 128.0, 'source spec kind:arg@id')
    r0, r1 = f.read(1000.0), f.read(1000.0 + 60000.0 / 128 * 4)
    ok(r0['beats'] == 0 and abs(r1['beats'] - 4) < 1e-6, f'fake: 4 beats in 4 periods ({r1["beats"]})')
    ok(r1['state'] == 'locked' and r1['confidence'] == 1.0 and r1['bpm'] == 128.0, 'fake: locked, confidence 1')
    m = core.message(f, r1)
    ok(m['type'] == 'source' and m['v'] == 1 and m['id'] == 'fake-b' and set(m) == {'type', 'v', 'id', 't', 'beats', 'bpm', 'confidence', 'state'},
       f'message shape {sorted(m)}')
    for bad in ({**r1, 'bpm': None}, {**r1, 'state': 'happy'}, {**r1, 'beats': float('nan')}):
        try:
            core.message(f, bad)
            ok(False, f'bad reading accepted: {bad}')
        except ValueError:
            ok(True, 'bad reading refused')
    for spec in ('nope:1', 'fake:999', 'fake:120@bad id'):
        try:
            sources.make(spec)
            ok(False, f'bad spec accepted: {spec}')
        except ValueError:
            ok(True, 'bad spec refused')

    # the loop on a fake clock: 2 sources, 1 s, 20 a second each; a 0.5 s stall does not burst
    t = {'now': 0.0}
    sent = []
    def clock():
        return t['now']
    def sleep(s):
        t['now'] += s
    def now():
        return 1e6 + t['now'] * 1000
    n = core.run([sources.make('fake:120'), sources.make('fake:90@slow')], lambda msg: sent.append(msg) or True,
                 seconds=1.0, now=now, clock=clock, sleep=sleep)
    per = {i: sum(1 for x in sent if x['id'] == i) for i in ('fake', 'slow')}
    ok(n == len(sent) and 19 <= per['fake'] <= 21 and 19 <= per['slow'] <= 21, f'20 a second each: {per}')
    ts = [x['t'] for x in sent if x['id'] == 'fake']
    ok(all(b - a >= 49.9 for a, b in zip(ts, ts[1:])), 'never faster than 20 a second')
    sent.clear()
    t['now'] = 0.0
    stalls = {'n': 0}
    def sleep_stall(s):
        t['now'] += s + (0.5 if stalls['n'] == 3 else 0.0)
        stalls['n'] += 1
    core.run([sources.make('fake:120')], lambda msg: sent.append(msg) or True, seconds=1.0, now=now, clock=clock, sleep=sleep_stall)
    ts = [x['t'] for x in sent]
    ok(all(b - a >= 49.9 for a, b in zip(ts, ts[1:])), 'no burst after a stall')

    # frames and backoff
    for size in (5, 300, 70000):
        payload = json.dumps({'type': 'source', 'pad': 'x' * size}).encode()
        b0, masked, back = unframe(frame(0x1, payload))
        ok(b0 == 0x81 and masked and back == payload, f'frame of {len(payload)} bytes')
    ok(abs(backoff_s(0, lambda: 1.0) - 0.25) < 1e-9 and abs(backoff_s(10, lambda: 1.0) - 8.0) < 1e-9, 'backoff 250 ms .. 8 s')
    ok(abs(backoff_s(2, lambda: 0.0) - 0.75) < 1e-9, 'jitter down to 75 %')
    print(f'beatd selftest: ok ({checks} checks)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
