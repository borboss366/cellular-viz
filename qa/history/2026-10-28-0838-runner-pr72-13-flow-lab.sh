#!/bin/sh
# 2026-10-28-0838-runner-pr72-13-flow-lab: runner build viz-72-2, #72 13-flow-lab @fa3ffff, checks from qa/headless-runner; result: viz-72-2 ready 15/15
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e fa3fffff6da730c879291f333cb0cd0d3a9552df:qa/experiments/72.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show fa3fffff6da730c879291f333cb0cd0d3a9552df:qa/experiments/72.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 72 --commit fa3ffff
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree-experiments.tar fa3fffff6da730c879291f333cb0cd0d3a9552df experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main fa3fffff6da730c879291f333cb0cd0d3a9552df
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/old-experiments.tar 963f38a4528f418407f49dc0057ea59f8f984422 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-72-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree/qa --pr 72 --sha fa3fffff6da730c879291f333cb0cd0d3a9552df --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/old/experiments --vs 963f38a --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-L21smM/tree/qa/13-flow-lab/runs/2026-10-28-0816-pr72
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-72-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-28-0816-pr72 --swipe /run/13-flow-lab/2026-10-28-0816-pr72-swipe/compare
