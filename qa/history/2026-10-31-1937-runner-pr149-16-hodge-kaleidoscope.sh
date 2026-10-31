#!/bin/sh
# 2026-10-31-1937-runner-pr149-16-hodge-kaleidoscope: runner build viz-149-3, #149 16-hodge-kaleidoscope @beb07ee, checks from main; result: viz-149-3 running 12/12
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 149 --commit beb07ee
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/149/head:refs/runner/pr-149 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/pages.tar beb07ee9393eecb05ac54389e531fd2f6a8c4321 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-149-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZROasK/tree/experiments --page 16-hodge-kaleidoscope.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-31-1933-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-149-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-31-1933-runner
