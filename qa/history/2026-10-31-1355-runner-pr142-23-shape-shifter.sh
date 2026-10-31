#!/bin/sh
# 2026-10-31-1355-runner-pr142-23-shape-shifter: runner build viz-142-3, #142 23-shape-shifter @e73a252, checks from main; result: viz-142-3 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/142/head:refs/runner/pr-142 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 142 --commit e73a252
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/142/head:refs/runner/pr-142 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/pages.tar e73a252fc679e6cf8b6f112b0bd7e2eb8099a1e3 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-142-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-HBBlBq/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-31-1350/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-142-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-31-1350
