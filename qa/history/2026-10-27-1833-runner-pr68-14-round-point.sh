#!/bin/sh
# 2026-10-27-1833-runner-pr68-14-round-point: runner build viz-68-5, #68 14-round-point @c3b8250, checks from qa/headless-runner; result: viz-68-5 ready 17/17
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e c3b82504dbc20f34756dd89f98bea1c11871fb7f:qa/experiments/68.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show c3b82504dbc20f34756dd89f98bea1c11871fb7f:qa/experiments/68.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 68 --commit c3b8250
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree-experiments.tar c3b82504dbc20f34756dd89f98bea1c11871fb7f experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main c3b82504dbc20f34756dd89f98bea1c11871fb7f
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/old-experiments.tar 351304f874448c239e1f4fb7678acf8c0de665d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-68-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree/qa --pr 68 --sha c3b82504dbc20f34756dd89f98bea1c11871fb7f --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/old/experiments --vs 351304f --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-bSmAE1/tree/qa/14-round-point/runs/2026-10-27-1823-pr68
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-68-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/runs/2026-10-27-1823-pr68 --swipe /run/14-round-point/2026-10-27-1823-pr68-swipe/compare
