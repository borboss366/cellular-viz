#!/bin/sh
# 2026-10-31-1933-runner-pr149-13-flow-lab: runner build viz-149-2, #149 13-flow-lab @beb07ee, checks from main; result: viz-149-2 running 20/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 149 --commit beb07ee
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/pages.tar beb07ee9393eecb05ac54389e531fd2f6a8c4321 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-149-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/tree/qa/check-13.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-NihF8Y/tree/experiments --page 13-flow-lab.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-31-1928/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-149-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-31-1928
