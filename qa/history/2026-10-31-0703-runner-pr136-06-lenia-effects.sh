#!/bin/sh
# 2026-10-31-0703-runner-pr136-06-lenia-effects: runner build viz-136-9, #136 06-lenia-effects @dd93ae6, checks from main; result: viz-136-9 running 8/8
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 06-lenia-effects --pr 136 --commit dd93ae6
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/pages.tar dd93ae6980a72315ec13f6a83e7923e0f0a4ea3e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-9 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-IBIAcT/tree/experiments --page 06-lenia-effects.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/06-lenia-effects/checks/2026-10-31-0659-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-9 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/06-lenia-effects/checks/2026-10-31-0659-runner
