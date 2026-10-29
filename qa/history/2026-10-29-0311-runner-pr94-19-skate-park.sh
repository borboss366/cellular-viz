#!/bin/sh
# 2026-10-29-0311-runner-pr94-19-skate-park: runner build viz-94-8, #94 19-skate-park @ef5dc84, checks from main; result: viz-94-8 failed 18/20
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 19-skate-park --pr 94 --commit ef5dc84
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/94/head:refs/runner/pr-94 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/pages.tar ef5dc8466a3fdd22e896a517c1add739bb843226 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-94-8 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/tree/qa/check-19.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-mpym4f/tree/experiments --page 19-skate-park.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/19-skate-park/checks/2026-10-29-0306/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-94-8 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/19-skate-park/checks/2026-10-29-0306
