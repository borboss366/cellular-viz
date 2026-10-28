#!/bin/sh
# 2026-10-25-1551 · re-run of the chain I ran from /tmp/q18 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q18/x && git archive d6e50dc experiments | tar -x -C /tmp/q18/x   # 13 Flow Lab @d6e50dc
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/check-13.mjs --experiments /tmp/q18/x/experiments > /tmp/q18/c13.out 2>&1
touch /tmp/q18/DONE
