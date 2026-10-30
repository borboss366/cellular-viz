#!/bin/sh
# 2026-10-30-0157-runner-pr104-25-shape-shifter-2: runner build viz-104-16, #104 25-shape-shifter-2 @91360fd, checks from main; result: viz-104-16 failed 22/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 91360fd
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/pages.tar 91360fda383e9c0e3943dc8f7e4df655f415edac experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-16 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aLEMkK/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-0152/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-16 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-0152
