#!/bin/sh
# 2026-10-31-1546-runner-pr146-03-lenia-audio: runner build viz-146-3, #146 03-lenia-audio @1bb9b67, checks from main; result: viz-146-3 running 10/10
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 03-lenia-audio --pr 146 --commit 1bb9b67
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/pages.tar 1bb9b675921d91e7315c036fd8349644a1f386db experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-146-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-TLirOC/tree/experiments --page 03-lenia-audio.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/03-lenia-audio/checks/2026-10-31-1541-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-146-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/03-lenia-audio/checks/2026-10-31-1541-runner
