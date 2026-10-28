#!/bin/sh
# 2026-10-28-1859-runner-pr84-16-hodge-kaleidoscope: runner build viz-84-1, #84 16-hodge-kaleidoscope @2fcb554, checks from qa/headless-runner; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 16-hodge-kaleidoscope --pr 84 --commit 2fcb554
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/84/head:refs/runner/pr-84 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fGj4Z9/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fGj4Z9/pages.tar 2fcb5543e738edbdc1ccda3463262162c9d8a9f1 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fGj4Z9/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fGj4Z9/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fGj4Z9/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-fGj4Z9/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-84-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/16-hodge-kaleidoscope/checks/2026-10-28-1859-runner --status failed --waiting qa-box --note 'no check script yet'
