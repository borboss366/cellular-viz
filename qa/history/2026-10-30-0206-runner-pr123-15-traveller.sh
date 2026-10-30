#!/bin/sh
# 2026-10-30-0206-runner-pr123-15-traveller: runner build viz-123-1, #123 15-traveller @ce1f5ff, checks from main; result: viz-123-1 failed 15/16
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/123/head:refs/runner/pr-123 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/123/head:refs/runner/pr-123 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e ce1f5ff17650974baea545fdeec159c62c051cd0:qa/experiments/123.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show ce1f5ff17650974baea545fdeec159c62c051cd0:qa/experiments/123.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 15-traveller --pr 123 --commit ce1f5ff
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree-experiments.tar ce1f5ff17650974baea545fdeec159c62c051cd0 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-123-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree/qa --pr 123 --sha ce1f5ff17650974baea545fdeec159c62c051cd0 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-LIZm9n/tree/qa/15-traveller/runs/2026-10-30-0158-pr123
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-123-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/15-traveller/runs/2026-10-30-0158-pr123 --swipe /run/15-traveller/2026-10-30-0158-pr123-swipe/compare
