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
let state = { seen: {}, etag: null, queue: [] };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) }; } catch {}
const save = () => { const t = STATE_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(state, null, 1)); fs.renameSync(t, STATE_FILE); };
const status = { started: new Date().toISOString(), lastPoll: null, lastError: null, rate: null, running: null, recent: [] };

// ---------- processes (no shell; argument arrays only) ----------
let child = null;
function run(cmd, args, { cwd, timeoutMs = 10 * 60e3, quiet = false } = {}) {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!quiet) child = p;
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
  state.queue = state.queue.filter(j => !(j.pr === job.pr && j.page === job.page));   // a newer commit replaces a queued older one
  state.queue.push(job);
  log(`queued #${job.pr} ${job.page} @${job.sha.slice(0, 7)}`);
}
async function poll() {
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
    if (!/^[0-9a-f]{40}$/.test(sha || '') || state.seen[n] === sha) continue;
    const files = await gh(`pulls/${n}/files?per_page=100`);
    const pages = [...new Set(files.data.map(f => (f.filename.match(PAGE_RE) || [])[1]).filter(Boolean))];
    const done = latestBuilds().filter(b => b.pr === n && sha.startsWith(String(b.commit || 'x')));
    for (const page of pages) if (!done.some(b => b.page === page)) enqueue({ pr: n, sha, page, title: pr.title, at: new Date().toISOString() });
    state.seen[n] = sha;
    save();
  }
  for (const k of Object.keys(state.seen)) {   // a PR left the open list: if it was merged, mark its builds merged
    const n = +k;
    if (open.has(n)) continue;
    try {
      const pr = await gh(`pulls/${n}`);
      if (pr.data.merged) for (const b of latestBuilds().filter(b => b.pr === n && b.status !== 'merged')) { b.status = 'merged'; b.waitingOn = null; appendBuild(b); log(`#${n} merged: ${b.id}`); }
    } catch (e) { log(`#${n} closed, merge state unknown: ${e.message}`); }
    delete state.seen[n]; state.queue = state.queue.filter(j => j.pr !== n); save();
  }
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
function failCheck(dir, rows) {   // a check.md the builds log can read, for runs that never wrote one
  fs.mkdirSync(dir, { recursive: true });
  const clean = s => String(s).replace(/[|\n\r]/g, ' ').slice(0, 280);
  fs.writeFileSync(path.join(dir, 'check.md'), `# runner\n\n| gate | result | detail |\n|---|---|---|\n` + rows.map(([g, d]) => `| ${clean(g)} | ❌ | ${clean(d)} |`).join('\n') + '\n');
}
async function runBuild(job) {
  const short = job.sha.slice(0, 7), stamp = new Date().toISOString().slice(0, 16).replace('T', '-').replace(':', '');
  const id = (await builds('start', '--page', job.page, '--pr', String(job.pr), '--commit', short)).trim().split('\n').pop();
  status.running = { ...job, id, started: new Date().toISOString() };
  log(`build ${id}: #${job.pr} ${job.page} @${short}, checks from ${CFG.checksRef}`);
  const tmp = fs.mkdtempSync(path.join(CFG.state, 'build-'));
  let result = 'failed';
  try {
    if (!fs.existsSync(path.join(WORK, '.git'))) {
      await must('git', ['init', '-q', WORK]);
      await must('git', ['-C', WORK, 'remote', 'add', 'origin', `https://github.com/${CFG.repo}.git`]);
    }
    await must('git', ['-C', WORK, 'fetch', '-q', '--force', 'origin', `+refs/pull/${job.pr}/head:refs/runner/pr-${job.pr}`, `+refs/heads/${CFG.checksRef}:refs/runner/checks`], { timeoutMs: 15 * 60e3 });
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
    const fin = await builds('finish', '--id', id, '--check', dest);
    result = fin.trim();
  } catch (e) {
    log(`build ${id} broke: ${e.message}`);
    const dir = path.join(CFG.qaHome, 'qa', job.page, 'checks', `${stamp}-runner`);
    try { failCheck(dir, [['the runner could prepare the build', e.message]]); await builds('finish', '--id', id, '--check', dir, '--status', 'failed', '--waiting', 'qa-box', '--note', 'runner error'); } catch (e2) { log(`could not record the failure: ${e2.message}`); }
    result = `error: ${e.message}`;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
    status.recent.unshift({ ...status.running, finished: new Date().toISOString(), result });
    status.recent = status.recent.slice(0, 30);
    status.running = null;
    log(`build ${id} done: ${result}`);
  }
}

// ---------- loops ----------
let stopping = false, working = false;
async function work() {
  if (working) return;
  working = true;
  try {
    while (!stopping && state.queue.length) {
      const job = state.queue[0];
      try { await runBuild(job); } catch (e) { log(`build for #${job.pr} ${job.page} could not start: ${e.message}`); status.running = null; }
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
    if (u.pathname === '/api/status') return send(200, { repo: CFG.repo, checksRef: CFG.checksRef, authors: CFG.authors, pollSeconds: CFG.poll, ...status, queue: state.queue, watching: state.seen });
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
  if (server) server.close();
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

// one runner at a time: if an older one is still alive (e.g. podman exec lost it on a restart), stop it first
const PID_FILE = path.join(CFG.state, 'runner.pid');
try {
  const old = +fs.readFileSync(PID_FILE, 'utf8');
  if (old && old !== process.pid) { process.kill(old, 0); log(`stopping the older runner ${old}`); process.kill(old, 'SIGTERM'); await new Promise(r => setTimeout(r, 3000)); }
} catch {}
fs.writeFileSync(PID_FILE, String(process.pid));
if (!fs.existsSync(BUILDS_CLI)) log(`warning: ${BUILDS_CLI} not found; set QA_HOME to QA box's working copy`);
log(`runner up: ${CFG.repo}, checks from ${CFG.checksRef}, authors ${CFG.authors.join(',')}, every ${CFG.poll} s, state ${CFG.state}`);
if (state.queue.length) log(`resuming ${state.queue.length} queued build(s)`);
tick();
