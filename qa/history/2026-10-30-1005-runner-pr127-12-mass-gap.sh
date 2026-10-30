#!/bin/sh
# 2026-10-30-1005-runner-pr127-12-mass-gap: runner build viz-127-1, #127 12-mass-gap @5c41015, checks from main; result: viz-127-1 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 127 --commit 5c41015
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/pages.tar 5c41015198a3859694e06665da18472361cea275 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7Xj1FE/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-30-1000/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-30-1000
