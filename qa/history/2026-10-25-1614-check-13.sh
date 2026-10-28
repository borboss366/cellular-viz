#!/bin/sh
# 2026-10-25-1614 · re-run of the chain I ran from /tmp/q19 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q19/x && git archive f73683a experiments | tar -x -C /tmp/q19/x   # 13 Flow Lab @f73683a
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/check-13.mjs --experiments /tmp/q19/x/experiments > /tmp/q19/c13.out 2>&1
touch /tmp/q19/DONE
