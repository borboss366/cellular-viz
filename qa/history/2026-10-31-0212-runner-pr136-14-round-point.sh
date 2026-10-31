#!/bin/sh
# 2026-10-31-0212-runner-pr136-14-round-point: runner build viz-136-6, #136 14-round-point @8310b69, checks from main; result: viz-136-6 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 136 --commit 8310b69
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/pages.tar 8310b69ebf641df81287a21a0ad46255d1d7d7ca experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LhVrKT/tree/experiments --page 14-round-point.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-31-0208/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-31-0208
