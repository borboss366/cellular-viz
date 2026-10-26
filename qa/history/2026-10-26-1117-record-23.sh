#!/bin/sh
# 2026-10-26-1117 (box clock, UTC) · 23 Shape Shifter @aa04702: record auto (64 s, covers the surgery at bar 14 = 28 s), one-hole, no-hole and auto at native res for the user's page
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
[ -d /tmp/q26/x ] || { mkdir -p /tmp/q26/x && git archive aa04702 experiments | tar -x -C /tmp/q26/x; }
node qa/run.mjs --exp 23-shape-shifter.html --variants qa/history/2026-10-26-1117-record-23.variants.txt --warm 2 --dur 64 --experiments /tmp/q26/x/experiments --tag g23 > /tmp/q26/r23.out 2>&1
touch /tmp/q26/RDONE
