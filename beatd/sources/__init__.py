"""beatd's sources, one file per tracker, all with the same three calls (see fake.py). Only the fake exists so far;
the trackers (beatnet, madmom, aubio) and the non-audio sources (the DJ software helper, link players) come as more
files here, named by a short fixed id."""
from .fake import FakeMetronome

KINDS = {'fake': FakeMetronome}


def make(spec):
    """'fake:128' or 'fake:128@fake-b' -> a source. kind[:arg][@id]; the id is what the conductor shows and logs."""
    name, _, sid = spec.partition('@')
    kind, _, arg = name.partition(':')
    if kind not in KINDS:
        raise ValueError(f'unknown source {kind!r} (known: {", ".join(sorted(KINDS))})')
    sid = sid or kind
    if not sid.replace('-', '').isalnum() or len(sid) > 16:
        raise ValueError(f'source id {sid!r}: letters, digits and - only, at most 16')
    if kind == 'fake':
        return FakeMetronome(bpm=float(arg) if arg else 120.0, id=sid)
    return KINDS[kind](arg, id=sid)
