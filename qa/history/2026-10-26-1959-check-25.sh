#!/bin/sh
# 2026-10-26-1959 (box clock) · 25 Shape Shifter II @71f3673 (PR #57) as a build: check-25 (all gates incl. framing) + turn probe
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
id=$(node qa/builds.mjs start --page 25-shape-shifter-2 --pr 57 --commit 71f3673)
rm -rf /tmp/q27/x && mkdir -p /tmp/q27/x && git archive 71f3673 experiments | tar -x -C /tmp/q27/x
node qa/builds.mjs set --id $id --status running
node qa/check-25.mjs --experiments /tmp/q27/x/experiments --bars 96 --n 128 > /tmp/q27/c25.out 2>&1
node qa/history/2026-10-26-1445-probe25-turns.mjs /tmp/q27/x/experiments > /tmp/q27/turns.out 2>&1
d=$(tail -n1 /tmp/q27/c25.out); if [ -f "$d/check.md" ]; then node qa/builds.mjs finish --id $id --check "$d"; else node qa/builds.mjs set --id $id --status failed --waiting qa-box; fi
touch /tmp/q27/DONE
