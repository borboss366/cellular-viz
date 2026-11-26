"""beatd's loop: every source's state to the relay, at most RATE_HZ a second per source, on wall time.

  { type: 'source', v: 1, id, t, beats, bpm, confidence, state }   (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 2)

t is wall time in ms (time.time() * 1000: the same clock as the pages' performance.timeOrigin + performance.now() on
the same Mac). The relay passes it to every page; the conductor shows each source and steers from the one picked.
If beatd dies nothing else does: the pages, the conductor and our own tracker do not depend on it.
"""
import time

RATE_HZ = 20
RELAY_VERSION = 1
STATES = ('waiting', 'locked', 'free-run', 'lost')


def wall_ms():
    return time.time() * 1000.0


def message(source, state):
    """the relay message for one reading; checks its shape so a plug-in cannot send garbage"""
    m = {'type': 'source', 'v': RELAY_VERSION, 'id': source.id}
    for k in ('t', 'beats', 'bpm', 'confidence'):
        v = state.get(k)
        if not isinstance(v, (int, float)) or v != v:
            raise ValueError(f'{source.id}: {k} is not a number ({v!r})')
        m[k] = v
    if state.get('state') not in STATES:
        raise ValueError(f'{source.id}: state {state.get("state")!r} (one of {", ".join(STATES)})')
    m['state'] = state['state']
    return m


def run(sources, send, rate_hz=RATE_HZ, seconds=None, now=wall_ms, clock=time.monotonic, sleep=time.sleep, ensure=None):
    """read every source rate_hz times a second and send its message; -> messages sent. send(msg) -> bool;
    ensure() (optional) reconnects the link and is called once per tick; seconds: stop after that long"""
    period, sent = 1.0 / max(1, min(RATE_HZ, rate_hz)), 0
    start = next_tick = clock()
    for s in sources:
        s.start(None)
    while seconds is None or clock() - start < seconds:
        if ensure is not None:
            ensure()
        t = now()
        for s in sources:
            st = s.read(t)
            if st is not None and send(message(s, st)):
                sent += 1
        next_tick += period
        wait = next_tick - clock()
        if wait <= 0:   # behind (a stall): no burst to catch up, the next reading one period from now
            next_tick = clock() + period
            wait = period
        sleep(wait)
    return sent
