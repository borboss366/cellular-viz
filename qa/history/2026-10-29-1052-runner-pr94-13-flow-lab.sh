#!/bin/sh
# 2026-10-29-1052-runner-pr94-13-flow-lab: runner build viz-94-27, #94 13-flow-lab @6a8f0c2, checks from main; result: viz-94-27 running 18/18
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 94 --commit 6a8f0c2
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/pages.tar 6a8f0c21021d92dc3da89a76932022990865ba37 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-27 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/tree/qa/check-13.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-LpdDzk/tree/experiments --page 13-flow-lab.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-29-1047/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-27 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-29-1047
