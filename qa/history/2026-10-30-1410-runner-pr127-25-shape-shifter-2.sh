#!/bin/sh
# 2026-10-30-1410-runner-pr127-25-shape-shifter-2: runner build viz-127-9, #127 25-shape-shifter-2 @93ddd18, checks from main; result: viz-127-9 failed 24/26
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 127 --commit 93ddd18
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/pages.tar 93ddd18383875e500442151f58aea90a95389367 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-9 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VxOUkN/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1405/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-9 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1405
