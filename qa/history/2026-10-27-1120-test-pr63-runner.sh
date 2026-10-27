#!/bin/sh
# PR #63 (qa-experiment-files @4a557a8): unit tests, example validation, syntax checks, and a dry run of
# exp-run on 18 (#49 @9d71ef5) without the swipe. Scratch checkout in /tmp/pr63; the runner service is not touched.
R=/home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz
SHA=${1:-4a557a8}
cd $R && git fetch -q origin qa-experiment-files
rm -rf /tmp/pr63 /tmp/exp-dry && mkdir -p /tmp/pr63/src /tmp/exp-dry/pages /tmp/exp-dry/out
git archive $SHA | tar -x -C /tmp/pr63/src
git archive 9d71ef5 experiments | tar -x -C /tmp/exp-dry/pages
# my qa tree as committed (checks like check-18), copied so the dry run writes nothing into the repo
mkdir -p /tmp/exp-dry/qatree && git archive HEAD qa | tar -x -C /tmp/exp-dry/qatree && ln -s $R/qa/node_modules /tmp/exp-dry/qatree/qa/node_modules
cd /tmp/pr63/src
ln -s $R/qa/node_modules qa/node_modules 2>/dev/null
echo "== 1 unit tests"; node --test qa/runner/test/; echo "exit $?"
echo "== 2 example"; node qa/runner/experiment.mjs qa/experiments/example.json; echo "exit $?"
echo "== 3 syntax"; node --check qa/runner/runner.mjs && node --check qa/runner/exp-run.mjs; echo "exit $?"
echo "== 4 dry run"
node -e 'const f="qa/experiments/example.json",j=JSON.parse(require("fs").readFileSync(f));delete j.swipe;require("fs").writeFileSync("/tmp/exp-dry/example-noswipe.json",JSON.stringify(j,null,1))'
node qa/runner/exp-run.mjs --file /tmp/exp-dry/example-noswipe.json --experiments /tmp/exp-dry/pages/experiments --qa /tmp/exp-dry/qatree/qa --out /tmp/exp-dry/out --pr 49 --sha 9d71ef5; echo "exit $?"
