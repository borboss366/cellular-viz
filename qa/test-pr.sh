#!/bin/sh
# Test a runner PR before it is merged, in a scratch clone at /tmp/test-pr: the runner's unit tests
# (node --test qa/runner/test/*.test.mjs) and a syntax check (node --check) of every qa/runner/*.mjs file, then a
# one-line summary. Writes nothing to the QA tree, the runner clone or GitHub. No arguments; the PR is
#   1. the number in ~/.cache/cellular-viz-runner/test-pr (or $TEST_PR_FILE), written by QA box's file tool, else
#   2. the newest open PR labelled runner-test (gh, the box's login).
# QA box types it the same way every time:
#   sh /path/to/cellular-viz-runner/qa/test-pr.sh
set -u
REPO=borboss366/cellular-viz
DIR=/tmp/test-pr
PR_FILE=${TEST_PR_FILE:-$HOME/.cache/cellular-viz-runner/test-pr}

PR=""
if [ -f "$PR_FILE" ]; then
  PR=$(tr -cd '0-9' < "$PR_FILE")
  [ -n "$PR" ] && echo "PR #$PR (from $PR_FILE)"
fi
if [ -z "$PR" ]; then
  PR=$(gh pr list --repo "$REPO" --label runner-test --state open --limit 1 --json number --jq '.[0].number // empty' 2>/dev/null)
  [ -n "$PR" ] && echo "PR #$PR (newest open PR labelled runner-test)"
fi
if [ -z "$PR" ]; then
  echo "test-pr: no PR: write its number to $PR_FILE or label it runner-test"
  exit 2
fi

if [ ! -d "$DIR/.git" ]; then
  rm -rf "$DIR"
  git clone -q "https://github.com/$REPO.git" "$DIR" || { echo "test-pr: clone failed"; exit 2; }
fi
git -C "$DIR" fetch -q --force origin "+pull/$PR/head:refs/remotes/origin/pr/$PR" || { echo "test-pr: fetch of pull/$PR/head failed"; exit 2; }
git -C "$DIR" checkout -q -f --detach "origin/pr/$PR" && git -C "$DIR" clean -q -fdx
echo "at $(git -C "$DIR" log -1 --format='%h %s')"
cd "$DIR" || exit 2

FAIL=0
echo "== node --check qa/runner/*.mjs"
CHECKED=0
for f in qa/runner/*.mjs; do
  [ -f "$f" ] || continue
  CHECKED=$((CHECKED + 1))
  node --check "$f" || { echo "syntax error: $f"; FAIL=1; }
done
echo "$CHECKED files checked"

echo "== node --test qa/runner/test/*.test.mjs"
TESTS=$(ls qa/runner/test/*.test.mjs 2>/dev/null)
if [ -z "$TESTS" ]; then
  echo "no test files"
  FAIL=1
else
  OUT=$(mktemp)
  # the TAP tail (# tests, # pass, # fail …) is the summary; failing tests are listed before it
  node --test --test-reporter=tap $TESTS > "$OUT" 2>&1
  RC=$?
  grep -E '^not ok|^# (tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)' "$OUT"
  if [ $RC -ne 0 ]; then
    FAIL=1
    echo "-- first failure:"
    awk '/^ *not ok/{p=1} p{print; if (++n >= 25) exit}' "$OUT"
  fi
  rm -f "$OUT"
fi

if [ $FAIL -eq 0 ]; then echo "PASS: PR #$PR"; else echo "FAIL: PR #$PR"; fi
exit $FAIL
