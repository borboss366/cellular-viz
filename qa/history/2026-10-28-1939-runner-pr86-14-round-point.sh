#!/bin/sh
# 2026-10-28-1939-runner-pr86-14-round-point: runner build viz-86-14, #86 14-round-point @3c65036, checks from qa/headless-runner; result: viz-86-14 failed 0/1
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 86 --commit 3c65036
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/pages.tar 3c650363d83389d01127e28b96361d7f11b254d2 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-86-14 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VNXYDK/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-86-14 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-28-1937-runner
