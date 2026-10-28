#!/bin/sh
# 2026-10-28-1909-runner-pr86-02-lenia: runner build viz-86-2, #86 02-lenia @3c65036, checks from qa/headless-runner; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 02-lenia --pr 86 --commit 3c65036
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/86/head:refs/runner/pr-86 +refs/heads/qa/headless-runner:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-g3TKR4/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-g3TKR4/pages.tar 3c650363d83389d01127e28b96361d7f11b254d2 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-g3TKR4/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-g3TKR4/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-g3TKR4/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-g3TKR4/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-86-2 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/02-lenia/checks/2026-10-28-1909-runner --status failed --waiting qa-box --note 'no check script yet'
