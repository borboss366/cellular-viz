#!/bin/sh
# Reference beats by a vote of three trackers (#188, the user 10 Nov 17:27; VIZ research's ruling): Beat This! logits +
# madmom's DBN, madmom's RNN + the same DBN, essentia's multifeature RhythmExtractor2013. Two of three agree within 1 %
# after octave folding AND essentia confidence >= 1.5 accepts a grid; anything else is flagged for the user's ear.
# See qa/ref_beats_vote.py. Ids only in every line it prints (R9).
#
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME), no arguments:
#   sh /path/to/cellular-viz-runner/qa/ref-beats-vote.sh
# What it does:
#   1. the first time: a venv of its own, $DATA/.venv-vote (the old ref-beats.sh venv, .venv-beatthis, is not
#      touched, so the 22 earlier tracks' tool stays exactly as it was), with CPU torch, beat-this, essentia, soundfile,
#      soxr, numpy < 2 and madmom: from git (CPJKU/madmom) when this container has git and a C compiler, else the
#      prebuilt wheel madmom-prebuilt (cp311 manylinux, no compiler needed). It says which one it used.
#   2. the vote on every corpus track on the box (ids from corpus-map.json), the rows with refTool "vote" in
#      qa/corpus.json first (hc-01..hc-11); a track whose .vote.json matches its sha256 is skipped. Accepted vote rows
#      get a new <stem>.ref.beats (tool 'vote'); every other row only gets <stem>.vote.json / .vote.beats as a report.
#   3. qa/beatgrid.mjs --dir: the changed .ref.beats become .beatgrid.json (grid-editor edits kept), as ref-beats.sh does.
# It holds the GPU lock (qa/gpu-lock.sh) like the runner and ref-beats.sh, so it never runs during a build's timing.
# No apt, nothing outside the bind mount: venv, pip cache and checkpoints live under $DATA (survive a recreate).
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
DATA=${QA_DATA_DIR:-/home/puggie/pi-durable-worker/data/qa-audio}
TRACKS=${QA_AUDIO_DIR:-$DATA/tracks}
VENV=$DATA/.venv-vote
export TORCH_HOME="$DATA/.models" PIP_CACHE_DIR="$DATA/.cache/pip" PIP_DISABLE_PIP_VERSION_CHECK=1
[ $# -eq 0 ] || { echo "usage: sh qa/ref-beats-vote.sh   (no arguments)" >&2; exit 2; }
die() { echo "ref-beats-vote.sh: $*" >&2; exit 1; }

command -v python3 >/dev/null 2>&1 || die "no python3 on PATH"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' || die "$(python3 -V 2>&1) is too old (3.9+)"
[ -d "$TRACKS" ] || die "no tracks folder $TRACKS (set QA_AUDIO_DIR)"
[ -f "$(dirname "$TRACKS")/corpus-map.json" ] || die "no corpus-map.json beside the tracks folder (ids come from it, R9)"
mkdir -p "$TORCH_HOME" "$PIP_CACHE_DIR" "$DATA/.cache"

# ---- the venv (first run only) ----------------------------------------------------------------------------------
PY=$VENV/bin/python
pip_ok() { [ -x "$PY" ] && "$PY" -m pip --version >/dev/null 2>&1; }
if ! pip_ok; then
  FREE=$(df -Pk "$DATA" | awk 'NR == 2 { print $4 }')
  [ "${FREE:-0}" -ge 3145728 ] || die "only $((${FREE:-0} / 1024)) MB free under $DATA; this venv needs about 3 GB"
  rm -rf "$VENV"
  if python3 -m venv "$VENV" >/dev/null 2>&1 && pip_ok; then
    echo "venv: $VENV (python3 -m venv)"
  else
    rm -rf "$VENV"
    python3 -m venv --without-pip "$VENV" || die "python3 -m venv --without-pip failed"
    python3 - "$DATA/.cache/get-pip.py" <<'EOF' || die "could not download get-pip.py"
import sys, urllib.request
urllib.request.urlretrieve('https://bootstrap.pypa.io/get-pip.py', sys.argv[1])
EOF
    "$PY" "$DATA/.cache/get-pip.py" -q || die "get-pip.py failed"
    echo "venv: $VENV (--without-pip + get-pip.py)"
  fi
fi
PIP() { "$PY" -m pip install -q "$@"; }

# ---- packages (first run, or when one is missing) ---------------------------------------------------------------
if ! "$PY" -c 'import torch, soundfile, numpy, soxr, beat_this.inference, essentia.standard, madmom.features.downbeats' >/dev/null 2>&1; then
  echo "installing into $VENV (first run: several minutes, ~3 GB)"
  PIP "numpy<2" || die "pip could not install numpy<2"
  PIP torch torchaudio --index-url https://download.pytorch.org/whl/cpu || die "pip could not install CPU torch"
  PIP tqdm einops soxr rotary-embedding-torch soundfile beat-this "numpy<2" || die "pip could not install beat-this"
  PIP essentia "numpy<2" || die "pip could not install essentia"
  if ! "$PY" -c 'import madmom' >/dev/null 2>&1; then
    if command -v git >/dev/null 2>&1 && { command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1; }; then
      echo "madmom: from git (CPJKU/madmom, built here)"
      PIP cython "numpy<2" scipy mido || die "pip could not install madmom's build deps"
      PIP --no-build-isolation "git+https://github.com/CPJKU/madmom" || { echo "madmom: the git build failed; trying the prebuilt wheel"; PIP --only-binary=:all: madmom-prebuilt "numpy<2" || die "no madmom (git build and prebuilt wheel both failed)"; }
    else
      echo "madmom: no git or no C compiler in this container, so the prebuilt wheel madmom-prebuilt (cp311 manylinux)"
      PIP --only-binary=:all: madmom-prebuilt "numpy<2" scipy mido || die "pip could not install madmom-prebuilt"
    fi
  fi
  "$PY" -c 'import torch, soundfile, numpy, soxr, beat_this.inference, essentia.standard, madmom.features.downbeats' \
    || die "installed, but the imports fail (see above)"
fi
"$PY" - <<'EOF'
from importlib import metadata
def v(p):
    try: return metadata.version(p)
    except metadata.PackageNotFoundError: return '-'
print('versions: ' + ', '.join(f'{p} {v(p)}' for p in ('torch', 'beat-this', 'madmom', 'madmom-prebuilt', 'essentia', 'numpy')))
EOF

# ---- the vote, holding the GPU lock so it never overlaps a build -------------------------------------------------
RC=0
nice -n 10 sh "$HERE/gpu-lock.sh" ref-beats-vote "$PY" "$HERE/ref_beats_vote.py" --dir "$TRACKS" || RC=$?

# ---- the grids for the changed references (edits kept) -----------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  echo "grids (qa/beatgrid.mjs --dir):"
  node "$HERE/beatgrid.mjs" --dir "$TRACKS" || { echo "ref-beats-vote.sh: the converter failed (see above)" >&2; [ "$RC" -ne 0 ] || RC=1; }
else
  echo "ref-beats-vote.sh: no node on PATH, so no grids were made" >&2
  [ "$RC" -ne 0 ] || RC=1
fi
exit "$RC"
