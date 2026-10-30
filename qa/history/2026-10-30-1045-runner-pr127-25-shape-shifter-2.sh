#!/bin/sh
# 2026-10-30-1045-runner-pr127-25-shape-shifter-2: runner build viz-127-3, #127 25-shape-shifter-2 @5c41015, checks from main; result: viz-127-3 failed 24/26
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 127 --commit 5c41015
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/pages.tar 5c41015198a3859694e06665da18472361cea275 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-j7YDVq/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1039/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1039
