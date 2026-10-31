#!/bin/sh
# 2026-10-31-1958-runner-pr149-23-shape-shifter: runner build viz-149-5, #149 23-shape-shifter @beb07ee, checks from main; result: viz-149-5 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 149 --commit beb07ee
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/pages.tar beb07ee9393eecb05ac54389e531fd2f6a8c4321 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-149-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ls9oNL/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-31-1953/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-149-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-31-1953
