#!/bin/sh
# 2026-10-29-0422-runner-pr94-11-riemann-show: runner build viz-94-13, #94 11-riemann-show @ef5dc84, checks from main; result: viz-94-13 running 14/14
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 11-riemann-show --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-13 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/tree/qa/check-11.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-C0a96F/tree/experiments --page 11-riemann-show.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-29-0417/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-13 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-29-0417
