#!/bin/sh
# 2026-10-31-0958-runner-pr139-11-riemann-show: runner build viz-139-1, #139 11-riemann-show @2ee4686, checks from main; result: viz-139-1 running 16/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 11-riemann-show --pr 139 --commit 2ee4686
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/pages.tar 2ee4686bca4b761e3f597c7385599936b6a4ac50 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-139-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/tree/qa/check-11.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-O3rDdH/tree/experiments --page 11-riemann-show.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-31-0953/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-139-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-31-0953
