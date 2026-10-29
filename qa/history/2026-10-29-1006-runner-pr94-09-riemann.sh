#!/bin/sh
# 2026-10-29-1006-runner-pr94-09-riemann: runner build viz-94-23, #94 09-riemann @6a8f0c2, checks from main; result: viz-94-23 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 09-riemann --pr 94 --commit 6a8f0c2
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/pages.tar 6a8f0c21021d92dc3da89a76932022990865ba37 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-23 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/tree/qa/check-09.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-MpFlIu/tree/experiments --page 09-riemann.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-29-1001/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-23 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-29-1001
