#!/bin/sh
# 2026-10-31-0155-runner-pr136-09-riemann: runner build viz-136-4, #136 09-riemann @8310b69, checks from main; result: viz-136-4 running 24/24
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 09-riemann --pr 136 --commit 8310b69
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/pages.tar 8310b69ebf641df81287a21a0ad46255d1d7d7ca experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/tree/qa/check-09.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TOc7Kp/tree/experiments --page 09-riemann.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-31-0150/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-31-0150
