#!/bin/sh
# 2026-10-31-1533-runner-pr146-16-hodge-kaleidoscope: runner build viz-146-2, #146 16-hodge-kaleidoscope @bca5055, checks from main; result: viz-146-2 running 12/12
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 146 --commit bca5055
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/pages.tar bca50558ad8f63a704178f9bb0ddcdfa07c4377d experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-146-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-1rp9Kc/tree/experiments --page 16-hodge-kaleidoscope.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-31-1528-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-146-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-31-1528-runner
