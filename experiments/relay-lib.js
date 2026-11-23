// The page side of the beat relay (docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md task 1, with VIZ research's notes 1-3), as
// plain functions with no WebSocket and no timers of their own, so node can test them. The relay itself is
// qa/beat-relay.mjs (in conduct-serve); the link a page opens (channel + socket) comes in task 2 and uses these.
//   RelayLib.backoffMs(attempt, rand)  -> the wait before reconnect attempt n (0, 1, 2, ...): BACKOFF_MIN_MS x 2^n,
//                                         capped at BACKOFF_MAX_MS, with jitter: a uniform pick in [cap / 2, cap]
//   RelayLib.offsetSample(t0, ts, t1)  -> { rtt, offset } from one time-ask (sent at local t0) answered with the relay's
//                                         ts and heard at local t1: offset = ts - (t0 + t1) / 2 (relay minus local, ms)
//   RelayLib.bestOffset(samples)       -> the sample with the smallest round trip, as Ableton Link does (the others
//                                         carry queueing delay); null without a valid sample
//   RelayLib.offsetTracker({ samples, every, timeout }) -> { ask(t), onTime(msg, t), estimate }: a round of `samples`
//                                         pings at connect and every `every` ms (OFFSET_SAMPLES, OFFSET_EVERY_MS); the
//                                         caller sends what ask(t) returns (one time-ask, or null) and feeds the
//                                         relay's { type: 'time' } answers to onTime. Asks unanswered for `timeout` ms
//                                         are dropped.
//   RelayLib.onceFilter(keep)          -> { first(msg) }: commands (COMMAND_TYPES: panic, slot, jump) that carry an id
//                                         are applied once: false for an id already seen (a resend after a
//                                         reconnect, or the same command by channel and socket); the last `keep` ids
//   RelayLib.seqGate()                 -> { fresh(msg) }: false for a relay message whose seq is not newer than the
//                                         last one of its type (an old late state after a resync); no seq: true
//   RelayLib.lateClockUsable(msg, now) -> false for a late clock (the relay's stored state) older than STALE_MS by
//                                         its own t: the page free-runs instead of jumping to it
//   RelayLib.idMaker(base)             -> () => 'base-1', 'base-2', ...: ids for the commands a page sends
// The clock's time base stays as the brief writes it (wall time, performance.timeOrigin + performance.now()); the
// offset is measured for the delay report and kept ready. Using it for the beat (VIZ research note 1) waits for the
// user's word, since the brief says wall time.
(function (root) {
  'use strict';
  const RELAY_VERSION = 1, RELAY_PATH = '/relay';
  const BACKOFF_MIN_MS = 250, BACKOFF_MAX_MS = 8000;
  const OFFSET_SAMPLES = 5, OFFSET_EVERY_MS = 30000, OFFSET_TIMEOUT_MS = 2000;
  const STALE_MS = 2000, ONCE_KEEP = 256;
  const COMMAND_TYPES = ['panic', 'slot', 'jump'];

  function backoffMs(attempt, rand) {
    const n = Math.max(0, Math.min(30, Math.floor(Number(attempt) || 0)));
    const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * Math.pow(2, n));
    const r = Math.min(1, Math.max(0, Number((rand || Math.random)()) || 0));
    return Math.round(cap / 2 + (cap / 2) * r);
  }

  function offsetSample(t0, ts, t1) {
    if (![t0, ts, t1].every(Number.isFinite) || t1 < t0) return null;
    return { rtt: t1 - t0, offset: ts - (t0 + t1) / 2 };
  }
  function bestOffset(samples) {
    const ok = (samples || []).filter(s => s && Number.isFinite(s.rtt) && Number.isFinite(s.offset));
    if (!ok.length) return null;
    const b = ok.reduce((a, s) => (s.rtt < a.rtt ? s : a));
    return { offset: b.offset, rtt: b.rtt, n: ok.length };
  }
  function offsetTracker(opts) {
    const o = opts || {};
    const samples = o.samples || OFFSET_SAMPLES, every = o.every || OFFSET_EVERY_MS, timeout = o.timeout || OFFSET_TIMEOUT_MS;
    const pending = new Map();
    let round = [], roundAt = -Infinity, nextId = 0;
    const tr = {
      estimate: null, rounds: 0,
      ask(t) {
        for (const [id, t0] of pending) if (t - t0 > timeout) pending.delete(id);
        const inRound = round.length > 0 || pending.size > 0;
        if (!inRound && tr.estimate && t - roundAt < every) return null;
        if (round.length + pending.size >= samples) return null;
        const id = ++nextId;
        pending.set(id, t);
        return { type: 'time-ask', v: RELAY_VERSION, id, t0: t };
      },
      onTime(msg, t1) {
        if (!msg || msg.type !== 'time' || !pending.has(msg.id)) return null;
        const s = offsetSample(pending.get(msg.id), msg.ts, t1);
        pending.delete(msg.id);
        if (s) round.push(s);
        if (round.length >= samples) {
          tr.estimate = bestOffset(round); tr.rounds++;
          round = []; roundAt = t1;
        }
        return tr.estimate;
      },
    };
    return tr;
  }

  function onceFilter(keep) {
    const max = keep || ONCE_KEEP, seen = new Set(), order = [];
    return {
      first(msg) {
        if (!msg || COMMAND_TYPES.indexOf(msg.type) < 0 || msg.id === undefined || msg.id === null) return true;
        const k = msg.type + ':' + msg.id;
        if (seen.has(k)) return false;
        seen.add(k); order.push(k);
        if (order.length > max) seen.delete(order.shift());
        return true;
      },
      get size() { return seen.size; },
    };
  }
  function seqGate() {
    const last = {};
    return {
      fresh(msg) {
        if (!msg || !Number.isFinite(msg.seq) || typeof msg.type !== 'string') return true;
        if (Number.isFinite(last[msg.type]) && msg.seq <= last[msg.type]) return false;
        last[msg.type] = msg.seq;
        return true;
      },
    };
  }
  function lateClockUsable(msg, now) {
    if (!msg || msg.type !== 'clock') return false;
    if (!msg.late) return true;
    return Number.isFinite(msg.t) && Number.isFinite(now) && now - msg.t <= STALE_MS;
  }
  function idMaker(base) {
    let n = 0;
    const b = String(base == null ? 'c' : base);
    return () => b + '-' + (++n);
  }

  const api = { RELAY_VERSION, RELAY_PATH, BACKOFF_MIN_MS, BACKOFF_MAX_MS, OFFSET_SAMPLES, OFFSET_EVERY_MS, OFFSET_TIMEOUT_MS,
    STALE_MS, ONCE_KEEP, COMMAND_TYPES, backoffMs, offsetSample, bestOffset, offsetTracker, onceFilter, seqGate, lateClockUsable, idMaker };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RelayLib = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
