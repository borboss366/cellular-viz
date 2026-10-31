#!/bin/sh
# 2026-10-31-1425-runner-pr142-25-shape-shifter-2: runner build viz-142-4, #142 25-shape-shifter-2 @e73a252, checks from main; result: viz-142-4 running 26/26
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/142/head:refs/runner/pr-142 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 142 --commit e73a252
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/142/head:refs/runner/pr-142 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/pages.tar e73a252fc679e6cf8b6f112b0bd7e2eb8099a1e3 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-142-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IMlmlA/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-31-1419/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-142-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-31-1419
