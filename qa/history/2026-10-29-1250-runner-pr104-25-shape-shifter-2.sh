#!/bin/sh
# 2026-10-29-1250-runner-pr104-25-shape-shifter-2: runner build viz-104-6, #104 25-shape-shifter-2 @d84df2e, checks from main; result: viz-104-6 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit d84df2e
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/pages.tar d84df2ecf35e715059a139840d59e1899443ba0e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ewpb0C/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1244/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1244
