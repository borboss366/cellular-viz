#!/bin/sh
# 2026-10-25-1651 (box clock, UTC) · 13 Flow Lab @40f2885: check-13 against the MVP gates, then record the six looks (40 s each) for the user's swipe page
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q20 && mkdir -p /tmp/q20/x && git archive 40f2885 experiments | tar -x -C /tmp/q20/x
node qa/check-13.mjs --experiments /tmp/q20/x/experiments > /tmp/q20/c13.out 2>&1
node qa/run.mjs --exp 13-flow-lab.html --variants qa/history/2026-10-25-1651-record-13.variants.txt --warm 6 --dur 40 --experiments /tmp/q20/x/experiments --tag g13 > /tmp/q20/r13.out 2>&1
touch /tmp/q20/DONE
