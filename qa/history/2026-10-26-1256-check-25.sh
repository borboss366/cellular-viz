#!/bin/sh
# 25 Shape Shifter II @f5f6a28 (PR #57): check-25 (keyframe genus n=192, live genus every 1/8 bar over 96 bars n=128, slalom crossings, clearance, turn rate, sync, fps)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q27/x && mkdir -p /tmp/q27/x && git archive f5f6a28 experiments | tar -x -C /tmp/q27/x
node qa/check-25.mjs --experiments /tmp/q27/x/experiments --bars 96 --n 128 > /tmp/q27/c25.out 2>&1
touch /tmp/q27/DONE
