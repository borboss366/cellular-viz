// GPU gate for the runner (QA box, 26 Oct: an outside process held the 780M at 99 % and halved every fps it measured).
// Before a build: take the GPU lock (one GPU check at a time on the box, whoever starts it), then wait until
// gpu_busy_percent stays low for a few seconds in a row. The readings are saved with the result.
//   GPU_BUSY_FILE   default /sys/class/drm/card0/device/gpu_busy_percent (no file → no reading, the run goes ahead, noted)
//   GPU_IDLE_MAX    busy % that counts as idle (default 10)
//   GPU_IDLE_SECS   idle readings in a row, one a second (default 5)
//   GPU_WAIT_MIN    give up after this many minutes; the build fails as "GPU busy", nothing is measured (default 30)
//   GPU_LOCK        lock file shared by every runner on the box (default /tmp/cellular-viz-gpu.lock)
import fs from 'node:fs';
import { gpuHolders, fmtHolders } from './procs.mjs';

const num = (k, d) => (Number.isFinite(+process.env[k]) && process.env[k] !== '' && process.env[k] !== undefined ? +process.env[k] : d);
export const GPU = {
  file: process.env.GPU_BUSY_FILE || '/sys/class/drm/card0/device/gpu_busy_percent',
  idleMax: num('GPU_IDLE_MAX', 10),
  idleSecs: Math.max(1, num('GPU_IDLE_SECS', 5)),
  waitMin: Math.max(0, num('GPU_WAIT_MIN', 30)),
  lock: process.env.GPU_LOCK || '/tmp/cellular-viz-gpu.lock',
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function readGpuBusy(file = GPU.file) {
  try { const v = parseFloat(fs.readFileSync(file, 'utf8')); return Number.isFinite(v) ? v : null; } catch { return null; }
}

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

/** Take the lock and wait for an idle GPU. → {ok, why?, waitedS, readings: [last 30], idleMax, file, at}
 *  On ok the caller holds the lock and must call unlock() when its build ends. shouldStop() ends the wait early. */
export async function gpuGate({ what = '', log = () => {}, shouldStop = () => false, sweep = () => {} } = {}) {
  const t0 = Date.now(), deadline = t0 + GPU.waitMin * 60e3, readings = [];
  const out = extra => ({ waitedS: Math.round((Date.now() - t0) / 1000), readings: readings.slice(-30), idleMax: GPU.idleMax, idleSecs: GPU.idleSecs, file: GPU.file, at: new Date().toISOString(), ...extra });
  let said = 0;
  while (!tryLock(what)) {
    if (shouldStop()) return out({ ok: false, why: 'stopping' });
    if (Date.now() > deadline) return out({ ok: false, why: `GPU lock held by ${lockHolder()} for ${GPU.waitMin} min` });
    if (Date.now() - said > 60e3) { log(`GPU lock held by ${lockHolder()}; waiting`); said = Date.now(); }
    await sleep(2000);
  }
  if (readGpuBusy() === null) return out({ ok: true, note: `no reading from ${GPU.file}; ran without the idle check` });
  let calm = 0, named = false;
  said = 0;
  const busySince = Date.now();
  for (;;) {
    const b = readGpuBusy();
    readings.push(b);
    calm = b !== null && b <= GPU.idleMax ? calm + 1 : 0;
    if (calm >= GPU.idleSecs) return out({ ok: true });
    if (shouldStop()) { unlock(); return out({ ok: false, why: 'stopping' }); }
    if (Date.now() > deadline) { unlock(); return out({ ok: false, why: `GPU busy (${readings.slice(-5).join(', ')} %) for ${GPU.waitMin} min; nothing measured` }); }
    if (Date.now() - said > 60e3) {
      log(`GPU busy ${b} % (> ${GPU.idleMax}); waiting before measuring`); said = Date.now();
      try { sweep(); } catch {}   // the runner kills leftover browsers here (their parent is gone)
    }
    if (!named && Date.now() - busySince > 10 * 60e3) {   // after 10 min, say who holds it
      named = true;
      let h = 'unknown'; try { h = fmtHolders(gpuHolders()); } catch {}
      log(`GPU busy for 10 min; /dev/dri holders: ${h}`);
    }
    await sleep(1000);
  }
}
