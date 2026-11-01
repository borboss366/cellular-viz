#!/usr/bin/env python3
"""Reference beat grids for the clock's truth (b) (#95): Beat This! on the CPU for each private track.

Run it through qa/ref-beats.sh (the venv, the GPU lock and the checks live there). For each fixed track name in the
folder: <name>.ref.beats (time<TAB>beat-in-bar, 1 = downbeat) and <name>.ref.json (track sha256, model, versions,
counts). A track whose .ref.json has the same sha256 and model is skipped unless --force. Report-only reference: the
gridder is compared against it, it gates nothing. The audio is read in place and never copied.
"""
import argparse
import hashlib
import json
import os
import sys
import time
from importlib import metadata

# the fixed names, as qa/runner/audio.mjs
TRACKS = ['darude-sandstorm', 'prodigy-voodoo-people', 'massive-attack-teardrop', 'james-brown']
EXTS = ['.flac', '.wav', '.m4a', '.mp3']   # the order a name is looked up in
LOSSY = {'.m4a', '.mp3'}


def find(folder, name):
    for ext in EXTS:
        p = os.path.join(folder, name + ext)
        if os.path.isfile(p):
            return p, ext
    return None, None


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
    a = ap.parse_args()

    import numpy as np
    import soundfile as sf
    import torch
    from beat_this.inference import Audio2Beats
    from beat_this.utils import save_beat_tsv

    torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))   # leave a core for the viewer
    a2b, done, failed = None, 0, 0
    for name in TRACKS:
        path, ext = find(a.dir, name)
        if not path:
            print(f'{name}: no file in {a.dir}, skipped')
            continue
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
