#!/usr/bin/env node
// cellular-viz QA runner: a systemd service on the QA box.
//
// It watches the open pull requests, and for every new head commit it runs the page checks on the pages
// that PR touches, then writes the result as a build in qa/builds.json (the /builds page reads that).
// Nobody sends it commands: its HTTP API is GET only (status, builds, log).
//
// Guard rails (#57 thread, VIZ research + VIZ evangelist):
//   1. The check scripts come from a trusted ref (CHECKS_REF: main, or QA box's branch until #20 is merged),
//      never from the PR. Only the PR's experiments/ folder is taken from the PR commit; its pages run inside
//      headless Chromium, the scripts that drive them do not come from the PR.
//   2. Only PRs whose head branch lives in this repo (no forks) and whose author is on RUNNER_AUTHORS.
//   3. No GitHub token: it reads the public REST API anonymously (ETag polling, 304s are free) and fetches
//      over https. It never pushes; QA box keeps doing the one push at ready-to-merge.
//   4. The API is read only and listens on 127.0.0.1 or a Unix socket unless you choose otherwise.
//
//   node qa/runner/runner.mjs [--once] [--repo o/r] [--qa-home dir] [--checks-ref main] [--authors a,b]
//                             [--poll 120] [--listen 127.0.0.1:8788 | --socket path] [--state dir] [--timeout 90]
// The same settings come from the environment: RUNNER_REPO, QA_HOME, CHECKS_REF, RUNNER_AUTHORS, RUNNER_POLL,
// RUNNER_LISTEN, RUNNER_SOCKET, RUNNER_STATE, RUNNER_TIMEOUT_MIN.  --once: one poll, run the queue, exit.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gpuGate, unlock as gpuUnlock, GPU } from './gpu.mjs';
import { putJob, superseded } from './queue.mjs';
import { loadFile } from './experiment.mjs';
import { historyEntry, commitPaths, reportFiles, buildDirs, messageFor } from './post.mjs';
import { sync as boardSync } from './board.mjs';
import { runShared } from './shared.mjs';
import { addTodo } from './todo.mjs';
import { audioDir, scanTracks } from './audio.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const CFG = {
  repo: flag('repo', env('RUNNER_REPO', 'borboss366/cellular-viz')),
  qaHome: path.resolve(flag('qa-home', env('QA_HOME', path.join(here, '..', '..')))),
  checksRef: flag('checks-ref', env('CHECKS_REF', 'main')),
  authors: flag('authors', env('RUNNER_AUTHORS', 'borboss366')).split(',').map(s => s.trim()).filter(Boolean),
  poll: Math.max(30, +flag('poll', env('RUNNER_POLL', '120')) || 120),
  listen: flag('listen', env('RUNNER_LISTEN', '127.0.0.1:8788')),
  socket: flag('socket', env('RUNNER_SOCKET', '')),
  state: path.resolve(flag('state', env('RUNNER_STATE', path.join(os.homedir(), '.cache', 'cellular-viz-runner')))),
  timeoutMin: Math.max(1, +flag('timeout', env('RUNNER_TIMEOUT_MIN', '90')) || 90),
  label: env('RUNNER_LABEL', 'qa-ready'),
  commit: env('RUNNER_COMMIT', '1') !== '0',   // after each build: commit its .md/.json reports + history entry in QA_HOME (never pushes)
  board: env('RUNNER_BOARD', '1') !== '0',     // after each build and merge: move the board cards (gh, the box's login)
  shared: env('SHARED_CHECKS', '1') !== '0',   // after each page's own check: qa/check-shared.mjs (flash + GPU gates, #88)
  sharedMin: Math.max(1, +env('SHARED_TIMEOUT_MIN', '12') || 12),
  audioDir: audioDir(flag('audio-dir', '')),   // QA_AUDIO_DIR: the real tracks (#95 truth (b)); never in git or a run folder
  once: argv.includes('--once'),
};
if (!/^[\w.-]+\/[\w.-]+$/.test(CFG.repo)) throw new Error('bad repo ' + CFG.repo);
if (!/^[\w][\w./-]*$/.test(CFG.checksRef) || CFG.checksRef.includes('..')) throw new Error('bad checks ref ' + CFG.checksRef);
const BUILDS_CLI = path.join(CFG.qaHome, 'qa', 'builds.mjs');
const BUILDS_FILE = path.join(CFG.qaHome, 'qa', 'builds.json');
const WORK = path.join(CFG.state, 'repo');
const STATE_FILE = path.join(CFG.state, 'state.json');
const LOG_FILE = path.join(CFG.state, 'runner.log');
const PAGE_RE = /^experiments\/(\d\d-[a-z0-9-]+)\.html$/;
const EXP_FILES = ['experiment.mjs', 'probes.mjs', 'gpu.mjs', 'exp-run.mjs', 'audio.mjs'];   // the measuring code: always this runner's own copy
fs.mkdirSync(CFG.state, { recursive: true });

// ---------- log ----------
function log(...a) {
  const line = `${new Date().toISOString()} ${a.join(' ')}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
    if (fs.statSync(LOG_FILE).size > 5e6) { const t = fs.readFileSync(LOG_FILE, 'utf8'); fs.writeFileSync(LOG_FILE, t.slice(-1e6)); }
  } catch {}
}
const tail = n => { try { return fs.readFileSync(LOG_FILE, 'utf8').trimEnd().split('\n').slice(-n); } catch { return []; } };

// ---------- state (survives restarts) ----------
let state = { seen: {}, etag: null, queue: [], recent: [], expDone: {} };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch {}
const save = () => { const t = STATE_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(state, null, 1)); fs.renameSync(t, STATE_FILE); };
const status = { started: new Date().toISOString(), lastPoll: null, lastError: null, rate: null, running: null };

// ---------- processes (no shell; argument arrays only) ----------
let child = null;
let trace = null;   // the commands of the running build, for its qa/history .sh
function run(cmd, args, { cwd, timeoutMs = 10 * 60e3, quiet = false } = {}) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!quiet) child = p;
    if (trace) trace.push([cmd, args]);
    let out = '', err = '';
    const cap = (s, d) => (s.length > 2e6 ? s.slice(-1e6) : s) + d;
    p.stdout.on('data', d => { out = cap(out, d); });
    p.stderr.on('data', d => { err = cap(err, d); });
    const timer = setTimeout(() => { log(`timeout after ${timeoutMs / 60e3} min: ${cmd} ${args[0] || ''}`); try { process.kill(-p.pid, 'SIGKILL'); } catch {} }, timeoutMs);
    p.on('error', e => { err += String(e); });
    p.on('close', code => { clearTimeout(timer); if (child === p) child = null; resolve({ code, out, err }); });
  });
}
async function must(cmd, args, opts) {
  const r = await run(cmd, args, { quiet: true, ...opts });
  if (r.code !== 0) throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} → ${r.code}: ${r.err.trim().split('\n').slice(-3).join(' / ')}`);
  return r.out;
}

// ---------- GitHub, read only and anonymous ----------
async function gh(p, etag) {
  const headers = { accept: 'application/vnd.github+json', 'user-agent': 'cellular-viz-qa-runner', 'x-github-api-version': '2022-11-28' };
  if (etag) headers['if-none-match'] = etag;
  const r = await fetch(`https://api.github.com/repos/${CFG.repo}/${p}`, { headers });
  status.rate = { remaining: +r.headers.get('x-ratelimit-remaining'), reset: new Date(1000 * +r.headers.get('x-ratelimit-reset')).toISOString() };
  if (r.status === 304) return { notModified: true };
  if (!r.ok) throw new Error(`GitHub ${r.status} on ${p}`);
  return { data: await r.json(), etag: r.headers.get('etag') };
}

// ---------- builds.json (QA box's file; this runner appends through builds.mjs, reads it directly) ----------
function buildLines() {
  try { return fs.readFileSync(BUILDS_FILE, 'utf8').split('\n').filter(l => l.trim()).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}
function latestBuilds() { const m = new Map(); for (const b of buildLines()) m.set(b.id, b); return [...m.values()]; }
const builds = (...a) => must('node', [BUILDS_CLI, ...a], { cwd: CFG.qaHome });
function appendBuild(b) { b.at = new Date().toISOString(); fs.appendFileSync(BUILDS_FILE, JSON.stringify(b) + '\n'); }

// ---------- watching ----------
function enqueue(job) {
  const { queue, replaced } = putJob(state.queue, job);   // a newer commit replaces a queued older one, in its place
  state.queue = queue;
  log(`queued #${job.pr} ${job.kind === 'experiment' ? 'experiment' : job.page} @${job.sha.slice(0, 7)}${replaced ? ` (replaces @${String(replaced.sha).slice(0, 7)})` : ''}`);
}
// A qa-ready PR runs only its experiment file. If the runner saw it before the label landed (opened, then labelled a
// minute later: #86 touched all 19 pages and queued 19 page builds, 01–08 "failed" in 0.7 s for want of a check
// script, 09+ ran full checks nobody asked for), its page builds are dropped here, also from a queue saved before a
// restart. A PR is labelled when its seen key carries the label (set below).
function dropPageJobsOfLabelled() {
  const labelled = n => String(state.seen[n] || '').endsWith(`+${CFG.label}`);
  const drop = state.queue.filter(j => j.kind !== 'experiment' && labelled(j.pr));
  if (!drop.length) return;
  state.queue = state.queue.filter(j => !drop.includes(j));
  log(`dropped ${drop.length} queued page build${drop.length > 1 ? 's' : ''} of qa-ready PR${new Set(drop.map(j => j.pr)).size > 1 ? 's' : ''} #${[...new Set(drop.map(j => j.pr))].join(', #')} (${drop.map(j => j.page).join(', ')}): the experiment file runs instead`);
  save();
}
async function poll() {
  dropPageJobsOfLabelled();
  status.lastPoll = new Date().toISOString();
  if (status.rate && status.rate.remaining === 0 && Date.parse(status.rate.reset) > Date.now()) return;
  const res = await gh('pulls?state=open&per_page=100', state.etag);
  if (res.notModified) return;
  state.etag = res.etag;
  const open = new Set();
  for (const pr of res.data) {
    const n = pr.number, sha = pr.head && pr.head.sha;
    open.add(n);
    if (!pr.head || !pr.head.repo || pr.head.repo.full_name !== CFG.repo) continue;   // forks never run
    if (!CFG.authors.includes(pr.user && pr.user.login)) continue;
    if (!/^[0-9a-f]{40}$/.test(sha || '')) continue;
    // labelled qa-ready: run the PR's own experiment file (qa/experiments/<PR>.json), once per head commit
    const labelled = (pr.labels || []).some(l => l && l.name === CFG.label);
    const key = labelled ? `${sha}+${CFG.label}` : sha;
    if (state.seen[n] === key) continue;
    if (labelled) {
      state.seen[n] = key;
      dropPageJobsOfLabelled();
      if ((state.expDone || {})[n] !== sha) enqueue({ pr: n, sha, kind: 'experiment', page: 'experiment', title: pr.title, at: new Date().toISOString() });
      save();
      continue;
    }
    const files = await gh(`pulls/${n}/files?per_page=100`);
    const pages = [...new Set(files.data.map(f => (f.filename.match(PAGE_RE) || [])[1]).filter(Boolean))];
    const done = latestBuilds().filter(b => b.pr === n && sha.startsWith(String(b.commit || 'x')));
    for (const page of pages) if (!done.some(b => b.page === page)) enqueue({ pr: n, sha, page, title: pr.title, at: new Date().toISOString() });
    state.seen[n] = key;
    save();
  }
  for (const k of Object.keys(state.seen)) {   // a PR left the open list: mark its builds merged, or closed if it was closed unmerged
    const n = +k;
    if (open.has(n)) continue;
    await settleLeft(n);
    delete state.seen[n]; if (state.expDone) delete state.expDone[n]; state.queue = state.queue.filter(j => j.pr !== n); save();
  }
  // builds of PRs that left before the runner saw them go (closed by hand, or closed while it was down):
  // a few a poll, so the builds page shows only live work
  const stale = [...new Set(latestBuilds().filter(b => b.pr && !DONE.has(b.status) && !open.has(b.pr)).map(b => b.pr))];
  for (const n of stale.slice(0, 5)) await settleLeft(n);
}
const DONE = new Set(['merged', 'closed']);
async function settleLeft(n) {
  try {
    const pr = await gh(`pulls/${n}`);
    if (pr.data.state !== 'closed') return;
    const status = pr.data.merged ? 'merged' : 'closed';
    const marked = latestBuilds().filter(b => b.pr === n && !DONE.has(b.status));
    for (const b of marked) { b.status = status; b.waitingOn = null; appendBuild(b); log(`#${n} ${status}: ${b.id}`); }
    if (marked.length) await afterMerge(n, marked, status);
  } catch (e) { log(`#${n} left the open list, state unknown: ${e.message}`); }
}

// ---------- one build ----------
function checkFor(tree, page) {   // qa/runner/checks.json (trusted, next to this file) or check-NN.mjs by the page number
  let map = {};
  try { map = JSON.parse(fs.readFileSync(path.join(here, 'checks.json'), 'utf8')); } catch {}
  const c = map[page] || { script: `check-${page.slice(0, 2)}.mjs`, args: [] };
  if (!/^[\w.-]+\.mjs$/.test(c.script)) return null;
  const p = path.join(tree, 'qa', c.script);
  return fs.existsSync(p) ? { script: p, args: (c.args || []).map(String) } : null;
}
const reportPath = dir => path.relative(CFG.qaHome, path.join(dir, 'check.md'));   // e.g. qa/12-mass-gap/checks/2026-10-28-2051/check.md
function failCheck(dir, rows) {   // a check.md the builds log can read, for runs that never wrote one
  fs.mkdirSync(dir, { recursive: true });
  const clean = s => String(s).replace(/[|\n\r]/g, ' ').slice(0, 280);
  fs.writeFileSync(path.join(dir, 'check.md'), `# runner\n\n| gate | result | detail |\n|---|---|---|\n` + rows.map(([g, d]) => `| ${clean(g)} | ❌ | ${clean(d)} |`).join('\n') + '\n');
}
// the GPU readings taken before the build go with its result: gpu-gate.json and an ℹ️ row in check.md
function saveGate(dir, gate) {
  if (!gate) return;
  try {
    fs.writeFileSync(path.join(dir, 'gpu-gate.json'), JSON.stringify(gate, null, 1));
    const r = gate.readings && gate.readings.length ? gate.readings.slice(-gate.idleSecs).join(', ') + ' %' : 'no reading';
    fs.appendFileSync(path.join(dir, 'check.md'), `| GPU busy before the run | ℹ️ | ${r} (idle ≤ ${gate.idleMax} % for ${gate.idleSecs} s; waited ${gate.waitedS} s)${gate.note ? ' · ' + gate.note : ''} |\n`);
  } catch (e) { log(`could not save the GPU readings: ${e.message}`); }
}
const localStamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };

// fetch the PR head, main and the checks ref into the work clone
async function fetchRefs(pr) {
  if (!fs.existsSync(path.join(WORK, '.git'))) {
    await must('git', ['init', '-q', WORK]);
    await must('git', ['-C', WORK, 'remote', 'add', 'origin', `https://github.com/${CFG.repo}.git`]);
  }
  await must('git', ['-C', WORK, 'fetch', '-q', '--force', 'origin', `+refs/pull/${pr}/head:refs/runner/pr-${pr}`, `+refs/heads/${CFG.checksRef}:refs/runner/checks`, '+refs/heads/main:refs/runner/main'], { timeoutMs: 15 * 60e3 });
}
// A fetch that fails on the network (DNS, TLS, a dropped connection) is not a result: the job stays queued and is
// tried again later, instead of the commit being marked done (QA #57: a DNS blip at 14:17 lost round 8).
const NET_RE = /could not resolve|unable to access|failed to connect|connection (?:timed out|refused|reset)|temporary failure in name resolution|name or service not known|early eof|rpc failed|operation timed out|network is unreachable|gnutls|ssl|tls/i;
const RETRY_MAX = 6;
async function fetchOrRetry(job) {   // true: fetched; false: a network failure, job.retry set for work()
  try { await fetchRefs(job.pr); return true; }
  catch (e) {
    if (!NET_RE.test(e.message) || (job.tries || 0) >= RETRY_MAX) throw e;
    job.retry = e.message;
    log(`#${job.pr} @${job.sha.slice(0, 7)}: network failure while fetching, will retry (try ${(job.tries || 0) + 1} of ${RETRY_MAX}): ${e.message}`);
    return false;
  }
}
async function unpack(ref, what, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const tar = path.join(path.dirname(dir), `${path.basename(dir)}-${what.replace(/\W+/g, '_')}.tar`);
  await must('git', ['-C', WORK, 'archive', '-o', tar, ref, what]);
  await must('tar', ['-xf', tar, '-C', dir]);
}

// a qa-ready PR: run its experiment file with this runner's measuring code and the check scripts from CHECKS_REF
async function runExperiment(job, gate) {
  try { if (!(await fetchOrRetry(job))) return; } catch {}   // a non-network failure is recorded below, as before
  const short = job.sha.slice(0, 7), stamp = localStamp(), tmp = fs.mkdtempSync(path.join(CFG.state, 'exp-'));
  const rel = `qa/experiments/${job.pr}.json`;
  let id = null, result = 'failed', page = `pr-${job.pr}`, report = null;   // report: its check.md, relative to QA_HOME (status.sh)
  status.running = { ...job, started: new Date().toISOString() };
  const fail = async (why, detail, waiting = 'dev') => {
    const dir = path.join(CFG.qaHome, 'qa', page, 'runs', `${stamp}-pr${job.pr}`);
    failCheck(dir, [[why, detail]]); saveGate(dir, gate); report = reportPath(dir);
    if (!id) id = (await builds('start', '--page', page, '--pr', String(job.pr), '--commit', short)).trim().split('\n').pop();
    status.running = { ...(status.running || job), id, page };
    await builds('finish', '--id', id, '--check', dir, '--status', 'failed', '--waiting', waiting, '--note', why);
    result = `failed: ${why}`;
  };
  try {
    await fetchRefs(job.pr);
    const has = await run('git', ['-C', WORK, 'cat-file', '-e', `${job.sha}:${rel}`], { quiet: true });
    if (has.code !== 0) return await fail(`the PR carries ${rel}`, `not on @${short}; see qa/experiments/README.md`);
    const file = path.join(tmp, 'experiment.json');
    fs.writeFileSync(file, await must('git', ['-C', WORK, 'show', `${job.sha}:${rel}`]));
    const { errors, exp } = loadFile(file);
    if (exp && typeof exp.id === 'string' && /^\d\d-[a-z0-9-]+$/.test(exp.id)) page = exp.id;
    if (errors.length) return await fail(`${rel} is valid`, errors.join(' · '));
    id = (await builds('start', '--page', page, '--pr', String(job.pr), '--commit', short)).trim().split('\n').pop();
    status.running = { ...job, id, page, started: new Date().toISOString() };
    log(`build ${id}: #${job.pr} experiment ${page} @${short}, checks from ${CFG.checksRef}`);

    const tree = path.join(tmp, 'tree');
    await unpack('refs/runner/checks', 'qa', tree);
    await unpack(job.sha, 'experiments', tree);
    fs.mkdirSync(path.join(tree, 'qa', 'runner'), { recursive: true });
    for (const f of EXP_FILES) fs.copyFileSync(path.join(here, f), path.join(tree, 'qa', 'runner', f));
    const nm = path.join(CFG.qaHome, 'qa', 'node_modules');
    if (fs.existsSync(nm) && !fs.existsSync(path.join(tree, 'qa', 'node_modules'))) fs.symlinkSync(nm, path.join(tree, 'qa', 'node_modules'), 'dir');
    const args = ['--file', file, '--experiments', path.join(tree, 'experiments'), '--qa', path.join(tree, 'qa'), '--pr', String(job.pr), '--sha', job.sha,
      '--audio-dir', CFG.audioDir];
    if (exp.swipe && exp.swipe.vs) {
      const r = exp.swipe.vs === 'base'
        ? await run('git', ['-C', WORK, 'merge-base', 'refs/runner/main', job.sha], { quiet: true })
        : await run('git', ['-C', WORK, 'rev-parse', '--verify', '-q', `${exp.swipe.vs}^{commit}`], { quiet: true });
      const old = r.out.trim();
      if (r.code !== 0 || !/^[0-9a-f]{40}$/.test(old)) return await fail('swipe.vs names a commit the runner can fetch', `${exp.swipe.vs}: not in the PR's history or main`);
      await unpack(old, 'experiments', path.join(tmp, 'old'));
      args.push('--experiments-old', path.join(tmp, 'old', 'experiments'), '--vs', old.slice(0, 7));
    }
    const out = path.join(tree, 'qa', page, 'runs', `${stamp}-pr${job.pr}`);
    args.push('--out', out);
    await builds('set', '--id', id, '--status', 'running');
    const r = await run('node', [path.join(tree, 'qa', 'runner', 'exp-run.mjs'), ...args], { cwd: tree, timeoutMs: (exp.timeoutMin || CFG.timeoutMin) * 60e3 });
    const dest = path.join(CFG.qaHome, 'qa', page, 'runs', path.basename(out));
    if (!fs.existsSync(path.join(out, 'check.md'))) failCheck(out, [['the experiment ran to the end', `exit ${r.code}: ${(r.err || r.out).trim().split('\n').slice(-3).join(' / ')}`]]);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(out, dest, { recursive: true });
    fs.writeFileSync(path.join(dest, 'runner.log'), `commit ${job.sha}\nchecks ${CFG.checksRef}\nexit ${r.code}\n\n${r.err.slice(-50000)}`);
    saveGate(dest, gate);
    let swipe = null;
    try { swipe = JSON.parse(fs.readFileSync(path.join(out, 'results.json'), 'utf8')).swipe; } catch {}
    report = reportPath(dest);
    const fin = ['finish', '--id', id, '--check', dest];
    if (swipe && swipe.dir && !swipe.dir.includes('..')) {
      fs.cpSync(path.join(tree, 'qa', swipe.dir), path.join(CFG.qaHome, 'qa', swipe.dir), { recursive: true });
      fin.push('--swipe', swipe.url);
    }
    result = (await builds(...fin)).trim();
  } catch (e) {
    log(`experiment for #${job.pr} broke: ${e.message}`);
    try { await fail('the runner could prepare the experiment', e.message, 'qa-box'); } catch (e2) { log(`could not record the failure: ${e2.message}`); }
    result = `error: ${e.message}`;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    state.expDone = { ...(state.expDone || {}), [job.pr]: job.sha };
    state.recent = [{ ...status.running, finished: new Date().toISOString(), result, report }, ...(state.recent || [])].slice(0, 30);
    save();
    status.running = null;
    log(`experiment #${job.pr} @${short} done: ${result}`);
  }
}

async function runBuild(job, gate) {
  try { if (!(await fetchOrRetry(job))) return; } catch {}   // a non-network failure is recorded below, as before
  const short = job.sha.slice(0, 7), stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const id = (await builds('start', '--page', job.page, '--pr', String(job.pr), '--commit', short)).trim().split('\n').pop();
  status.running = { ...job, id, started: new Date().toISOString() };
  log(`build ${id}: #${job.pr} ${job.page} @${short}, checks from ${CFG.checksRef}`);
  const tmp = fs.mkdtempSync(path.join(CFG.state, 'build-'));
  let result = 'failed', report = null;
  try {
    await fetchRefs(job.pr);
    const tree = path.join(tmp, 'tree');
    fs.mkdirSync(tree);
    await must('git', ['-C', WORK, 'archive', '-o', path.join(tmp, 'checks.tar'), 'refs/runner/checks', 'qa']);
    await must('git', ['-C', WORK, 'archive', '-o', path.join(tmp, 'pages.tar'), job.sha, 'experiments']);
    await must('tar', ['-xf', path.join(tmp, 'checks.tar'), '-C', tree]);
    await must('tar', ['-xf', path.join(tmp, 'pages.tar'), '-C', tree]);
    const check = checkFor(tree, job.page);
    const fallback = path.join(CFG.qaHome, 'qa', job.page, 'checks', `${stamp}-runner`);
    if (!check) {
      failCheck(fallback, [[`a check script for ${job.page}`, `none on ${CFG.checksRef} (qa/check-${job.page.slice(0, 2)}.mjs or qa/runner/checks.json)`]]);
      await builds('finish', '--id', id, '--check', fallback, '--status', 'failed', '--waiting', 'qa-box', '--note', 'no check script yet');
      return;
    }
    const nm = path.join(CFG.qaHome, 'qa', 'node_modules');
    if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(tree, 'qa', 'node_modules'), 'dir');
    await builds('set', '--id', id, '--status', 'running');
    const r = await run('node', [check.script, '--experiments', path.join(tree, 'experiments'), ...check.args], { cwd: tree, timeoutMs: CFG.timeoutMin * 60e3 });
    // the check prints its result folder last; copy it into QA box's tree, where the viewer and builds.mjs look
    const last = r.out.trim().split('\n').pop() || '', src = path.resolve(tree, last.trim()), qaTree = path.join(tree, 'qa');
    let dest = fallback;
    if (src.startsWith(qaTree + path.sep) && fs.existsSync(path.join(src, 'check.md'))) {
      dest = path.join(CFG.qaHome, 'qa', path.relative(qaTree, src));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
      fs.writeFileSync(path.join(dest, 'runner.log'), `commit ${job.sha}\nchecks ${CFG.checksRef}\nexit ${r.code}\n\n${r.err.slice(-20000)}`);
    } else {
      failCheck(fallback, [['the check ran to the end and wrote check.md', `exit ${r.code}: ${(r.err || r.out).trim().split('\n').slice(-3).join(' / ')}`]]);
    }
    // the shared gates every page gets (#88), still inside this build's GPU lock; their rows join dest/check.md
    if (CFG.shared) {
      const t0 = Date.now();
      try { await runShared({ run, tree, page: job.page, dest, timeoutMs: CFG.sharedMin * 60e3, log }); }
      catch (e) { log(`shared gates for ${job.page} could not run: ${e.message}`); }
      log(`shared gates for ${job.page} took ${((Date.now() - t0) / 60e3).toFixed(1)} min`);
    }
    saveGate(dest, gate);
    report = reportPath(dest);
    const fin = await builds('finish', '--id', id, '--check', dest);
    result = fin.trim();
  } catch (e) {
    log(`build ${id} broke: ${e.message}`);
    const dir = path.join(CFG.qaHome, 'qa', job.page, 'checks', `${stamp}-runner`);
    report = reportPath(dir);
    try { failCheck(dir, [['the runner could prepare the build', e.message]]); await builds('finish', '--id', id, '--check', dir, '--status', 'failed', '--waiting', 'qa-box', '--note', 'runner error'); } catch (e2) { log(`could not record the failure: ${e2.message}`); }
    result = `error: ${e.message}`;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    state.recent = [{ ...status.running, finished: new Date().toISOString(), result, report }, ...(state.recent || [])].slice(0, 30);   // kept in state.json, so it survives restarts
    save();
    status.running = null;
    log(`build ${id} done: ${result}`);
  }
}

// ---------- after each build: history entry, report commit, board (QA box no longer types these) ----------
async function moveCards() {
  if (!CFG.board) return;
  try { await boardSync({ buildsFile: BUILDS_FILE, stateDir: CFG.state, log: s => log(`board: ${s}`) }); }
  catch (e) { log(`board: not synced: ${e.message}`); }
}
async function afterBuild(rec, gate, tr) {
  const b = rec.id && latestBuilds().find(x => x.id === rec.id);
  if (!b) { log(`after build: no build line for #${rec.pr}; no history, commit or board move`); return; }
  let paths = [];
  try { paths = historyEntry({ qaHome: CFG.qaHome, b, trace: tr || [], result: rec.result, gate, checksRef: CFG.checksRef }); }
  catch (e) { log(`history entry for ${b.id}: ${e.message}`); }
  // a ready build with a swipe waits on the user: put it on the grading page (qa/todo.json)
  try {
    const t = addTodo({ qaHome: CFG.qaHome, b, title: rec.title || '' });
    if (t.error) log(`todo for ${b.id} not added: ${t.error}`);
    if (t.changed) { paths.push('qa/todo.json'); log(`todo ${t.id} added for the user${t.superseded.length ? `; superseded ${t.superseded.join(', ')}` : ''}`); }
  } catch (e) { log(`todo for ${b.id}: ${e.message}`); }
  if (CFG.commit) {
    const r = await commitPaths(CFG.qaHome, [...paths, ...reportFiles(CFG.qaHome, buildDirs(b)), 'qa/builds.json'], messageFor(b));
    log(r.ok ? `reports of ${b.id} committed as ${r.sha} (not pushed)` : `reports of ${b.id} not committed: ${r.why}`);
  }
  await moveCards();
}
async function afterMerge(n, marked, status = 'merged') {
  if (CFG.commit) {
    const r = await commitPaths(CFG.qaHome, ['qa/builds.json'], `qa: #${n} ${status} (${marked.map(b => b.id).join(', ')})\n\nMade-by: QA runner\n`);
    log(r.ok ? `builds log for ${status} #${n} committed as ${r.sha}` : `builds log for ${status} #${n} not committed: ${r.why}`);
  }
  await moveCards();
}

// ---------- loops ----------
let stopping = false, working = false;
async function work() {
  if (working) return;
  working = true;
  try {
    while (!stopping && state.queue.length) {
      dropPageJobsOfLabelled();   // a label can land while a long build runs
      if (!state.queue.length) break;
      const job = state.queue[0];
      if (job.after && Date.now() < job.after) break;   // waiting to retry after a network failure
      // one GPU check at a time on the box, and only on an idle GPU; if it stays busy the job stays queued for the next poll.
      // GitHub is still polled while the gate waits (up to GPU_WAIT_MIN), so a PR whose head moves overnight gets its
      // queued jobs swapped to the new commit; the job at the gate then gives way to its replacement (#94, 28 Oct).
      const gone = () => superseded(state.queue, job);
      let polling = null;
      const pollTimer = setInterval(() => {
        if (polling) return;
        polling = poll().then(() => { status.lastError = null; }, e => { status.lastError = e.message; log(`poll: ${e.message}`); }).finally(() => { polling = null; });
      }, CFG.poll * 1000);
      let gate;
      try { gate = await gpuGate({ what: `runner #${job.pr} ${job.page}`, log, shouldStop: () => stopping || gone() }); }
      finally { clearInterval(pollTimer); if (polling) await polling; }
      status.gpu = gate;
      if (!stopping && gone()) {
        if (gate.ok) gpuUnlock();
        log(`#${job.pr} ${job.page} @${job.sha.slice(0, 7)} left the queue while waiting for the GPU (newer commit or label); next job`);
        continue;
      }
      if (!gate.ok) { log(`not starting #${job.pr} ${job.page}: ${gate.why}`); break; }
      trace = [];
      const before = (state.recent || [])[0];
      try { await (job.kind === 'experiment' ? runExperiment(job, gate) : runBuild(job, gate)); }
      catch (e) { log(`build for #${job.pr} ${job.page} could not start: ${e.message}`); status.running = null; }
      finally { gpuUnlock(); }
      const tr = trace; trace = null;
      if (job.retry) {   // a network failure: keep the job, try again in 2, 4, 8 … up to 10 minutes
        job.tries = (job.tries || 0) + 1; job.lastError = job.retry; delete job.retry;
        job.after = Date.now() + Math.min(10, 2 ** job.tries) * 60e3;
        save();
        break;
      }
      const rec = (state.recent || [])[0];
      if (rec && rec !== before) await afterBuild(rec, gate, tr);
      state.queue = state.queue.filter(j => j !== job && !(j.pr === job.pr && j.page === job.page && j.sha === job.sha));
      save();
    }
  } finally { working = false; }
}
async function tick() {
  try { await poll(); status.lastError = null; } catch (e) { status.lastError = e.message; log(`poll: ${e.message}`); }
  await work();
  if (CFG.once) { server && server.close(); return; }
  if (!stopping) setTimeout(tick, CFG.poll * 1000);
}

// ---------- read-only API ----------
let server = null;
if (!CFG.once) {
  server = http.createServer((req, res) => {
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(req.method === 'HEAD' ? '' : JSON.stringify(obj, null, 1)); };
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
    const u = new URL(req.url, 'http://runner');
    if (u.pathname === '/' || u.pathname === '/api') return send(200, { endpoints: ['/health', '/api/status', '/api/builds', '/api/builds/<id>', '/api/log?lines=200'], note: 'read only' });
    if (u.pathname === '/health') return send(200, { ok: true, running: !!status.running, queued: state.queue.length });
    if (u.pathname === '/api/status') return send(200, { repo: CFG.repo, checksRef: CFG.checksRef, authors: CFG.authors, label: CFG.label, gpuGate: GPU, pollSeconds: CFG.poll, pid: process.pid, ...status, queue: state.queue, recent: state.recent || [], watching: state.seen });
    if (u.pathname === '/api/builds') return send(200, latestBuilds().sort((a, b) => String(b.at).localeCompare(String(a.at))));
    const m = u.pathname.match(/^\/api\/builds\/([\w.-]+)$/);
    if (m) return send(200, buildLines().filter(b => b.id === m[1]));
    if (u.pathname === '/api/log') return send(200, { lines: tail(Math.max(1, Math.min(2000, +u.searchParams.get('lines') || 200))) });
    send(404, { error: 'not found' });
  });
  if (CFG.socket) {
    try { fs.unlinkSync(CFG.socket); } catch {}
    server.listen(CFG.socket, () => { fs.chmodSync(CFG.socket, 0o660); log(`API on unix:${CFG.socket}`); });
  } else {
    const i = CFG.listen.lastIndexOf(':'), host = CFG.listen.slice(0, i) || '127.0.0.1', port = +CFG.listen.slice(i + 1);
    server.listen(port, host, () => log(`API on http://${host}:${port}`));
  }
}
function stop(sig) {
  if (stopping) return;
  stopping = true;
  log(`${sig}: stopping`);
  if (child) try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  save();
  gpuUnlock();
  if (server) server.close();
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
// A crash exits with 70, not Node's default 1: the unit counts 1 as a clean stop (podman exec signalled on stop),
// so 70 keeps a real crash visible as Failed in systemctl status and journalctl.
const crash = e => { try { log(`crash: ${e && e.stack || e}`); save(); } catch {} process.exit(70); };
process.on('uncaughtException', crash);
process.on('unhandledRejection', crash);

// one runner at a time: if an older one is still alive (e.g. podman exec lost it on a restart), stop it first
const PID_FILE = path.join(CFG.state, 'runner.pid');
// --once never touches a running service: it refuses and exits (it was stopping the service's runner)
let older = 0;
try { older = +fs.readFileSync(PID_FILE, 'utf8'); if (older && older !== process.pid) process.kill(older, 0); else older = 0; } catch { older = 0; }
if (older && CFG.once) { console.error(`a runner (pid ${older}) is already running on ${CFG.state}; --once would race it. Use another --state for a dry run.`); process.exit(1); }
if (older) { log(`stopping the older runner ${older}`); try { process.kill(older, 'SIGTERM'); } catch {} await new Promise(r => setTimeout(r, 3000)); }
if (!CFG.once) fs.writeFileSync(PID_FILE, String(process.pid));
// The service's settings come from an env file on the host, which the container can't see. Keep a copy in the state
// folder, so qa/run-next.sh inside the container runs with the same QA_HOME, checks ref and GPU gate.
if (!CFG.once) {
  const vals = { RUNNER_REPO: CFG.repo, QA_HOME: CFG.qaHome, CHECKS_REF: CFG.checksRef, RUNNER_AUTHORS: CFG.authors.join(','), RUNNER_POLL: CFG.poll,
    RUNNER_TIMEOUT_MIN: CFG.timeoutMin, RUNNER_STATE: CFG.state, QA_AUDIO_DIR: CFG.audioDir, RUNNER_LABEL: CFG.label, RUNNER_COMMIT: CFG.commit ? 1 : 0, RUNNER_BOARD: CFG.board ? 1 : 0,
    GPU_BUSY_FILE: GPU.file, GPU_IDLE_MAX: GPU.idleMax, GPU_IDLE_SECS: GPU.idleSecs, GPU_WAIT_MIN: GPU.waitMin, GPU_LOCK: GPU.lock };
  const q = v => `'${String(v).replace(/'/g, `'\\''`)}'`;
  try { fs.writeFileSync(path.join(CFG.state, 'runner.env'), '# written by the runner service at start; qa/run-next.sh reads it\n' + Object.entries(vals).map(([k, v]) => `${k}=${q(v)}`).join('\n') + '\n'); }
  catch (e) { log(`could not write runner.env: ${e.message}`); }
}
if (!fs.existsSync(BUILDS_CLI)) log(`warning: ${BUILDS_CLI} not found; set QA_HOME to QA box's working copy`);
log(`runner up: ${CFG.repo}, checks from ${CFG.checksRef}, authors ${CFG.authors.join(',')}, label ${CFG.label}, every ${CFG.poll} s, state ${CFG.state}, GPU idle ≤ ${GPU.idleMax} % (${GPU.file})`);
{ const a = scanTracks(CFG.audioDir); log(`tracks (QA_AUDIO_DIR ${CFG.audioDir}): ${a.present.length}/4 present${a.missing.length ? `, missing ${a.missing.join(', ')} (their gates are skipped)` : ''}`); }
if (state.queue.length) log(`resuming ${state.queue.length} queued build(s)`);
tick();
