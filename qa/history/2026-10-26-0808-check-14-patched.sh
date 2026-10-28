#!/bin/sh
# 14 Round Point @3862e5b with the one-character syntax fix applied locally (Math.exp(-((d / w) ** 2))): check-14 preview
cd /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
rm -rf /tmp/q24 && mkdir -p /tmp/q24/x && git archive 3862e5b experiments | tar -x -C /tmp/q24/x
sed -i 's|Math.exp(-(d / w) \*\* 2)|Math.exp(-((d / w) ** 2))|' /tmp/q24/x/experiments/14-round-point.html
node qa/check-14.mjs --experiments /tmp/q24/x/experiments > /tmp/q24/c14.out 2>&1
touch /tmp/q24/DONE
