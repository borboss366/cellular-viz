#!/usr/bin/env node
// qa/emit-test-event.sh: write one "test" event into QA_EVENTS_DIR, the way the runner writes its build events
// (events.mjs: atomic, pruned), so QA box can check its folder trigger end to end. No arguments.
import os from 'node:os';
import { emit } from './events.mjs';

const dir = process.env.QA_EVENTS_DIR || '';
if (!dir) { console.error('QA_EVENTS_DIR is not set in the runner settings (runner.env): no events are written'); process.exit(1); }
const f = emit(dir, { type: 'test', pr: null, note: 'qa/emit-test-event.sh: a test of the folder trigger', host: os.hostname() });
console.log(`test event written: ${f}`);
