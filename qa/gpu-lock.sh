#!/bin/sh
# Run a command holding the box's GPU lock the way the QA runner takes it (gpu.mjs: create the file exclusively with our
# pid inside; a lock whose pid is dead is taken over). flock does NOT work here: the runner never calls flock.
#   sh qa/gpu-lock.sh <label> <command…>
L=${GPU_LOCK:-/tmp/cellular-viz-gpu.lock}; what=$1; shift
while :; do
  if ( set -C; echo "$$ $(date -u +%FT%TZ) qa-box $what" > "$L" ) 2>/dev/null; then break; fi
  p=$(cut -d' ' -f1 "$L" 2>/dev/null); if [ -n "$p" ] && ! kill -0 "$p" 2>/dev/null; then rm -f "$L"; continue; fi
  sleep 10
done
trap '[ "$(cut -d" " -f1 "$L" 2>/dev/null)" = "$$" ] && rm -f "$L"' EXIT INT TERM
"$@"
