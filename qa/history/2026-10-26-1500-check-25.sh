#!/bin/sh
# 25 Shape Shifter II @9363bf0 (PR #57, fixes for check 1316): check-25, flagged moments re-counted at n 192/256
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q27/x && mkdir -p /tmp/q27/x && git archive 9363bf0 experiments | tar -x -C /tmp/q27/x
node qa/check-25.mjs --experiments /tmp/q27/x/experiments --bars 96 --n 128 > /tmp/q27/c25.out 2>&1
touch /tmp/q27/DONE
