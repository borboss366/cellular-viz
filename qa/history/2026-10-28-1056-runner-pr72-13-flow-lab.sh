#!/bin/sh
# 2026-10-28-1056-runner-pr72-13-flow-lab: runner build viz-72-5, #72 13-flow-lab @7877b19, checks from qa/headless-runner; result: viz-72-5 ready 15/15
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 7877b1916f2bde11f8828973794ccb4dcaf0e531:qa/experiments/72.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 7877b1916f2bde11f8828973794ccb4dcaf0e531:qa/experiments/72.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 72 --commit 7877b19
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree-experiments.tar 7877b1916f2bde11f8828973794ccb4dcaf0e531 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main 7877b1916f2bde11f8828973794ccb4dcaf0e531
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/old-experiments.tar 963f38a4528f418407f49dc0057ea59f8f984422 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-72-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree/qa --pr 72 --sha 7877b1916f2bde11f8828973794ccb4dcaf0e531 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/old/experiments --vs 963f38a --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D7E7JH/tree/qa/13-flow-lab/runs/2026-10-28-1034-pr72
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-72-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-28-1034-pr72 --swipe /run/13-flow-lab/2026-10-28-1034-pr72-swipe/compare
