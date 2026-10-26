#!/bin/sh
# 2026-10-26-1540 (box clock, UTC) · 25 Shape Shifter II @9363bf0: preview recording for the user (auto and native res, 64 s = 8 phrases incl. two slaloms) while VIZ dev fixes the last 2 genus moments and the view jumps
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
[ -f /tmp/q27/x/experiments/25-shape-shifter-2.html ] || { mkdir -p /tmp/q27/x && git archive 9363bf0 experiments | tar -x -C /tmp/q27/x; }
node qa/run.mjs --exp 25-shape-shifter-2.html --variants qa/history/2026-10-26-1540-record-25.variants.txt --warm 2 --dur 64 --experiments /tmp/q27/x/experiments --tag g25 > /tmp/q27/r25.out 2>&1
touch /tmp/q27/RDONE
