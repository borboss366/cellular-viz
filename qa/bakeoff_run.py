#!/usr/bin/env python3
"""beatd task 1: one live beat tracker over one recording, causally (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 1).

Run it through qa/bakeoff.sh: each tracker has its own venv there (qa/bakeoff/<id>.txt), installed within an hour or
dropped. Each tracker is used as its authors ship it, in its documented online / causal mode with its default
settings: no tuning to the recording, nothing patched.

  python qa/bakeoff_run.py --tracker aubio|madmom|beatnet --wav <recording.wav> --out <id>.json

Output JSON (no names, R9): { version, tracker, status: ok|failed, why?, seconds, sampleRate, rate, cpuS, wallS,
cpuPerAudioS, settings, versions, beats: [[t, at], ...] } where t is the beat's time in the recording (s) and at is how
much of the recording the tracker had read when it reported that beat (s), so at - (the true beat) is its delay.

The recording is the conductor's 16-bit WAV (qa/conduct-rec.mjs). It is read in place and never copied; it is mixed
to mono and, where a tracker needs another rate, resampled here (a windowed-sinc low-pass, then linear interpolation):
input preparation, the same for every tracker that needs that rate.
"""
import argparse
import json
import os
import sys
import time
import traceback
import wave
from importlib import metadata

import numpy as np

CHUNK = 1 << 20   # frames per read


def read_mono(path):
    """the WAV as mono float32 in [-1, 1) and its sample rate, read in chunks (a 38-minute stereo file is ~400 MB)"""
    with wave.open(path, 'rb') as w:
        ch, width, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        if width != 2:
            raise ValueError(f'{width * 8}-bit WAV: the conductor writes 16-bit PCM')
        out = np.empty(n, dtype=np.float32)
        done = 0
        while done < n:
            raw = w.readframes(min(CHUNK, n - done))
            if not raw:
                break
            x = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
            x = x.reshape(-1, ch).mean(axis=1) if ch > 1 else x
            out[done:done + len(x)] = x
            done += len(x)
    return out[:done], sr


def lowpass(x, cutoff, sr, taps=129):
    """windowed-sinc FIR low-pass (Hann), applied in overlapping chunks; zero phase (the delay is taken out)"""
    k = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cutoff / sr * k) * np.hanning(taps)
    h = (h / h.sum()).astype(np.float32)
    half, out = (taps - 1) // 2, np.empty_like(x)
    for a in range(0, len(x), CHUNK):
        b = min(len(x), a + CHUNK)
        seg = x[max(0, a - half):min(len(x), b + half)]
        y = np.convolve(seg, h, mode='same')
        off = a - max(0, a - half)
        out[a:b] = y[off:off + (b - a)]
    return out


def resample(x, sr, rate):
    """x at sr -> at rate: low-pass below the lower Nyquist (when going down), then linear interpolation, in chunks"""
    if rate == sr:
        return x
    if rate < sr:
        x = lowpass(x, 0.45 * rate, sr)
    n = int(len(x) * rate / sr)
    out, step = np.empty(n, dtype=np.float32), sr / rate
    for a in range(0, n, CHUNK):
        b = min(n, a + CHUNK)
        pos = np.arange(a, b, dtype=np.float64) * step
        lo, hi = int(pos[0]), min(len(x), int(pos[-1]) + 2)
        out[a:b] = np.interp(pos, np.arange(lo, hi, dtype=np.float64), x[lo:hi])
    return out


def version(pkg):
    try:
        return metadata.version(pkg)
    except metadata.PackageNotFoundError:
        return None


# ---------- the trackers: run(x at `rate`, rate, path) -> (beats [[t, at]], settings) ----------

def run_aubio(x, rate, path):
    """aubio's tempo tracker: the default method with the window / hop of the aubio command line (512 / 256); a beat
    is reported in the hop just read: t = get_last_s() (aubio places it, its own 4-hop look-back included), at = the
    end of that hop"""
    import aubio
    win, hop = 512, 256
    tr = aubio.tempo('default', win, hop, rate)
    beats = []
    for i in range(0, len(x) - hop + 1, hop):
        if tr(np.ascontiguousarray(x[i:i + hop], dtype=aubio.float_type))[0]:
            beats.append([float(tr.get_last_s()), (i + hop) / rate])
    return beats, {'method': 'default', 'win': win, 'hop': hop, 'rate': rate}


def run_madmom(x, rate, path):
    """madmom's online beat tracker as its DBNBeatTracker program runs it online: RNNBeatProcessor(online=True) with the
    one network the online mode uses (BEATS_LSTM[0]); the network is causal, so activations over the whole file equal
    streamed ones. They go to DBNBeatTrackingProcessor(online=True) one frame at a time (process_online, state kept from
    frame 0): at = i / fps is how far the tracker had read when it reported beat t"""
    from madmom.audio.signal import Signal
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
    from madmom.models import BEATS_LSTM
    fps = 100
    act = RNNBeatProcessor(online=True, nn_files=[BEATS_LSTM[0]], fps=fps)(Signal(x, sample_rate=rate, num_channels=1))
    dbn = DBNBeatTrackingProcessor(fps=fps, online=True)
    beats = []
    for i in range(len(act)):
        for t in np.atleast_1d(dbn.process_online(act[i:i + 1], reset=(i == 0))):
            beats.append([float(t), i / fps])
    return beats, {'rnn': 'RNNBeatProcessor(online=True, nn_files=[BEATS_LSTM[0]], fps=100)',
                   'dbn': 'DBNBeatTrackingProcessor(fps=100, online=True)', 'rate': rate}


def pyaudio_stub():
    """BeatNet imports pyaudio at module level, but only its 'stream' mode (the live microphone) uses it, and PyAudio
    has no Linux wheel: an empty module stands in for it. Nothing of BeatNet itself is changed."""
    import types
    try:
        import pyaudio  # noqa: F401
    except ImportError:
        sys.modules['pyaudio'] = types.ModuleType('pyaudio')


def run_beatnet(x, rate, path):
    """BeatNet in its realtime mode (model 1, particle filter), the loop of its own process() driven here frame by frame
    (20 ms hop, 50 fps): it reads the file itself (librosa, 22050 Hz). Frame c uses the audio up to c * hop + the 64 ms
    window; the particle filter reports a beat at c * 20 ms. So t = c * 0.02 and at = t + win / sr. Downbeats count
    as beats. (Its 'stream' mode has a documented 0.084 s window offset; realtime is the same network on a file.)"""
    pyaudio_stub()
    from BeatNet.BeatNet import BeatNet
    bn = BeatNet(1, mode='realtime', inference_model='PF', plot=[], thread=False)
    look = bn.log_spec_win_length / bn.sample_rate
    bn.counter, bn.completed = 0, 0
    beats, seen = [], 0
    while bn.completed == 0:
        bn.activation_extractor_realtime(path)
        if bn.completed:
            break
        out = np.atleast_2d(np.asarray(bn.estimator.process(bn.pred), dtype=float))
        n = out.shape[0] if out.size else 0
        for r in out[seen:n]:
            beats.append([float(r[0]), float(r[0]) + look])
        seen = max(seen, n)
        bn.counter += 1
    return beats, {'model': 1, 'mode': 'realtime', 'inference_model': 'PF', 'fps': 50, 'rate': bn.sample_rate,
                   'lookS': round(look, 4), 'reads': 'the file itself', 'pyaudio': 'stub (stream mode only)'}


TRACKERS = {
    'aubio': {'run': run_aubio, 'rate': None, 'pkgs': ['aubio', 'numpy']},
    'madmom': {'run': run_madmom, 'rate': 44100, 'pkgs': ['madmom', 'numpy', 'scipy']},
    'beatnet': {'run': run_beatnet, 'rate': None, 'own_reader': True, 'pkgs': ['BeatNet', 'madmom', 'librosa', 'torch', 'numpy']},
}


def numpy_build():
    """the numpy and its BLAS (a slow BLAS would look like a slow tracker: madmom #524)"""
    out = {'numpy': np.__version__, 'threads': {k: os.environ.get(k) for k in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS')}}
    try:
        cfg = np.show_config(mode='dicts')
        blas = (cfg.get('Build Dependencies') or {}).get('blas') or {}
        out['blas'] = blas.get('name')
    except Exception:
        out['blas'] = None
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument('--tracker', required=True, choices=sorted(TRACKERS))
    ap.add_argument('--wav', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    spec, res = TRACKERS[a.tracker], {'version': 1, 'tracker': a.tracker}
    try:
        t0, c0 = time.time(), time.process_time()
        if spec.get('own_reader'):
            with wave.open(a.wav, 'rb') as w:
                sr, seconds = w.getframerate(), w.getnframes() / w.getframerate()
            x, rate = None, None
        else:
            x, sr = read_mono(a.wav)
            seconds = len(x) / sr
            rate = spec['rate'] or sr
            x = resample(x, sr, rate)
        c1 = time.process_time()   # reading and resampling are not the tracker's cost
        beats, settings = spec['run'](x, rate, a.wav)
        c2, t2 = time.process_time(), time.time()
        beats.sort(key=lambda b: b[0])
        res.update({'status': 'ok', 'seconds': round(seconds, 3), 'sampleRate': sr, 'rate': settings.get('rate'),
                    'cpuS': round(c2 - c1, 2), 'wallS': round(t2 - t0, 2), 'cpuPerAudioS': round((c2 - c1) / seconds, 4) if seconds else None,
                    'settings': settings, 'versions': {p: version(p) for p in spec['pkgs']}, 'build': numpy_build(),
                    'beats': [[round(t, 4), round(at, 4)] for t, at in beats]})
        print(f'{a.tracker}: {len(beats)} beats over {seconds:.0f} s, CPU {c2 - c1:.1f} s ({(c2 - c1) / seconds:.3f} s per s)')
    except Exception as e:   # one line why, the rest to stderr; the scorer lists it as failed
        traceback.print_exc()
        res.update({'status': 'failed', 'why': f'{type(e).__name__}: {str(e)[:160]}'})
        print(f'{a.tracker}: failed ({res["why"]})')
    tmp = a.out + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(res, f)
        f.write('\n')
    os.replace(tmp, a.out)
    return 0 if res['status'] == 'ok' else 1


if __name__ == '__main__':
    sys.exit(main())
