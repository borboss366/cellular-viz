#!/bin/sh
# 2026-10-27-1157-runner-pr57-25-shape-shifter-2: runner build viz-57-8, #57 25-shape-shifter-2 @c6b9618, checks from qa/headless-runner; result: viz-57-8 failed 14/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/57/head:refs/runner/pr-57 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e c6b9618c10c985eb460bf59982296f0a2bfe9375:qa/experiments/57.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show c6b9618c10c985eb460bf59982296f0a2bfe9375:qa/experiments/57.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 25-shape-shifter-2 --pr 57 --commit c6b9618
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree-experiments.tar c6b9618c10c985eb460bf59982296f0a2bfe9375 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo rev-parse --verify -q '71f3673^{commit}'
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/old-experiments.tar 71f36738d9a37db633a4afca39b21339b59aa1d9 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-57-8 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree/qa --pr 57 --sha c6b9618c10c985eb460bf59982296f0a2bfe9375 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/old/experiments --vs 71f3673 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-YnpBxa/tree/qa/25-shape-shifter-2/runs/2026-10-27-1133-pr57
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-57-8 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/25-shape-shifter-2/runs/2026-10-27-1133-pr57 --swipe /run/25-shape-shifter-2/2026-10-27-1133-pr57-swipe/compare
