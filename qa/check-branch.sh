#!/bin/sh
# 90 s cover check of 06 look-dream + look-glow on any branch, with this branch's harness.
#   sh qa/check-branch.sh auto-no-blank [seconds]
# Writes qa/06-effects/runs/<stamp>-<branch>/ (report.md has the cover table). Does not push.
set -eu
branch=${1:?branch}; dur=${2:-90}
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git fetch -q origin "$branch"
git archive FETCH_HEAD experiments | tar -x -C "$tmp"
printf 'look-dream :: preset=four&sigma=0.02&look=dream ::tap\nlook-glow :: preset=four&sigma=0.02&look=glow ::tap\n' > "$tmp/v.txt"
out=$(node qa/run.mjs --exp 06-lenia-effects.html --variants "$tmp/v.txt" --warm 4 --dur "$dur" \
  --experiments "$tmp/experiments" --tag "$branch-$(git rev-parse --short FETCH_HEAD)" | tail -1)
echo "$out"
sed -n '/Cover over time/,$p' "$out/report.md"
