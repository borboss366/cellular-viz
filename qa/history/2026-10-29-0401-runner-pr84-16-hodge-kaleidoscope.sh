#!/bin/sh
# 2026-10-29-0401-runner-pr84-16-hodge-kaleidoscope: runner build viz-84-3, #84 16-hodge-kaleidoscope @8589927, checks from main; result: viz-84-3 failed 17/19
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 858992739df3580de24c2da4339c47105a4a3b67:qa/experiments/84.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 858992739df3580de24c2da4339c47105a4a3b67:qa/experiments/84.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 84 --commit 8589927
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree-experiments.tar 858992739df3580de24c2da4339c47105a4a3b67 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo rev-parse --verify -q '2fcb554^{commit}'
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/old-experiments.tar 2fcb5543e738edbdc1ccda3463262162c9d8a9f1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-84-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree/qa --pr 84 --sha 858992739df3580de24c2da4339c47105a4a3b67 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/old/experiments --vs 2fcb554 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-76SYDN/tree/qa/16-hodge-kaleidoscope/runs/2026-10-29-0346-pr84
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-84-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/runs/2026-10-29-0346-pr84 --swipe /run/16-hodge-kaleidoscope/2026-10-29-0346-pr84-swipe/compare
