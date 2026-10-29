#!/bin/sh
# 2026-10-29-2002-runner-pr121-18-little-bang: runner build viz-121-6, #121 18-little-bang @5ec996f, checks from main; result: viz-121-6 running 31/31
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 121 --commit 5ec996f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/121/head:refs/runner/pr-121 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/pages.tar 5ec996fb1a4533b54e9020eca7de5eac9fb467d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-121-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/tree/qa/check-18.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-CabrM4/tree/experiments --page 18-little-bang.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-29-1958/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-121-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-29-1958
