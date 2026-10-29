#!/bin/sh
# 2026-10-29-0814-runner-pr94-09-riemann: runner build viz-94-16, #94 09-riemann @d85d49f, checks from main; result: viz-94-16 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 09-riemann --pr 94 --commit d85d49f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/pages.tar d85d49f56b673b38989c2402afaeb43e13c5dbeb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-16 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/tree/qa/check-09.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-6AIHzP/tree/experiments --page 09-riemann.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-29-0809/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-16 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-29-0809
