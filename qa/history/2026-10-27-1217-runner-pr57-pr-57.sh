#!/bin/sh
# 2026-10-27-1217-runner-pr57-pr-57: runner build viz-57-9, #57 pr-57 @bb19457, checks from qa/headless-runner; result: error: git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch → 128: fatal: unable to access 'https://github.com/borboss366/cellular-viz.git/': Could not resolve host: github.com
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/57/head:refs/runner/pr-57 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page pr-57 --pr 57 --commit bb19457
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-57-9 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/pr-57/runs/2026-10-27-1217-pr57 --status failed --waiting qa-box --note 'the runner could prepare the experiment'
