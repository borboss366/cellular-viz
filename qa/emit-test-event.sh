#!/bin/sh
# Write one "test" build event into QA_EVENTS_DIR (from the runner settings), to check QA box's folder trigger end to
# end. No arguments; changes nothing else. QA box types it the same way every time, from the runner's clone:
#   sh /path/to/cellular-viz-runner/qa/emit-test-event.sh
set -eu
. "$(dirname "$0")/runner/settings.sh"
exec node "$HOME_DIR/qa/runner/emit-test-event.mjs"
