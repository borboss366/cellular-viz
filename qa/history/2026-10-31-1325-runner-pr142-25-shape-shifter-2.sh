#!/bin/sh
# 2026-10-31-1325-runner-pr142-25-shape-shifter-2: runner build viz-142-2, #142 25-shape-shifter-2 @e17ff7f, checks from main; result: viz-142-2 failed 25/26
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/142/head:refs/runner/pr-142 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 142 --commit e17ff7f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/142/head:refs/runner/pr-142 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/pages.tar e17ff7f1eeddfd8f408a2e9c598b081a5e4ccb17 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-142-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-WZdUbd/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-31-1320/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-142-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-31-1320
