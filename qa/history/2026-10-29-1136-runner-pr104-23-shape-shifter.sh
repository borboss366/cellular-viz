#!/bin/sh
# 2026-10-29-1136-runner-pr104-23-shape-shifter: runner build viz-104-3, #104 23-shape-shifter @081388c, checks from main; result: viz-104-3 running 17/17
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 23-shape-shifter --pr 104 --commit 081388c
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/104/head:refs/runner/pr-104 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/pages.tar 081388c5d12141e24f155b47179819ad27685360 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-104-3 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/tree/qa/check-23.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/tree/experiments
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-Ipkjwn/tree/experiments --page 23-shape-shifter.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1130/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-104-3 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/23-shape-shifter/checks/2026-10-29-1130
