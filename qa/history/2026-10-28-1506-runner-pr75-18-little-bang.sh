#!/bin/sh
# 2026-10-28-1506-runner-pr75-18-little-bang: runner build viz-75-3, #75 18-little-bang @912313e, checks from qa/headless-runner; result: viz-75-3 failed 20/21
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 912313e3d1bcd3f4bda65242148cf261ed2fb78a:qa/experiments/75.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 912313e3d1bcd3f4bda65242148cf261ed2fb78a:qa/experiments/75.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 75 --commit 912313e
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree-experiments.tar 912313e3d1bcd3f4bda65242148cf261ed2fb78a experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo rev-parse --verify -q '9311bdb^{commit}'
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/old-experiments.tar 9311bdbfb61655d98faf518a68a6dc13b2808836 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-75-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree/qa --pr 75 --sha 912313e3d1bcd3f4bda65242148cf261ed2fb78a --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/old/experiments --vs 9311bdb --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QvIe1F/tree/qa/18-little-bang/runs/2026-10-28-1453-pr75
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-75-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/runs/2026-10-28-1453-pr75 --swipe /run/18-little-bang/2026-10-28-1453-pr75-swipe/compare
