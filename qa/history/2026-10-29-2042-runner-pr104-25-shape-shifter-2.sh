#!/bin/sh
# 2026-10-29-2042-runner-pr104-25-shape-shifter-2: runner build viz-104-14, #104 25-shape-shifter-2 @50c2ad1, checks from main; result: viz-104-14 failed 21/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 50c2ad1
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/pages.tar 50c2ad1ee570bdca752bcce2b8f7943ade5d8988 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-14 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-FMDGHE/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-2036/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-14 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-2036
