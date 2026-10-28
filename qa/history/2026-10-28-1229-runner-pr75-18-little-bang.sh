#!/bin/sh
# 2026-10-28-1229-runner-pr75-18-little-bang: runner build viz-75-2, #75 18-little-bang @9311bdb, checks from qa/headless-runner; result: viz-75-2 ready 17/17
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 9311bdbfb61655d98faf518a68a6dc13b2808836:qa/experiments/75.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 9311bdbfb61655d98faf518a68a6dc13b2808836:qa/experiments/75.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 75 --commit 9311bdb
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree-experiments.tar 9311bdbfb61655d98faf518a68a6dc13b2808836 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main 9311bdbfb61655d98faf518a68a6dc13b2808836
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/old-experiments.tar 076df135d56ad85d718c45bcce969cc41739efed experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-75-2 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree/qa --pr 75 --sha 9311bdbfb61655d98faf518a68a6dc13b2808836 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/old/experiments --vs 076df13 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-t5sdPP/tree/qa/18-little-bang/runs/2026-10-28-1216-pr75
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-75-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/runs/2026-10-28-1216-pr75 --swipe /run/18-little-bang/2026-10-28-1216-pr75-swipe/compare
