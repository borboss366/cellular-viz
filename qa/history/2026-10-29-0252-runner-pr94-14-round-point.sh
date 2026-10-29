#!/bin/sh
# 2026-10-29-0252-runner-pr94-14-round-point: runner build viz-94-6, #94 14-round-point @ef5dc84, checks from main; result: viz-94-6 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-qc196w/tree/experiments --page 14-round-point.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-0247/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-0247
