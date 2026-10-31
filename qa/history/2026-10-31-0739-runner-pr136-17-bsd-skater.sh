#!/bin/sh
# 2026-10-31-0739-runner-pr136-17-bsd-skater: runner build viz-136-14, #136 17-bsd-skater @dd93ae6, checks from main; result: viz-136-14 running 13/13
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 17-bsd-skater --pr 136 --commit dd93ae6
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/pages.tar dd93ae6980a72315ec13f6a83e7923e0f0a4ea3e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-14 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/tree/qa/check-17.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-V2Xb1r/tree/experiments --page 17-bsd-skater.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/17-bsd-skater/checks/2026-10-31-0734/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-14 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/17-bsd-skater/checks/2026-10-31-0734
