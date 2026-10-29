#!/bin/sh
# 2026-10-29-1014-runner-pr94-10-bsd: runner build viz-94-24, #94 10-bsd @6a8f0c2, checks from main; result: viz-94-24 running 16/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 10-bsd --pr 94 --commit 6a8f0c2
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/pages.tar 6a8f0c21021d92dc3da89a76932022990865ba37 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-24 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/tree/qa/check-10.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-v5PaaD/tree/experiments --page 10-bsd.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-29-1009/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-24 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-29-1009
