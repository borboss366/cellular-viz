#!/bin/sh
# Move the kanban cards from the builds log (replaces qa/board.py set/sync). The runner already does this after every
# build and merge; this is the same step by hand. QA box types it the same way every time:
#   sh /path/to/cellular-viz-runner/qa/board-sync.sh
set -eu
. "$(dirname "$0")/runner/settings.sh"
exec node "$HOME_DIR/qa/runner/board.mjs" sync
