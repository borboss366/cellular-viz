#!/usr/bin/env python3
"""Reference beat grids for the clock's truth (b) (#95): Beat This! on the CPU for each private track.

Run it through qa/ref-beats.sh (the venv, the GPU lock and the checks live there). For each source track in the
folder (#188 PR1a: every audio file at the top of the folder that is not a render, by the rule in
qa/render-names.json, shared with qa/runner/audio.mjs): <stem>.ref.beats (time<TAB>beat-in-bar, 1 = downbeat) and
<stem>.ref.json (track sha256, model, versions, counts). A track whose .ref.json has the same sha256 and model is
skipped unless --force, so new uploads are the only ones run. Report-only reference: the gridder is compared against
it, it gates nothing. The audio is read in place and never copied.

  --list   print the source tracks it would take (stem<TAB>file), one a line, and exit: no torch, no model
"""
import argparse
import hashlib
import json
import os
import re
import sys
import time
from importlib import metadata

# the one source-vs-render rule, as qa/runner/audio.mjs reads it
with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'render-names.json')) as _f:
    RULE = json.load(_f)
EXTS = RULE['audioExts']   # also the order one stem's files are preferred in
RENDER_RES = [re.compile(p) for p in RULE['renderPatterns']]
LOSSY = {'.m4a', '.mp3'}


def is_render(name):
    return any(r.search(name) for r in RENDER_RES)


def is_source_track(name):
    ext = os.path.splitext(name)[1].lower()
    return not name.startswith('.') and ext in EXTS and len(name) > len(ext) and not is_render(name)


def source_tracks(folder):
    """[(stem, path, ext)] for every source track at the top of folder, sorted by stem; as sourceTracks() in audio.mjs"""
    try:
        files = [e.name for e in os.scandir(folder) if e.is_file()]
    except OSError:
        return []
    by = {}
    for f in files:
        if not is_source_track(f):
            continue
        ext = os.path.splitext(f)[1]
        stem, rank = f[:-len(ext)], EXTS.index(ext.lower())
        old = by.get(stem)
        if old is None or rank < old[2] or (rank == old[2] and f < old[0]):
            by[stem] = (f, ext.lower(), rank)
    return [(stem, os.path.join(folder, by[stem][0]), by[stem][1]) for stem in sorted(by)]


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def version(pkg):
    try:
        return metadata.version(pkg)
    except metadata.PackageNotFoundError:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--dir', required=True, help='the private tracks folder (QA_AUDIO_DIR)')
    ap.add_argument('--model', default='final0', help='Beat This! checkpoint (default final0)')
    ap.add_argument('--force', action='store_true', help='redo tracks whose reference is up to date')
    ap.add_argument('--list', action='store_true', help='print the source tracks (stem<TAB>file) and exit')
    a = ap.parse_args()

    tracks = source_tracks(a.dir)
    if a.list:
        for stem, path, _ in tracks:
            print(f'{stem}\t{os.path.basename(path)}')
        return 0
    print(f'{len(tracks)} source tracks in {a.dir}')

    import numpy as np
    import soundfile as sf
    import torch
    from beat_this.inference import Audio2Beats
    from beat_this.utils import save_beat_tsv

    torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))   # leave a core for the viewer
    a2b, done, failed = None, 0, 0
    for name, path, ext in tracks:
        out, meta_path = os.path.join(a.dir, name + '.ref.beats'), os.path.join(a.dir, name + '.ref.json')
        digest = sha256(path)
        if not a.force and os.path.isfile(out) and os.path.isfile(meta_path):
            try:
                old = json.load(open(meta_path))
                if old.get('sha256') == digest and old.get('model') == a.model:
                    print(f'{name}: up to date ({old.get("beats")} beats), skipped')
                    continue
            except (OSError, ValueError):
                pass
        try:
            sig, sr = sf.read(path, dtype='float32', always_2d=True)
        except Exception as e:   # libsndfile reads FLAC, WAV and MP3; not M4A
            print(f'{name}: cannot decode {os.path.basename(path)} ({e}); add a .flac or .wav of it', file=sys.stderr)
            failed += 1
            continue
        mono = np.ascontiguousarray(sig.mean(axis=1))
        if a2b is None:
            t = time.time()
            a2b = Audio2Beats(checkpoint_path=a.model, device='cpu', dbn=False)
            print(f'model {a.model} loaded in {time.time() - t:.1f} s (cached in {os.environ.get("TORCH_HOME", "~/.cache/torch")})')
        t = time.time()
        beats, downbeats = a2b(mono, sr)
        took = time.time() - t
        beats, downbeats = np.asarray(beats, dtype=float), np.asarray(downbeats, dtype=float)
        save_beat_tsv(beats, downbeats, out + '.tmp')
        os.replace(out + '.tmp', out)
        ibi = np.diff(beats)
        meta = {
            'track': os.path.basename(path), 'sha256': digest, 'sampleRate': sr, 'seconds': round(len(mono) / sr, 3),
            'lossy': ext in LOSSY,
            'note': 'times as decoded by libsndfile; for a lossy file the encoder delay is NOT removed here '
                    '(qa/runner/audio.mjs measures it), so compare with that offset' if ext in LOSSY else None,
            'model': a.model, 'dbn': False, 'device': 'cpu',
            'versions': {'beat-this': version('beat-this'), 'torch': torch.__version__, 'soundfile': version('soundfile'),
                         'python': sys.version.split()[0]},
            'beats': int(len(beats)), 'downbeats': int(len(downbeats)),
            'medianBpm': round(60 / float(np.median(ibi)), 2) if len(ibi) else None,
            'firstBeat': round(float(beats[0]), 4) if len(beats) else None,
            'seconds_to_run': round(took, 1), 'created': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        }
        with open(meta_path + '.tmp', 'w') as f:
            json.dump(meta, f, indent=1)
        os.replace(meta_path + '.tmp', meta_path)
        print(f'{name}: {meta["beats"]} beats, {meta["downbeats"]} downbeats, ~{meta["medianBpm"]} bpm, '
              f'{took:.0f} s → {os.path.basename(out)}')
        done += 1
    print(f'ref-beats: {done} written, {failed} failed')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
