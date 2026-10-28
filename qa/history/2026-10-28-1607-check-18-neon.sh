#!/bin/sh
# check-18 with the #75 gates (9–12: + 13–16 neon wires) on PR #75 head
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
git fetch -q origin pull/75/head:pr75
rm -rf /tmp/q75 && mkdir -p /tmp/q75 && git archive pr75 experiments | tar -x -C /tmp/q75
sh qa/gpu-lock.sh check-18 node qa/check-18.mjs --experiments /tmp/q75/experiments > /tmp/q75/out 2>&1
touch /tmp/q75/DONE
