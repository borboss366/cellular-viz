#!/bin/sh
# 2026-10-29-1831-runner-pr121-12-mass-gap: runner build viz-121-1, #121 12-mass-gap @c22447e, checks from main; result: viz-121-1 failed 21/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 121 --commit c22447e
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/pages.tar c22447e9e888e8e6e421cf66bbb43ea1addd01cc experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-121-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Xm7D2A/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-29-1826/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-121-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-29-1826
