#!/bin/sh
# 2026-10-28-1907-runner-pr84-16-hodge-kaleidoscope: runner build viz-84-2, #84 16-hodge-kaleidoscope @2fcb554, checks from qa/headless-runner; result: viz-84-2 ready 10/10
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 2fcb5543e738edbdc1ccda3463262162c9d8a9f1:qa/experiments/84.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 2fcb5543e738edbdc1ccda3463262162c9d8a9f1:qa/experiments/84.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 84 --commit 2fcb554
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree-experiments.tar 2fcb5543e738edbdc1ccda3463262162c9d8a9f1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-84-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree/qa --pr 84 --sha 2fcb5543e738edbdc1ccda3463262162c9d8a9f1 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LWACiA/tree/qa/16-hodge-kaleidoscope/runs/2026-10-28-1901-pr84
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-84-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/runs/2026-10-28-1901-pr84 --swipe /run/16-hodge-kaleidoscope/2026-10-28-1901-pr84-swipe/compare
