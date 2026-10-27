#!/bin/sh
# 18 Little Bang #49: swipe run old collide (2ed06a0) vs the white-blob fix (9d71ef5: collide, quench, auto), 40 s each, merged into one run
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/run.mjs --exp 18-little-bang.html --variants qa/history/2026-10-27-0821-record-18ab.old.txt --warm 4 --dur 40 --experiments /tmp/q18c/2ed06a0/experiments --tag g18old > /tmp/q18c/rold.out 2>&1
node qa/run.mjs --exp 18-little-bang.html --variants qa/history/2026-10-27-0821-record-18ab.new.txt --warm 4 --dur 40 --experiments /tmp/q18c/9d71ef5/experiments --tag g18new > /tmp/q18c/rnew.out 2>&1
touch /tmp/q18c/RDONE
