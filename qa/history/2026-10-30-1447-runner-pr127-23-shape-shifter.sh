#!/bin/sh
# 2026-10-30-1447-runner-pr127-23-shape-shifter: runner build viz-127-11, #127 23-shape-shifter @c774e09, checks from main; result: viz-127-11 running 21/21
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 127 --commit c774e09
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/pages.tar c774e095c8f8c8b7c5ba4804773ed8cf17b159f1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-11 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-to6LBT/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-30-1441/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-11 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-30-1441
