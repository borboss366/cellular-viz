#!/bin/sh
# 2026-10-29-2106-runner-pr104-23-shape-shifter: runner build viz-104-15, #104 23-shape-shifter @91360fd, checks from main; result: viz-104-15 running 19/19
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 91360fd
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/pages.tar 91360fda383e9c0e3943dc8f7e4df655f415edac experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-15 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Dzft9Y/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-2100/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-15 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-2100
