#!/bin/sh
# 2026-10-26-1826 (box clock) · 18 Little Bang @2ed06a0 (#49): swipe run for the user (collide, quench, strings, auto; 40 s each), attached to build viz-49-1
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
[ -d /tmp/qb49/x ] || { mkdir -p /tmp/qb49/x && git archive 2ed06a0 experiments | tar -x -C /tmp/qb49/x; }
node qa/run.mjs --exp 18-little-bang.html --variants qa/history/2026-10-26-1826-record-18.variants.txt --warm 4 --dur 40 --experiments /tmp/qb49/x/experiments --tag g18 > /tmp/qb49/r18.out 2>&1
