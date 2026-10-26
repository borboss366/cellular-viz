#!/bin/sh
# 25 Shape Shifter II @acef3bb (PR #57): check-25 with the framing gates (no empty picture > ¼ s; shape ≥ 25 % mean, ≥ 8 % at p10) + turn probe
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q27/x && mkdir -p /tmp/q27/x && git archive acef3bb experiments | tar -x -C /tmp/q27/x
node qa/check-25.mjs --experiments /tmp/q27/x/experiments --bars 96 --n 128 > /tmp/q27/c25.out 2>&1
node qa/history/2026-10-26-1445-probe25-turns.mjs /tmp/q27/x/experiments > /tmp/q27/turns.out 2>&1
touch /tmp/q27/DONE
