#!/bin/sh
# 2026-10-29-2012-runner-pr104-23-shape-shifter: runner build viz-104-13, #104 23-shape-shifter @50c2ad1, checks from main; result: viz-104-13 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 50c2ad1
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/pages.tar 50c2ad1ee570bdca752bcce2b8f7943ade5d8988 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-13 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IlCvfM/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-2007/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-13 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-2007
