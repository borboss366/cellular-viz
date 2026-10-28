#!/bin/sh
# 2026-10-25-1837 (box clock, UTC) · 13 Flow Lab @bc01f4d (RK3 back-trace): full check-13 (fps on all six, raw dye, beat over 60 s), then the curl drift probe
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q22 && mkdir -p /tmp/q22/x && git archive bc01f4d experiments | tar -x -C /tmp/q22/x
node qa/check-13.mjs --experiments /tmp/q22/x/experiments > /tmp/q22/c13.out 2>&1
node qa/history/2026-10-25-1717-curl-drift-probe.mjs /tmp/q22/x/experiments > /tmp/q22/curl.out 2>&1
touch /tmp/q22/DONE
