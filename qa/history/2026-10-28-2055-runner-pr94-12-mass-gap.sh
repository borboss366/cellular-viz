#!/bin/sh
# 2026-10-28-2055-runner-pr94-12-mass-gap: runner build viz-94-4, #94 12-mass-gap @05bb4aa, checks from qa/headless-runner; result: viz-94-4 failed 17/21
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 94 --commit 05bb4aa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/pages.tar 05bb4aa1612d65f5cd67ba1abe4db9312bb20b80 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lEcjG5/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-28-2051/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-28-2051
