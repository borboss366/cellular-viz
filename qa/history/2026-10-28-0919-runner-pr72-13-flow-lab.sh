#!/bin/sh
# 2026-10-28-0919-runner-pr72-13-flow-lab: runner build viz-72-3, #72 13-flow-lab @d6a5e02, checks from qa/headless-runner; result: viz-72-3 ready 15/15
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e d6a5e023dda2d7dafa8e30e3964d67fdbcebe97f:qa/experiments/72.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show d6a5e023dda2d7dafa8e30e3964d67fdbcebe97f:qa/experiments/72.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 72 --commit d6a5e02
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree-experiments.tar d6a5e023dda2d7dafa8e30e3964d67fdbcebe97f experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main d6a5e023dda2d7dafa8e30e3964d67fdbcebe97f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/old-experiments.tar 963f38a4528f418407f49dc0057ea59f8f984422 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-72-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree/qa --pr 72 --sha d6a5e023dda2d7dafa8e30e3964d67fdbcebe97f --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/old/experiments --vs 963f38a --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-QWbpsP/tree/qa/13-flow-lab/runs/2026-10-28-0856-pr72
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-72-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-28-0856-pr72 --swipe /run/13-flow-lab/2026-10-28-0856-pr72-swipe/compare
