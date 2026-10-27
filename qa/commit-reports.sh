#!/bin/sh
# Commit every changed .md/.json report under qa/ in QA_HOME (and qa/history/*.sh), with a message made from the builds
# log. Never pushes: the push stays its own fixed command. The runner already commits each build's reports itself;
# this catches anything left over. QA box types it the same way every time:
#   sh /path/to/cellular-viz-runner/qa/commit-reports.sh
set -eu
. "$(dirname "$0")/runner/settings.sh"
exec node "$HOME_DIR/qa/runner/post.mjs" commit-reports
