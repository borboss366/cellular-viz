#!/bin/sh
# 2026-10-31-1528-runner-pr146-03-lenia-audio: runner build viz-146-1, #146 03-lenia-audio @bca5055, checks from main; result: viz-146-1 failed 10/11
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 03-lenia-audio --pr 146 --commit bca5055
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/146/head:refs/runner/pr-146 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/pages.tar bca50558ad8f63a704178f9bb0ddcdfa07c4377d experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-146-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-gtelVs/tree/experiments --page 03-lenia-audio.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/03-lenia-audio/checks/2026-10-31-1524-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-146-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/03-lenia-audio/checks/2026-10-31-1524-runner
