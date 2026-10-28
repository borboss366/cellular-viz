#!/bin/sh
# Commit QA box's check scripts and reports in its QA tree (QA_HOME), and nothing else:
#   qa/check-*.mjs (incl. check-pulse.mjs), qa/todo.json, qa/builds.json,
#   qa/*/checks/**/*.md and *.json, qa/*/runs/**/report.md, results.json and comparisons.json.
# Never videos or screenshots (no pattern matches them), and anything else already staged stays out of this commit.
# Commits as "QA box <qa-box@puggie.local>" with a message listing the files and the checks. Nothing changed: exit 0,
# no commit. Never pushes: the push stays its own fixed command. No arguments; QA box types it the same way every time:
#   sh /path/to/cellular-viz-runner/qa/commit-checks.sh
set -eu
ENV_FILE=${RUNNER_ENV:-$HOME/.config/cellular-viz-runner.env}
[ -f "$ENV_FILE" ] || ENV_FILE=$HOME/.cache/cellular-viz-runner/runner.env
if [ -f "$ENV_FILE" ]; then set -a; . "$ENV_FILE"; set +a; fi
QA_HOME=${QA_HOME:-/home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz}
cd "$QA_HOME"

# changed (modified, deleted or new, not ignored) files that match the patterns, one per line
FILES=$(git ls-files -m -o --exclude-standard -- \
  ':(glob)qa/check-*.mjs' 'qa/todo.json' 'qa/builds.json' \
  ':(glob)qa/*/checks/**/*.md' ':(glob)qa/*/checks/**/*.json' \
  ':(glob)qa/*/runs/**/report.md' ':(glob)qa/*/runs/**/results.json' ':(glob)qa/*/runs/**/comparisons.json' | sort -u)
if [ -z "$FILES" ]; then
  echo "commit-checks: nothing to commit in $QA_HOME"
  exit 0
fi

# what the commit is about: check scripts by name, reports by experiment and run folder
NAMES=$(printf '%s\n' "$FILES" | awk -F/ '
  /^qa\/check-[^\/]*\.mjs$/ { sub(/\.mjs$/, "", $2); print $2; next }
  $3 == "checks" || $3 == "runs" { print $2 " " $4; next }
  { print $2 }' | sort -u | paste -sd, - | sed 's/,/, /g')
COUNT=$(printf '%s\n' "$FILES" | wc -l | tr -d ' ')
BRANCH=$(git rev-parse --abbrev-ref HEAD)
MSG_FILE=$(mktemp)
trap 'rm -f "$MSG_FILE"' EXIT
{
  echo "QA: $NAMES ($COUNT files)"
  echo
  printf '%s\n' "$FILES" | sed 's/^/- /'
  echo
  echo "Made-by: QA box (qa/commit-checks.sh)"
} > "$MSG_FILE"

# add the new and changed ones (a deleted one is staged as a deletion), then commit only these paths
printf '%s\n' "$FILES" | while IFS= read -r f; do git add -A -- "$f"; done
printf '%s\n' "$FILES" | tr '\n' '\0' | xargs -0 git -c user.name="QA box" -c user.email=qa-box@puggie.local \
  commit -q -F "$MSG_FILE" --only --
echo "commit-checks: $(git log -1 --format='%h %s') on $BRANCH (not pushed)"
