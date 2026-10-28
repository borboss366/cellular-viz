#!/bin/sh
# 2026-10-25-1717 · see 2026-10-25-1717-curl-drift-probe.mjs
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
[ -d /tmp/q20/x ] || { mkdir -p /tmp/q20/x && git archive 40f2885 experiments | tar -x -C /tmp/q20/x; }
node qa/history/2026-10-25-1717-curl-drift-probe.mjs "${1:-/tmp/q20/x/experiments}"
