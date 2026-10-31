#!/bin/sh
# 2026-10-31-1048-runner-pr139-19-skate-park: runner build viz-139-5, #139 19-skate-park @2ee4686, checks from main; result: viz-139-5 running 19/19
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 19-skate-park --pr 139 --commit 2ee4686
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/139/head:refs/runner/pr-139 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/pages.tar 2ee4686bca4b761e3f597c7385599936b6a4ac50 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-139-5 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/tree/qa/check-19.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ar2yQI/tree/experiments --page 19-skate-park.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/19-skate-park/checks/2026-10-31-1043/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-139-5 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/19-skate-park/checks/2026-10-31-1043
