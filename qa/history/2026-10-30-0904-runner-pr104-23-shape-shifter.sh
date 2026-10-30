#!/bin/sh
# 2026-10-30-0904-runner-pr104-23-shape-shifter: runner build viz-104-17, #104 23-shape-shifter @91aa5a8, checks from main; result: viz-104-17 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 91aa5a8
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/pages.tar 91aa5a8797202813599fba5899aef5ee3b958fe9 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-17 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-aAfNwj/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-30-0858/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-17 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-30-0858
