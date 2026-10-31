#!/bin/sh
# 2026-10-31-2028-runner-pr149-25-shape-shifter-2: runner build viz-149-6, #149 25-shape-shifter-2 @beb07ee, checks from main; result: viz-149-6 running 26/26
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 149 --commit beb07ee
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/pages.tar beb07ee9393eecb05ac54389e531fd2f6a8c4321 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-149-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-SEc6G4/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-31-2022/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-149-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-31-2022
