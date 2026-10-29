#!/bin/sh
# 2026-10-29-1840-runner-pr121-14-round-point: runner build viz-121-2, #121 14-round-point @c22447e, checks from main; result: viz-121-2 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 121 --commit c22447e
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/pages.tar c22447e9e888e8e6e421cf66bbb43ea1addd01cc experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-121-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-rfwXCi/tree/experiments --page 14-round-point.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-1835/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-121-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-1835
