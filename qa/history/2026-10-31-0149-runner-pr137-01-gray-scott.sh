#!/bin/sh
# 2026-10-31-0149-runner-pr137-01-gray-scott: runner build viz-137-1, #137 01-gray-scott @15f0225, checks from main; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/137/head:refs/runner/pr-137 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 01-gray-scott --pr 137 --commit 15f0225
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/137/head:refs/runner/pr-137 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-8F8Wwi/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-8F8Wwi/pages.tar 15f02257e780d6462fd8e84acb3e59a553b17a83 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-8F8Wwi/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-8F8Wwi/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-8F8Wwi/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-8F8Wwi/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-137-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/01-gray-scott/checks/2026-10-31-0149-runner --status failed --waiting qa-box --note 'no check script yet'
