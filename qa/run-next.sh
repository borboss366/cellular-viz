#!/bin/sh
# One round of the QA runner without the service: poll the open PRs once, run the whole queue, exit.
# Same code, state, GPU gate and results as the service. It refuses to start while the service's runner is up.
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/run-next.sh
# Settings: RUNNER_ENV or ~/.config/cellular-viz-runner.env if there, else the copy the service writes at start
# (~/.cache/cellular-viz-runner/runner.env).
set -eu
HOME_DIR=$(cd "$(dirname "$0")/.." && pwd)        # the clone this script lives in = RUNNER_HOME
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}
[ -f "$ENV_FILE" ] || ENV_FILE=$HOME/.cache/cellular-viz-runner/runner.env
if [ ! -f "$ENV_FILE" ]; then
  echo "no runner settings: start the service once (it writes $ENV_FILE) or put the env file at ~/.config/cellular-viz-runner.env" >&2
  exit 1
fi
set -a; . "$ENV_FILE"; set +a
echo "settings from $ENV_FILE (QA_HOME ${QA_HOME:-not set})"
exec node "$HOME_DIR/qa/runner/runner.mjs" --once
