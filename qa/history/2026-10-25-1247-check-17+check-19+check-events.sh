#!/bin/sh
# 2026-10-25-1247 · re-run of the chain I ran from /tmp/q13 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q13/s /tmp/q13/p && git archive 5735093 experiments | tar -x -C /tmp/q13/s && git archive ab589e7 experiments | tar -x -C /tmp/q13/p   # 17 @5735093, 19 @ab589e7
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
idle() { while ps -eo args | grep -E '^node qa/(check|canyon-closeup|run)' >/dev/null; do sleep 15; done; }
run() { idle; "$@"; }
run node qa/check-19.mjs --experiments /tmp/q13/p/experiments > /tmp/q13/c19.out 2>&1
run node qa/check-17.mjs --experiments /tmp/q13/s/experiments --secs 40 --query "trickOn=bars&trickEvery=1&trickSpeed=1" > /tmp/q13/c17m.out 2>&1
run node qa/check-17.mjs --experiments /tmp/q13/s/experiments --secs 40 > /tmp/q13/c17d.out 2>&1
run node qa/check-events.mjs --page 17-bsd-skater.html --query "" --experiments /tmp/q13/s/experiments --label "17 default events" --secs 60 > /tmp/q13/e17.json 2>&1
touch /tmp/q13/DONE
