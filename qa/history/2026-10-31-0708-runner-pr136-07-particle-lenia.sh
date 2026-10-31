#!/bin/sh
# 2026-10-31-0708-runner-pr136-07-particle-lenia: runner build viz-136-10, #136 07-particle-lenia @dd93ae6, checks from main; result: viz-136-10 running 9/9
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 07-particle-lenia --pr 136 --commit dd93ae6
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/pages.tar dd93ae6980a72315ec13f6a83e7923e0f0a4ea3e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-10 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-oZGnQr/tree/experiments --page 07-particle-lenia.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/07-particle-lenia/checks/2026-10-31-0703-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-10 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/07-particle-lenia/checks/2026-10-31-0703-runner
