#!/bin/sh
# 2026-10-31-0150-runner-pr137-05-flow-lenia: runner build viz-137-3, #137 05-flow-lenia @15f0225, checks from main; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/137/head:refs/runner/pr-137 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 05-flow-lenia --pr 137 --commit 15f0225
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/137/head:refs/runner/pr-137 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ElMnMA/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ElMnMA/pages.tar 15f02257e780d6462fd8e84acb3e59a553b17a83 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ElMnMA/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ElMnMA/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ElMnMA/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-ElMnMA/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-137-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/05-flow-lenia/checks/2026-10-31-0150-runner --status failed --waiting qa-box --note 'no check script yet'
