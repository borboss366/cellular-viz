#!/bin/sh
# 2026-10-31-1948-runner-pr149-18-little-bang: runner build viz-149-4, #149 18-little-bang @beb07ee, checks from main; result: viz-149-4 running 32/32
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 149 --commit beb07ee
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/pages.tar beb07ee9393eecb05ac54389e531fd2f6a8c4321 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-149-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/tree/qa/check-18.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-p8GYIK/tree/experiments --page 18-little-bang.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-31-1944/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-149-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-31-1944
