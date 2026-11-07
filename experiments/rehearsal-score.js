// rehearsal-score.js: the scoring of the DJ rehearsal page (#188), pure and node-tested
// (qa/runner/test/rehearsal-score.test.mjs), also used on the box to replay a session log.
//
//   const S = RehearsalScore;                                  // or require('./rehearsal-score.js') in node
//   S.refTimes(gridBeats, { startCtx, offsetS, shiftMs })      → reference beats on the ctx timeline [{ t, pos }] (§4.1)
//   S.classifyTrack({ refs, clock, shadow, unscored, startAt, endAt, stateAt, hasGrid })
//                                                              → one record per reference beat (§4.2), shadow included
//   S.summarizeTrack(beats, fixes, { gate, which })            → { episodes, fixResults, summary } (§4.3–4.5)
//   S.alignLag(env, envRate, refMs, { maxMs, stepMs })         → the grid alignment lag in ms (lossy files, §4.1)
//   S.makeLog(session) / S.parseLog(text) / S.replay(text)      → JSONL schema v1 (§5); replay re-scores from beat, fix
//                                                                and transport records and returns every trackSummary
//
// Times are AudioContext seconds (ctx) unless the name says ms. Output latency cancels (clicks and music leave through
// the same output), so nothing here adds latency() or the visual offset (§2).
(function (root) {
  'use strict';
  const W_MS = 35, W70_MS = 70;
  const GATE = { afterLock: 90, lockS: 30, wrongBeats: 16 };
  const SCORED = ['lost', 'double', 'half', 'ratio', 'offbeat', 'loose', 'good'];
  const UNSCORED = ['nogrid', 'xfade', 'paused', 'outside'];
  const LOCK_RUN = 8, END_RUN = 4, CURE_BEATS = 8, WORSE_BEFORE = 4, WORSE_AFTER = 4;
  const isScored = c => SCORED.includes(c);
  const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const r1 = x => (x === null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
  const r3 = x => (x === null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
  const r6 = x => (x === null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6);
  const wrapHalf = x => { let y = x - Math.round(x); if (y <= -0.5) y += 1; return y; };   // (−½, ½]

  // ---------- §4.1 timelines ----------
  /** grid beats [{ms, pos}] of the file → reference beats on the ctx timeline: r_k = startCtx + (ms/1000 + shift − offset) */
  function refTimes(gridBeats, { startCtx = 0, offsetS = 0, shiftMs = 0 } = {}) {
    return gridBeats.map(b => ({ t: startCtx + (b.ms + shiftMs) / 1000 - offsetS, pos: b.pos, ms: b.ms }));
  }

  /**
   * grid alignment (lossy files): cross-correlate an onset envelope (env[i] at i / envRate s of the file) with impulses
   * at the grid beats over ±maxMs in stepMs steps; the lag (ms, + = the audio is later than the grid) that maximises it
   */
  function alignLag(env, envRate, refMs, { maxMs = 60, stepMs = 1 } = {}) {
    let best = -Infinity, lag = 0;
    for (let L = -maxMs; L <= maxMs + 1e-9; L += stepMs) {
      let s = 0;
      for (const ms of refMs) {
        const x = (ms + L) / 1000 * envRate, i = Math.floor(x), f = x - i;
        if (i >= 0 && i + 1 < env.length) s += env[i] * (1 - f) + env[i + 1] * f;
      }
      if (s > best + 1e-12) { best = s; lag = L; }
    }
    return Math.round(lag);
  }
  /** the shift applied to a grid: lossy files with |lag| ≥ 5 ms move by the lag; FLAC and WAV never move */
  const gridShift = (lagMs, lossy) => (lossy && Math.abs(lagMs) >= 5 ? lagMs : 0);

  // ---------- §4.2 classification ----------
  function nearest(times, t) {   // index of the time nearest t in a sorted array
    let lo = 0, hi = times.length - 1;
    if (hi < 0) return -1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= t) lo = m; else hi = m; }
    return Math.abs(times[lo] - t) <= Math.abs(times[hi] - t) ? lo : hi;
  }
  /**
   * one clock list against one reference beat. clk: sorted clock beat times. Returns { cls, clk, err, rho, i }.
   * ρ is the reference period over the median clock period of the beats within ±2.5 P_k (so ÷2 is told from lost:
   * a half-speed clock leaves every other reference beat without a beat within ±P/2, which is still 'half').
   */
  function classifyOne(clk, k, refs, w) {
    const r = refs[k].t;
    const P = k > 0 && k < refs.length - 1 ? (refs[k + 1].t - refs[k - 1].t) / 2 : k < refs.length - 1 ? refs[k + 1].t - r : r - refs[k - 1].t;
    const i = nearest(clk, r);
    const near = i >= 0 ? clk[i] : null;
    const win = [], periods = [];
    if (i >= 0) { let a = i, b = i; while (a > 0 && clk[a - 1] >= r - 2.5 * P) a--; while (b < clk.length - 1 && clk[b + 1] <= r + 2.5 * P) b++; for (let j = a; j <= b; j++) win.push(clk[j]); }
    for (let j = 1; j < win.length; j++) periods.push(win[j] - win[j - 1]);
    const mp = median(periods), rho = mp > 0 ? P / mp : null;
    const has = near !== null && Math.abs(near - r) <= P / 2 + 1e-9;
    const e = has ? (near - r) * 1000 : null, phi = has ? wrapHalf((near - r) / P) : null;
    const out = (cls) => ({ cls, clk: has ? near : null, err: has ? e : null, rho, i: has ? i : -1, phi });
    if (rho !== null && rho >= 0.485 && rho <= 0.515) return out('half');
    if (!has || rho === null) return out('lost');
    if (rho >= 1.94 && rho <= 2.06) return out('double');
    if (rho < 0.97 || rho > 1.03) return out('ratio');
    if (Math.abs(phi) >= 0.375) return out('offbeat');
    if (Math.abs(e) > w) return out('loose');
    return out('good');
  }

  /**
   * every reference beat of one track → a beat record (§5 'beat'). opts:
   *   refs [{t, pos}]   clock / shadow [{t, beatInBar?, state?, conf?, bpm?}] sorted   hasGrid (false: one record per clock beat)
   *   unscored [{from, to, cls: 'xfade' | 'paused'}]   startAt / endAt (ctx): the played span   stateAt(t) → {state, conf, bpm, ...}
   */
  function classifyTrack({ refs = [], clock = [], shadow = null, hasGrid = true, unscored = [], startAt = -Infinity, endAt = Infinity, stateAt = null, w = W_MS } = {}) {
    if (!hasGrid) return clock.filter(c => c.t >= startAt && c.t <= endAt).map((c, k) => ({ k, ref: null, pos: null, refBpm: null, clk: r6(c.t), err: null, cls: 'nogrid',
      state: c.state ?? null, conf: c.conf ?? null, bpm: c.bpm ?? null, octaveLock: c.octaveLock ?? null, beatInBar: c.beatInBar ?? null, side: c.side ?? null, shadow: null }));
    const ct = clock.map(c => c.t), st = shadow ? shadow.map(c => c.t) : null;
    return refs.map((ref, k) => {
      const r = ref.t, P = k > 0 && k < refs.length - 1 ? (refs[k + 1].t - refs[k - 1].t) / 2 : refs.length > 1 ? Math.abs(refs[k === 0 ? 1 : k].t - refs[k === 0 ? 0 : k - 1].t) : NaN;
      const s = stateAt ? stateAt(r) || {} : {};
      const span = unscored.find(u => r >= u.from && r < u.to);
      const pre = span ? span.cls : (r < startAt || r > endAt || k === 0 || k === refs.length - 1) ? 'outside' : null;
      const c = pre ? { cls: pre, clk: null, err: null, i: -1 } : classifyOne(ct, k, refs, w);
      const sh = !st ? null : pre ? { clk: null, err: null, cls: pre, state: null } : (() => { const o = classifyOne(st, k, refs, w); return { clk: r6(o.clk), err: r3(o.err), cls: o.cls, state: shadow[o.i]?.state ?? null }; })();
      const cb = c.i >= 0 ? clock[c.i] : null;
      const barOk = c.cls === 'good' && cb && Number.isFinite(cb.beatInBar) && Number.isFinite(ref.pos) ? ((cb.beatInBar === 1) === (ref.pos === 1)) : null;
      return { k, ref: r6(r), pos: ref.pos ?? null, refBpm: P > 0 ? r3(60 / P) : null, clk: r6(c.clk), err: r3(c.err), cls: c.cls,
        state: s.state ?? cb?.state ?? null, conf: s.conf ?? cb?.conf ?? null, bpm: s.bpm ?? cb?.bpm ?? null, octaveLock: s.octaveLock ?? null,
        beatInBar: cb?.beatInBar ?? null, side: s.side ?? null, barOk, shadow: sh };
    });
  }

  // ---------- §4.3–4.5 episodes, fix verdicts, per-track numbers ----------
  const pick = (b, which) => (which === 'shadow' ? (b.shadow ? { cls: b.shadow.cls, err: b.shadow.err, state: b.shadow.state } : { cls: b.cls, err: null, state: null }) : b);
  /**
   * beats: beat records in reference order (classifyTrack, or the log's 'beat' records). fixes: [{id, kind, ctx (pressed),
   * landedCtx?}] of this track (the shadow column takes none). Returns { episodes, fixResults, summary, inGate }.
   */
  function summarizeTrack(beats, fixes = [], { gate = GATE, which = 'clock', rejected = 0 } = {}) {
    const B = beats.map(b => ({ t: b.ref, ...pick(b, which), barOk: which === 'shadow' ? null : b.barOk }));
    const fx = which === 'shadow' ? [] : fixes.map(f => ({ ...f, land: Number.isFinite(f.landedCtx) ? f.landedCtx : f.ctx }));
    const S = B.map((b, i) => i).filter(i => isScored(B[i].cls)), good = i => B[i].cls === 'good';
    const nGood = S.filter(good).length;
    // the first good lock: the first beat of the first run of LOCK_RUN good scored beats
    let lockAt = -1;
    for (let j = 0; j + LOCK_RUN <= S.length && lockAt < 0; j++) if (S.slice(j, j + LOCK_RUN).every(good)) lockAt = j;
    const after = lockAt < 0 ? [] : S.slice(lockAt);
    // episodes (after the first lock): from a run of ≥ 2 scored non-good beats to the first beat of a run of END_RUN good ones
    const episodes = [];
    for (let j = 0; j < after.length; j++) {
      if (good(after[j]) || j + 1 >= after.length || good(after[j + 1])) continue;
      let e = j + 2, end = -1;
      for (; e < after.length; e++) if (after.slice(e, e + END_RUN).length === END_RUN && after.slice(e, e + END_RUN).every(good)) { end = e; break; }
      const span = after.slice(j, end < 0 ? after.length : end), bad = span.filter(i => !good(i));
      const counts = {}; for (const i of bad) counts[B[i].cls] = (counts[B[i].cls] || 0) + 1;
      const cls = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || bad.findIndex(i => B[i].cls === a) - bad.findIndex(i => B[i].cls === b))[0];
      const locked = span.filter(i => B[i].state === 'locked').length;
      const last = B[span[span.length - 1]];
      episodes.push({ id: episodes.length + 1, startCtx: B[after[j]].t, endCtx: end < 0 ? last.t : B[after[end]].t, ended: end >= 0,
        startIdx: after[j], endIdx: end < 0 ? null : after[end], cls, wrongLock: locked * 2 > span.length, beats: span.length, fixes: [], reactionMs: null, cureMs: null, endedBy: null });
      j = end < 0 ? after.length : end + END_RUN - 1;
    }
    // fix verdicts: settled on the landing time (a flip lands at the bar line)
    const idxAfter = t => { const i = B.findIndex(b => b.t > t); return i < 0 ? B.length : i; };
    const fixResults = [];
    const byEp = new Map();
    for (const f of fx) {
      const ep = episodes.find(e => f.land >= e.startCtx && (e.ended ? f.land < e.endCtx : true));
      if (ep) { if (!byEp.has(ep)) byEp.set(ep, []); byEp.get(ep).push(f); continue; }
      const ia = idxAfter(f.land), before = S.filter(i => i < ia).slice(-WORSE_BEFORE), next = S.filter(i => i >= ia).slice(0, WORSE_AFTER);
      const worse = before.length === WORSE_BEFORE && before.every(good) && episodes.some(e => next.includes(e.startIdx));
      fixResults.push({ id: f.id, verdict: worse ? 'worse' : 'neutral', episode: worse ? episodes.find(e => next.includes(e.startIdx)).id : null });
    }
    for (const ep of episodes) {
      const list = (byEp.get(ep) || []).sort((a, b) => a.land - b.land);
      ep.fixes = list.map(f => f.id);
      if (list.length) ep.reactionMs = r1(1000 * (Math.min(...list.map(f => f.ctx)) - ep.startCtx));
      const lastF = list[list.length - 1];
      const cured = !!lastF && ep.ended && (() => { const ia = idxAfter(lastF.land); return ep.endIdx >= ia && ep.endIdx - ia < CURE_BEATS; })();
      for (const f of list) fixResults.push({ id: f.id, verdict: cured ? (f === lastF ? 'cured' : 'partOf') : 'noEffect', episode: ep.id });
      ep.endedBy = !ep.ended ? 'trackEnd' : cured ? 'fix' : 'tracker';
      ep.cureMs = r1(1000 * (ep.endCtx - ep.startCtx));
    }
    fixResults.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
    // per-track numbers
    const pct = (n, d) => (d ? r1(100 * n / d) : null);
    const goodAfter = after.filter(good).length;
    const good70 = S.filter(i => (B[i].cls === 'good' || B[i].cls === 'loose') && Number.isFinite(B[i].err) && Math.abs(B[i].err) <= W70_MS).length;
    const goods = S.filter(good), barKnown = goods.filter(i => B[i].barOk !== null && B[i].barOk !== undefined);
    const lockS = lockAt < 0 ? null : r3(B[S[lockAt]].t - B[S[0]].t);
    const wrong = episodes.filter(e => e.wrongLock), lost = episodes.filter(e => !e.wrongLock);
    const kinds = {}; for (const f of fx) kinds[f.kind] = (kinds[f.kind] || 0) + 1;
    const react = episodes.map(e => e.reactionMs).filter(Number.isFinite), cure = episodes.map(e => e.cureMs).filter(Number.isFinite);
    const g = { ...GATE, ...gate };
    const afterLockExact = after.length ? 100 * goodAfter / after.length : null;
    const longestWrong = wrong.reduce((m, e) => Math.max(m, e.beats), 0);
    const inGate = S.length > 0 && afterLockExact !== null && afterLockExact >= g.afterLock - 1e-9 && lockS !== null && lockS <= g.lockS + 1e-9 && longestWrong <= g.wrongBeats;
    const summary = { scored: S.length, good: nGood, goodPct: pct(nGood, S.length), goodPctAfterLock: afterLockExact === null ? null : r3(afterLockExact),
      goodPct70: pct(good70, S.length), barPct: pct(barKnown.filter(i => B[i].barOk).length, barKnown.length), lockS,
      wrongS: r3(wrong.reduce((s, e) => s + (e.endCtx - e.startCtx), 0)), lostS: r3(lost.reduce((s, e) => s + (e.endCtx - e.startCtx), 0)),
      episodes: episodes.length, wrongLockEpisodes: wrong.length, longestWrongBeats: longestWrong, fixes: fx.length, fixKinds: kinds, rejected,
      reactionMs: { median: r1(median(react)), max: react.length ? Math.max(...react) : null }, cureMs: { median: r1(median(cure)), max: cure.length ? Math.max(...cure) : null },
      unscoredBeats: B.length - S.length, inGate };
    return { episodes: episodes.map(({ startIdx, endIdx, ended, ...e }) => ({ ...e, startCtx: r6(e.startCtx), endCtx: r6(e.endCtx) })), fixResults, summary, inGate };
  }
  /** both columns of one track (§4.5): with your fixes (the clock) and tracker alone (the shadow) */
  function trackSummary(idx, beats, fixes, opts = {}) {
    const a = summarizeTrack(beats, fixes, { ...opts, which: 'clock' }), b = summarizeTrack(beats, [], { ...opts, which: 'shadow' });
    return { type: 'trackSummary', idx, withFixes: a.summary, trackerAlone: b.summary, inGate: a.inGate, episodes: a.episodes, fixResults: a.fixResults };
  }
  /** the session headline: tracks in the gate / scored tracks, fixes per scored track; unscored listed with the reason */
  function sessionSummary(tracks) {
    const scored = tracks.filter(t => t.withFixes && t.withFixes.scored > 0);
    const fixes = scored.reduce((s, t) => s + t.withFixes.fixes, 0);
    return { type: 'sessionSummary', tracksInGate: scored.filter(t => t.inGate).length, scoredTracks: scored.length,
      fixesPerTrack: scored.length ? r3(fixes / scored.length) : null,
      unscored: tracks.filter(t => !(t.withFixes && t.withFixes.scored > 0)).map(t => ({ idx: t.idx, reason: t.reason || 'no grid' })) };
  }

  // ---------- §5 the JSONL log, schema v1 ----------
  const SCHEMA = {
    session: ['v', 'id', 'startedAt', 'W_MS', 'gate'], track: ['idx', 'name', 'file', 'grid', 'mode'], beat: ['k', 'ref', 'clk', 'err', 'cls', 'state'],
    fix: ['id', 'kind', 'origin'], fixResult: ['id', 'verdict'], jump: ['kind', 'origin', 'fromBeats', 'toBeats'], rejected: ['kind', 'origin'],
    state: ['from', 'to'], episode: ['id', 'startCtx', 'endCtx', 'cls', 'wrongLock', 'beats', 'fixes', 'endedBy'], transport: ['op'],
    offset: ['visualOffsetMs'], key: ['shown'], trackSummary: ['idx', 'withFixes', 'trackerAlone', 'inGate'], sessionSummary: ['tracksInGate', 'scoredTracks', 'fixesPerTrack', 'unscored'],
  };
  /** the problems with one record (empty when it fits schema v1) */
  function checkRecord(r) {
    const errs = [];
    if (!r || typeof r !== 'object') return ['not an object'];
    if (!SCHEMA[r.type]) return [`unknown type ${r.type}`];
    if (!Number.isFinite(r.ctx)) errs.push(`${r.type}: ctx missing`);
    for (const k of SCHEMA[r.type]) if (!(k in r)) errs.push(`${r.type}: ${k} missing`);
    if (r.type === 'session' && r.v !== 1) errs.push('session: v is not 1');
    if (r.type === 'beat' && !SCORED.includes(r.cls) && !UNSCORED.includes(r.cls)) errs.push(`beat: class ${r.cls}`);
    return errs;
  }
  const line = r => JSON.stringify(r);
  /** records → JSONL (one record per line, in time order as given) */
  const toJsonl = records => records.map(line).join('\n') + '\n';
  /** JSONL → records; throws on a line that doesn't parse or doesn't fit the schema */
  function parseLog(text) {
    return String(text).split('\n').filter(l => l.trim()).map((l, n) => {
      let r; try { r = JSON.parse(l); } catch (e) { throw new Error(`line ${n + 1}: not JSON (${e.message})`); }
      const errs = checkRecord(r); if (errs.length) throw new Error(`line ${n + 1}: ${errs.join('; ')}`);
      return r;
    });
  }
  /**
   * re-score a session from its 'beat', 'fix' and 'transport' records alone (§5 box replay): → [trackSummary] per scored
   * track, plus the sessionSummary. The gate comes from the session header.
   */
  function replay(text) {
    const recs = typeof text === 'string' ? parseLog(text) : text;
    const head = recs.find(r => r.type === 'session') || {};
    const tracks = new Map();
    for (const r of recs) {
      if (r.type === 'beat' || r.type === 'fix') {
        if (!tracks.has(r.track)) tracks.set(r.track, { beats: [], fixes: [] });
        (r.type === 'beat' ? tracks.get(r.track).beats : tracks.get(r.track).fixes).push(r);
      }
    }
    const rejected = recs.filter(r => r.type === 'rejected');
    const out = [];
    for (const [idx, t] of [...tracks.entries()].sort((a, b) => a[0] - b[0])) {
      if (t.beats.every(b => b.cls === 'nogrid')) { out.push({ type: 'trackSummary', idx, withFixes: null, trackerAlone: null, inGate: false, reason: 'no grid' }); continue; }
      out.push(trackSummary(idx, t.beats.sort((a, b) => a.k - b.k), t.fixes, { gate: head.gate, rejected: rejected.filter(r => r.track === idx).length }));
    }
    return { tracks: out, session: sessionSummary(out) };
  }

  const api = { W_MS, W70_MS, GATE, SCORED, UNSCORED, refTimes, alignLag, gridShift, classifyOne, classifyTrack, summarizeTrack, trackSummary, sessionSummary,
    checkRecord, toJsonl, parseLog, replay, median };
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.RehearsalScore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
