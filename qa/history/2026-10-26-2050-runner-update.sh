#!/bin/sh
# Update the QA runner code (pull main into RUNNER_HOME) and let systemd restart it: kill by the pid file, never by pattern
R=/home/puggie/pi-durable-worker/data/cellular-viz-runner; S=/home/puggie/pi-durable-worker/home/.cache/cellular-viz-runner
git -C $R pull -q --ff-only && git -C $R log --oneline -1
pid=$(cat $S/runner.pid); echo "stopping runner pid $pid"; kill -TERM "$pid"
