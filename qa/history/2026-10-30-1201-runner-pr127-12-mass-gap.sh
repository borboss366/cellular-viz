#!/bin/sh
# 2026-10-30-1201-runner-pr127-12-mass-gap: runner build viz-127-4, #127 12-mass-gap @bfa58f8, checks from main; result: viz-127-4 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 127 --commit bfa58f8
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/pages.tar bfa58f818fba18c431b79f47c7a7c1da8fef5adb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WSy2J4/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-30-1156/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-30-1156
