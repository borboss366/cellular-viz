#!/bin/sh
# 2026-10-29-1202-runner-pr104-25-shape-shifter-2: runner build viz-104-4, #104 25-shape-shifter-2 @081388c, checks from main; result: viz-104-4 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 081388c
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/pages.tar 081388c5d12141e24f155b47179819ad27685360 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HbCgy4/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1157/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1157
