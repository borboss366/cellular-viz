#!/bin/sh
# 2026-10-29-1822-runner-pr104-25-shape-shifter-2: runner build viz-104-12, #104 25-shape-shifter-2 @3f9b51a, checks from main; result: viz-104-12 failed 6/7
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 3f9b51a
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/pages.tar 3f9b51af073f925e717386faa275c260abd38506 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-12 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ju8gjP/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1646-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-12 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-1646-runner
