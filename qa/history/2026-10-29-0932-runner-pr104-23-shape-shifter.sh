#!/bin/sh
# 2026-10-29-0932-runner-pr104-23-shape-shifter: runner build viz-104-1, #104 23-shape-shifter @0774590, checks from main; result: viz-104-1 failed 16/17
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 0774590
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/pages.tar 077459094d0006d7a7e7a0e8449a78a4a116e7cd experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Oj9WsX/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-0926/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-0926
