#!/bin/sh
# 2026-10-30-1908-runner-pr134-24-paint-pour: runner build viz-134-1, #134 24-paint-pour @389935a, checks from main; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/134/head:refs/runner/pr-134 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 24-paint-pour --pr 134 --commit 389935a
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/134/head:refs/runner/pr-134 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-5uho2t/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-5uho2t/pages.tar 389935a3ab6067a76c9d33e2e789e798b268bbaa experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-5uho2t/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-5uho2t/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-5uho2t/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-5uho2t/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-134-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/24-paint-pour/checks/2026-10-30-1908-runner --status failed --waiting qa-box --note 'no check script yet'
