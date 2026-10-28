#!/bin/sh
# 2026-10-28-2119-runner-pr94-13-flow-lab: runner build viz-94-5, #94 13-flow-lab @05bb4aa, checks from qa/headless-runner; result: viz-94-5 running 18/18
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 94 --commit 05bb4aa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/pages.tar 05bb4aa1612d65f5cd67ba1abe4db9312bb20b80 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/tree/qa/check-13.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-BzsBFS/tree/experiments --page 13-flow-lab.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-28-2114/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-28-2114
