#!/bin/sh
# 2026-10-28-1827-runner-pr75-18-little-bang: runner build viz-75-5, #75 18-little-bang @b0cfb63, checks from qa/headless-runner; result: viz-75-5 failed 24/25
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/75/head:refs/runner/pr-75 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e b0cfb63c4eaee4e3f769c399740d73a8cc0b31c8:qa/experiments/75.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show b0cfb63c4eaee4e3f769c399740d73a8cc0b31c8:qa/experiments/75.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 75 --commit b0cfb63
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree-experiments.tar b0cfb63c4eaee4e3f769c399740d73a8cc0b31c8 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo rev-parse --verify -q '9311bdb^{commit}'
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/old-experiments.tar 9311bdbfb61655d98faf518a68a6dc13b2808836 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/old-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/old
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-75-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree/qa --pr 75 --sha b0cfb63c4eaee4e3f769c399740d73a8cc0b31c8 --experiments-old /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/old/experiments --vs 9311bdb --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-KbaSQ5/tree/qa/18-little-bang/runs/2026-10-28-1812-pr75
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-75-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/runs/2026-10-28-1812-pr75 --swipe /run/18-little-bang/2026-10-28-1812-pr75-swipe/compare
