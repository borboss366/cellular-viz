#!/bin/sh
# 2026-10-30-0758-runner-pr124-16-neon-lines: runner build viz-124-4, #124 16-neon-lines @73b9471, checks from main; result: viz-124-4 running 27/27
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/124/head:refs/runner/pr-124 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 73b9471ea62d35e877bb9a28498ea835937b23cf:qa/experiments/124.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 73b9471ea62d35e877bb9a28498ea835937b23cf:qa/experiments/124.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-neon-lines --pr 124 --commit 73b9471
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree-experiments.tar 73b9471ea62d35e877bb9a28498ea835937b23cf experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-124-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree/qa --pr 124 --sha 73b9471ea62d35e877bb9a28498ea835937b23cf --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-FFI3mT/tree/qa/16-neon-lines/runs/2026-10-30-0751-pr124
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-124-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-neon-lines/runs/2026-10-30-0751-pr124
