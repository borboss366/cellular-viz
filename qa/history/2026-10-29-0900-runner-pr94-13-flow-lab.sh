#!/bin/sh
# 2026-10-29-0900-runner-pr94-13-flow-lab: runner build viz-94-20, #94 13-flow-lab @d85d49f, checks from main; result: viz-94-20 running 18/18
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 94 --commit d85d49f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/pages.tar d85d49f56b673b38989c2402afaeb43e13c5dbeb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-20 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/tree/qa/check-13.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Kjd9Ck/tree/experiments --page 13-flow-lab.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-29-0855/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-20 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/checks/2026-10-29-0855
