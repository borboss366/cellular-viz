#!/bin/sh
# 2026-10-25-1315 · re-run of the chain I ran from /tmp/q14 (pages unpacked there from origin branches at that time)
# times are the box clock (UTC). Unpack the pages first:
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
mkdir -p /tmp/q14/s /tmp/q14/p && git archive 1177330 experiments | tar -x -C /tmp/q14/s && git archive ab589e7 experiments | tar -x -C /tmp/q14/p   # 17 @1177330, 19 @ab589e7
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
idle() { while ps -eo args | grep -E '^node qa/(check|canyon-closeup|run)' >/dev/null; do sleep 15; done; }
run() { idle; "$@"; }
run node qa/check-17.mjs --experiments /tmp/q14/s/experiments --secs 40 --query "trickOn=bars&trickEvery=1&trickSpeed=1" > /tmp/q14/c17m.out 2>&1
run node qa/check-17.mjs --experiments /tmp/q14/s/experiments --secs 70 > /tmp/q14/c17d.out 2>&1
run node qa/check-events.mjs --page 17-bsd-skater.html --query "x=1" --experiments /tmp/q14/s/experiments --label "17 default events" --secs 70 > /tmp/q14/e17.json 2>&1
printf '17-x3-2x :: x=1 ::tap\n' > /tmp/q14/v17.txt
run node qa/run.mjs --exp 17-bsd-skater.html --variants /tmp/q14/v17.txt --warm 4 --dur 64 --experiments /tmp/q14/s/experiments --tag g17 > /tmp/q14/r17.out 2>&1
printf '19-torus :: track=torus ::tap\n19-morph :: track=morph ::tap\n19-free :: track=free ::tap\n' > /tmp/q14/v19.txt
run node qa/run.mjs --exp 19-skate-park.html --variants /tmp/q14/v19.txt --warm 4 --dur 64 --experiments /tmp/q14/p/experiments --tag g19 > /tmp/q14/r19.out 2>&1
touch /tmp/q14/DONE
