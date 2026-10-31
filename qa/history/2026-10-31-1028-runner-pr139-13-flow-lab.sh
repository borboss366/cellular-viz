#!/bin/sh
# 2026-10-31-1028-runner-pr139-13-flow-lab: runner build viz-139-3, #139 13-flow-lab @2ee4686, checks from main; result: viz-139-3 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 139 --commit 2ee4686
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/pages.tar 2ee4686bca4b761e3f597c7385599936b6a4ac50 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-139-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/tree/qa/check-13.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7pcKlb/tree/experiments --page 13-flow-lab.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-31-1024/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-139-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-31-1024
