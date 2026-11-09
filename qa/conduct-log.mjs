// The conductor page's session log (#188 Task 1 "Log", schema v1 as qa/conduct-score.mjs reads it). Pure and
// browser-safe: the page imports it from /qa/conduct-log.mjs; node tests check that what it writes parses with the
// scorer's parseLog. One JSON object per line, each with `type` and `ctx` (AudioContext seconds).
//
//   const log = new ConductLog({ id: sessionId(), now: () => ctx.currentTime, post: lines => fetch(...) });
//   log.add('track', { idx: 0, event: 'play', id: 'opus', posMs: 0 });   // ctx filled from now() unless given
//   setInterval(() => log.flush(), 1000);                                 // POSTs the new lines (qa/conduct-serve.mjs)
//   log.toJsonl()                                                         // the whole session, for the download
export const SCHEMA_V = 1;
export const TYPES = ['session', 'latency', 'track', 'pair', 'xfade', 'beat', 'sample', 'fix', 'jump', 'state', 'mark', 'key'];
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
