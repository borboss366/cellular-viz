#!/bin/sh
# 2026-10-29-0414-runner-pr94-10-bsd: runner build viz-94-12, #94 10-bsd @ef5dc84, checks from main; result: viz-94-12 running 16/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 10-bsd --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-12 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/tree/qa/check-10.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mA3GdY/tree/experiments --page 10-bsd.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-29-0409/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-12 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-29-0409
