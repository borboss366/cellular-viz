#!/bin/sh
# 2026-10-28-1910-runner-pr86-09-riemann: runner build viz-86-9, #86 09-riemann @3c65036, checks from qa/headless-runner; result: viz-86-9 failed 15/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 09-riemann --pr 86 --commit 3c65036
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/pages.tar 3c650363d83389d01127e28b96361d7f11b254d2 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-86-9 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/tree/qa/check-09.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-DlI2nV/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-86-9 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-28-1910
