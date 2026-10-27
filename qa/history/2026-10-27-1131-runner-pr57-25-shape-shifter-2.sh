#!/bin/sh
# 2026-10-27-1131-runner-pr57-25-shape-shifter-2: runner build viz-57-7, #57 25-shape-shifter-2 @9dd0310, checks from qa/headless-runner; result: viz-57-7 failed 10/11
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 57 --commit 9dd0310
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/57/head:refs/runner/pr-57 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/pages.tar 9dd0310a8050903772252c3a1c0af3935c8b6a45 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-57-7 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-AkbnyQ/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-57-7 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-27-1131
