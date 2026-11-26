#!/bin/sh
# beatd task 1: the offline comparison of live beat trackers on one recording (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md
# task 1, docs/CELLULAR_VIZ_BRIEF_BEAT_BAKEOFF.md). Approved by the user (26 Nov) as a fixed script QA box may run.
#
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/bakeoff.sh <session> <row> [tracker ...]
#   e.g.  sh qa/bakeoff.sh conductor-20261126-223503 wired-1
# <session>: the conductor session whose recording is compared (<sessions>/<session>.wav, with its .jsonl log and
# .wav.json when they are there); <row>: the name the report uses (wired-1, mic-1, mix-1). Trackers: aubio madmom
# beatnet by default (qa/bakeoff/<id>.txt).
#
# Steps, each one line of output:
#   1. the reference: Beat This! over the recording (the venv of qa/ref-beats.sh; run that script once first)
#   2. per tracker: its own venv under the data folder, installed from qa/bakeoff/<id>.txt within an hour
#      (BAKEOFF_INSTALL_S, default 3600) or dropped with one line why; then qa/bakeoff_run.py runs it causally over
#      the recording. A dropped or failed tracker is a row in the report, never a stop.
#   3. the scorer (qa/bakeoff-score.mjs): <out>/report.md and <out>/result.json
# Output: <data>/bakeoff/<row>/ (outside git). The recording is read in place, never copied; the outputs hold beat
# times and numbers only, no names (R9). Heavy steps wait for the GPU lock (qa/gpu-lock.sh), as the runner does.
# Nothing is tuned to the recording; each tracker runs with its authors' online defaults.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
DATA=${QA_DATA_DIR:-/home/puggie/pi-durable-worker/data/qa-audio}
SESS=${CONDUCTOR_SESSIONS:-$DATA/sessions}
INSTALL_S=${BAKEOFF_INSTALL_S:-3600}
RUN_S=${BAKEOFF_RUN_S:-7200}
export PIP_CACHE_DIR="$DATA/.cache/pip" PIP_DISABLE_PIP_VERSION_CHECK=1 TORCH_HOME="$DATA/.models"

die() { echo "bakeoff.sh: $*" >&2; exit 1; }
[ $# -ge 2 ] || die "usage: sh qa/bakeoff.sh <session like conductor-20261126-223503> <row like wired-1> [tracker ...]"
SESSION=$1; ROW=$2; shift 2
echo "$SESSION" | grep -Eq '^conductor-[0-9]{8}-[0-9]{6}(-[a-z0-9]{1,8})?$' || die "not a session name: $SESSION"
echo "$ROW" | grep -Eq '^[a-z][a-z0-9-]{0,23}$' || die "not a row name (like wired-1): $ROW"
TRACKERS=${*:-aubio madmom beatnet}
for id in $TRACKERS; do [ -f "$HERE/bakeoff/$id.txt" ] || die "no install list qa/bakeoff/$id.txt for tracker $id"; done

WAV=$SESS/$SESSION.wav; LOG=$SESS/$SESSION.jsonl; WJ=$SESS/$SESSION.wav.json
[ -f "$WAV" ] || die "no recording $WAV"
command -v python3 >/dev/null 2>&1 || die "no python3 on PATH"
command -v node >/dev/null 2>&1 || die "no node on PATH"
command -v timeout >/dev/null 2>&1 || die "no timeout (coreutils) on PATH"
OUT=$DATA/bakeoff/$ROW
mkdir -p "$OUT" "$PIP_CACHE_DIR" "$TORCH_HOME" "$DATA/.cache"
echo "bakeoff $ROW: $(du -m "$WAV" | cut -f1) MB recording; out $OUT; trackers: $TRACKERS"

# a JSON row for a tracker that never ran: { tracker, status, why } (python3 writes it, so the why is escaped)
note() {   # id status why
  python3 - "$OUT/$1.json" "$1" "$2" "$3" <<'EOF'
import json, sys
out, tid, status, why = sys.argv[1:5]
with open(out, 'w') as f:
    json.dump({'version': 1, 'tracker': tid, 'status': status, 'why': why[:200]}, f)
    f.write('\n')
EOF
  echo "$1: $2 ($3)"
}

# ---- 1. the reference ----------------------------------------------------------------------------------------------
REFPY=$DATA/.venv-beatthis/bin/python
if [ ! -s "$OUT/ref.beats" ] || [ "$WAV" -nt "$OUT/ref.beats" ]; then
  [ -x "$REFPY" ] || die "no Beat This! venv at $DATA/.venv-beatthis: run qa/ref-beats.sh once first"
  sh "$HERE/gpu-lock.sh" "bakeoff-ref-$ROW" "$REFPY" "$HERE/bakeoff_ref.py" --wav "$WAV" --out "$OUT/ref" || die "the reference failed"
else
  echo "reference: up to date ($(wc -l < "$OUT/ref.beats") beats)"
fi

# ---- 2. the trackers -----------------------------------------------------------------------------------------------
make_venv() {   # dir: a venv with pip (Debian's python3 may have no ensurepip: bare venv + get-pip.py, as ref-beats.sh)
  py=$1/bin/python
  if [ -x "$py" ] && "$py" -m pip --version >/dev/null 2>&1; then return 0; fi
  rm -rf "$1"
  if python3 -m venv "$1" >/dev/null 2>&1 && "$py" -m pip --version >/dev/null 2>&1; then return 0; fi
  rm -rf "$1"
  python3 -m venv --without-pip "$1" || return 1
  [ -s "$DATA/.cache/get-pip.py" ] || python3 -c 'import sys, urllib.request; urllib.request.urlretrieve("https://bootstrap.pypa.io/get-pip.py", sys.argv[1])' "$DATA/.cache/get-pip.py" || return 1
  "$py" "$DATA/.cache/get-pip.py" -q && "$py" -m pip --version >/dev/null 2>&1
}
check_import() {   # id -> the import that proves the tracker is usable
  case $1 in
    aubio) echo 'import aubio' ;;
    madmom) echo 'import madmom.features.beats' ;;
    beatnet) echo 'from BeatNet.BeatNet import BeatNet' ;;
    *) echo 'pass' ;;
  esac
}
for id in $TRACKERS; do
  VENV=$DATA/.venv-bakeoff-$id; PY=$VENV/bin/python; REQ=$HERE/bakeoff/$id.txt; NODEPS=$HERE/bakeoff/$id.nodeps.txt
  SUM=$(cat "$REQ" "$NODEPS" 2>/dev/null | cksum | cut -d' ' -f1)
  # madmom: the vote's venv (qa/ref-beats-vote.sh) already has a madmom that imports on this box (a git build, or the
  # prebuilt wheel with its metadata fixed); it is used as it is, nothing installed or changed in it
  if [ "$id" = madmom ] && [ -x "$DATA/.venv-vote/bin/python" ] && "$DATA/.venv-vote/bin/python" -c "$(check_import madmom)" >/dev/null 2>&1; then
    PY=$DATA/.venv-vote/bin/python
    echo "madmom: the vote's venv, madmom $("$PY" -c 'import importlib.metadata as m; print(m.version("madmom"))' 2>/dev/null || echo '?')"
  elif [ ! -f "$VENV/.bakeoff-ok-$SUM" ]; then
    echo "$id: installing (at most ${INSTALL_S} s) from qa/bakeoff/$id.txt"
    LOGF=$OUT/$id.install.log
    if make_venv "$VENV" > "$LOGF" 2>&1 && timeout "$INSTALL_S" sh -c '
        set -e
        "$1" -m pip install -q -r "$2"
        if [ -f "$3" ]; then "$1" -m pip install -q --no-deps -r "$3"; fi
        "$1" -c "$4"' sh "$PY" "$REQ" "$NODEPS" "$(check_import "$id")" >> "$LOGF" 2>&1; then
      rm -f "$VENV"/.bakeoff-ok-*; touch "$VENV/.bakeoff-ok-$SUM"
      echo "$id: installed"
    else
      WHY=$(grep -v '^\s*$' "$LOGF" | tail -n 1 | cut -c1-180)
      note "$id" dropped "did not install within ${INSTALL_S} s: ${WHY:-no output}"
      continue
    fi
  fi
  if timeout "$RUN_S" sh "$HERE/gpu-lock.sh" "bakeoff-$id-$ROW" "$PY" "$HERE/bakeoff_run.py" --tracker "$id" --wav "$WAV" --out "$OUT/$id.json"; then
    :
  elif [ ! -s "$OUT/$id.json" ] || ! grep -q '"status": "failed"' "$OUT/$id.json"; then
    note "$id" failed "no result within ${RUN_S} s or the run crashed (see the output above)"
  fi
done

# ---- 3. the score --------------------------------------------------------------------------------------------------
set -- --row "$ROW" --ref "$OUT/ref.beats" --dir "$OUT" --md "$OUT/report.md" --json "$OUT/result.json"
if [ -f "$LOG" ] && [ -f "$WJ" ]; then set -- "$@" --log "$LOG" --wavjson "$WJ"
else echo "no session log or .wav.json next to the recording: ours (alone, with the hand) are left out"; fi
node "$HERE/bakeoff-score.mjs" "$@" || die "the scorer failed"
echo "report: $OUT/report.md (send it as it is: rows and numbers only)"
