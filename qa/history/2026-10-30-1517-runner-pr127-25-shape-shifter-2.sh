#!/bin/sh
# 2026-10-30-1517-runner-pr127-25-shape-shifter-2: runner build viz-127-12, #127 25-shape-shifter-2 @c774e09, checks from main; result: viz-127-12 running 25/25
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 127 --commit c774e09
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/127/head:refs/runner/pr-127 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/pages.tar c774e095c8f8c8b7c5ba4804773ed8cf17b159f1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-127-12 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-JNyqd2/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1511/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-127-12 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-1511
