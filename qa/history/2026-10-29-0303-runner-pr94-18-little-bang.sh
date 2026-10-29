#!/bin/sh
# 2026-10-29-0303-runner-pr94-18-little-bang: runner build viz-94-7, #94 18-little-bang @ef5dc84, checks from main; result: viz-94-7 running 30/30
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-7 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/tree/qa/check-18.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-0n5Fhp/tree/experiments --page 18-little-bang.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-29-0258/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-7 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-29-0258
