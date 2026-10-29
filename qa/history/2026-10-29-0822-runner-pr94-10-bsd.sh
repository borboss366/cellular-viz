#!/bin/sh
# 2026-10-29-0822-runner-pr94-10-bsd: runner build viz-94-17, #94 10-bsd @d85d49f, checks from main; result: viz-94-17 running 16/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 10-bsd --pr 94 --commit d85d49f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/pages.tar d85d49f56b673b38989c2402afaeb43e13c5dbeb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-17 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/tree/qa/check-10.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-T1Jq1m/tree/experiments --page 10-bsd.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-29-0817/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-17 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/10-bsd/checks/2026-10-29-0817
