// The conductor page's session log (#188 Task 1 "Log", schema v1 as qa/conduct-score.mjs reads it). Pure and
// browser-safe: the page imports it from /qa/conduct-log.mjs; node tests check that what it writes parses with the
// scorer's parseLog. One JSON object per line, each with `type` and `ctx` (AudioContext seconds).
//
//   const log = new ConductLog({ id: sessionId(), now: () => ctx.currentTime, post: lines => fetch(...) });
//   log.add('track', { idx: 0, event: 'play', id: 'opus', posMs: 0 });   // ctx filled from now() unless given
//   setInterval(() => log.flush(), 1000);                                 // POSTs the new lines (qa/conduct-serve.mjs)
//   log.toJsonl()                                                         // the whole session, for the download
// v2 (the user 10 Nov 22:27): adds 'wheel' records (the phase-wheel hint when it changes) and sample.wheel { kind, ms }
// v3 (#239, hand-held mode): adds 'hold' and 'holdSuspect' (the clock's state when it changes, { on }) and 'holdPress'
// (a hold or auto-hold press { kind: 'hold' | 'autoHold', origin, on }): presses, never hand fixes
// v3 addition (#244): 'holdRecentre' { from, to, n } when the held tempo re-centred (trackerState.held.recentres grew)
// v3 addition (beat server brief, owner's call A, 23 Nov): 'offset' { loadId, page, slot, ms, rttMs, n, finding }, one per
// page load: a scene measured its wall-clock offset to the conductor through the relay (5 pings, the shortest round
// trip) and reported it; finding when |ms| > OFFSET_FINDING_MS. Report only: nothing applies the offset. page is the
// scene's file name and loadId a random id per load (R9: no names of people or tracks); offsetRecord() makes the record.
export const SCHEMA_V = 3;
export const TYPES = ['session', 'latency', 'track', 'pair', 'xfade', 'beat', 'sample', 'fix', 'jump', 'state', 'mark', 'key', 'wheel', 'hold', 'holdSuspect', 'holdPress', 'holdRecentre', 'offset'];
export const OFFSET_FINDING_MS = 5;
/** a page's offset report (the relay's { type: 'offset-report' }) -> the log record's fields, or null when it does not fit */
export function offsetRecord(m) {
  if (!m || typeof m !== 'object') return null;
  const id = typeof m.loadId === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(m.loadId) ? m.loadId : null;
  const page = typeof m.page === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(m.page) ? m.page : null;
  if (!id || !page || !Number.isFinite(m.ms) || !Number.isFinite(m.rttMs) || !(m.n >= 1)) return null;
  const slot = m.slot === 'A' || m.slot === 'B' ? m.slot : null;
  const ms = Math.round(m.ms * 100) / 100;
  return { loadId: id, page, slot, ms, rttMs: Math.round(m.rttMs * 100) / 100, n: Math.floor(m.n), finding: Math.abs(ms) > OFFSET_FINDING_MS };
}
export const PAIR_EVERY_S = 5, SAMPLE_EVERY_S = 0.1;
const pad = n => String(n).padStart(2, '0');

/** conductor-YYYYMMDD-HHMMSS (local time): the session id and the log's file name */
export const sessionId = (d = new Date()) => `conductor-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
export const SESSION_ID_RE = /^conductor-\d{8}-\d{6}(-[a-z0-9]{1,8})?$/;

export class ConductLog {
  constructor({ id = sessionId(), now = () => 0, post = null, input = 'line:page', startedAt = new Date().toISOString() } = {}) {
    if (!SESSION_ID_RE.test(id)) throw new Error(`session id ${id}`);
    Object.assign(this, { id, now, post, all: [], pending: [], failed: 0 });
    this.add('session', { v: SCHEMA_V, id, startedAt, input });
  }
  /** one record; ctx is now() unless the fields carry it (a beat booked ahead, a fix landing later) */
  add(type, fields = {}) {
    if (!TYPES.includes(type)) throw new Error(`log type ${type}`);
    const r = { type, ctx: typeof fields.ctx === 'number' ? fields.ctx : this.now(), ...fields };
    r.ctx = Math.round(r.ctx * 1e6) / 1e6;
    this.all.push(r);
    this.pending.push(r);
    return r;
  }
  /** POST the lines not sent yet; on failure they stay pending and go with the next flush */
  async flush() {
    if (!this.post || !this.pending.length) return 0;
    const batch = this.pending.splice(0);
    try { await this.post(batch.map(r => JSON.stringify(r)).join('\n') + '\n'); return batch.length; }
    catch { this.pending.unshift(...batch); this.failed++; return 0; }
  }
  toJsonl() { return this.all.map(r => JSON.stringify(r)).join('\n') + '\n'; }
}
