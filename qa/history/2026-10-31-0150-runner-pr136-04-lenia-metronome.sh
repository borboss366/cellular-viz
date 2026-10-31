#!/bin/sh
# 2026-10-31-0150-runner-pr136-04-lenia-metronome: runner build viz-136-1, #136 04-lenia-metronome @8310b69, checks from main; result: failed
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 04-lenia-metronome --pr 136 --commit 8310b69
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-N1gvAE/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-N1gvAE/pages.tar 8310b69ebf641df81287a21a0ad46255d1d7d7ca experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-N1gvAE/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-N1gvAE/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-N1gvAE/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-N1gvAE/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/04-lenia-metronome/checks/2026-10-31-0150-runner --status failed --waiting qa-box --note 'no check script yet'
