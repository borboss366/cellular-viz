#!/bin/sh
# 2026-10-27-1802-runner-pr68-14-round-point: runner build viz-68-3, #68 14-round-point @953bac4, checks from qa/headless-runner; result: failed: qa/experiments/68.json is valid
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 953bac4a48a2a1495b62fa27edea8a69fd593add:qa/experiments/68.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 953bac4a48a2a1495b62fa27edea8a69fd593add:qa/experiments/68.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 68 --commit 953bac4
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-68-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/runs/2026-10-27-1802-pr68 --status failed --waiting dev --note 'qa/experiments/68.json is valid'
