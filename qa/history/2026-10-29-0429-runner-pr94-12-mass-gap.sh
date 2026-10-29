#!/bin/sh
# 2026-10-29-0429-runner-pr94-12-mass-gap: runner build viz-94-14, #94 12-mass-gap @ef5dc84, checks from main; result: viz-94-14 running 21/21
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-14 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IioKDO/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-29-0424/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-14 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-29-0424
