#!/bin/sh
# 2026-10-29-0830-runner-pr94-11-riemann-show: runner build viz-94-18, #94 11-riemann-show @d85d49f, checks from main; result: viz-94-18 running 14/14
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 11-riemann-show --pr 94 --commit d85d49f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/pages.tar d85d49f56b673b38989c2402afaeb43e13c5dbeb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-18 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/tree/qa/check-11.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-VFaNGh/tree/experiments --page 11-riemann-show.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-29-0825/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-18 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-29-0825
