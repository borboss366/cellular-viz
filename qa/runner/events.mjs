// Build events for QA box's folder trigger (VIZ evangelist + QA box, 1 Nov): one small JSON file per event in
// QA_EVENTS_DIR (/home/puggie/pi-durable-worker/data/scratch/c14/qa-events on the box), so QA box hears about a build
// without polling. Unset QA_EVENTS_DIR = no events.
//   finished   a build (page, experiment or swipe-only) finished: its status, gates, report and swipe
//   discarded  a run was thrown away (GPU contended, #144) and requeued, or given up after 3
//   waiting    a job started waiting at the GPU gate (once per job, when it starts waiting)
//   error      a job could not start or the runner hit an error running it
//   test       qa/emit-test-event.sh, to check the trigger end to end
// Each file is written into <dir>.tmp/ (same filesystem, outside the watched folder) and renamed into <dir>, so the
// trigger never sees half a file. The folder keeps the newest 500 events and nothing older than 14 days.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const TYPES = ['finished', 'discarded', 'waiting', 'error', 'test'];
export const KEEP = 500, DAYS = 14;
const NAME_RE = /^\d{8}T\d{6}\d{3}Z-[a-z]+(?:-pr\d+)?-[0-9a-f]{6}\.json$/;

const stampOf = d => d.toISOString().replace(/[-:.]/g, '');   // 20261101T174700123Z: sorts by time
/** the file name of an event: <UTC stamp>-<type>[-pr<N>]-<6 hex>.json */
export function eventName(ev, now = new Date()) {
  return `${stampOf(now)}-${ev.type}${ev.pr ? `-pr${ev.pr}` : ''}-${crypto.randomBytes(3).toString('hex')}.json`;
}

/** write one event atomically into dir, then prune; returns the file path, or null when dir is empty */
export function emit(dir, ev, { now = new Date(), keep = KEEP, days = DAYS } = {}) {
  if (!dir) return null;
  if (!ev || !TYPES.includes(ev.type)) throw new Error(`unknown event type ${ev && ev.type}`);
  const target = path.resolve(dir), tmpDir = `${target.replace(/\/+$/, '')}.tmp`;
  fs.mkdirSync(target, { recursive: true }); fs.mkdirSync(tmpDir, { recursive: true });
  const name = eventName(ev, now), tmp = path.join(tmpDir, name), file = path.join(target, name);
  fs.writeFileSync(tmp, JSON.stringify({ ...ev, at: now.toISOString() }) + '\n');
  fs.renameSync(tmp, file);
  prune(target, { now, keep, days });
  return file;
}

/** keep the newest `keep` event files and none older than `days`; other files in the folder are left alone */
export function prune(dir, { now = new Date(), keep = KEEP, days = DAYS } = {}) {
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => NAME_RE.test(f)).sort(); } catch { return []; }
  const oldest = stampOf(new Date(now.getTime() - days * 86400e3)), gone = [];
  files.forEach((f, i) => { if (i < files.length - keep || f.slice(0, 19) < oldest.slice(0, 19)) gone.push(f); });
  for (const f of gone) { try { fs.rmSync(path.join(dir, f), { force: true }); } catch {} }
  return gone;
}

/** an event's fields from a build line of qa/builds.json (and the job) */
export function buildEvent(type, b, job = {}, extra = {}) {
  const gates = b && Array.isArray(b.gates) ? b.gates : [];
  return { type, pr: (b && b.pr) || job.pr || null, page: (b && b.page) || job.page || null, kind: job.kind || 'page',
    id: (b && b.id) || job.id || null, sha: job.sha ? String(job.sha).slice(0, 7) : (b && b.commit) || null,
    status: (b && b.status) || null, waitingOn: (b && b.waitingOn) || null,
    gates: gates.length ? `${gates.filter(g => g && g.ok).length}/${gates.length}` : null,
    report: (b && b.report) || null, swipe: (b && b.swipe) || null, ...extra };
}
