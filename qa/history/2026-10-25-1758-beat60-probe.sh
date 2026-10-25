#!/bin/sh
# 2026-10-25-1758 (box clock) · see 2026-10-25-1758-beat60-probe.mjs
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
[ -d /tmp/q21/x ] || { mkdir -p /tmp/q21/x && git archive 40f2885 experiments | tar -x -C /tmp/q21/x; }
node qa/history/2026-10-25-1758-beat60-probe.mjs "${1:-/tmp/q21/x/experiments}"
node qa/history/2026-10-25-1717-curl-drift-probe.mjs "${1:-/tmp/q21/x/experiments}"
