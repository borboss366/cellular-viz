// Builds log: one check round of one commit on one PR = one build.
// qa/builds.json is append-only JSON Lines; each line is a full snapshot of a build, the latest line per id wins.
//   {id, kind, page, pr, commit, round, started, finished, status, gates:[{name, ok, value, bar}], report, swipe, waitingOn, at}
//   status: queued → running → failed | ready → merged      waitingOn: dev | qa-box | user
//
//   node qa/builds.mjs start  --page 25-shape-shifter-2 --pr 57 --commit acef3bb [--kind viz]      → prints the build id (status queued)
//   node qa/builds.mjs set    --id <id> --status running
//   node qa/builds.mjs finish --id <id> --check qa/<page>/checks/<stamp> [--swipe /run/<exp>/<stamp>/compare]
//                             → gates from that check.md, status failed (waiting on dev) or ready (waiting on user)
//                             [--gate 'name|0|value'] adds a gate; [--status ready --note why] records a ruling over the table
//   node qa/builds.mjs merged                                  → marks ready builds whose PR is merged (gh, read only)
//   node qa/builds.mjs list
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// the builds log lives in QA box's working copy (QA_HOME), also when this code runs from another clone (the viewer service)
const here = path.join(path.resolve(process.env.QA_HOME || path.join(path.dirname(fileURLToPath(import.meta.url)), '..')), 'qa');
export const FILE = path.join(here, 'builds.json');

export function loadBuilds() {
  if (!fs.existsSync(FILE)) return [];
  const latest = new Map();
  for (const line of fs.readFileSync(FILE, 'utf8').split('\n')) { if (!line.trim()) continue; try { const b = JSON.parse(line); latest.set(b.id, b); } catch {} }
  return [...latest.values()];
}
function append(b) { b.at = new Date().toISOString(); fs.appendFileSync(FILE, JSON.stringify(b) + '\n'); return b; }

// gates from a check.md table: | gate | ✅/❌/ℹ️ | detail |  (ℹ️ rows are reported-only, not gates)
export function gatesFromCheck(dir) {
  const md = fs.readFileSync(path.join(dir, 'check.md'), 'utf8'), gates = [];
  for (const line of md.split('\n')) {
    const m = line.match(/^\| (.+?) \| (✅|❌)[^|]*\|(.*)\|$/);           // | gate | ✅ … | detail |
    if (m) { gates.push({ name: m[1].trim(), ok: m[2] === '✅', value: m[3].trim().slice(0, 300) || null, bar: null }); continue; }
    const l = line.match(/^- (✅|❌) (\S.*)$/);                              // - ✅ gate   (check-17 style)
    if (l) gates.push({ name: l[2].trim(), ok: l[1] === '✅', value: null, bar: null });
  }
  return gates;
}

function args() { const a = {}; for (let i = 3; i < process.argv.length; i += 2) a[process.argv[i].replace(/^--/, '')] = process.argv[i + 1]; return a; }
const cmd = process.argv[2];
if (cmd === 'start') {
  const a = args(), all = loadBuilds(), kind = a.kind || 'viz';
  const round = all.filter(b => b.kind === kind && String(b.pr) === String(a.pr)).length + 1;
  const b = append({ id: `${kind}-${a.pr}-${round}`, kind, page: a.page, pr: +a.pr, commit: a.commit, round, started: a.at || new Date().toISOString(), finished: null,
    status: 'queued', gates: [], report: null, swipe: null, waitingOn: 'qa-box' });
  console.log(b.id);
} else if (cmd === 'set') {
  const a = args(), b = loadBuilds().find(x => x.id === a.id); if (!b) throw new Error('no build ' + a.id);
  b.status = a.status; if (a.waiting) b.waitingOn = a.waiting; append(b);
} else if (cmd === 'finish') {
  const a = args(), b = loadBuilds().find(x => x.id === a.id); if (!b) throw new Error('no build ' + a.id);
  b.gates = gatesFromCheck(a.check); b.report = path.relative(path.join(here, '..'), path.join(a.check, 'check.md'));
  b.finished = a.at || new Date().toISOString();
  if (a.swipe) b.swipe = a.swipe;
  if (a.gate) { const [name, ok, value] = a.gate.split('|'); b.gates.unshift({ name, ok: ok === '1', value: value || null, bar: null }); }   // a gate the table doesn't hold (e.g. the page didn't load)
  const allOk = b.gates.length > 0 && b.gates.every(g => g.ok);
  b.status = allOk ? (b.swipe ? 'ready' : 'running') : 'failed';
  b.waitingOn = allOk ? (b.swipe ? 'user' : 'qa-box') : 'dev';
  if (a.status) { b.status = a.status; b.waitingOn = a.waiting || (a.status === 'ready' ? 'user' : a.status === 'failed' ? 'dev' : b.waitingOn); b.note = a.note || null; }   // a ruling the table can't show
  append(b);
  console.log(`${b.id} ${b.status} ${b.gates.filter(g => g.ok).length}/${b.gates.length}`);
} else if (cmd === 'merged') {
  for (const b of loadBuilds().filter(x => x.status === 'ready')) {
    try {
      const state = execFileSync('gh', ['pr', 'view', String(b.pr), '--json', 'state', '-q', '.state'], { encoding: 'utf8' }).trim();
      if (state === 'MERGED') { b.status = 'merged'; b.waitingOn = null; append(b); console.log(`${b.id} merged`); }
    } catch (e) { console.error(`${b.id}: ${e.message.split('\n')[0]}`); }
  }
} else if (cmd === 'list') {
  for (const b of loadBuilds()) console.log(`${b.id}\t${b.page}\t${b.commit}\t${b.status}\t${b.gates.filter(g => g.ok).length}/${b.gates.length}\t${b.waitingOn || ''}`);
}
