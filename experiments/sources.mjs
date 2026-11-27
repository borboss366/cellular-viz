// The conductor's beat sources (docs/CELLULAR_VIZ_BRIEF_BEAT_SOURCES.md task 3, first half): every source side by side,
// the user's pick, and what goes into the session log. Pure: the page feeds it and draws it (clock-conductor.html);
// node tests it (qa/runner/test/sources.test.mjs). It decides nothing about the clock yet: steering the clock from the
// picked source (clock.js source 'ext') is the next step; until then the pick is shown and logged only.
//
// Sources: beatd's { type: 'source', v: 1, id, t, beats, bpm, confidence, state } through the relay (t wall ms), and
// ours (the conductor's own tracker, the shadow), always the first row with the id 'ours'.
//   board.ingest(msg, nowWall)              -> true when kept (a well-formed source message)
//   board.view(nowWall, { clockBeats, clockBpm, ours })   -> rows [{ id, picked, pending, state, bpm, conf, phase,
//                                              lamp, deltaMs, ageMs }]: deltaMs = how far the source's beat is from the
//                                              playing clock's (+ = the source is later), the phase difference in ms
//   board.step(dir) / board.pick(id)        -> the pending pick (lands on the next bar line: board.land())
//   board.land()                            -> { from, to } when a pending pick took effect, else null
//   board.lostNow(nowWall)                  -> ids that just fell silent (LOST_MS without a message): log them once
//   board.logRecord(id, nowWall)            -> the 'source' log record's fields when it is due (every LOG_MS per source,
//                                              and at once on a state change), else null
export const OURS = 'ours', LOST_MS = 2000, LOG_MS = 250, LAMP_PHASE = 0.2;
const STATES = ['waiting', 'locked', 'free-run', 'lost'];
const num = x => typeof x === 'number' && Number.isFinite(x);
const wrapHalf = x => { let y = x - Math.round(x); if (y <= -0.5) y += 1; return y; };
const frac = x => x - Math.floor(x);

/** a well-formed beatd message, else null (the relay checks the version only) */
export function readSource(m) {
  if (!m || m.type !== 'source' || m.v !== 1) return null;
  if (typeof m.id !== 'string' || !/^[A-Za-z0-9-]{1,16}$/.test(m.id) || m.id === OURS) return null;
  if (![m.t, m.beats, m.bpm, m.confidence].every(num) || m.bpm <= 0 || !STATES.includes(m.state)) return null;
  return { id: m.id, t: m.t, beats: m.beats, bpm: m.bpm, conf: m.confidence, state: m.state };
}

export function createBoard({ lostMs = LOST_MS, logMs = LOG_MS } = {}) {
  const rows = new Map();   // id -> { last: readSource(), at: wall ms received, n, lost, loggedAt, loggedState }
  let picked = OURS, pending = null;
  const ids = () => [OURS, ...rows.keys()];
  const board = {
    get picked() { return picked; },
    get pending() { return pending; },
    get ids() { return ids(); },
    ingest(m, nowWall) {
      const s = readSource(m);
      if (!s) return false;
      const r = rows.get(s.id) || { n: 0, loggedAt: -Infinity, loggedState: null };
      Object.assign(r, { last: s, at: nowWall, lost: false });
      r.n++;
      rows.set(s.id, r);
      return true;
    },
    /** the source's beat count at wall time T (beats since it started, extrapolated at its own tempo) */
    beatsAt(id, T) {
      const r = rows.get(id);
      return r ? r.last.beats + (T - r.last.t) * r.last.bpm / 60000 : null;
    },
    view(nowWall, { clockBeats = null, clockBpm = null, ours = null } = {}) {
      const out = [], hasClock = num(clockBeats) && clockBeats >= 0 && num(clockBpm) && clockBpm > 0;
      const row = (id, beats, bpm, conf, state, ageMs) => {
        const ok = num(beats) && state !== 'lost';
        const phase = ok ? frac(beats) : null;
        out.push({ id, picked: id === picked, pending: id === pending, state, bpm: num(bpm) ? Math.round(bpm * 10) / 10 : null,
          conf: num(conf) ? Math.round(conf * 100) / 100 : null, phase, lamp: ok && phase < LAMP_PHASE,
          deltaMs: ok && hasClock ? Math.round(wrapHalf(beats - clockBeats) * 60000 / clockBpm) : null, ageMs });
      };
      if (ours) row(OURS, ours.beats, ours.bpm, ours.conf, ours.state || 'waiting', 0);
      else row(OURS, null, null, null, 'waiting', null);
      for (const [id, r] of rows) {
        const age = nowWall - r.at, lost = age > lostMs;
        row(id, lost ? null : board.beatsAt(id, nowWall), r.last.bpm, r.last.conf, lost ? 'lost' : r.last.state, Math.round(age));
      }
      return out;
    },
    step(dir) {
      const list = ids(), from = list.indexOf(pending || picked);
      const next = list[((from < 0 ? 0 : from) + (dir < 0 ? -1 : 1) + list.length) % list.length];
      pending = next === picked ? null : next;
      return pending;
    },
    pick(id) {
      if (!ids().includes(id)) return null;
      pending = id === picked ? null : id;
      return pending;
    },
    land() {
      if (!pending) return null;
      const out = { from: picked, to: pending };
      picked = pending; pending = null;
      return out;
    },
    lostNow(nowWall) {
      const out = [];
      for (const [id, r] of rows) if (!r.lost && nowWall - r.at > lostMs) { r.lost = true; out.push(id); }
      return out;
    },
    logRecord(id, nowWall) {
      const r = rows.get(id);
      if (!r) return null;
      const state = r.lost ? 'lost' : r.last.state;
      if (state === r.loggedState && nowWall - r.loggedAt < logMs) return null;
      r.loggedAt = nowWall; r.loggedState = state;
      const s = r.last;
      return { id, t: s.t, beats: s.beats, bpm: s.bpm, conf: s.conf, state };
    },
    get count() { return rows.size; },
  };
  return board;
}

/** the panel's rows as plain text cells (ASCII, #205): '*' picked, '>' pending, the lamp as '#' */
export function rowText(r) {
  const d = r.deltaMs === null ? '-' : `${r.deltaMs > 0 ? '+' : ''}${r.deltaMs} ms`;
  return { mark: r.picked ? '*' : r.pending ? '>' : '', id: r.id, lamp: r.lamp ? '#' : '', bpm: r.bpm === null ? '-' : r.bpm.toFixed(1),
    conf: r.conf === null ? '-' : r.conf.toFixed(2), delta: d, state: r.state };
}
