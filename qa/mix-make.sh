#!/bin/sh
# The mix tool on the box (#188 T7/T13, qa/mix-make.mjs): every recipe in qa/mixes.json that is missing or stale, then
# T12's alignLag (R14) when corpus.json's alignSha doesn't match the files. Writes only to <QA_AUDIO_DIR>/renders/
# (mix-*.wav, mix-*.beatgrid.json, mix-*.mix.json, align-<id>.json); the tracks are read, never copied. No ffmpeg:
# Chromium's decoder from the runner's playwright. It waits for the GPU lock like ref-beats.sh (qa/gpu-lock.sh).
# Playwright is in QA box's working copy (QA_HOME/qa/node_modules), not in the runner clone: QA_HOME comes from the
# runner's settings (qa/runner/settings.sh), and mix-make.mjs requires Playwright from there.
#
# QA box types it the same way every time, from the runner's clone:
#   sh /path/to/cellular-viz-runner/qa/mix-make.sh
set -eu
[ $# -eq 0 ] || { echo "usage: sh qa/mix-make.sh (no arguments)" >&2; exit 2; }
HERE=$(cd "$(dirname "$0")" && pwd)
. "$HERE/runner/settings.sh"
[ -n "${QA_HOME:-}" ] || { echo "mix-make.sh: no QA_HOME in the runner settings ($ENV_FILE)" >&2; exit 1; }
export QA_HOME
DATA=${QA_DATA_DIR:-/home/puggie/pi-durable-worker/data/qa-audio}
TRACKS=${QA_AUDIO_DIR:-$DATA/tracks}
[ -d "$TRACKS" ] || { echo "mix-make.sh: no tracks folder $TRACKS (set QA_AUDIO_DIR)" >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "mix-make.sh: no node on PATH" >&2; exit 1; }
nice -n 10 sh "$HERE/gpu-lock.sh" mix-make node "$HERE/mix-make.mjs" --dir "$TRACKS"
