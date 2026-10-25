#!/bin/sh
# 2026-10-25-1939 (box clock, UTC) · 13 Flow Lab @ccad444 (fNat 1.2081): check-13, then re-record the six looks (40 s each) for the user's swipe page
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q23 && mkdir -p /tmp/q23/x && git archive ccad444 experiments | tar -x -C /tmp/q23/x
node qa/check-13.mjs --experiments /tmp/q23/x/experiments > /tmp/q23/c13.out 2>&1
node qa/run.mjs --exp 13-flow-lab.html --variants qa/history/2026-10-25-1651-record-13.variants.txt --warm 6 --dur 40 --experiments /tmp/q23/x/experiments --tag g13 > /tmp/q23/r13.out 2>&1
touch /tmp/q23/DONE
