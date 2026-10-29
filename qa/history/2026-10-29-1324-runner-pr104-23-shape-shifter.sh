#!/bin/sh
# 2026-10-29-1324-runner-pr104-23-shape-shifter: runner build viz-104-7, #104 23-shape-shifter @3ff423f, checks from main; result: viz-104-7 running 17/17
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 3ff423f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/pages.tar 3ff423f6be586a46617bd00edaf0fd7b0e8c1c9a experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-7 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-pd5Hlz/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1318/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-7 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1318
