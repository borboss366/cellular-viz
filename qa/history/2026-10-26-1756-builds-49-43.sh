#!/bin/sh
# Builds for the two open PRs that passed before the builds page existed: #49 18 Little Bang @2ed06a0 (check-18), #43 12 Mass Gap @b33ad47 (check-12)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
run() {   # page pr commit check-script
  id=$(node qa/builds.mjs start --page $1 --pr $2 --commit $3)
  rm -rf /tmp/qb$2 && mkdir -p /tmp/qb$2/x && git archive $3 experiments | tar -x -C /tmp/qb$2/x
  node qa/builds.mjs set --id $id --status running
  out=$(node qa/$4.mjs --experiments /tmp/qb$2/x/experiments 2>/tmp/qb$2/err.log | tail -n1)
  if [ -f "$out/check.md" ]; then node qa/builds.mjs finish --id $id --check "$out"; else node qa/builds.mjs set --id $id --status failed --waiting qa-box; fi
}
run 18-little-bang 49 2ed06a0 check-18
run 12-mass-gap 43 b33ad47 check-12
touch /tmp/qb.DONE
