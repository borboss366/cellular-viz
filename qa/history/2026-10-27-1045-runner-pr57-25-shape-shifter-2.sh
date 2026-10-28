#!/bin/sh
# 2026-10-27-1045-runner-pr57-25-shape-shifter-2: runner build viz-57-6, #57 25-shape-shifter-2 @9a7dc87, checks from qa/headless-runner; result: viz-57-6 failed 9/11
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 57 --commit 9a7dc87
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/57/head:refs/runner/pr-57 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/pages.tar 9a7dc87dba4ab8e1bfb5d8adafeba6f44b82893f experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-57-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-4VR5ui/tree/experiments
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-57-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-27-1045
