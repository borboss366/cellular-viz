#!/bin/sh
# 2026-10-28-1843-runner-pr75-18-little-bang: runner build viz-75-6, #75 18-little-bang @7e0a43c, checks from qa/headless-runner; result: viz-75-6 failed 24/25
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 7e0a43c2d8c2f41dc1669b796f1fd804fe4c0d93:qa/experiments/75.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 7e0a43c2d8c2f41dc1669b796f1fd804fe4c0d93:qa/experiments/75.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 75 --commit 7e0a43c
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree-experiments.tar 7e0a43c2d8c2f41dc1669b796f1fd804fe4c0d93 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo rev-parse --verify -q '912313e^{commit}'
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/old-experiments.tar 912313e3d1bcd3f4bda65242148cf261ed2fb78a experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-75-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree/qa --pr 75 --sha 7e0a43c2d8c2f41dc1669b796f1fd804fe4c0d93 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/old/experiments --vs 912313e --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mCHY5L/tree/qa/18-little-bang/runs/2026-10-28-1829-pr75
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-75-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/runs/2026-10-28-1829-pr75 --swipe /run/18-little-bang/2026-10-28-1829-pr75-swipe/compare
