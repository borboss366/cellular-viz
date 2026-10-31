#!/bin/sh
# 2026-10-31-0658-runner-pr136-04-lenia-metronome: runner build viz-136-8, #136 04-lenia-metronome @dd93ae6, checks from main; result: viz-136-8 running 10/10
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 04-lenia-metronome --pr 136 --commit dd93ae6
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/136/head:refs/runner/pr-136 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/pages.tar dd93ae6980a72315ec13f6a83e7923e0f0a4ea3e experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-136-8 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gSw4EX/tree/experiments --page 04-lenia-metronome.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/04-lenia-metronome/checks/2026-10-31-0654-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-136-8 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/04-lenia-metronome/checks/2026-10-31-0654-runner
