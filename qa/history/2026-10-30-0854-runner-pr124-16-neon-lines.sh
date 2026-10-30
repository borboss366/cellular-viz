#!/bin/sh
# 2026-10-30-0854-runner-pr124-16-neon-lines: runner build viz-124-6, #124 16-neon-lines @17924a4, checks from main; result: viz-124-6 running 30/30
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 17924a45c5b89dc457101a762040613d460c07ff:qa/experiments/124.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 17924a45c5b89dc457101a762040613d460c07ff:qa/experiments/124.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-neon-lines --pr 124 --commit 17924a4
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree-experiments.tar 17924a45c5b89dc457101a762040613d460c07ff experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-124-6 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree/qa --pr 124 --sha 17924a45c5b89dc457101a762040613d460c07ff --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-mgupDi/tree/qa/16-neon-lines/runs/2026-10-30-0847-pr124
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-124-6 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-neon-lines/runs/2026-10-30-0847-pr124
