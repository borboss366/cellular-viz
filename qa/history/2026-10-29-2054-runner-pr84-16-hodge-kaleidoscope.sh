#!/bin/sh
# 2026-10-29-2054-runner-pr84-16-hodge-kaleidoscope: runner build viz-84-5, #84 16-hodge-kaleidoscope @757f116, checks from main; result: viz-84-5 running 19/19
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo cat-file -e 757f116786da393bb773bddd67ae2d40c8817d40:qa/experiments/84.json
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo show 757f116786da393bb773bddd67ae2d40c8817d40:qa/experiments/84.json
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 84 --commit 757f116
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree-qa.tar refs/runner/checks qa
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree-qa.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree-experiments.tar 757f116786da393bb773bddd67ae2d40c8817d40 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree-experiments.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-84-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree/qa/runner/exp-run.mjs --file /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/experiment.json --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree/experiments --qa /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree/qa --pr 84 --sha 757f116786da393bb773bddd67ae2d40c8817d40 --out /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/exp-JvGTmj/tree/qa/16-hodge-kaleidoscope/runs/2026-10-29-2042-pr84
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-84-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/runs/2026-10-29-2042-pr84
