#!/bin/sh
# 2026-10-25-1731 (box clock, UTC) · re-run check-13 on 13 Flow Lab @40f2885 (user asked to restart the check)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q21 && mkdir -p /tmp/q21/x && git archive 40f2885 experiments | tar -x -C /tmp/q21/x
node qa/check-13.mjs --experiments /tmp/q21/x/experiments > /tmp/q21/c13.out 2>&1
node qa/history/2026-10-25-1717-curl-drift-probe.mjs /tmp/q21/x/experiments > /tmp/q21/curl.out 2>&1
touch /tmp/q21/DONE
