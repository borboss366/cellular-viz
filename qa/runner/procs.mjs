// Who holds the GPU, and leftover browsers (QA box, 28 Oct: gpu_busy_percent stuck at 99 % with no build running
// after #94's 13-flow-lab build; most likely a headless Chromium that outlived its check).
// Linux /proc only, no tools: works inside the worker container without ps. Read only, except killOrphans().
import fs from 'node:fs';

const HZ = 100;   // USER_HZ, the unit of /proc/<pid>/stat starttime on Linux
export const DRI_RE = /^\/dev\/dri\/(renderD\d+|card\d+)$/;

const read = f => { try { return fs.readFileSync(f, 'utf8'); } catch { return null; } };
function pids() { try { return fs.readdirSync('/proc').filter(d => /^\d+$/.test(d)).map(Number); } catch { return []; } }
function uptime() { const u = read('/proc/uptime'); return u ? parseFloat(u) : null; }
/** one process: {pid, ppid, pgid, startS, comm, cmd, uid} or null when it is gone or unreadable */
export function proc(pid) {
  const s = read(`/proc/${pid}/stat`);
  if (!s) return null;
  const close = s.lastIndexOf(')'), f = s.slice(close + 2).split(' ');   // f[0] = field 3 (state), so field n is f[n - 3]
  const comm = s.slice(s.indexOf('(') + 1, close);
  const cmd = (read(`/proc/${pid}/cmdline`) || '').replace(/\0+$/, '').replace(/\0/g, ' ');
  const uidLine = (read(`/proc/${pid}/status`) || '').match(/^Uid:\s+(\d+)/m);
  return { pid, ppid: +f[1], pgid: +f[2], startS: +f[19] / HZ, comm, cmd, uid: uidLine ? +uidLine[1] : null };
}
const ageOf = (p, up = uptime()) => (up === null ? null : Math.max(0, Math.round(up - p.startS)));
export const fmtAge = s => (s === null ? '?' : s < 120 ? `${s}s` : s < 7200 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`);

/** processes in this PID namespace with a /dev/dri node open (default: any render or card node). → [{pid, ageS, cmd, dev}] */
export function gpuHolders(re = DRI_RE) {
  const out = [], up = uptime();
  for (const pid of pids()) {
    let fds;
    try { fds = fs.readdirSync(`/proc/${pid}/fd`); } catch { continue; }
    let dev = null;
    for (const fd of fds) {
      let l; try { l = fs.readlinkSync(`/proc/${pid}/fd/${fd}`); } catch { continue; }
      if (re.test(l)) { dev = l; break; }
    }
    if (!dev) continue;
    const p = proc(pid);
    if (p) out.push({ pid, ageS: ageOf(p, up), cmd: (p.cmd || p.comm).slice(0, 80), dev });
  }
  return out;
}
export const fmtHolders = h => (h.length ? h.map(x => `${x.pid} (${fmtAge(x.ageS)}) ${x.cmd}`).join('; ') : 'none in the container');

// A leftover is a browser or a check script whose parent is gone (re-parented to the container's PID 1, or 0 from
// outside the namespace): nothing will ever stop it. Live builds always have a live parent, so they never match.
const BROWSER_RE = /chrome|chromium|headless_shell/i, CHECK_RE = /\/qa\/(check-[\w.-]+|runner\/exp-run)\.mjs/;
export function orphans({ uid = process.getuid ? process.getuid() : null, self = process.pid, match = () => true } = {}) {
  const all = pids().map(proc).filter(Boolean), alive = new Set(all.map(p => p.pid));
  return all.filter(p => p.pid !== self && (uid === null || p.uid === uid) && match(p)
    && (BROWSER_RE.test(p.comm) || BROWSER_RE.test(p.cmd.split(' ')[0] || '') || CHECK_RE.test(p.cmd))
    && (p.ppid <= 1 || !alive.has(p.ppid)));
}
/** SIGKILL every leftover and its process group. → the ones killed (also logged) */
export function killOrphans(log = () => {}, opts) {
  const list = orphans(opts), me = proc(process.pid), mine = me ? me.pgid : process.pid;
  for (const p of list) {
    // its whole group only when it leads one (a detached check or browser), and never our own group
    if (p.pgid === p.pid && p.pgid !== mine) { try { process.kill(-p.pgid, 'SIGKILL'); } catch {} }
    try { process.kill(p.pid, 'SIGKILL'); } catch {}
  }
  if (list.length) log(`killed ${list.length} leftover process${list.length > 1 ? 'es' : ''} whose parent was gone: ${list.map(p => `${p.pid} ${(p.cmd || p.comm).slice(0, 60)}`).join('; ')}`);
  return list;
}
