#!/bin/sh
# 2026-10-29-1951-runner-pr121-14-round-point: runner build viz-121-5, #121 14-round-point @5ec996f, checks from main; result: viz-121-5 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 121 --commit 5ec996f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/pages.tar 5ec996fb1a4533b54e9020eca7de5eac9fb467d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-121-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XD4Zyw/tree/experiments --page 14-round-point.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-1947/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-121-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-1947
