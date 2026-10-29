#!/bin/sh
# 2026-10-29-1353-runner-pr104-25-shape-shifter-2: runner build viz-104-8, #104 25-shape-shifter-2 @3ff423f, checks from main; result: viz-104-8 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 3ff423f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/pages.tar 3ff423f6be586a46617bd00edaf0fd7b0e8c1c9a experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-8 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-bvrKL3/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1348/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-8 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1348
