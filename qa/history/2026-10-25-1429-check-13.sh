#!/bin/sh
# 2026-10-25-1429 · re-run of the chain I ran from /tmp/q15 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q15/x && git archive 5e83b58 experiments | tar -x -C /tmp/q15/x   # 13 Flow Lab @5e83b58
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/check-13.mjs --experiments /tmp/q15/x/experiments > /tmp/q15/c13.out 2>&1
touch /tmp/q15/DONE
