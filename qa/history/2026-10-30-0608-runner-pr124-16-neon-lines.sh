#!/bin/sh
# 2026-10-30-0608-runner-pr124-16-neon-lines: runner build viz-124-2, #124 16-neon-lines @71acc57, checks from main; result: viz-124-2 failed 24/27
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 71acc572b18ab7ec020194e4f4c47da2eba1c6fb:qa/experiments/124.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 71acc572b18ab7ec020194e4f4c47da2eba1c6fb:qa/experiments/124.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-neon-lines --pr 124 --commit 71acc57
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree-experiments.tar 71acc572b18ab7ec020194e4f4c47da2eba1c6fb experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-124-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree/qa --pr 124 --sha 71acc572b18ab7ec020194e4f4c47da2eba1c6fb --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-5QG3u9/tree/qa/16-neon-lines/runs/2026-10-30-0601-pr124
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-124-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-neon-lines/runs/2026-10-30-0601-pr124
