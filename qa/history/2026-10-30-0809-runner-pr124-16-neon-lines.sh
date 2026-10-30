#!/bin/sh
# 2026-10-30-0809-runner-pr124-16-neon-lines: runner build viz-124-5, #124 16-neon-lines @01fe493, checks from main; result: viz-124-5 running 30/30
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 01fe493fae1bb811426cd1492ab02f7632cba734:qa/experiments/124.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 01fe493fae1bb811426cd1492ab02f7632cba734:qa/experiments/124.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-neon-lines --pr 124 --commit 01fe493
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree-experiments.tar 01fe493fae1bb811426cd1492ab02f7632cba734 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-124-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree/qa --pr 124 --sha 01fe493fae1bb811426cd1492ab02f7632cba734 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-VpoNa8/tree/qa/16-neon-lines/runs/2026-10-30-0802-pr124
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-124-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-neon-lines/runs/2026-10-30-0802-pr124
