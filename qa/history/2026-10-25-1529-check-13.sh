#!/bin/sh
# 2026-10-25-1529 · re-run of the chain I ran from /tmp/q17 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q17/x && git archive ddb3d49 experiments | tar -x -C /tmp/q17/x   # 13 Flow Lab @ddb3d49
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/check-13.mjs --experiments /tmp/q17/x/experiments > /tmp/q17/c13.out 2>&1
touch /tmp/q17/DONE
