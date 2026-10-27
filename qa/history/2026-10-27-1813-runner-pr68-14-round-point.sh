#!/bin/sh
# 2026-10-27-1813-runner-pr68-14-round-point: runner build viz-68-4, #68 14-round-point @24d52a7, checks from qa/headless-runner; result: viz-68-4 failed 15/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/68/head:refs/runner/pr-68 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 24d52a7b900c6ebe08d373e01eb436ad4b19990a:qa/experiments/68.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 24d52a7b900c6ebe08d373e01eb436ad4b19990a:qa/experiments/68.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 14-round-point --pr 68 --commit 24d52a7
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree-experiments.tar 24d52a7b900c6ebe08d373e01eb436ad4b19990a experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main 24d52a7b900c6ebe08d373e01eb436ad4b19990a
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/old-experiments.tar 351304f874448c239e1f4fb7678acf8c0de665d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-68-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree/qa --pr 68 --sha 24d52a7b900c6ebe08d373e01eb436ad4b19990a --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/old/experiments --vs 351304f --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-16RVbo/tree/qa/14-round-point/runs/2026-10-27-1804-pr68
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-68-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/14-round-point/runs/2026-10-27-1804-pr68 --swipe /run/14-round-point/2026-10-27-1804-pr68-swipe/compare
