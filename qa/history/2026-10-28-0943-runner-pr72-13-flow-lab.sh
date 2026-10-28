#!/bin/sh
# 2026-10-28-0943-runner-pr72-13-flow-lab: runner build viz-72-4, #72 13-flow-lab @890c798, checks from qa/headless-runner; result: viz-72-4 ready 15/15
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/72/head:refs/runner/pr-72 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 890c798343cc86cb458220c9e82c04e3450155f5:qa/experiments/72.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 890c798343cc86cb458220c9e82c04e3450155f5:qa/experiments/72.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 72 --commit 890c798
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree-experiments.tar 890c798343cc86cb458220c9e82c04e3450155f5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main 890c798343cc86cb458220c9e82c04e3450155f5
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/old-experiments.tar 963f38a4528f418407f49dc0057ea59f8f984422 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-72-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree/qa --pr 72 --sha 890c798343cc86cb458220c9e82c04e3450155f5 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/old/experiments --vs 963f38a --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-tOlIx2/tree/qa/13-flow-lab/runs/2026-10-28-0921-pr72
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-72-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-28-0921-pr72 --swipe /run/13-flow-lab/2026-10-28-0921-pr72-swipe/compare
