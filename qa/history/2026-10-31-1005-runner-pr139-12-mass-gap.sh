#!/bin/sh
# 2026-10-31-1005-runner-pr139-12-mass-gap: runner build viz-139-2, #139 12-mass-gap @2ee4686, checks from main; result: viz-139-2 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 12-mass-gap --pr 139 --commit 2ee4686
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/pages.tar 2ee4686bca4b761e3f597c7385599936b6a4ac50 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-139-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/tree/qa/check-12.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-o1niod/tree/experiments --page 12-mass-gap.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-31-1000/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-139-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/12-mass-gap/checks/2026-10-31-1000
