#!/bin/sh
# 2026-10-30-0743-runner-pr124-16-neon-lines: runner build viz-124-3, #124 16-neon-lines @95e65b5, checks from main; result: viz-124-3 failed 24/27
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 95e65b573a16a1893ec23832440153b7ea29cbce:qa/experiments/124.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 95e65b573a16a1893ec23832440153b7ea29cbce:qa/experiments/124.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-neon-lines --pr 124 --commit 95e65b5
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree-experiments.tar 95e65b573a16a1893ec23832440153b7ea29cbce experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-124-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree/qa --pr 124 --sha 95e65b573a16a1893ec23832440153b7ea29cbce --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-HYa1Gr/tree/qa/16-neon-lines/runs/2026-10-30-0736-pr124
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-124-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-neon-lines/runs/2026-10-30-0736-pr124
