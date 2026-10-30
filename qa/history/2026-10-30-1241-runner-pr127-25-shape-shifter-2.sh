#!/bin/sh
# 2026-10-30-1241-runner-pr127-25-shape-shifter-2: runner build viz-127-6, #127 25-shape-shifter-2 @bfa58f8, checks from main; result: viz-127-6 failed 24/26
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 127 --commit bfa58f8
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/pages.tar bfa58f818fba18c431b79f47c7a7c1da8fef5adb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Bjhx4W/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1235/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1235
