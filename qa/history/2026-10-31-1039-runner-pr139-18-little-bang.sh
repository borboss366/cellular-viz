#!/bin/sh
# 2026-10-31-1039-runner-pr139-18-little-bang: runner build viz-139-4, #139 18-little-bang @2ee4686, checks from main; result: viz-139-4 running 32/32
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 18-little-bang --pr 139 --commit 2ee4686
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/pages.tar 2ee4686bca4b761e3f597c7385599936b6a4ac50 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-139-4 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/tree/qa/check-18.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-lmjOCU/tree/experiments --page 18-little-bang.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-31-1035/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-139-4 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/18-little-bang/checks/2026-10-31-1035
