#!/bin/sh
# PR #65 (runner-after-build @1e2549d): unit tests, syntax, board.mjs sync --dry against the real board,
# and post.mjs commit-reports in a throwaway copy of the QA tree. Scratch checkout /tmp/pr65; service untouched.
R=/home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
SHA=${1:-1e2549d}
cd $R && git fetch -q origin runner-after-build
rm -rf /tmp/pr65 /tmp/pr65-state /tmp/pr65-qa && mkdir -p /tmp/pr65 /tmp/pr65-state
git archive $SHA | tar -x -C /tmp/pr65
cd /tmp/pr65
echo "== 1 unit tests"; node --test qa/runner/test/*.test.mjs; echo "exit $?"
echo "== 2 syntax"
for f in qa/runner/runner.mjs qa/runner/board.mjs qa/runner/post.mjs; do node --check $f && echo "ok $f"; done
for f in qa/board-sync.sh qa/commit-reports.sh qa/run-next.sh qa/runner/settings.sh; do sh -n $f && echo "ok $f"; done
echo "== 3 board dry"
QA_HOME=$R RUNNER_STATE=/tmp/pr65-state node qa/runner/board.mjs sync --dry; echo "exit $?"
echo "== 4 commit-reports in a throwaway copy"
git clone -q $R /tmp/pr65-qa && cp -a $R/qa/. /tmp/pr65-qa/qa/ 2>/dev/null
git -C /tmp/pr65-qa status --porcelain | head -40
QA_HOME=/tmp/pr65-qa node qa/runner/post.mjs commit-reports; echo "exit $?"
git -C /tmp/pr65-qa log -1 --stat --format='%an <%ae>%n%n%B' | head -80
git -C /tmp/pr65-qa status --porcelain | head -20
