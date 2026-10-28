#!/bin/sh
# 2026-10-25 17:29 (box clock) · restart the grading viewer: kill the old serve.mjs by pid, start a new one
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
pid=$(ps -eo pid,args | awk '$2=="node" && $3=="qa/serve.mjs"{print $1}')
[ -n "$pid" ] && kill $pid
sleep 1
setsid nohup node qa/serve.mjs --port 8787 --socket /home/puggie/pi-durable-worker/data/qa-viewer.sock > ~/qa-viewer.log 2>&1 < /dev/null &
