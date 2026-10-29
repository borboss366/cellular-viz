#!/bin/sh
# 2026-10-29-1123-runner-pr84-16-hodge-kaleidoscope: runner build viz-84-4, #84 16-hodge-kaleidoscope @5d73e6a, checks from main; result: viz-84-4 failed 17/19
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 5d73e6a0b0bd68618f70db498bf2f71acc2efb71:qa/experiments/84.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 5d73e6a0b0bd68618f70db498bf2f71acc2efb71:qa/experiments/84.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 84 --commit 5d73e6a
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree-experiments.tar 5d73e6a0b0bd68618f70db498bf2f71acc2efb71 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-84-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree/qa --pr 84 --sha 5d73e6a0b0bd68618f70db498bf2f71acc2efb71 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-T0JTZQ/tree/qa/16-hodge-kaleidoscope/runs/2026-10-29-1112-pr84
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-84-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/runs/2026-10-29-1112-pr84
