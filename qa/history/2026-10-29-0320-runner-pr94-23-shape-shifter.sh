#!/bin/sh
# 2026-10-29-0320-runner-pr94-23-shape-shifter: runner build viz-94-9, #94 23-shape-shifter @ef5dc84, checks from main; result: viz-94-9 failed 14/18
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-9 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-3XzJh4/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-0315/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-9 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-0315
