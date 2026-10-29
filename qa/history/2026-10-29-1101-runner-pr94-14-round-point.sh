#!/bin/sh
# 2026-10-29-1101-runner-pr94-14-round-point: runner build viz-94-28, #94 14-round-point @6a8f0c2, checks from main; result: viz-94-28 running 22/22
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 94 --commit 6a8f0c2
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/pages.tar 6a8f0c21021d92dc3da89a76932022990865ba37 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-28 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/tree/qa/check-14.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ZHbUZu/tree/experiments --page 14-round-point.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-1056/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-28 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/checks/2026-10-29-1056
