#!/bin/sh
# Rulings on the #49 / #43 builds: 18's one red row is the 1M-track stress setting (default 100k is 60 fps at 1440p and 4K; accepted 2026-10-25); 12 was graded on 2026-10-25 (run 2026-10-25-0035)
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
node qa/builds.mjs finish --id viz-49-1 --check qa/18-little-bang/checks/2026-10-26-1801 --status ready --note '1440p row fails only at ?n=1M (stress setting, accepted 2026-10-25); default 100k tracks: 60 fps at 1080p/1440p/4K'
node qa/builds.mjs finish --id viz-43-1 --check qa/12-mass-gap/checks/2026-10-26-1803 --swipe /run/12-mass-gap/2026-10-25-0035/compare
