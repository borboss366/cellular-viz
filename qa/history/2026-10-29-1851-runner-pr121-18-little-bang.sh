#!/bin/sh
# 2026-10-29-1851-runner-pr121-18-little-bang: runner build viz-121-3, #121 18-little-bang @c22447e, checks from main; result: viz-121-3 running 31/31
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 121 --commit c22447e
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/pages.tar c22447e9e888e8e6e421cf66bbb43ea1addd01cc experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-121-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/tree/qa/check-18.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VcayLH/tree/experiments --page 18-little-bang.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-29-1847/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-121-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-29-1847
