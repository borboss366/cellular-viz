#!/bin/sh
# 2026-10-27-1422-runner-pr68-14-round-point: runner build viz-68-1, #68 14-round-point @ac9d3d3, checks from qa/headless-runner; result: viz-68-1 running 10/10
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 68 --commit ac9d3d3
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/pages.tar ac9d3d3ae8c8d27742cde1a846df5fdca367a837 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-68-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-an5l8x/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-68-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-27-1422
