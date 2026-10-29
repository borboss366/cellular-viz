#!/bin/sh
# 2026-10-29-1422-runner-pr104-23-shape-shifter: runner build viz-104-9, #104 23-shape-shifter @a06a149, checks from main; result: viz-104-9 running 18/18
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit a06a149
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/pages.tar a06a14922746f3e2aafcf7dcafb357a18629e518 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-9 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-U6E0wn/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1416/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-9 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1416
