"""beatd: beat sources on the show Mac, reported to the beat relay (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 2).

  python3 -m beatd [--relay ws://127.0.0.1:8790/relay?v=1] [--source fake:120] [--source fake:126@fake-b]
                   [--in <part of the input's name>] [--seconds N] [--print]

Start it with tools/start-beatd.sh. Sources: kind[:arg][@id]; only the fake metronome exists so far (the trackers come
after the comparison of task 1). --print writes each message as one JSON line (with no --relay: print only).
--in names the audio input for the audio trackers (like the pages' ?in=); the fake needs none.
"""
import argparse
import json
import sys

from . import core, sources
from .relay import Link


def main(argv=None):
    ap = argparse.ArgumentParser(prog='beatd', description='beat sources to the beat relay')
    ap.add_argument('--relay', default=None, help='ws://host:port/relay?v=1 (conduct-serve through the tunnel: ws://127.0.0.1:8790/relay?v=1)')
    ap.add_argument('--source', action='append', default=[], help='kind[:arg][@id], e.g. fake:128 (repeat for more)')
    ap.add_argument('--in', dest='input', default=None, help='part of the audio input name (audio trackers only)')
    ap.add_argument('--rate', type=float, default=core.RATE_HZ, help=f'messages per second per source (at most {core.RATE_HZ})')
    ap.add_argument('--seconds', type=float, default=None, help='stop after this long (tests)')
    ap.add_argument('--print', dest='echo', action='store_true', help='also write each message as a JSON line')
    a = ap.parse_args(argv)
    try:
        srcs = [sources.make(s) for s in (a.source or ['fake:120'])]
    except ValueError as e:
        ap.error(str(e))
    ids = [s.id for s in srcs]
    if len(set(ids)) != len(ids):
        ap.error(f'two sources with one id: {ids} (give one an @id)')
    if any(getattr(s, 'needs_audio', False) for s in srcs) and not a.input:
        ap.error('an audio source needs --in <part of the input name>')
    if not a.relay and not a.echo:
        ap.error('nothing to do: give --relay, --print or both')

    link = Link(a.relay, log=lambda m: print(m, file=sys.stderr, flush=True)) if a.relay else None

    def send(m):
        if a.echo:
            print(json.dumps(m, separators=(',', ':')), flush=True)
        return link.send(m) if link else True

    print(f'beatd: sources {", ".join(f"{s.id} ({s.kind})" for s in srcs)}; relay {a.relay or "none"}; '
          f'{min(a.rate, core.RATE_HZ):g} a second each', file=sys.stderr, flush=True)
    try:
        n = core.run(srcs, send, rate_hz=a.rate, seconds=a.seconds, ensure=link.ensure if link else None)
    except KeyboardInterrupt:
        n = None
    finally:
        if link:
            link.close()
    print(f'beatd: stopped{"" if n is None else f" ({n} messages)"}', file=sys.stderr, flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
