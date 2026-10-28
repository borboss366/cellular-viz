#!/bin/sh
# 2026-10-28-1214-runner-pr75-18-little-bang: runner build viz-75-1, #75 18-little-bang @10e047b, checks from qa/headless-runner; result: viz-75-1 running 11/11
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 75 --commit 10e047b
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/pages.tar 10e047b9323586eb10703cf620b2650b48c0843e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-75-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/tree/qa/check-18.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C6BI5v/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-75-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-28-1214
