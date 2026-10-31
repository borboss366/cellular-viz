#!/bin/sh
# 2026-10-31-0150-runner-pr136-07-particle-lenia: runner build viz-136-3, #136 07-particle-lenia @8310b69, checks from main; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 07-particle-lenia --pr 136 --commit 8310b69
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gm3YF0/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gm3YF0/pages.tar 8310b69ebf641df81287a21a0ad46255d1d7d7ca experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gm3YF0/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gm3YF0/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gm3YF0/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gm3YF0/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/07-particle-lenia/checks/2026-10-31-0150-runner --status failed --waiting qa-box --note 'no check script yet'
