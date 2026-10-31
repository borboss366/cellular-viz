#!/bin/sh
# 2026-10-31-0221-runner-pr136-17-bsd-skater: runner build viz-136-7, #136 17-bsd-skater @8310b69, checks from main; result: viz-136-7 running 12/12
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 17-bsd-skater --pr 136 --commit 8310b69
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/pages.tar 8310b69ebf641df81287a21a0ad46255d1d7d7ca experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-7 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/tree/qa/check-17.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-51Sjw8/tree/experiments --page 17-bsd-skater.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/17-bsd-skater/checks/2026-10-31-0216/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-7 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/17-bsd-skater/checks/2026-10-31-0216
