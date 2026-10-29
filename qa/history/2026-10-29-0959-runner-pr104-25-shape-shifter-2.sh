#!/bin/sh
# 2026-10-29-0959-runner-pr104-25-shape-shifter-2: runner build viz-104-2, #104 25-shape-shifter-2 @0774590, checks from main; result: viz-104-2 running 19/19
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 104 --commit 0774590
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/pages.tar 077459094d0006d7a7e7a0e8449a78a4a116e7cd experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/tree/qa/check-25.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-hQ3aZv/tree/experiments --page 25-shape-shifter-2.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-0953/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/checks/2026-10-29-0953
