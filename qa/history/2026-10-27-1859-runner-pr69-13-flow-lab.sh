#!/bin/sh
# 2026-10-27-1859-runner-pr69-13-flow-lab: runner build viz-69-2, #69 13-flow-lab @3907937, checks from qa/headless-runner; result: viz-69-2 ready 15/15
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/69/head:refs/runner/pr-69 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/69/head:refs/runner/pr-69 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 3907937db06c4c4030b417de86ba1340e45d2bf1:qa/experiments/69.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 3907937db06c4c4030b417de86ba1340e45d2bf1:qa/experiments/69.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 69 --commit 3907937
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree-experiments.tar 3907937db06c4c4030b417de86ba1340e45d2bf1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main 3907937db06c4c4030b417de86ba1340e45d2bf1
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/old-experiments.tar 351304f874448c239e1f4fb7678acf8c0de665d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-69-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree/qa --pr 69 --sha 3907937db06c4c4030b417de86ba1340e45d2bf1 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/old/experiments --vs 351304f --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gnU3Gv/tree/qa/13-flow-lab/runs/2026-10-27-1835-pr69
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-69-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-27-1835-pr69 --swipe /run/13-flow-lab/2026-10-27-1835-pr69-swipe/compare
