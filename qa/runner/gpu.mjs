// GPU gate for the runner (QA box, 26 Oct: an outside process held the 780M at 99 % and halved every fps it measured;
// #144, 31 Oct: three "empty commit to rebuild, GPU was shared" in two days).
// Before a build: take the GPU lock (one GPU check at a time on the box, whoever starts it), then wait until
// gpu_busy_percent stays low AND no foreign process holds a render node (/dev/dri/renderD*) for a few seconds in a row.
// During the build: watch the render-node holders once a second; a foreign one makes the run invalid (the runner
// discards and requeues it). After the build: wait for the job's own processes (Chromium's GPU process and renderers)
// to let go of the render node before the lock is released, and kill leftovers after GPU_TAIL_SECS.
//   GPU_BUSY_FILE    default /sys/class/drm/card0/device/gpu_busy_percent (no file → no busy reading, noted)
//   GPU_IDLE_MAX     busy % that counts as idle (default 10)
//   GPU_IDLE_SECS    seconds of idle readings in a row (default 3)
//   GPU_SAMPLE_HZ    readings per second (default 4)
//   GPU_WAIT_MIN     stop waiting after this many minutes; the job stays queued, nothing is written (default 30)
//   GPU_LOCK         lock file shared by every runner on the box (default /tmp/cellular-viz-gpu.lock)
//   GPU_DRI, GPU_PROC  where the render nodes and processes are (default /dev/dri, /proc; tests point them at stubs)
//   GPU_HOLDER_ALLOW process names that may hold a render node at any time (the desktop's compositor), comma list
//   GPU_TAIL_SECS    seconds a finished job's processes get to let go of the render node before being killed (default 5)
import fs from 'node:fs';
import path from 'node:path';

const num = (k, d) => (Number.isFinite(+process.env[k]) && process.env[k] !== '' && process.env[k] !== undefined ? +process.env[k] : d);
export const GPU = {
  file: process.env.GPU_BUSY_FILE || '/sys/class/drm/card0/device/gpu_busy_percent',
  idleMax: num('GPU_IDLE_MAX', 10),
  idleSecs: Math.max(0.25, num('GPU_IDLE_SECS', 3)),
  hz: Math.max(1, num('GPU_SAMPLE_HZ', 4)),
  waitMin: Math.max(0, num('GPU_WAIT_MIN', 30)),
  lock: process.env.GPU_LOCK || '/tmp/cellular-viz-gpu.lock',
  dri: process.env.GPU_DRI || '/dev/dri',
  proc: process.env.GPU_PROC || '/proc',
  allow: (process.env.GPU_HOLDER_ALLOW ?? 'Xorg,Xwayland,gnome-shell,kwin_wayland,mutter,sway,weston').split(',').map(s => s.trim()).filter(Boolean),
  tailSecs: Math.max(0, num('GPU_TAIL_SECS', 5)),
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function readGpuBusy(file = GPU.file) {
  try { const v = parseFloat(fs.readFileSync(file, 'utf8')); return Number.isFinite(v) ? v : null; } catch { return null; }
}

// ---------- render-node holders ----------
export function renderNodes(dri = GPU.dri) {
  try { return fs.readdirSync(dri).filter(n => /^renderD\d+$/.test(n)).map(n => path.join(dri, n)); } catch { return []; }
}
function procInfo(pid, proc = GPU.proc) {
  const p = path.join(proc, String(pid));
  let comm = '?', ppid = 0, cmd = '';
  try { comm = fs.readFileSync(path.join(p, 'comm'), 'utf8').trim(); } catch {}
  try { const s = fs.readFileSync(path.join(p, 'stat'), 'utf8'); ppid = +s.slice(s.lastIndexOf(')') + 2).split(' ')[1] || 0; } catch {}
  try { cmd = fs.readFileSync(path.join(p, 'cmdline'), 'utf8').replace(/\0/g, ' ').trim().slice(0, 200); } catch {}
  return { pid, comm, ppid, cmd };
}
/** Processes with a render node open: [{pid, comm, ppid, cmd}] (reads /proc/<pid>/fd links; unreadable ones are skipped). */
export function renderHolders({ proc = GPU.proc, nodes = renderNodes() } = {}) {
  const want = new Set(nodes), out = [];
  if (!want.size) return out;
  let pids = [];
  try { pids = fs.readdirSync(proc).filter(n => /^\d+$/.test(n)); } catch { return out; }
  for (const p of pids) {
    let fds;
    try { fds = fs.readdirSync(path.join(proc, p, 'fd')); } catch { continue; }
    for (const fd of fds) {
      let t; try { t = fs.readlinkSync(path.join(proc, p, 'fd', fd)); } catch { continue; }
      if (want.has(t)) { out.push(procInfo(+p, proc)); break; }
    }
  }
  return out;
}
/** true if pid descends from root (the runner): its own builds and their Chromium, while they run. */
export function descendsFrom(pid, root = process.pid, proc = GPU.proc) {
  for (let i = 0, p = pid; i < 64 && p > 1; i++) { if (p === root) return true; p = procInfo(p, proc).ppid; }
  return pid === root;
}
/** Holders that are neither allowed (GPU_HOLDER_ALLOW) nor this runner's own processes. */
export function foreignHolders({ root = process.pid, proc = GPU.proc, holders = renderHolders({ proc }) } = {}) {
  return holders.filter(h => !GPU.allow.includes(h.comm) && !descendsFrom(h.pid, root, proc));
}
const name = hs => hs.map(h => `${h.pid} ${h.comm}`).join(', ');

const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
/** Try to take the lock once. true if this process holds it now. A lock left by a dead process is taken over. */
export function tryLock(what = '') {
  for (let i = 0; i < 2; i++) {
    try { const fd = fs.openSync(GPU.lock, 'wx'); fs.writeSync(fd, `${process.pid} ${new Date().toISOString()} ${what}\n`); fs.closeSync(fd); return true; } catch (e) { if (e.code !== 'EEXIST') throw e; }
    const pid = parseInt(fs.readFileSync(GPU.lock, 'utf8'), 10);
    if (pid === process.pid) return true;
    if (pid && alive(pid)) return false;
    try { fs.unlinkSync(GPU.lock); } catch {}
  }
  return false;
}
export function unlock() {
  try { if (parseInt(fs.readFileSync(GPU.lock, 'utf8'), 10) === process.pid) fs.unlinkSync(GPU.lock); } catch {}
}
export const lockHolder = () => { try { return fs.readFileSync(GPU.lock, 'utf8').trim(); } catch { return null; } };

/** Take the lock and wait for an idle GPU with no foreign render-node holder.
 *  → {ok, why?, waitedS, readings: [last 30], holders, idleMax, idleSecs, hz, file, at}
 *  On ok the caller holds the lock and must call unlock() when its build ends. A timeout is not a failure: the job stays
 *  queued ("waiting for GPU") and nothing is written. shouldStop() ends the wait early. onWait(state) sees each reading. */
export async function gpuGate({ what = '', log = () => {}, shouldStop = () => false, onWait = () => {} } = {}) {
  const t0 = Date.now(), deadline = t0 + GPU.waitMin * 60e3, readings = [];
  let holders = [];
  const out = extra => ({ waitedS: Math.round((Date.now() - t0) / 1000), readings: readings.slice(-30), holders: holders.map(h => ({ pid: h.pid, comm: h.comm })),
    idleMax: GPU.idleMax, idleSecs: GPU.idleSecs, hz: GPU.hz, file: GPU.file, at: new Date().toISOString(), ...extra });
  let said = 0;
  while (!tryLock(what)) {
    if (shouldStop()) return out({ ok: false, why: 'stopping' });
    if (Date.now() > deadline) return out({ ok: false, waiting: true, why: `waiting for GPU: lock held by ${lockHolder()} for ${GPU.waitMin} min` });
    onWait({ lock: lockHolder() });
    if (Date.now() - said > 60e3) { log(`GPU lock held by ${lockHolder()}; waiting`); said = Date.now(); }
    await sleep(2000);
  }
  const noBusy = readGpuBusy() === null, need = Math.ceil(GPU.idleSecs * GPU.hz);
  let calm = 0;
  said = 0;
  for (;;) {
    const b = readGpuBusy();
    holders = foreignHolders();
    readings.push(b);
    calm = (noBusy || (b !== null && b <= GPU.idleMax)) && !holders.length ? calm + 1 : 0;
    if (calm >= need) return out({ ok: true, ...(noBusy ? { note: `no reading from ${GPU.file}; ran without the busy check` } : {}) });
    onWait({ busy: b, holders });
    if (shouldStop()) { unlock(); return out({ ok: false, why: 'stopping' }); }
    if (Date.now() > deadline) { unlock(); return out({ ok: false, waiting: true, why: `waiting for GPU (busy ${readings.slice(-4).join(', ')} %${holders.length ? `, holder ${name(holders)}` : ''}) for ${GPU.waitMin} min; still queued, nothing measured` }); }
    if (Date.now() - said > 60e3) { log(`waiting for GPU: busy ${b} %${holders.length ? `, holder ${name(holders)}` : ''}`); said = Date.now(); }
    await sleep(1000 / GPU.hz);
  }
}

/** During a build: check the render-node holders every second; onForeign(holders) once when a foreign one shows up.
 *  → stop() */
export function watchForeign({ onForeign, everyMs = 1000, root = process.pid } = {}) {
  let fired = false;
  const t = setInterval(() => {
    if (fired) return;
    const f = foreignHolders({ root });
    if (f.length) { fired = true; try { onForeign(f); } catch {} }
  }, everyMs);
  return () => clearInterval(t);
}

/** After a build, before unlock(): wait until no process that wasn't holding a render node before the build (baseline:
 *  a Set of pids) still holds one. Chromium leftovers (cmdline with chrom / headless_shell) are killed after GPU_TAIL_SECS;
 *  anything else is only reported (the next gate waits for it). → {tailMs, killed: [names], left: [names]} */
export async function closeTail({ baseline = new Set(), tailSecs = GPU.tailSecs, kill = pid => process.kill(pid, 'SIGKILL'), log = () => {} } = {}) {
  const t0 = Date.now(), left = () => renderHolders().filter(h => !baseline.has(h.pid) && !GPU.allow.includes(h.comm));
  let rest = left();
  while (rest.length && Date.now() - t0 < tailSecs * 1000) { await sleep(100); rest = left(); }
  const killed = [];
  if (rest.length) {
    for (const h of rest) if (/chrom|headless_shell/i.test(h.cmd || h.comm)) { try { kill(h.pid); killed.push(`${h.pid} ${h.comm}`); } catch {} }
    for (let i = 0; i < 10 && left().length; i++) await sleep(100);
    rest = left();
    log(`GPU tail: killed ${killed.join(', ') || 'nothing'}${rest.length ? `; still holding the render node: ${name(rest)}` : ''}`);
  }
  return { tailMs: Date.now() - t0, killed, left: rest.map(h => `${h.pid} ${h.comm}`) };
}
