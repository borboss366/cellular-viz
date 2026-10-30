#!/bin/sh
# 2026-10-30-0934-runner-pr104-25-shape-shifter-2: runner build viz-104-18, #104 25-shape-shifter-2 @91aa5a8, checks from main; result: viz-104-18 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 91aa5a8
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/pages.tar 91aa5a8797202813599fba5899aef5ee3b958fe9 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-18 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-YSA7az/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-0928/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-18 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-30-0928
