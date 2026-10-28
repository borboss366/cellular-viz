#!/bin/sh
# 2026-10-28-1947-runner-pr86-13-flow-lab: runner build viz-86-16, #86 13-flow-lab @bf67c4d, checks from qa/headless-runner; result: viz-86-16 running 8/8
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e bf67c4d858d5ec42951bed94560655379ca78649:qa/experiments/86.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show bf67c4d858d5ec42951bed94560655379ca78649:qa/experiments/86.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 86 --commit bf67c4d
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree-experiments.tar bf67c4d858d5ec42951bed94560655379ca78649 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-86-16 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree/qa --pr 86 --sha bf67c4d858d5ec42951bed94560655379ca78649 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JaObz1/tree/qa/13-flow-lab/runs/2026-10-28-1947-pr86
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-86-16 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-28-1947-pr86
