#!/bin/sh
# 2026-10-30-0206-runner-pr124-pr-124: runner build viz-124-1, #124 pr-124 @c0401ab, checks from main; result: failed: qa/experiments/124.json is valid
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e c0401ab3b14985a9efc39dc3954100030d8c58fa:qa/experiments/124.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show c0401ab3b14985a9efc39dc3954100030d8c58fa:qa/experiments/124.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page pr-124 --pr 124 --commit c0401ab
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-124-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/pr-124/runs/2026-10-30-0206-pr124 --status failed --waiting dev --note 'qa/experiments/124.json is valid'
