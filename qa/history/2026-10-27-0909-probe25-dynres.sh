#!/bin/sh
# 25 #57: where do the native-4K slow frames happen (dynres steps vs shapes)? arg: --experiments <dir>
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
git fetch -q origin; rm -rf /tmp/q25 && mkdir -p /tmp/q25/x && git archive e046b75 experiments | tar -x -C /tmp/q25/x
node qa/history/2026-10-27-0909-probe25-dynres.mjs "$@"
