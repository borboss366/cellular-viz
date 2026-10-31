#!/bin/sh
# 2026-10-31-1748-runner-pr147-15-traveller: runner build viz-147-1, #147 15-traveller @f40220a, checks from main; result: viz-147-1 running 11/11
# The commands as the QA runner ran them, in order (no shell; temp folders were removed after the build).
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/147/head:refs/runner/pr-147 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs start --page 15-traveller --pr 147 --commit f40220a
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo fetch -q --force origin +refs/pull/147/head:refs/runner/pr-147 +refs/heads/main:refs/runner/checks +refs/heads/main:refs/runner/main
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/checks.tar refs/runner/checks qa
git -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/repo archive -o /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/pages.tar f40220a429e3ddf8fb9014fc3aed18a6ed5f4200 experiments
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/checks.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/tree
tar -xf /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/pages.tar -C /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/tree
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs set --id viz-147-1 --status running
node /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/tree/qa/check-shared.mjs --experiments /home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner/build-XoAk2K/tree/experiments --page 15-traveller.html --out /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/15-traveller/checks/2026-10-31-1743-runner/shared
node /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/builds.mjs finish --id viz-147-1 --check /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz/qa/15-traveller/checks/2026-10-31-1743-runner
