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
#      prebuilt wheel madmom-prebuilt (cp311 manylinux, no compiler needed). It says which one it used. The prebuilt
#      wheel's metadata is fixed inside the venv (mm_fix), then `import madmom, essentia, beat_this` is checked before
#      any voting: no Beat This! or essentia stops the run; no madmom runs it DEGRADED with 2 trackers (A0 + C).
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

# ---- madmom's metadata (box, 10 Nov): madmom/__init__.py sets __version__ = distribution("madmom").version, but the
#      prebuilt wheel registers itself as madmom-prebuilt (madmom_prebuilt-*.dist-info), so `import madmom` fails with
#      PackageNotFoundError. Inside .venv-vote only: a minimal madmom-<version>.dist-info (METADATA, Name: madmom) beside
#      the package; if the import still fails, that one line in the venv's madmom/__init__.py gets a try/except.
#      Idempotent; a no-op when madmom is not installed, already resolves (a git build), or sits outside the venv.
mm_fix() {
  "$PY" - <<'EOF' || echo "madmom-fix: failed (see above); the check below decides"
import importlib, importlib.util, os, re, sys
from importlib import metadata
spec = importlib.util.find_spec('madmom')
if spec is None or not spec.submodule_search_locations:
    sys.exit(0)
pkg = list(spec.submodule_search_locations)[0]
site = os.path.dirname(pkg)
if not os.path.realpath(site).startswith(os.path.realpath(sys.prefix) + os.sep):
    print('madmom-fix: madmom is outside ' + sys.prefix + ', left alone')
    sys.exit(0)
try:
    metadata.distribution('madmom')
    sys.exit(0)
except metadata.PackageNotFoundError:
    pass
try:
    ver = metadata.version('madmom-prebuilt')
except metadata.PackageNotFoundError:
    ver = '0.17.post1'
d = os.path.join(site, 'madmom-' + ver + '.dist-info')
os.makedirs(d, exist_ok=True)
with open(os.path.join(d, 'METADATA'), 'w') as f:
    f.write('Metadata-Version: 2.1\nName: madmom\nVersion: ' + ver + '\nSummary: metadata shim for madmom-prebuilt (cellular-viz qa/ref-beats-vote.sh)\n')
with open(os.path.join(d, 'INSTALLER'), 'w') as f:
    f.write('ref-beats-vote.sh\n')
importlib.invalidate_caches()
try:
    metadata.distribution('madmom')
    print('madmom-fix: wrote ' + os.path.basename(d) + ' (Name: madmom) beside the prebuilt wheel')
    sys.exit(0)
except metadata.PackageNotFoundError:
    pass
init = os.path.join(pkg, '__init__.py')
src = open(init).read()
line = re.compile(r'^__version__ = distribution\(["\']madmom["\']\)\s*\.version[ \t]*$', re.M)
if line.search(src):
    src = line.sub("try:\n    __version__ = distribution('madmom').version\nexcept Exception:  # ref-beats-vote.sh: prebuilt wheel\n    __version__ = '" + ver + "'", src, count=1)
    with open(init, 'w') as f:
        f.write(src)
    print('madmom-fix: the dist-info did not resolve; patched the version line in the venv madmom/__init__.py')
else:
    print('madmom-fix: the dist-info did not resolve and the version line was not found: left as is')
EOF
}

# ---- packages (first run, or when one is missing) ---------------------------------------------------------------
CORE='import torch, soundfile, numpy, soxr, beat_this.inference, essentia.standard'
MM='import madmom.features.beats, madmom.features.downbeats'
mm_fix
if ! "$PY" -c "$CORE; $MM" >/dev/null 2>&1; then
  echo "installing into $VENV (first run: several minutes, ~3 GB)"
  PIP "numpy<2" || die "pip could not install numpy<2"
  PIP torch torchaudio --index-url https://download.pytorch.org/whl/cpu || die "pip could not install CPU torch"
  PIP tqdm einops soxr rotary-embedding-torch soundfile beat-this "numpy<2" || die "pip could not install beat-this"
  PIP essentia "numpy<2" || die "pip could not install essentia"
  if ! "$PY" -c 'import importlib.util, sys; sys.exit(importlib.util.find_spec("madmom") is None)' >/dev/null 2>&1; then
    if command -v git >/dev/null 2>&1 && { command -v cc >/dev/null 2>&1 || command -v gcc >/dev/null 2>&1; }; then
      echo "madmom: from git (CPJKU/madmom, built here)"
      PIP cython "numpy<2" scipy mido || die "pip could not install madmom's build deps"
      PIP --no-build-isolation "git+https://github.com/CPJKU/madmom" || { echo "madmom: the git build failed; trying the prebuilt wheel"; PIP --only-binary=:all: madmom-prebuilt "numpy<2" || die "no madmom (git build and prebuilt wheel both failed)"; }
    else
      echo "madmom: no git or no C compiler in this container, so the prebuilt wheel madmom-prebuilt (cp311 manylinux)"
      PIP --only-binary=:all: madmom-prebuilt "numpy<2" scipy mido || die "pip could not install madmom-prebuilt"
    fi
  fi
  mm_fix
fi

# ---- the check, before any voting: Beat This! and essentia are required; without madmom the vote runs DEGRADED -----
"$PY" -c "$CORE" || die "STOP: torch / beat-this / essentia / soundfile / soxr do not import in $VENV (see above); no vote ran"
VOTE_MODE=3
if "$PY" -c "import madmom, essentia, beat_this; $MM" >"$DATA/.cache/madmom-check.txt" 2>&1; then
  echo "check: import madmom, essentia, beat_this: ok (3 trackers: A beat-this+dbn, B madmom-rnn+dbn, C essentia)"
else
  VOTE_MODE=2
  echo "check: import madmom FAILED: $(tail -n 1 "$DATA/.cache/madmom-check.txt")"
  echo "DEGRADED: madmom is off, so A beat-this+dbn and B madmom-rnn+dbn are off. The vote runs with 2 trackers:"
  echo "  A0 beat-this-minimal (Beat This!'s own peak picking, no DBN, no tempo range) and C essentia; both must agree."
  echo "  Every .vote.json says degraded; no .ref.beats is written (a reference needs the 3-tracker vote)."
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
nice -n 10 sh "$HERE/gpu-lock.sh" ref-beats-vote "$PY" "$HERE/ref_beats_vote.py" --dir "$TRACKS" --trackers "$VOTE_MODE" || RC=$?

# ---- the grids for the changed references (edits kept) -----------------------------------------------------------
if command -v node >/dev/null 2>&1; then
  echo "grids (qa/beatgrid.mjs --dir):"
  node "$HERE/beatgrid.mjs" --dir "$TRACKS" || { echo "ref-beats-vote.sh: the converter failed (see above)" >&2; [ "$RC" -ne 0 ] || RC=1; }
else
  echo "ref-beats-vote.sh: no node on PATH, so no grids were made" >&2
  [ "$RC" -ne 0 ] || RC=1
fi
exit "$RC"
