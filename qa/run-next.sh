#!/bin/sh
# One round of the QA runner without the service: poll the open PRs once, run the whole queue, exit.
# Same code, state, GPU gate, results and after-build steps as the service. It refuses while the service's runner is up.
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/run-next.sh
set -eu
. "$(dirname "$0")/runner/settings.sh"
echo "settings from $ENV_FILE (QA_HOME ${QA_HOME:-not set})"
exec node "$HOME_DIR/qa/runner/runner.mjs" --once
