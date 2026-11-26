#!/usr/bin/env python3
"""beatd task 1: the reference for one recording, Beat This! offline (as qa/ref_beats.py does for the corpus).

Run it through qa/bakeoff.sh with the Beat This! venv of qa/ref-beats.sh. Writes <out>.beats (time<TAB>beat-in-bar,
1 = downbeat) and <out>.json (seconds, beats, model, versions; no names). The recording is read in place, never copied.

  python qa/bakeoff_ref.py --wav <recording.wav> --out <dir>/ref [--model final0]
"""
import argparse
import json
import os
import sys
import time
from importlib import metadata


def version(pkg):
    try:
        return metadata.version(pkg)
    except metadata.PackageNotFoundError:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--wav', required=True)
    ap.add_argument('--out', required=True, help='path without extension: writes <out>.beats and <out>.json')
    ap.add_argument('--model', default='final0')
    a = ap.parse_args()

    import numpy as np
    import soundfile as sf
    import torch
    from beat_this.inference import Audio2Beats
    from beat_this.utils import save_beat_tsv

    torch.set_num_threads(max(1, (os.cpu_count() or 2) - 1))
    sig, sr = sf.read(a.wav, dtype='float32', always_2d=True)
    mono = np.ascontiguousarray(sig.mean(axis=1))
    del sig
    t = time.time()
    beats, downbeats = Audio2Beats(checkpoint_path=a.model, device='cpu', dbn=False)(mono, sr)
    took = time.time() - t
    save_beat_tsv(np.asarray(beats, dtype=float), np.asarray(downbeats, dtype=float), a.out + '.beats.tmp')
    os.replace(a.out + '.beats.tmp', a.out + '.beats')
    meta = {'version': 1, 'seconds': round(len(mono) / sr, 3), 'sampleRate': sr, 'beats': int(len(beats)),
            'downbeats': int(len(downbeats)), 'model': a.model, 'dbn': False, 'device': 'cpu', 'tookS': round(took, 1),
            'versions': {'beat-this': version('beat-this'), 'torch': torch.__version__, 'soundfile': version('soundfile')}}
    with open(a.out + '.json', 'w') as f:
        json.dump(meta, f, indent=1)
        f.write('\n')
    print(f'reference: {len(beats)} beats over {len(mono) / sr:.0f} s in {took:.0f} s (Beat This! {a.model})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
