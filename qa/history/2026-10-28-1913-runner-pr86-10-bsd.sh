#!/bin/sh
# 2026-10-28-1913-runner-pr86-10-bsd: runner build viz-86-10, #86 10-bsd @3c65036, checks from qa/headless-runner; result: viz-86-10 failed 7/8
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 10-bsd --pr 86 --commit 3c65036
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/pages.tar 3c650363d83389d01127e28b96361d7f11b254d2 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-86-10 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/tree/qa/check-10.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-RWp3nK/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-86-10 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-28-1913
