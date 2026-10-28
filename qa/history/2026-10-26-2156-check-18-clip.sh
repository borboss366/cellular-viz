#!/bin/sh
# 18 Little Bang #49: check-18 with the new #58 clip gate, on the fix (9d71ef5, as build round 3) and on the old build (2ed06a0, reference only)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
git fetch -q origin
for c in 2ed06a0 9d71ef5; do rm -rf /tmp/q18c/$c && mkdir -p /tmp/q18c/$c && git archive $c experiments | tar -x -C /tmp/q18c/$c; done
node qa/check-18.mjs --experiments /tmp/q18c/2ed06a0/experiments > /tmp/q18c/old.out 2>&1
id=$(node qa/builds.mjs start --page 18-little-bang --pr 49 --commit 9d71ef5); node qa/builds.mjs set --id $id --status running
node qa/check-18.mjs --experiments /tmp/q18c/9d71ef5/experiments > /tmp/q18c/new.out 2>&1
d=$(tail -n1 /tmp/q18c/new.out); if [ -f "$d/check.md" ]; then node qa/builds.mjs finish --id $id --check "$d"; else node qa/builds.mjs set --id $id --status failed --waiting qa-box; fi
touch /tmp/q18c/DONE
