#!/bin/sh
# 2026-10-29-0406-runner-pr94-09-riemann: runner build viz-94-11, #94 09-riemann @ef5dc84, checks from main; result: viz-94-11 running 23/23
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 09-riemann --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-11 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/tree/qa/check-09.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-wTfom8/tree/experiments --page 09-riemann.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-29-0401/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-11 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/09-riemann/checks/2026-10-29-0401
