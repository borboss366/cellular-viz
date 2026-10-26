#!/bin/sh
# 14 Round Point @3862e5b (PR #55): check-14 (all VIZ QA gates)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q24 && mkdir -p /tmp/q24/x && git archive 3862e5b experiments | tar -x -C /tmp/q24/x
node qa/check-14.mjs --experiments /tmp/q24/x/experiments > /tmp/q24/c14.out 2>&1
touch /tmp/q24/DONE
