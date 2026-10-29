#!/bin/sh
# 2026-10-29-1646-runner-pr104-23-shape-shifter: runner build viz-104-11, #104 23-shape-shifter @3f9b51a, checks from main; result: viz-104-11 running 14/14
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 3f9b51a
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/pages.tar 3f9b51af073f925e717386faa275c260abd38506 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-11 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rcVBs9/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1640/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-11 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1640
