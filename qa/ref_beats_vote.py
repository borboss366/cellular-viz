#!/usr/bin/env python3
"""Reference beats by a vote of three trackers (#188, the user 10 Nov 17:27, VIZ research's ruling): for tracks that
are hard FOR THE TRACKER (the batch hc-01..hc-12: odd meters, swing, unusual or slow tempos, maybe polyrhythm; the
user's correction 17:39, not the hardcore genre) where Beat This! alone gave 7/11 gridSuspect grids.

Run it through qa/ref-beats-vote.sh (the venv, the GPU lock, the grids). For each corpus track on the box (ids from
corpus-map.json beside the tracks folder; R9: ids only in every line it prints, never a file name):
  A  Beat This! frame logits (Audio2Frames, 50 fps) decoded by madmom's DBNBeatTrackingProcessor (min_bpm..max_bpm),
     the bar positions by DBNDownBeatTrackingProcessor(beats_per_bar=[2, 3, 4, 5, 6, 7]) on the same logits: the meter
     it picks is reported per track (the old grids' 3.49, 3.15, 2.46 beats a bar may be real odd meters)
  B  madmom RNNBeatProcessor + the same DBN (100 fps)
  C  essentia RhythmExtractor2013(method='multifeature', minTempo, maxTempo <= 250), with its confidence
The vote: two of three agree within 1 % after octave folding (x2, /2, x4, /4). The gate: all three agreeing within
1 % with no fold accepts at any essentia confidence (v3, the user 19:45); 2-of-3 AND essentia confidence >= 1.5
accepts; anything else is flagged for the user's ear. Each tracker's bpm is a fit over the whole beat list (bpm_of, v3),
not one frame-snapped interval. When the trackers agree only after an octave
fold, no prior picks the octave: both candidates are reported and the track is flagged, unless essentia's confidence
is >= 3.5. The tempo range is wide (60-260: 87.7 and 91.06 may be true tempos here); a corpus row may set refMinBpm /
refMaxBpm, used only when the wide vote does not agree. Each line also carries the tempo curve over 8-bar windows
(p5 / p50 / p95), so a swung or drifting track shows as one, not as a single forced bpm.

Outputs, next to the track (beat times only; the audio is read in place, never copied):
  <stem>.vote.json   every track: each tracker's bpm, beats and seconds, agreement, confidence, accepted / flagged
  <stem>.vote.beats  every accepted track: time<TAB>beat-in-bar (the .ref.beats format), for comparison
  <stem>.ref.beats + <stem>.ref.json (tool 'vote')  ONLY for rows with refTool 'vote' in qa/corpus.json and only when
     accepted; ref_beats.py leaves such tracks alone. The other rows' .ref.* (the 22 tracks before the batch) are never
     touched: their vote is a report next to their existing grid.

  --selftest   the vote and folding rules on fixed numbers (no audio, no torch): what the node test runs
  --trackers 2 DEGRADED (ref-beats-vote.sh passes it when madmom does not import): A and B both need madmom (its DBN),
     so they are off; A0 beat-this-minimal (Beat This!'s own peak picking: no DBN, no tempo range, its downbeats give
     the meter) and C essentia vote, and both must agree. Every .vote.json and line says so; no .ref.beats is written.
"""
import argparse
import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
WIDE = (60.0, 260.0)           # the default range (the user 17:39: slow and unusual tempos are real here)
ESSENTIA_MAX = 250.0           # RhythmExtractor2013's maxTempo limit
AGREE = 0.01                   # 1 %
CONF_MIN = 1.5                 # essentia confidence for an accepted grid
CONF_OCTAVE = 3.5              # ... and for one whose agreement needed an octave fold (else: flagged, both candidates)
METERS = [2, 3, 4, 5, 6, 7]    # beats a bar the downbeat DBN may choose
WIN_BARS = 8                   # the tempo curve's window
FPS_BT, FPS_MM = 50, 100
TOOL_VERSION = 3   # 2: range 60-260, meters 2-7, octave candidates, tempo curve (the user 17:39)
                   # 3: sub-frame bpm_of (index fit, not the frame-snapped median interval); 3 of 3 with no fold
                   #    accepts at any essentia confidence (the user's go 19:45). v2 .vote.json files are redone.
NO_ROW = {}
SETS = {3: 'A+B+C', 2: 'A0+C (degraded: no madmom)'}
NAMES = {'A': 'beat-this+dbn', 'A0': 'beat-this-minimal', 'B': 'madmom-rnn+dbn', 'C': 'essentia-multifeature'}


# ---------------------------------------------------------------- the rules (pure, tested by --selftest)
def fold(a, b):
    """the octave factor (a power of two, x4 at most) that brings b nearest to a, and the error after it"""
    if not (a and b and a > 0 and b > 0):
        return None, None
    k = 2.0 ** max(-2, min(2, round(math.log2(a / b))))
    return k, abs(a / (b * k) - 1)


def vote(bpms):
    """bpms: {'A': x, 'B': y, 'C': z} (None when a tracker failed) -> the agreeing pairs and the pick.
    The pick prefers A (Beat This!), then B, then C, among the trackers in an agreeing pair."""
    names = [n for n in ('A', 'B', 'C') if bpms.get(n)]
    pairs = []
    for i, p in enumerate(names):
        for q in names[i + 1:]:
            k, err = fold(bpms[p], bpms[q])
            if err is not None and err <= AGREE:
                pairs.append({'pair': p + q, 'fold': k, 'errPct': round(100 * err, 3)})
    agreeing = sorted({c for pr in pairs for c in pr['pair']})
    pick = next((n for n in ('A', 'B', 'C') if n in agreeing), None)
    octave_split = any(pr['fold'] != 1 for pr in pairs)   # some agreement needed an octave fold: worth an ear
    # the distinct octaves the agreeing trackers stand at (no prior chooses between them)
    cands = []
    for n in agreeing:
        if not any(abs(bpms[n] / c - 1) <= AGREE for c in cands):
            cands.append(round(bpms[n], 2))
    # all three present, every pair within 1 % and none needing a fold
    all_three = len(names) == 3 and len(pairs) == 3 and all(pr['fold'] == 1 for pr in pairs)
    return {'pairs': pairs, 'agree': len(agreeing) >= 2, 'agreeing': agreeing, 'pick': pick, 'octaveSplit': octave_split,
            'candidates': sorted(cands), 'allThree': all_three, 'trackers': len(names)}


def verdict(v, conf):
    """accepted when A, B and C all agree within 1 % with no octave fold (any essentia confidence), or when two agree
    AND essentia is confident (>= 1.5; >= 3.5 when the agreement needed an octave fold); the reason otherwise"""
    if not v['agree']:
        return False, 'no two trackers agree within 1 % (after octave folding)'
    if v.get('allThree'):
        return True, None
    if conf is None or conf < CONF_MIN:
        return False, f'essentia confidence {conf if conf is None else round(conf, 2)} < {CONF_MIN}'
    if v['octaveSplit'] and conf < CONF_OCTAVE:
        return False, f'octave ambiguous (candidates {" / ".join(str(c) for c in v["candidates"])}), essentia confidence {round(conf, 2)} < {CONF_OCTAVE}: for the ear'
    return True, None


EAR_RULE = 1   # the user-ear A+B rule (the user's go 14 Nov 13:18); a flagged user-ear row voted before it re-votes once


def user_ear_ab(row, bpms):
    """the user-ear rule: a row the user checked by ear (bpmSource 'user-ear', with refMinBpm / refMaxBpm) is accepted
    when trackers A and B agree within 1 % (no octave fold) and both lie inside the ear range, even when C is off or
    essentia's confidence is low (C stays in the json as a report). hc-03: A 160.37, B 160.11, C 161.89 at confidence
    1.195, range 153.6-166.4. A DEGRADED vote (no B) never qualifies."""
    row = row or NO_ROW
    lo, hi, a, b = row.get('refMinBpm'), row.get('refMaxBpm'), bpms.get('A'), bpms.get('B')
    if row.get('bpmSource') != 'user-ear' or not (lo and hi and a and b):
        return False
    return abs(a / b - 1) <= AGREE and float(lo) <= a <= float(hi) and float(lo) <= b <= float(hi)


def accept_reason(v, conf):
    """why an accepted vote was accepted, for .vote.json and the line"""
    n, of = len(v['agreeing']), v.get('trackers', 3)
    if v.get('allThree'):
        return f'3 of 3, no fold (essentia confidence {conf if conf is None else round(conf, 2)})'
    if v['octaveSplit']:
        return f'{n} of {of} after an octave fold, essentia confidence {round(conf, 2)} >= {CONF_OCTAVE}'
    return f'{n} of {of}, no fold, essentia confidence {round(conf, 2)} >= {CONF_MIN}'


def tempo_curve(beats, meter=4, bars=WIN_BARS):
    """the tempo over windows of `bars` bars (meter beats each), half overlapping -> p5 / p50 / p95 and the spread in %"""
    n = max(4, int(meter or 4) * bars)
    if beats is None or len(beats) < n + 1:
        return None
    vals = []
    for i in range(0, len(beats) - n, max(1, n // 2)):
        dt = beats[i + n] - beats[i]
        if dt > 0:
            vals.append(60.0 * n / dt)
    if not vals:
        return None
    vals.sort()
    q = lambda p: vals[min(len(vals) - 1, int(round(p * (len(vals) - 1))))]
    p5, p50, p95 = q(0.05), q(0.5), q(0.95)
    return {'p5': round(p5, 2), 'p50': round(p50, 2), 'p95': round(p95, 2), 'spreadPct': round(100 * (p95 - p5) / p50, 2), 'windows': len(vals), 'beatsPerWindow': n}


def meter_of(rows):
    """the downbeat DBN's (time, beat-in-bar) rows -> the most common bar length and how often each length came"""
    counts, last = {}, None
    for _, p in rows:
        p = int(p)
        if p == 1 and last:
            counts[last] = counts.get(last, 0) + 1
        last = p
    if not counts:
        return None, {}
    return max(counts, key=lambda k: (counts[k], -abs(k - 4))), {str(k): v for k, v in sorted(counts.items())}


def _line(xs, ys):
    """least squares y = c + s x -> (s, c), or (None, None)"""
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    if sxx <= 0:
        return None, None
    s = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sxx
    return s, my - s * mx


def bpm_of(beats):
    """the tempo of a beat list below the frame grid (v3). The DBN beats sit on frames (50 or 100 fps), so one median
    interval moves in 2-4 % steps at 120-190 bpm. Instead: each beat gets its place in the beat count from the median
    interval (a gap of about 2 periods is a missed beat and counts 2; a gap that rounds to 0 is an extra beat, skipped),
    then a least-squares line of time against that index over the whole track, refit without beats more than a quarter
    period off it. The count is redone with the fitted period (so a long gap is counted right even though the median
    interval is a frame off), then refit. Frame errors average out over hundreds of beats; a few missed or extra
    beats change nothing. Rounded to 2 decimals."""
    if beats is None or len(beats) < 8:
        return None
    ivs = sorted(b - a for a, b in zip(beats[:-1], beats[1:]) if b > a)
    med = ivs[len(ivs) // 2] if ivs else 0
    if med <= 0:
        return None

    def count(period):
        xs, ys, k, last = [0], [float(beats[0])], 0, float(beats[0])
        for t in beats[1:]:
            n = int(round((float(t) - last) / period))
            if n <= 0:
                continue                   # an extra beat (or a duplicate): the count does not move
            k += n
            last = float(t)
            xs.append(k)
            ys.append(last)
        return xs, ys

    xs, ys = count(med)
    if len(xs) < 8:
        return None
    s, c = _line(xs, ys)
    if not s or s <= 0:
        return None
    xs, ys = count(s)                      # the count again with the fitted (sub-frame) period
    s, c = _line(xs, ys)
    if not s or s <= 0:
        return None
    keep = [(x, y) for x, y in zip(xs, ys) if abs(y - (c + s * x)) <= s / 4]
    if len(keep) >= max(8, len(xs) // 2):
        s2, _ = _line([x for x, _ in keep], [y for _, y in keep])
        if s2 and s2 > 0:
            s = s2
    return round(60.0 / s, 2)


def positions(beats, downbeats, tol=0.05):
    """beat-in-bar for each beat: 1 at a beat within tol s of a downbeat, then counting on (irregular bars kept)"""
    out, pos, j = [], 0, 0
    for t in beats:
        while j < len(downbeats) and downbeats[j] < t - tol:
            j += 1
        if j < len(downbeats) and abs(downbeats[j] - t) <= tol:
            pos = 1
        else:
            pos = pos + 1 if pos else 1
        out.append(pos)
    return out


def snapped(bpm, n=400, fps=50, start=0.37, missed=(17, 18, 90, 201, 333), extra=(50, 260)):
    """a test beat list: bpm, every beat snapped to a frame of 1/fps s like the DBN's, some beats missed, some extra
    beats 0.3 of a period after a real one"""
    p, out = 60.0 / bpm, []
    q = lambda t: round(t * fps) / fps
    for i in range(n):
        if i not in missed:
            out.append(q(start + i * p))
        if i in extra:
            out.append(q(start + (i + 0.3) * p))
    return out


def selftest():
    cases = []
    # a fast track: Beat This! and madmom at 200, essentia at 100 (folded x2): all three agree
    v = vote({'A': 200.0, 'B': 199.6, 'C': 100.1}); cases.append(('octave fold', v['agree'] and v['pick'] == 'A' and v['octaveSplit'] is True and len(v['pairs']) == 3))
    v = vote({'A': 200.0, 'B': 199.6, 'C': 200.3}); cases.append(('same octave', v['agree'] and v['octaveSplit'] is False))
    # 87.7 (the half DBN range let in) vs 175.5: folds
    v = vote({'A': 87.7, 'B': 175.5, 'C': None}); cases.append(('half folds', v['agree'] and v['pick'] == 'A' and v['octaveSplit'] is True))
    # 1.2 % apart: no agreement
    v = vote({'A': 200.0, 'B': 202.4, 'C': 150.0}); cases.append(('1.2 % is out', not v['agree']))
    # only B and C agree: B is the pick
    v = vote({'A': 133.0, 'B': 180.0, 'C': 180.9}); cases.append(('B and C', v['agree'] and v['pick'] == 'B' and v['pairs'][0]['pair'] == 'BC'))
    # 4:3 is not an octave: no agreement
    v = vote({'A': 136.0, 'B': 181.3, 'C': None}); cases.append(('4:3 is not folded', not v['agree']))
    ok, why = verdict(vote({'A': 200.0, 'B': 200.5, 'C': 150.0}), 1.2); cases.append(('low confidence flags', not ok and 'confidence' in why))
    # agreement only after a fold: both candidates, flagged unless essentia is very confident
    v = vote({'A': 87.7, 'B': 175.5, 'C': None}); ok, why = verdict(v, 2.4)
    cases.append(('octave fold flags for the ear', not ok and 'octave ambiguous' in why and v['candidates'] == [87.7, 175.5]))
    ok, why = verdict(v, 3.6); cases.append(('octave fold accepted at conf 3.6', ok))
    tc = tempo_curve([i * 0.5 for i in range(200)], 4); cases.append(('tempo curve steady', tc['p50'] == 120.0 and tc['spreadPct'] == 0.0))
    swing = [0.0]
    for i in range(199):
        swing.append(swing[-1] + (0.5 if i < 100 else 0.45))
    tc = tempo_curve(swing, 4); cases.append(('tempo curve shows a change', tc['p5'] < 121 and tc['p95'] > 132))
    cases.append(('meter 7', meter_of([(i, (i % 7) + 1) for i in range(70)])[0] == 7))
    cases.append(('meter 3', meter_of([(i, (i % 3) + 1) for i in range(30)])[0] == 3))
    ok, why = verdict(vote({'A': 200.0, 'B': 200.5, 'C': 200.2}), 3.1); cases.append(('accepted', ok and why is None))
    cases.append(('bpm_of', bpm_of([i * 0.3 for i in range(20)]) == 200.0))
    # v3 (the user's go 19:45): the sub-frame tempo, and 3 of 3 with no fold accepts at any confidence
    cases.append(('bpm_of 122.9 on 50 fps frames, missed + extra beats, within 0.3 %', abs(bpm_of(snapped(122.9)) / 122.9 - 1) <= 0.003))
    cases.append(('bpm_of 189.7 on 50 fps frames, missed + extra beats, within 0.3 %', abs(bpm_of(snapped(189.7)) / 189.7 - 1) <= 0.003))
    cases.append(('bpm_of 122.9 on 100 fps frames', abs(bpm_of(snapped(122.9, fps=100)) / 122.9 - 1) <= 0.003))
    v = vote({'A': 122.88, 'B': 122.95, 'C': 122.9}); ok, why = verdict(v, 0.7)
    cases.append(('3 of 3, no fold, conf 0.7: accepted', ok and v['allThree'] and accept_reason(v, 0.7).startswith('3 of 3, no fold')))
    v = vote({'A': 189.7, 'B': 189.5, 'C': 94.9}); ok, why = verdict(v, 1.5)
    cases.append(('3 agree with an octave fold, conf 1.5: flagged', not ok and not v['allThree'] and 'octave ambiguous' in why))
    v = vote({'A': 122.9, 'B': 122.8, 'C': 140.0}); ok, why = verdict(v, 1.4)
    cases.append(('only 2 agree, conf 1.4: flagged', not ok and not v['allThree'] and 'confidence' in why))
    v = vote({'A': 136.0, 'B': 181.3, 'C': 136.2}); ok, why = verdict(v, 0.7)
    cases.append(('4:3 never counts toward 3 of 3', not ok and not v['allThree']))
    v = vote({'A': 122.9, 'B': None, 'C': 122.9}); cases.append(('DEGRADED (2 trackers) is never 3 of 3', not v['allThree'] and not verdict(v, 0.7)[0]))
    cases.append(('tool version 3', TOOL_VERSION == 3))
    cases.append(('positions', positions([0, .3, .6, .9, 1.2, 1.5], [0, 1.2]) == [1, 2, 3, 4, 1, 2]))
    cases.append(('wide range', WIDE == (60.0, 260.0) and ESSENTIA_MAX == 250.0 and METERS == [2, 3, 4, 5, 6, 7]))
    # the user-ear A+B rule (the user's go 14 Nov 13:18)
    ear = {'bpmSource': 'user-ear', 'refMinBpm': 153.6, 'refMaxBpm': 166.4}
    h3 = {'A': 160.37, 'B': 160.11, 'C': 161.89}
    cases.append(('user-ear AB: hc-03 is flagged by the vote (confidence 1.195) and accepted by the rule',
                  not verdict(vote(h3), 1.195)[0] and user_ear_ab(ear, h3)))
    cases.append(('user-ear AB: A and B more than 1 % apart refused', not user_ear_ab(ear, {'A': 160.37, 'B': 157.0, 'C': 161.89})))
    cases.append(('user-ear AB: A or B outside the ear range refused', not user_ear_ab(ear, {'A': 166.9, 'B': 166.2, 'C': 161.89})
                  and not user_ear_ab(ear, {'A': 153.5, 'B': 154.0, 'C': None})))
    cases.append(('user-ear AB: a non-user-ear row refused', not user_ear_ab({**ear, 'bpmSource': 'user'}, h3) and not user_ear_ab({}, h3)))
    cases.append(('user-ear AB: DEGRADED (no B) refused', not user_ear_ab(ear, {'A': 160.37, 'B': None, 'C': 161.89})))
    # the per-row plan (14 Nov ear checks): an ear-checked row decodes in its narrow range from the start, a meter row
    # fixes the downbeat DBN, any other row is as before (wide, meters 2-7, no plan key so its .vote.json stays fresh)
    cases.append(('plain row: wide, meters 2-7, no key', row_plan({'bpm': 128, 'bpmSource': 'user'}) == (WIDE, 'wide', METERS, None)))
    cases.append(('a range without user-ear stays an override', row_plan({'bpmSource': 'user', 'refMinBpm': 100, 'refMaxBpm': 110})[1] == 'wide'))
    p = row_plan({'bpm': 160, 'bpmSource': 'user-ear', 'refMinBpm': 153.6, 'refMaxBpm': 166.4})
    cases.append(('user-ear: the narrow range first', p[0] == (153.6, 166.4) and p[1] == 'ear' and p[2] == METERS and p[3] == {'range': [153.6, 166.4], 'meter': None}))
    p = row_plan({'bpmSource': 'user-ear', 'meter': 5})
    cases.append(('meter 5: the downbeat DBN on 5 only', p[0] == WIDE and p[1] == 'wide' and p[2] == [5] and p[3] == {'range': None, 'meter': 5}))
    # tracker C's range (14 Nov: hc-03's 153.6-166.4 crashed essentia: maxTempo should be larger than minTempo + 20)
    cases.append(('C range: 12.8 wide -> 24 around the centre', range_c(153.6, 166.4) == (148.0, 172.0)))
    cases.append(('C range: valid essentia config', essentia_tempos(*range_c(153.6, 166.4)) == (148, 172)))
    cases.append(('C range: a wide range is untouched', range_c(*WIDE) == WIDE and essentia_tempos(*WIDE) == (60, 250)))
    cases.append(('C range: every ear range gives max > min + 20', all((lambda m: m[1] - m[0] > 20)(essentia_tempos(*range_c(b * 0.96, b * 1.04))) for b in (60, 90.91, 107.5, 160, 172, 189.1, 240, 255))))
    # degraded (no madmom): A0 sits in A's slot and B is None, so the two left must agree (2 of 2)
    v = vote({'A': 140.0, 'B': None, 'C': 140.6}); cases.append(('degraded: 2 of 2 agree', v['agree'] and v['pick'] == 'A' and v['pairs'][0]['pair'] == 'AC'))
    v = vote({'A': 140.0, 'B': None, 'C': 105.0}); cases.append(('degraded: 2 of 2 disagree flags', not v['agree'] and not verdict(v, 4.0)[0]))
    bad = [n for n, ok in cases if not ok]
    print(json.dumps({'selftest': 'ok' if not bad else 'FAIL', 'cases': len(cases), 'failed': bad}))
    return 1 if bad else 0


# ---------------------------------------------------------------- the trackers (heavy imports inside)
def madmom_error():
    """None when madmom (beats + downbeats) imports, else the short reason"""
    try:
        import madmom.features.beats, madmom.features.downbeats  # noqa: F401
        return None
    except Exception as e:
        return f'{type(e).__name__}: {str(e)[:160]}'


class Trackers:
    def __init__(self, model, n=3):
        import numpy as np
        import soxr
        from beat_this.inference import Audio2Frames
        import essentia.standard as es
        self.np, self.soxr, self.es, self.n = np, soxr, es, n
        t = time.time()
        self.a2f = Audio2Frames(checkpoint_path=model, device='cpu')
        if n == 3:
            from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
            from madmom.features.downbeats import DBNDownBeatTrackingProcessor
            self.DBN, self.DDBN = DBNBeatTrackingProcessor, DBNDownBeatTrackingProcessor
            self.rnn = RNNBeatProcessor()
        else:
            from beat_this.model.postprocessor import Postprocessor   # 'minimal' needs no madmom
            self.minimal = Postprocessor(type='minimal', fps=FPS_BT)
        self.loadS = round(time.time() - t, 1)

    def activations(self, mono, sr):
        """the expensive part, once per track: Beat This! logits (A) and madmom's RNN activation (B), 44.1 kHz audio (C)"""
        np = self.np
        t = time.time()
        bl, dl = self.a2f(mono, sr)
        sig = lambda x: 1.0 / (1.0 + np.exp(-x.cpu().numpy().astype(np.float64)))
        beat, down = sig(bl), sig(dl)
        tA = time.time() - t
        t = time.time()
        a44 = mono if sr == 44100 else self.soxr.resample(mono, sr, 44100).astype(np.float32)
        act = None
        if self.n == 3:
            from madmom.audio.signal import Signal
            act = self.rnn(Signal(a44, sample_rate=44100, num_channels=1))
        tB = time.time() - t
        return {'beat': beat, 'down': down, 'bl': bl, 'dl': dl, 'act': act, 'a44': np.ascontiguousarray(a44, dtype=np.float32), 'tA': tA, 'tB': tB}

    def decode(self, acts, lo, hi, meters=METERS):
        out = {}
        t = time.time()
        if self.n != 3:
            # DEGRADED: Beat This!'s own peak picking in A's slot (no range), no B
            a, d = self.minimal(acts['bl'], acts['dl'])
            a, downs = [float(x) for x in a], [float(x) for x in d]
            meter, bars = meter_of(list(zip(a, positions(a, downs))))
            out['A'] = {'beats': a, 'downbeats': downs, 'meter': meter, 'bars': bars, 'seconds': round(acts['tA'] + time.time() - t, 1)}
            out['B'] = None
        else:
            out.update(self._dbn(acts, lo, hi, t, meters))
        t = time.time()
        mn, mx = essentia_tempos(*range_c(lo, hi))   # C on its own range: at least C_MIN_WIDTH wide (TempoTapDegara)
        bpm, ticks, conf, _, _ = self.es.RhythmExtractor2013(method='multifeature', minTempo=mn, maxTempo=mx)(acts['a44'])
        out['C'] = {'beats': [float(x) for x in ticks], 'essentiaBpm': round(float(bpm), 3), 'confidence': round(float(conf), 3),
                    'seconds': round(time.time() - t, 1)}
        for k in ('A', 'B'):
            if out[k]:
                out[k]['bpm'] = bpm_of(out[k]['beats'])
        out['C']['bpm'] = round(out['C']['essentiaBpm'], 2) if out['C']['essentiaBpm'] else bpm_of(out['C']['beats'])
        return out

    def _dbn(self, acts, lo, hi, t, meters=METERS):
        np = self.np
        out = {}
        a = self.DBN(min_bpm=lo, max_bpm=hi, fps=FPS_BT)(acts['beat'])
        both = np.stack([np.clip(acts['beat'] - acts['down'], 0, 1), acts['down']], axis=1)
        d = self.DDBN(beats_per_bar=meters, min_bpm=lo, max_bpm=hi, fps=FPS_BT)(both)   # METERS unless the row has a meter
        downs = [float(r[0]) for r in d if int(r[1]) == 1]
        meter, bars = meter_of([(float(r[0]), int(r[1])) for r in d])
        out['A'] = {'beats': [float(x) for x in a], 'downbeats': downs, 'meter': meter, 'bars': bars,
                    'seconds': round(acts['tA'] + time.time() - t, 1)}
        t = time.time()
        b = self.DBN(min_bpm=lo, max_bpm=hi, fps=FPS_MM)(acts['act'])
        out['B'] = {'beats': [float(x) for x in b], 'seconds': round(acts['tB'] + time.time() - t, 1)}
        return out


C_MIN_WIDTH = 24.0   # essentia's TempoTapDegara needs maxTempo > minTempo + 20 (14 Nov: hc-03's 12.8-bpm range crashed C)


def range_c(lo, hi):
    """tracker C's range: a range narrower than C_MIN_WIDTH is widened for C only, symmetric around its centre, to
    exactly C_MIN_WIDTH (153.6-166.4 -> 148-172); A and B keep the narrow range"""
    lo, hi = float(lo), float(hi)
    if hi - lo < C_MIN_WIDTH:
        c = (lo + hi) / 2
        lo, hi = round(c - C_MIN_WIDTH / 2, 3), round(c + C_MIN_WIDTH / 2, 3)
    return lo, hi


def essentia_tempos(lo, hi):
    """RhythmExtractor2013's (minTempo, maxTempo): ints, 40 <= min <= 180, 60 <= max <= ESSENTIA_MAX, and always
    max > min + 20 (near the 250 cap the window slides down instead of shrinking)"""
    mn, mx = int(max(40, min(lo, 180))), int(min(ESSENTIA_MAX, max(hi, 60)))
    if mx - mn <= 20:
        mn = max(40, mx - int(C_MIN_WIDTH))
    return mn, mx


def row_plan(row):
    """the per-row vote settings -> (range, range name, meters, plan key).
    A row the user checked by ear (bpmSource 'user-ear') with refMinBpm / refMaxBpm decodes in that narrow range from
    the start ('ear'), so a wide-range agreement in the wrong octave cannot win; any other row starts wide and uses its
    range only on disagreement ('override', as before). A row with 'meter' gives the downbeat DBN that meter only
    (DEGRADED mode has no DBN and ignores it). The plan key is None for a row with neither, so its old .vote.json stays
    up to date; a changed key votes again."""
    row = row or NO_ROW
    lo, hi, m = row.get('refMinBpm'), row.get('refMaxBpm'), row.get('meter')
    ear = row.get('bpmSource') == 'user-ear' and bool(lo and hi)
    meters = [int(m)] if m else METERS
    key = {'range': [float(lo), float(hi)] if ear else None, 'meter': int(m) if m else None} if (ear or m) else None
    return ((float(lo), float(hi)) if ear else WIDE), ('ear' if ear else 'wide'), meters, key


def writes_ref(row, accepted, degraded):
    """a new <stem>.ref.beats only for a refTool 'vote' row (the hc batch), only when accepted, never from a DEGRADED
    (2-tracker) vote; every other row keeps its old reference (the vote is a report next to it)"""
    return bool(accepted) and not degraded and (row or {}).get('refTool') == 'vote' and not (row or {}).get('noRef')
    # noRef: a row the user heard has no single tempo (14 Nov: hc-05 drifts, hc-08 floats); the vote stays a report


def write_beats(path, beats, pos):
    with open(path + '.tmp', 'w') as f:
        for t, p in zip(beats, pos):
            f.write(f'{t:.3f}\t{p}\n')
    os.replace(path + '.tmp', path)


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--dir', help='the private tracks folder (QA_AUDIO_DIR)')
    ap.add_argument('--model', default='final0')
    ap.add_argument('--force', action='store_true', help='vote again on tracks whose .vote.json is up to date')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--trackers', type=int, choices=(2, 3), default=3, help='2: DEGRADED, no madmom (A0 + C)')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if not a.dir:
        ap.error('--dir is required')
    n_trk = a.trackers
    if n_trk == 3:
        err = madmom_error()
        if err:
            print(f'vote: madmom does not import ({err}): DEGRADED to 2 trackers')
            n_trk = 2
    tset = SETS[n_trk]
    degraded = None if n_trk == 3 else ('no madmom: A beat-this+dbn and B madmom-rnn+dbn are off; '
                                        'A0 beat-this-minimal (no DBN, no range) + C essentia must both agree; no .ref.beats')
    print(f'vote: trackers {tset}' + (f' | DEGRADED: {degraded}' if degraded else ''))

    from ref_beats import source_tracks, sha256, version
    with open(os.path.join(HERE, 'corpus.json')) as f:
        rows = {r['id']: r for r in json.load(f)}
    try:
        with open(os.path.join(os.path.dirname(os.path.abspath(a.dir)), 'corpus-map.json')) as f:
            id_of = {stem: i for i, stem in json.load(f)['tracks'].items()}
    except (OSError, ValueError, KeyError):
        print('vote: no corpus-map.json beside the tracks folder: nothing to do (ids only, R9)')
        return 1
    tracks = [(id_of[s], s, p) for s, p, _ in source_tracks(a.dir) if s in id_of]
    # the vote rows first (the hc batch), then the rest as a report
    tracks.sort(key=lambda x: (rows.get(x[0], NO_ROW).get('refTool') != 'vote', x[0]))
    n_vote = sum(1 for t in tracks if rows.get(t[0], NO_ROW).get('refTool') == 'vote')
    n_unmapped = len(source_tracks(a.dir)) - len(tracks)
    print(f'vote: {len(tracks)} corpus tracks ({n_vote} vote rows), {n_unmapped} source tracks not in the map (skipped)')

    import numpy as np
    import soundfile as sf
    trk, summary, failed = None, [], []
    for tid, stem, path in tracks:
        row = rows.get(tid, {})
        base = os.path.join(a.dir, stem)
        digest = sha256(path)
        if not a.force and os.path.isfile(base + '.vote.json'):
            try:
                old = json.load(open(base + '.vote.json'))
                if (old.get('sha256') == digest and old.get('toolVersion') == TOOL_VERSION and old.get('model') == a.model
                        and old.get('trackerSet', SETS[3]) == tset and old.get('plan') == row_plan(row)[3]
                        # a flagged user-ear row voted before the user-ear A+B rule votes again once; accepted rows stay
                        and (old.get('accepted') or (row or NO_ROW).get('bpmSource') != 'user-ear' or old.get('earRule') == EAR_RULE)):
                    print(f'vote: {tid} up to date ({"accepted" if old.get("accepted") else "flagged"}), skipped')
                    summary.append(old)
                    continue
            except (OSError, ValueError):
                pass
        try:
            sig, sr = sf.read(path, dtype='float32', always_2d=True)
        except Exception as e:
            print(f'vote: {tid} cannot be decoded ({type(e).__name__}), skipped')
            continue
        mono = np.ascontiguousarray(sig.mean(axis=1))
        if trk is None:
            trk = Trackers(a.model, n_trk)
            print(f'vote: models loaded in {trk.loadS} s')
        try:   # one track failing (a bad config, a decode error) must not stop the run
            acts = trk.activations(mono, sr)
            rng, rng_name, meters, plan = row_plan(row)
            res = trk.decode(acts, *rng, meters)
            bpms = {k: (res[k] or {}).get('bpm') for k in ('A', 'B', 'C')}
            v = vote(bpms)
            if not v['agree'] and rng_name == 'wide' and row.get('refMinBpm') and row.get('refMaxBpm'):   # the per-id range, only on disagreement
                rng, rng_name = (float(row['refMinBpm']), float(row['refMaxBpm'])), 'override'
                res = trk.decode(acts, *rng, meters)
                bpms = {k: (res[k] or {}).get('bpm') for k in ('A', 'B', 'C')}
                v = vote(bpms)
            conf = res['C']['confidence']
            ok, why = verdict(v, conf)
            pick = v['pick']
            accepted_by = 'vote' if ok else None
            if not ok and not degraded and user_ear_ab(row, bpms):   # the user-ear A+B rule; C is a report only
                ok, why, pick, accepted_by = True, None, 'A', 'user-ear-AB'
            grid_beats = res[pick]['beats'] if (ok and pick) else []
            pos = positions(grid_beats, res['A']['downbeats']) if grid_beats else []
            seconds = round(len(mono) / sr, 2)
            # the meter the downbeat DBN chose, and the tempo curve over 8-bar windows (of the grid, else of A's beats)
            meter = res['A'].get('meter')
            curve = tempo_curve(grid_beats or res['A']['beats'], meter or 4)
            meta = {
                'id': tid, 'toolVersion': TOOL_VERSION, 'model': a.model, 'sha256': digest, 'seconds': seconds,
                'trackerSet': tset, 'degraded': degraded,
                'range': {'name': rng_name, 'minBpm': rng[0], 'maxBpm': rng[1], 'essentiaMax': ESSENTIA_MAX},
                'rangeC': (lambda c, e: {'minBpm': c[0], 'maxBpm': c[1], 'essentiaMin': e[0], 'essentiaMaxTempo': e[1],
                                         'widened': c != (float(rng[0]), float(rng[1]))})(range_c(*rng), essentia_tempos(*range_c(*rng))),
                'plan': plan, 'meters': meters,
                'trackers': {
                    'A': {'name': NAMES['A' if n_trk == 3 else 'A0'], 'bpm': bpms['A'], 'beats': len(res['A']['beats']), 'downbeats': len(res['A']['downbeats']), 'seconds': res['A']['seconds']},
                    'B': ({'name': NAMES['B'], 'bpm': bpms['B'], 'beats': len(res['B']['beats']), 'seconds': res['B']['seconds']} if res['B']
                          else {'name': NAMES['B'], 'off': 'madmom does not import', 'bpm': None, 'seconds': None}),
                    'C': {'name': 'essentia-multifeature', 'bpm': bpms['C'], 'beats': len(res['C']['beats']), 'confidence': conf, 'seconds': res['C']['seconds']},
                },
                'meter': meter, 'barLengths': res['A'].get('bars'), 'tempoCurve': curve, 'candidates': v['candidates'],
                'vote': v, 'accepted': ok, 'acceptedBy': accepted_by, 'earRule': EAR_RULE,
                'accept': (f'user-ear: A {bpms["A"]} and B {bpms["B"]} within 1 % inside the ear range {row.get("refMinBpm")}-{row.get("refMaxBpm")}'
                           f' (C {bpms["C"]}, confidence {conf}: report only)') if accepted_by == 'user-ear-AB' else (accept_reason(v, conf) if ok else None),
                'flagged': None if ok else why,
                'pick': pick if ok else None,
                'bpm': bpms[pick] if (ok and pick) else None, 'corpusBpm': row.get('bpm'), 'refTool': row.get('refTool'),
                'versions': {k: version(k) for k in ('beat-this', 'madmom', 'madmom-prebuilt', 'essentia', 'torch', 'numpy')},
                'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
            }
            if ok:
                write_beats(base + '.vote.beats', grid_beats, pos)
                if writes_ref(row, ok, degraded):   # only the batch's rows, accepted, 3 trackers
                    write_beats(base + '.ref.beats', grid_beats, pos)
                    ref = {'track': os.path.basename(path), 'sha256': digest, 'tool': 'vote', 'model': a.model, 'pick': pick,
                           'beats': len(grid_beats), 'downbeats': sum(1 for p in pos if p == 1), 'medianBpm': bpms[pick],
                           'bpm': bpms[pick], 'toolVersion': TOOL_VERSION, 'accept': meta['accept'],
                           'seconds': seconds, 'vote': os.path.basename(base) + '.vote.json', 'created': meta['created']}
                    with open(base + '.ref.json.tmp', 'w') as f:
                        json.dump(ref, f, indent=1)
                    os.replace(base + '.ref.json.tmp', base + '.ref.json')
                    meta['wroteRef'] = True
            # the earlier rows: the vote next to their existing grid's fitted tempo (the grid itself is not touched)
            try:
                g = json.load(open(base + '.beatgrid.json'))
                fit = g.get('bpmFitCore') or g.get('bpmFit')
                meta['gridBpm'] = round(float(fit), 3) if fit else None
                meta['gridSuspect'] = g.get('gridSuspect')
                if fit and meta['bpm']:
                    k, err = fold(float(fit), meta['bpm'])
                    meta['vsGrid'] = {'fold': k, 'diffPct': round(100 * err, 3)}
            except (OSError, ValueError, TypeError):
                meta['gridBpm'] = None
            with open(base + '.vote.json.tmp', 'w') as f:
                json.dump(meta, f, indent=1)
            os.replace(base + '.vote.json.tmp', base + '.vote.json')
            summary.append(meta)
            T = meta['trackers']
            print(f'vote: {tid} {seconds:.0f} s | {"DEGRADED A0+C | " if degraded else ""}'
                  f'A {T["A"]["bpm"]} ({T["A"]["seconds"]} s) B {T["B"]["bpm"] if res["B"] else "off"} ({T["B"]["seconds"]} s) '
                  f'C {T["C"]["bpm"]} conf {conf} ({T["C"]["seconds"]} s) | agree {"+".join(p["pair"] for p in v["pairs"]) or "none"} '
                  f'{"(octave split: " + " / ".join(str(c) for c in v["candidates"]) + ") " if v["octaveSplit"] else ""}| range {rng_name} | '
                  f'meter {meter} {res["A"].get("bars")} | tempo 8-bar p5/p50/p95 '
                  f'{(str(curve["p5"]) + "/" + str(curve["p50"]) + "/" + str(curve["p95"]) + " spread " + str(curve["spreadPct"]) + " %") if curve else "-"} | '
                  f'{"ACCEPTED " + str(meta["bpm"]) + " [" + meta["accept"] + "]" + (" -> .ref.beats" if meta.get("wroteRef") else " (report)") if ok else "FLAGGED: " + why}'
                  f' | corpus {row.get("bpm")} | grid {meta.get("gridBpm")} (suspect {meta.get("gridSuspect")}) vs vote {meta.get("vsGrid")}')
        except Exception as err:
            failed.append(tid)
            msg = str(err).replace(a.dir, '<tracks>').replace(stem, tid)[:200]   # R9: ids only, never a file name
            print(f'vote: {tid} failed ({type(err).__name__}: {msg}), skipped')

    # the runtime of one ~5-minute track, three ways
    timed = [m for m in summary if m.get('trackers') and m.get('seconds')]
    if timed:
        m = min(timed, key=lambda x: abs(x['seconds'] - 300))
        T = m['trackers']
        print(f'vote: runtime on {m["id"]} ({m["seconds"]:.0f} s of audio): A {T["A"]["name"]} {T["A"]["seconds"]} s, '
              f'B madmom {T["B"]["seconds"] if T["B"].get("seconds") is not None else "off"} s, C essentia {T["C"]["seconds"]} s')
    acc = sum(1 for m in summary if m.get('accepted'))
    print(f'vote: {acc} accepted, {len(summary) - acc} flagged of {len(summary)} | trackers {tset}'
          + (f' | DEGRADED: {degraded}' if degraded else '') + (f' | {len(failed)} failed: {", ".join(failed)}' if failed else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
