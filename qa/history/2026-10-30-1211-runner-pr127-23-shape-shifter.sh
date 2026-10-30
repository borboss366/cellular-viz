#!/bin/sh
# 2026-10-30-1211-runner-pr127-23-shape-shifter: runner build viz-127-5, #127 23-shape-shifter @bfa58f8, checks from main; result: viz-127-5 failed 21/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 127 --commit bfa58f8
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/pages.tar bfa58f818fba18c431b79f47c7a7c1da8fef5adb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-PKRgrC/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-30-1206/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-30-1206
