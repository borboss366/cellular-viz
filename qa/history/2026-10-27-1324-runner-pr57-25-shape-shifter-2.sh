#!/bin/sh
# 2026-10-27-1324-runner-pr57-25-shape-shifter-2: runner build viz-57-10, #57 25-shape-shifter-2 @cbbe220, checks from qa/headless-runner; result: viz-57-10 failed 15/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/57/head:refs/runner/pr-57 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e cbbe220cccff646ec1d6003d2c339a9d425840ec:qa/experiments/57.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show cbbe220cccff646ec1d6003d2c339a9d425840ec:qa/experiments/57.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 57 --commit cbbe220
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree-experiments.tar cbbe220cccff646ec1d6003d2c339a9d425840ec experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo rev-parse --verify -q '71f3673^{commit}'
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/old-experiments.tar 71f36738d9a37db633a4afca39b21339b59aa1d9 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-57-10 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree/qa --pr 57 --sha cbbe220cccff646ec1d6003d2c339a9d425840ec --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/old/experiments --vs 71f3673 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-xpBLuE/tree/qa/25-shape-shifter-2/runs/2026-10-27-1259-pr57
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-57-10 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/runs/2026-10-27-1259-pr57 --swipe /run/25-shape-shifter-2/2026-10-27-1259-pr57-swipe/compare
