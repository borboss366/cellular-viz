#!/bin/sh
# 2026-10-28-2049-runner-pr94-11-riemann-show: runner build viz-94-3, #94 11-riemann-show @05bb4aa, checks from qa/headless-runner; result: viz-94-3 running 14/14
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 11-riemann-show --pr 94 --commit 05bb4aa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/pages.tar 05bb4aa1612d65f5cd67ba1abe4db9312bb20b80 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/tree/qa/check-11.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Nv4CXp/tree/experiments --page 11-riemann-show.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-28-2044/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-28-2044
