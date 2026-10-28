#!/bin/sh
# 2026-10-25-1503 · re-run of the chain I ran from /tmp/q16 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q16/x && git archive 70fc2c4 experiments | tar -x -C /tmp/q16/x   # 13 Flow Lab @70fc2c4
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/check-13.mjs --experiments /tmp/q16/x/experiments > /tmp/q16/c13.out 2>&1
touch /tmp/q16/DONE
