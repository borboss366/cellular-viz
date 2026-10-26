#!/bin/sh
# 2026-10-26-0831 (box clock, UTC) · 14 Round Point @1bad7e6: check-14 (VIZ QA gates, iso ignores the last 1 % of area), then record curve / pinch / auto, 40 s each
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q25 && mkdir -p /tmp/q25/x && git archive 1bad7e6 experiments | tar -x -C /tmp/q25/x
node qa/check-14.mjs --experiments /tmp/q25/x/experiments > /tmp/q25/c14.out 2>&1
node qa/run.mjs --exp 14-round-point.html --variants qa/history/2026-10-26-0831-record-14.variants.txt --warm 4 --dur 40 --experiments /tmp/q25/x/experiments --tag g14 > /tmp/q25/r14.out 2>&1
touch /tmp/q25/DONE
