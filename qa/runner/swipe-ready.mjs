#!/usr/bin/env node
// qa/swipe-ready.sh: ask the runner for a swipe run on every build that finished green without one (the newest round
// of each PR, an experiment build on a page, open or merged in the last 3 days). No arguments. It writes one request per build into the runner's state folder; the runner
// picks them up at its next poll (or run-next.sh), records the swipe at the build's commit and finishes the same build
// with it, so the build lands on the grading page. Prints what it asked for.
import os from 'node:os';
import path from 'node:path';
import { loadBuilds } from '../builds.mjs';
import { swipeCandidates, writeRequest } from './swipe.mjs';

const state = path.resolve(process.env.RUNNER_STATE || path.join(os.homedir(), '.cache', 'cellular-viz-runner'));
const want = swipeCandidates(loadBuilds());
if (!want.length) console.log('nothing to swipe: no green build without a swipe run');
for (const b of want) {
  writeRequest(state, b);
  console.log(`asked for a swipe: ${b.id} (#${b.pr} ${b.page} @${b.commit}, ${b.gates.length}/${b.gates.length} gates)`);
}
if (want.length) console.log(`the runner takes ${want.length === 1 ? 'it' : 'them'} at its next poll (${state}/swipe-requests)`);
