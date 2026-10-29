#!/bin/sh
# 2026-10-29-1022-runner-pr94-11-riemann-show: runner build viz-94-25, #94 11-riemann-show @6a8f0c2, checks from main; result: viz-94-25 running 14/14
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 11-riemann-show --pr 94 --commit 6a8f0c2
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/pages.tar 6a8f0c21021d92dc3da89a76932022990865ba37 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-25 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/tree/qa/check-11.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-czC6tn/tree/experiments --page 11-riemann-show.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-29-1017/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-25 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/11-riemann-show/checks/2026-10-29-1017
