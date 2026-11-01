#!/bin/sh
# Ask the runner for a swipe run on every build that finished green without one, so it lands on the grading page.
# No arguments. The runner records each swipe at its next poll (or run-next.sh) and finishes the build with it.
# QA box types it the same way every time, from the runner's clone (RUNNER_HOME):
#   sh /path/to/cellular-viz-runner/qa/swipe-ready.sh
set -eu
. "$(dirname "$0")/runner/settings.sh"
exec node "$HOME_DIR/qa/runner/swipe-ready.mjs"
