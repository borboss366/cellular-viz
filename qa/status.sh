#!/bin/sh
# Read-only status of the QA runner and viewer, short plain text: runner /health and /api/status (queue, current
# build, last results), the last 10 lines of runner.log, the viewer's HTTP codes for / and /builds, and the GPU's
# gpu_busy_percent. No arguments; changes nothing. QA box types it the same way every time:
#   sh /path/to/cellular-viz-runner/qa/status.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}
[ -f "$ENV_FILE" ] || ENV_FILE=$HOME/.cache/cellular-viz-runner/runner.env
# the settings are optional here: without them qa/status.mjs uses the box's default paths
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
exec node "$HERE/status.mjs"
