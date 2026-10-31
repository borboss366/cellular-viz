#!/bin/sh
# 2026-10-31-0713-runner-pr136-09-riemann: runner build viz-136-11, #136 09-riemann @dd93ae6, checks from main; result: viz-136-11 running 25/25
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 09-riemann --pr 136 --commit dd93ae6
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/pages.tar dd93ae6980a72315ec13f6a83e7923e0f0a4ea3e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-11 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/tree/qa/check-09.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-OzFXQ3/tree/experiments --page 09-riemann.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-31-0708/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-11 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-31-0708
