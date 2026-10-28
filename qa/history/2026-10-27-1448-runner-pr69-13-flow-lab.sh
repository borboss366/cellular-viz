#!/bin/sh
# 2026-10-27-1448-runner-pr69-13-flow-lab: runner build viz-69-1, #69 13-flow-lab @3ddb5cb, checks from qa/headless-runner; result: viz-69-1 failed 13/14
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/69/head:refs/runner/pr-69 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/69/head:refs/runner/pr-69 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 3ddb5cb692207e9666175e2d666e3c2347c37a19:qa/experiments/69.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 3ddb5cb692207e9666175e2d666e3c2347c37a19:qa/experiments/69.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 13-flow-lab --pr 69 --commit 3ddb5cb
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree-experiments.tar 3ddb5cb692207e9666175e2d666e3c2347c37a19 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo merge-base refs/runner/main 3ddb5cb692207e9666175e2d666e3c2347c37a19
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/old-experiments.tar 351304f874448c239e1f4fb7678acf8c0de665d5 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-69-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree/qa --pr 69 --sha 3ddb5cb692207e9666175e2d666e3c2347c37a19 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/old/experiments --vs 351304f --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-gYnztF/tree/qa/13-flow-lab/runs/2026-10-27-1424-pr69
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-69-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/13-flow-lab/runs/2026-10-27-1424-pr69 --swipe /run/13-flow-lab/2026-10-27-1424-pr69-swipe/compare
