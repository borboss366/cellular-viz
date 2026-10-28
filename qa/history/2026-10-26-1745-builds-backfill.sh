#!/bin/sh
# 2026-10-26 17:45 (box clock) · backfill qa/builds.json from the check reports of #53 (13), #55 (14), #56 (23), #57 (25)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -f qa/builds.json
B() { node qa/builds.mjs start --page $1 --pr $2 --commit $3 --at $4; }
F() { id=$1; shift; node qa/builds.mjs finish --id $id "$@"; }
T() { echo "$1" | sed -E 's/(....-..-..)-(..)(..)/\1T\2:\3:00Z/'; }
for x in "1438 5e83b58" "1514 70fc2c4" "1541 ddb3d49" "1604 d6e50dc" "1628 f73683a" "1705 40f2885" "1745 40f2885" "1854 bc01f4d"; do set -- $x
  id=$(B 13-flow-lab 53 $2 $(T 2026-10-25-$1)); F $id --check qa/13-flow-lab/checks/2026-10-25-$1 --at $(T 2026-10-25-$1); done
id=$(B 13-flow-lab 53 ccad444 $(T 2026-10-25-1939)); F $id --check qa/13-flow-lab/checks/2026-10-25-1957 --swipe /run/13-flow-lab/2026-10-25-1957/compare --at $(T 2026-10-25-1957)
id=$(B 14-round-point 55 3862e5b $(T 2026-10-26-0618)); F $id --check qa/14-round-point/checks/2026-10-26-0812 --gate 'page loads|0|SyntaxError in curveBump: -(d / w) ** 2; the table below is from a locally patched copy' --at $(T 2026-10-26-0812)
id=$(B 14-round-point 55 1bad7e6 $(T 2026-10-26-0831)); F $id --check qa/14-round-point/checks/2026-10-26-0835 --swipe /run/14-round-point/2026-10-26-0835/compare --at $(T 2026-10-26-0850)
id=$(B 23-shape-shifter 56 aa04702 $(T 2026-10-26-0949)); F $id --check qa/23-shape-shifter/checks/2026-10-26-0953 --swipe /run/23-shape-shifter/2026-10-26-1117/compare --status ready --note 'Gauss–Bonnet judged with bumps off (holds); genus exact from χ' --at $(T 2026-10-26-1123)
for x in "1316 f5f6a28 1256" "1524 9363bf0 1500" "1642 acef3bb 1620"; do set -- $x
  id=$(B 25-shape-shifter-2 57 $2 $(T 2026-10-26-$3)); F $id --check qa/25-shape-shifter-2/checks/2026-10-26-$1 --at $(T 2026-10-26-$1); done
node qa/builds.mjs merged
node qa/builds.mjs list
