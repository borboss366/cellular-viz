#!/bin/sh
# One round of the QA runner without the service: poll the open PRs once, run the whole queue, exit.
# Same code, state, GPU gate and results as the service. It refuses to start while the service's runner is up.
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/run-next.sh
set -eu
HOME_DIR=$(cd "$(dirname "$0")/.." && pwd)        # the clone this script lives in = RUNNER_HOME
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
exec node "$HOME_DIR/qa/runner/runner.mjs" --once
