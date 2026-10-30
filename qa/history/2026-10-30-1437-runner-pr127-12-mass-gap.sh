#!/bin/sh
# 2026-10-30-1437-runner-pr127-12-mass-gap: runner build viz-127-10, #127 12-mass-gap @c774e09, checks from main; result: viz-127-10 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 127 --commit c774e09
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/pages.tar c774e095c8f8c8b7c5ba4804773ed8cf17b159f1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-10 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3hEHuU/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-30-1432/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-10 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-30-1432
