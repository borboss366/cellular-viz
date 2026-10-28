// Short plain-text status of the QA runner and viewer, for qa/status.sh. Read only: it asks the runner's API and the
// viewer over their Unix sockets, reads the runner log and the GPU busy file, and changes nothing.
//   node qa/status.mjs
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { gpuHolders, orphans, fmtAge } from './runner/procs.mjs';

const DATA = '/home/puggie/pi-durable-worker/data';
const env = (k, d) => process.env[k] || d;
const RUNNER_SOCK = env('RUNNER_SOCKET', `${DATA}/qa-runner.sock`);
const VIEWER_SOCK = env('VIEWER_SOCKET', `${DATA}/qa-viewer.sock`);
const STATE = env('RUNNER_STATE', path.join(os.homedir(), '.cache', 'cellular-viz-runner'));
const GPU_FILE = env('GPU_BUSY_FILE', '/sys/class/drm/card0/device/gpu_busy_percent');
const LOG_LINES = 10;

function get(socketPath, p) {
  return new Promise(resolve => {
    const req = http.get({ socketPath, path: p, timeout: 4000 }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { if (body.length < 1 << 20) body += c; });
      res.on('end', () => resolve({ code: res.statusCode, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', e => resolve({ code: null, error: e.code || e.message }));
  });
}
const json = r => { try { return JSON.parse(r.body); } catch { return null; } };
const ago = t => {
  if (!t) return '-';
  const s = Math.round((Date.now() - Date.parse(t)) / 1000);
  return s < 120 ? `${s}s ago` : s < 7200 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};
const job = j => `#${j.pr} ${j.kind === 'experiment' ? 'experiment' : (j.page || '?')} @${String(j.sha || '').slice(0, 7)}`;
const short = (s, n = 100) => { s = String(s ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

const out = [];
// runner
const health = await get(RUNNER_SOCK, '/health');
if (health.code === null) out.push(`runner: no answer on ${RUNNER_SOCK} (${health.error})`);
else {
  const h = json(health) || {};
  out.push(`runner /health ${health.code}: ok=${h.ok} running=${h.running} queued=${h.queued}`);
  const st = await get(RUNNER_SOCK, '/api/status');
  const s = json(st);
  if (!s) out.push(`runner /api/status ${st.code}: unreadable`);
  else {
    out.push(`runner /api/status ${st.code}: pid ${s.pid}, up since ${ago(s.started)}, last poll ${ago(s.lastPoll)}${s.lastError ? `, last error: ${short(s.lastError, 80)}` : ''}`);
    if (s.rate) out.push(`  GitHub rate: ${s.rate.remaining} left, resets ${s.rate.reset}`);
    out.push(`  now: ${s.running ? `${job(s.running)}${s.running.id ? ` (${s.running.id})` : ''}, started ${ago(s.running.started)}` : 'idle'}`);
    const q = s.queue || [];
    out.push(`  queue (${q.length}): ${q.length ? q.slice(0, 6).map(job).join(', ') + (q.length > 6 ? ', …' : '') : '-'}`);
    for (const r of (s.recent || []).slice(0, 3)) out.push(`  done ${ago(r.finished)}: ${job(r)}: ${short(r.result, 90)}`);
    if (s.gpu) out.push(`  last GPU gate: ${short(JSON.stringify(s.gpu), 100)}`);
  }
}
// log
const logFile = path.join(STATE, 'runner.log');
try {
  const lines = fs.readFileSync(logFile, 'utf8').split('\n').filter(l => l.trim());
  out.push(`log ${logFile} (last ${Math.min(LOG_LINES, lines.length)}):`);
  for (const l of lines.slice(-LOG_LINES)) out.push(`  ${short(l, 160)}`);
} catch (e) { out.push(`log ${logFile}: ${e.code || e.message}`); }
// viewer
const codes = [];
for (const p of ['/', '/builds']) { const r = await get(VIEWER_SOCK, p); codes.push(`${p} ${r.code ?? r.error}`); }
out.push(`viewer (${VIEWER_SOCK}): ${codes.join(', ')}`);
// GPU
try { out.push(`gpu_busy_percent: ${fs.readFileSync(GPU_FILE, 'utf8').trim()}`); }
catch (e) { out.push(`gpu_busy_percent: ${e.code || e.message} (${GPU_FILE})`); }
// who has the GPU open (pid, age, command); none here while it is busy means a process outside the container
try {
  const h = gpuHolders();
  if (!h.length) out.push('GPU holders (/dev/dri): none in the container');
  else { out.push(`GPU holders (/dev/dri): ${h.length}`); for (const x of h.slice(0, 8)) out.push(`  ${x.pid} ${fmtAge(x.ageS)} ${x.dev.replace('/dev/dri/', '')} ${x.cmd}`); }
  const o = orphans();
  out.push(`leftover browsers/checks (parent gone): ${o.length ? o.map(p => `${p.pid} ${(p.cmd || p.comm).slice(0, 50)}`).slice(0, 5).join('; ') : 'none'}`);
} catch (e) { out.push(`GPU holders: ${e.message}`); }

console.log(out.join('\n'));
