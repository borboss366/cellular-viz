#!/bin/sh
# 2026-10-29-0452-runner-pr94-13-flow-lab: runner build viz-94-15, #94 13-flow-lab @ef5dc84, checks from main; result: viz-94-15 running 18/18
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-15 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/tree/qa/check-13.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-xEY4c0/tree/experiments --page 13-flow-lab.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-29-0447/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-15 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-29-0447
