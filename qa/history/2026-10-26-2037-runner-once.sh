#!/bin/sh
# Dry run of the #59 QA runner inside the container before the user installs the systemd unit: one poll, run the queue, exit
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
set -a; . /home/puggie/pi-durable-worker/data/cellular-viz-runner.env; set +a
timeout 3600 node /home/puggie/pi-durable-worker/data/cellular-viz-runner/qa/runner/runner.mjs --once > /tmp/runner-once.log 2>&1
echo "exit $?" >> /tmp/runner-once.log
touch /tmp/runner-once.DONE
