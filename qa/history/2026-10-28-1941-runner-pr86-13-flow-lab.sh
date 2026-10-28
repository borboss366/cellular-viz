#!/bin/sh
# 2026-10-28-1941-runner-pr86-13-flow-lab: runner build viz-86-15, #86 13-flow-lab @3c65036, checks from qa/headless-runner; result: viz-86-15 running 8/8
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 3c650363d83389d01127e28b96361d7f11b254d2:qa/experiments/86.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 3c650363d83389d01127e28b96361d7f11b254d2:qa/experiments/86.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 86 --commit 3c65036
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree-experiments.tar 3c650363d83389d01127e28b96361d7f11b254d2 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-86-15 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree/qa --pr 86 --sha 3c650363d83389d01127e28b96361d7f11b254d2 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-D2E7Ia/tree/qa/13-flow-lab/runs/2026-10-28-1940-pr86
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-86-15 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-28-1940-pr86
