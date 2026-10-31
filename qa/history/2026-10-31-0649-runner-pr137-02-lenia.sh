#!/bin/sh
# 2026-10-31-0649-runner-pr137-02-lenia: runner build viz-137-5, #137 02-lenia @997bfa6, checks from main; result: viz-137-5 running 10/10
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/137/head:refs/runner/pr-137 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 02-lenia --pr 137 --commit 997bfa6
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/137/head:refs/runner/pr-137 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/pages.tar 997bfa656bee0d6aabb32bbb369bc484c876c77a experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-137-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-7rpt4N/tree/experiments --page 02-lenia.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/02-lenia/checks/2026-10-31-0644-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-137-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/02-lenia/checks/2026-10-31-0644-runner
