#!/bin/sh
# Reference beat grids for the clock's truth (b) (#95, ruling of 1 Nov): Beat This! (CPJKU, ISMIR 2024, MIT licence) on
# the CPU, for each private track in QA_AUDIO_DIR → <track>.ref.beats (time<TAB>beat-in-bar, 1 = downbeat, as Beat
# This! / Sonic Visualiser write them) plus <track>.ref.json (track sha256, model, versions, counts). Report-only: the
# hard gate is the node test on synthetic grids; these files are what the gridder is compared against, never a gate.
#
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/ref-beats.sh            # tracks with no or stale reference files
#   sh /path/to/cellular-viz-runner/qa/ref-beats.sh --force    # all tracks again
#   sh /path/to/cellular-viz-runner/qa/ref-beats.sh --list     # only list the source tracks it would take (no venv)
#
# Source tracks (#188 PR1a): every audio file at the top of the folder that is not a render, by qa/render-names.json
# (the same rule as isRender() in qa/runner/audio.mjs). At the end, qa/beatgrid.mjs (ensureGrids) turns each new or
# changed <stem>.ref.beats into <stem>.beatgrid.json, keeping any grid-editor edits already in it.
#
# No apt, nothing outside the bind mount: the venv, pip cache and model checkpoint live under
# /home/puggie/pi-durable-worker/data/qa-audio (survives a container recreate); the outputs go next to the tracks.
# The tracks are copyrighted: they are read here and never copied; the outputs hold beat times only.
# First run downloads CPU torch (~200 MB), beat-this and the final0 checkpoint (~78 MB); later runs reuse them.
# It waits for the GPU lock like the runner does (qa/gpu-lock.sh), so it never runs during a build's timing.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
DATA=${QA_DATA_DIR:-/home/puggie/pi-durable-worker/data/qa-audio}
TRACKS=${QA_AUDIO_DIR:-$DATA/tracks}
VENV=$DATA/.venv-beatthis
MODEL=${REF_BEATS_MODEL:-final0}
export TORCH_HOME="$DATA/.models" PIP_CACHE_DIR="$DATA/.cache/pip" PIP_DISABLE_PIP_VERSION_CHECK=1
FORCE=
LIST=
case "${1:-}" in --force) FORCE=--force ;; --list) LIST=1 ;; '') ;; *) echo "usage: sh qa/ref-beats.sh [--force | --list]" >&2; exit 2 ;; esac

die() { echo "ref-beats.sh: $*" >&2; exit 1; }

# ---- what the box must have -------------------------------------------------------------------------------------
command -v python3 >/dev/null 2>&1 || die "no python3 on PATH (the runner's container has Python 3.11; is this the right shell?)"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || die "$(python3 -V 2>&1) is too old: Beat This! needs Python 3.9+"
[ -d "$TRACKS" ] || die "no tracks folder $TRACKS (set QA_AUDIO_DIR)"
if [ -n "$LIST" ]; then exec python3 "$HERE/ref_beats.py" --dir "$TRACKS" --list; fi
mkdir -p "$TORCH_HOME" "$PIP_CACHE_DIR" "$DATA/.cache"

reach() {   # every URL must answer (any HTTP status counts as reachable)
  python3 - "$@" <<'EOF'
import sys, urllib.request, urllib.error
bad = []
for u in sys.argv[1:]:
    try:
        urllib.request.urlopen(urllib.request.Request(u, method='HEAD'), timeout=20)
    except urllib.error.HTTPError:
        pass
    except Exception as e:
        bad.append(f'{u} ({e.__class__.__name__}: {e})')
if bad:
    print('cannot reach: ' + '; '.join(bad), file=sys.stderr)
    sys.exit(1)
EOF
}

# ---- the venv (first run only) ----------------------------------------------------------------------------------
PY=$VENV/bin/python
pip_ok() { [ -x "$PY" ] && "$PY" -m pip --version >/dev/null 2>&1; }
if ! pip_ok; then
  FREE=$(df -Pk "$DATA" | awk 'NR == 2 { print $4 }')
  [ "${FREE:-0}" -ge 2097152 ] || die "only $((${FREE:-0} / 1024)) MB free under $DATA; the venv with CPU torch needs about 2 GB"
  reach https://pypi.org/simple/ https://download.pytorch.org/whl/cpu/ || die "no network to PyPI or download.pytorch.org"
  rm -rf "$VENV"
  if python3 -m venv "$VENV" >/dev/null 2>&1 && pip_ok; then
    echo "venv: $VENV (python3 -m venv)"
  else
    # Debian's python3 has no ensurepip without the python3-venv package: make the venv bare, then bootstrap pip
    rm -rf "$VENV"
    python3 -m venv --without-pip "$VENV" || die "python3 -m venv --without-pip failed: this python3 has no venv module"
    if reach https://bootstrap.pypa.io/get-pip.py && python3 - "$DATA/.cache/get-pip.py" <<'EOF'
import sys, urllib.request
urllib.request.urlretrieve('https://bootstrap.pypa.io/get-pip.py', sys.argv[1])
EOF
    then "$PY" "$DATA/.cache/get-pip.py" -q || true
    fi
    pip_ok && echo "venv: $VENV (--without-pip + get-pip.py)"
  fi
fi
if pip_ok; then
  PIP() { "$PY" -m pip install -q "$@"; }
elif command -v uv >/dev/null 2>&1; then
  [ -x "$PY" ] || uv venv -q "$VENV" || die "uv venv failed"
  PIP() { uv pip install -q --python "$PY" "$@"; }
  echo "venv: $VENV (uv)"
else
  die "could not get pip into $VENV (no ensurepip, get-pip.py failed, no uv on PATH)"
fi

# ---- packages (first run, or when one is missing) ---------------------------------------------------------------
if ! "$PY" -c 'import torch, soundfile, numpy, beat_this.inference' >/dev/null 2>&1; then
  echo "installing CPU torch, beat-this and soundfile into $VENV (first run: a few minutes)"
  # torch first, from the CPU index, so beat-this never pulls the CUDA build from PyPI
  PIP torch torchaudio --index-url https://download.pytorch.org/whl/cpu || die "pip could not install CPU torch"
  PIP tqdm einops soxr rotary-embedding-torch soundfile numpy beat-this || die "pip could not install beat-this"
  "$PY" -c 'import torch, soundfile, numpy, beat_this.inference' || die "beat-this is installed but does not import (see above)"
fi

# ---- run it, holding the GPU lock so it never overlaps a build ---------------------------------------------------
reach https://cloud.cp.jku.at/ 2>/dev/null || echo "note: cloud.cp.jku.at (the checkpoint host) does not answer; fine if $MODEL is already cached in $TORCH_HOME"
RC=0
nice -n 10 sh "$HERE/gpu-lock.sh" ref-beats "$PY" "$HERE/ref_beats.py" --dir "$TRACKS" --model "$MODEL" $FORCE || RC=$?

# ---- the rehearsal grids: <stem>.ref.beats → <stem>.beatgrid.json (new or changed ones only; edits kept) -----------
# Runs even when a track failed above, so the ones that worked get their grid.
if command -v node >/dev/null 2>&1; then
  echo "grids (qa/beatgrid.mjs --dir):"
  node "$HERE/beatgrid.mjs" --dir "$TRACKS" || { echo "ref-beats.sh: the converter failed (see above)" >&2; [ "$RC" -ne 0 ] || RC=1; }
  n=$(ls "$TRACKS" | grep -c '\.beatgrid\.json$' || true)
  echo "grids: $n <stem>.beatgrid.json in $TRACKS"
else
  echo "ref-beats.sh: no node on PATH, so no grids were made; exp-run makes them on the next audio build" >&2
  [ "$RC" -ne 0 ] || RC=1
fi
exit "$RC"
