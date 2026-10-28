#!/bin/sh
# 2026-10-25-1900 (box clock) · beat over 60 s with the calibrated fNat on 13 @bc01f4d
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
[ -d /tmp/q22/x ] || { mkdir -p /tmp/q22/x && git archive bc01f4d experiments | tar -x -C /tmp/q22/x; }
node qa/history/2026-10-25-1900-beat60-fnat-probe.mjs "${1:-/tmp/q22/x/experiments}" "${2:-&fNat=1.2081}"
