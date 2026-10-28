#!/bin/sh
# 23 Shape Shifter @aa04702 (PR #56): check-23 (genus by my own topology, Gauss–Bonnet, camera, events, sync, fps)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q26 && mkdir -p /tmp/q26/x && git archive aa04702 experiments | tar -x -C /tmp/q26/x
node qa/check-23.mjs --experiments /tmp/q26/x/experiments > /tmp/q26/c23.out 2>&1
touch /tmp/q26/DONE
