#!/bin/sh
# 2026-10-29-1942-runner-pr121-12-mass-gap: runner build viz-121-4, #121 12-mass-gap @5ec996f, checks from main; result: viz-121-4 failed 21/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 121 --commit 5ec996f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/pages.tar 5ec996fb1a4533b54e9020eca7de5eac9fb467d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-121-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-J41PYT/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-29-1937/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-121-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-29-1937
