#!/bin/sh
# 2026-10-29-1451-runner-pr104-25-shape-shifter-2: runner build viz-104-10, #104 25-shape-shifter-2 @a06a149, checks from main; result: viz-104-10 failed 19/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit a06a149
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/pages.tar a06a14922746f3e2aafcf7dcafb357a18629e518 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-10 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-GU3TJP/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1445/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-10 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1445
