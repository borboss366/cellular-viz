#!/bin/sh
# 2026-10-31-1551-runner-pr146-16-hodge-kaleidoscope: runner build viz-146-4, #146 16-hodge-kaleidoscope @1bb9b67, checks from main; result: viz-146-4 running 12/12
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 146 --commit 1bb9b67
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/pages.tar 1bb9b675921d91e7315c036fd8349644a1f386db experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-146-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fXd0w1/tree/experiments --page 16-hodge-kaleidoscope.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-31-1546-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-146-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-31-1546-runner
