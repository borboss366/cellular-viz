#!/bin/sh
# 2026-10-28-2041-runner-pr94-10-bsd: runner build viz-94-2, #94 10-bsd @05bb4aa, checks from qa/headless-runner; result: viz-94-2 running 16/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 10-bsd --pr 94 --commit 05bb4aa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/pages.tar 05bb4aa1612d65f5cd67ba1abe4db9312bb20b80 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/tree/qa/check-10.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-i8tmFS/tree/experiments --page 10-bsd.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-28-2036/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-28-2036
