#!/bin/sh
# 2026-10-27-1945-runner-pr72-13-flow-lab: runner build viz-72-1, #72 13-flow-lab @e5b1a9c, checks from qa/headless-runner; result: viz-72-1 ready 15/15
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e e5b1a9ca990ccbbdaf1b2d6565c25fcc88d57e30:qa/experiments/72.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show e5b1a9ca990ccbbdaf1b2d6565c25fcc88d57e30:qa/experiments/72.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 72 --commit e5b1a9c
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree-experiments.tar e5b1a9ca990ccbbdaf1b2d6565c25fcc88d57e30 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main e5b1a9ca990ccbbdaf1b2d6565c25fcc88d57e30
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/old-experiments.tar 963f38a4528f418407f49dc0057ea59f8f984422 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-72-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree/qa --pr 72 --sha e5b1a9ca990ccbbdaf1b2d6565c25fcc88d57e30 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/old/experiments --vs 963f38a --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-P2YdBa/tree/qa/13-flow-lab/runs/2026-10-27-1923-pr72
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-72-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-27-1923-pr72 --swipe /run/13-flow-lab/2026-10-27-1923-pr72-swipe/compare
