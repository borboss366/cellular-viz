#!/bin/sh
# check-14 with the new brightness-jump gate (6), on main's 14 (1bad7e6, hard cut: should fail) and PR #68 (no hard cuts)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
git fetch -q origin; git fetch -q origin pull/68/head:pr68
rm -rf /tmp/q14l && mkdir -p /tmp/q14l/old /tmp/q14l/new
git archive 1bad7e6 experiments | tar -x -C /tmp/q14l/old
git archive pr68 experiments | tar -x -C /tmp/q14l/new
sh qa/gpu-lock.sh check-14 node qa/check-14.mjs --experiments /tmp/q14l/old/experiments > /tmp/q14l/old.out 2>&1
sh qa/gpu-lock.sh check-14 node qa/check-14.mjs --experiments /tmp/q14l/new/experiments > /tmp/q14l/new.out 2>&1
touch /tmp/q14l/DONE
