// The conductor's "Corrections now" panel (the user, 17 Nov 00:47): which hand fixes act now and since when (track
// time mm:ss), what the tracker took back, and the last 8 hand fixes with their status now. Display only: it reads
// what the clock already exposes (trackerState = the tracker's snapshot() plus offsetBeats and autoHold, clock.jumps,
// clock.handState) and the page's own fix results. It never calls fix(), never touches the clock and adds no log
// record (the conductor log already has the fixes). Pure: node-tested in qa/runner/test/corrections.test.mjs.
//
//   const corr = createCorrections();
//   corr.fix({ kind, arg, j, at, ms, bpmBefore, bpmAfter })   a hand fix from the page's clock.fix wrapper (j = its result)
//   corr.jump(j, ms)                                          each new entry of clock.jumps (tracker and hand jumps)
//   corr.text(view)                                           the panel: 7 "now" lines, then the history (newest first)
//     view = { ts: clock.trackerState, hand: clock.handState, autoHold, nowMs, trackAt(ctxTime) -> ms | null, hasBeats }
//
// Where each line comes from (clock.js, experiments/clock-tracker.js; nothing is counted from key presses when the
// clock holds the state):
//   tempo   ts.held.on (held), ts.tapped (a tap owns the output), else the tracker; ts.bpm; the tap count and tap bpm of
//           the active tap set (its fix result: taps, tapBpm)
//   octave  ts.octaveLock (the held bpm); hand.octaveHold.kind (which key holds it: x2 or half) and hand.holdRelease
//           (a release booked for the bar line). The second press of the same key releases it (clock.js D4)
//   side    ts.lane.side.offset (0 on the beat, 0.5 flipped); landed flips counted from clock.jumps kind 'flip' since
//           the last restart; hand.flipDue (a flip booked for the next bar line)
//   nudge   ts.offsetBeats: line.offset in beats. Nudges add fractions of a beat; reset moves it by whole beats; every
//           accepted tap rounds it to a whole beat and restart sets it to 0 (clock.js lineFixInner / lineRestart), so
//           the nudge in force is its distance to the nearest whole beat, shown in ms at the current tempo
//   bar 1   the active set-1 / reset fix (hand); else the clock's own count from its first lock (the line clock has no
//           grid; the bar 1 lamp shows the reference grid); "none" before the clock has a beat
//   hold    ts.held: on, since, bpm, suspect, suspectWhy, suspectSince, recentreArmed; auto-hold from the clock
//   tracker the last tracker jump 'override' (it replaced a tap) or a new entry in ts.hold.releases (it let an x2 / /2
//           hold go)
export const HISTORY_ROWS = 8, PANEL_HZ = 4, ROWS_KEPT = 64, TAP_GAP_S = 2;
export const STATUS = { active: 'active', replaced: 'replaced by a newer fix', tracker: 'taken back by the tracker',
  released: 'released', restart: 'cleared by restart', none: 'no effect' };

const KEY_NAME = { x2: 'x2', half: '/2' }, KEY_SHIFT = { x2: 'Shift+D', half: 'Shift+H' };
const f1 = v => (Number.isFinite(v) && v > 0 ? v.toFixed(1) : '?');
const signed = v => `${v > 0 ? '+' : ''}${v}`;

/** track time in ms -> mm:ss ('--:--' when unknown) */
export function mmss(ms) {
  if (!Number.isFinite(ms)) return '--:--';
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
/** the nudge in force (ms at bpm) from the clock's offset in beats: its distance to the nearest whole beat */
export function nudgeMs(offsetBeats, bpm) {
  if (!Number.isFinite(offsetBeats)) return null;
  const fr = offsetBeats - Math.round(offsetBeats);
  if (Math.abs(fr) < 1e-6) return 0;   // whole beats only: no nudge, whatever the tempo
  if (!(bpm > 0)) return null;
  return Math.round(fr * 60000 / bpm);
}

export function createCorrections() {
  const rows = [];
  let nextId = 0, flips = 0, takeover = null, relSeen = -Infinity;
  const since = {};
  const active = dom => rows.filter(r => r.status === 'active' && dom.includes(r.domain));
  const mark = (dom, status, except) => { for (const r of active(dom)) if (r !== except) r.status = status; };
  const add = r => { r.id = ++nextId; rows.push(r); if (rows.length > ROWS_KEPT) rows.shift(); return r; };
  const last = () => rows[rows.length - 1] || null;

  function fix({ kind, arg, j, at, ms, bpmBefore, bpmAfter }) {
    if (kind === 'autoHold') return null;   // a setting, not a fix: the hold line shows it
    const base = { at, ms, kind, n: 1 };
    if (!j) return add({ ...base, label: kind, effect: 'no effect', domain: 'none', status: 'none' });
    if (j.rejected) return add({ ...base, label: 'tap', effect: `rejected: ${j.tapError === 'double' ? 'double' : 'missed'} tap, nothing changed`, domain: 'none', status: 'none' });
    if (kind === 'restart') {
      mark(['tempo', 'phase', 'octave', 'release', 'nudge', 'side', 'bar', 'hold', 'holdOff', 'restart', 'other'], 'restart');
      flips = 0;
      return add({ ...base, label: 'restart', effect: 'a fresh tracker: tempo, octave, side, nudge and bar 1 start over', domain: 'restart', status: 'active' });
    }
    if (kind === 'tap') {
      const p = last(), merge = p && p.kind === 'tap' && p.status === 'active' && at - p.at <= TAP_GAP_S;
      const r = merge ? p : add({ ...base, label: 'tap', domain: 'phase', status: 'active', bpmFrom: bpmBefore });
      if (merge) { r.n++; r.at = at; r.ms = ms; }   // the row's time: the latest tap of the run
      if (j.tapBpm) { r.domain = 'tempo'; r.tapBpm = j.tapBpm; r.taps = j.taps; r.effect = `tempo ${f1(r.bpmFrom)} -> ${f1(j.tapBpm)} (${j.taps} taps)`; mark(['tempo', 'phase', 'octave', 'release'], 'replaced', r); }
      else r.effect = `beat moved to the tap (${r.n} tap${r.n > 1 ? 's' : ''})`;
      mark(['nudge'], 'replaced');   // every accepted tap rounds the clock's offset to a whole beat: the nudge goes
      return r;
    }
    if (kind === 'x2' || kind === 'half') {
      const name = KEY_NAME[kind];
      if (j.type === 'release-scheduled') {
        for (const r of active(['octave'])) if (r.kind === kind) r.status = 'released';
        return add({ ...base, label: `${name} again`, effect: `releases the ${name} hold at the bar line`, domain: 'release', status: 'active' });
      }
      mark(['octave', 'release'], 'replaced');
      return add({ ...base, label: name, effect: `tempo ${f1(bpmBefore)} -> ${f1(bpmAfter)}, octave held`, domain: 'octave', status: 'active' });
    }
    if (kind === 'nudge') {
      const v = Number(arg) || 0, p = last();
      if (p && p.kind === 'nudge' && p.status === 'active' && p.step === v) {   // the same key again: one row
        p.n++; p.sum += v; p.at = at; p.ms = ms;
        p.effect = `${signed(v)} ms x${p.n} = ${signed(p.sum)} ms`;
        return p;
      }
      return add({ ...base, label: 'nudge', step: v, sum: v, effect: `${signed(v)} ms`, domain: 'nudge', status: 'active' });
    }
    if (kind === 'flip') {
      mark(['side'], 'replaced');
      return add({ ...base, label: 'flip', effect: 'half a beat at the next bar line', domain: 'side', status: 'active' });
    }
    if (kind === 'setOne' || kind === 'reset') {
      mark(['bar'], 'replaced');
      const b = j && Number.isFinite(j.toBeats) ? Math.round(j.toBeats) : null;
      return add({ ...base, label: kind === 'setOne' ? 'set 1' : 'reset', effect: kind === 'setOne' ? `bar 1 on this beat${b !== null ? ` (beat ${b})` : ''}` : 'beat count from 0, bar 1 here',
        domain: 'bar', status: 'active' });
    }
    if (kind === 'hold') {
      if (j.on) { mark(['hold'], 'replaced'); return add({ ...base, label: 'hold on', effect: `the clock keeps the beat (${f1(bpmAfter)} bpm)`, domain: 'hold', status: 'active' }); }
      mark(['hold'], 'released');
      return add({ ...base, label: 'hold off', effect: 'the tracker is free again', domain: 'holdOff', status: 'active' });
    }
    return add({ ...base, label: kind, effect: '', domain: 'other', status: 'active' });
  }

  // each new clock.jumps entry: landed flips; the tracker's override of a tap
  function jump(j, ms) {
    if (!j) return;
    if (j.kind === 'flip') flips++;
    if (j.kind === 'override' && (j.origin || 'tracker') === 'tracker') {
      const taps = active(['tempo', 'phase']).filter(r => r.kind === 'tap');
      for (const r of taps) r.status = 'tracker';
      const t = taps[taps.length - 1];
      takeover = { ms, text: `override replaced ${t ? (t.tapBpm ? `the tap tempo ${f1(t.tapBpm)} bpm` : 'the tapped beat') : 'a tap'}` };
    }
  }

  // the tracker letting an x2 / /2 hold go (fix c or the real-tempo-change release): a new entry in ts.hold.releases
  function observe(view) {
    const rel = view && view.ts && view.ts.hold && Array.isArray(view.ts.hold.releases) ? view.ts.hold.releases : [];
    for (const r of rel) {
      if (!(r.t > relSeen)) continue;
      relSeen = r.t;
      const held = active(['octave']);
      for (const x of held) x.status = 'tracker';
      const h = held[held.length - 1];
      takeover = { ms: view.trackAt ? view.trackAt(r.t) : null, text: `octave release (${r.why || 'evidence'}) replaced ${h ? `the ${h.label} hold` : `the hold at ${f1(r.lock)} bpm`}` };
    }
  }

  // since: the track time at which a line's value last changed (seen at most PANEL_HZ times a second)
  function sinceOf(key, value, nowMs) {
    const s = since[key];
    if (!s || s.value !== value) since[key] = { value, ms: nowMs };
    return since[key].ms;
  }

  function nowLines(view) {
    const ts = view.ts, hand = view.hand, at = t => (view.trackAt && Number.isFinite(t) ? view.trackAt(t) : null), now = view.nowMs;
    if (!ts) return ['tempo   unknown', 'octave  unknown', 'side    unknown', 'nudge   unknown', 'bar 1   unknown', 'hold    unknown', 'tracker unknown'];
    const out = [], h = ts.held || null, bpm = Number(ts.bpm) || 0;
    // 1. tempo
    let src, tempo;
    if (h && h.on) { src = 'held'; tempo = `held ${f1(h.bpm || bpm)} bpm`; }
    else if (ts.tapped) {
      const t = active(['tempo']).filter(r => r.kind === 'tap').pop();
      src = t ? `tap${t.id}` : 'tap';
      tempo = t ? `tap: ${t.taps} taps, ${f1(bpm)} bpm` : `tap (beat only), ${f1(bpm)} bpm`;
    } else { src = 'tracker'; tempo = `tracker ${f1(bpm)} bpm`; }
    out.push(`tempo   ${tempo} since ${mmss(sinceOf('tempo', src, now))}`);
    // 2. octave lock
    if (!ts.octaveLock) { sinceOf('octave', 'off', now); out.push('octave  off'); }
    else {
      const k = hand && hand.octaveHold ? hand.octaveHold.kind : null, name = k ? KEY_NAME[k] : (hand ? 'held' : 'unknown');
      const how = hand && hand.holdRelease ? 'release booked for the next bar line'
        : k ? `to release: press ${name} again (${KEY_SHIFT[k]})` : 'to release: tap 4 times or restart';
      out.push(`octave  ${name} at ${f1(ts.octaveLock)} bpm since ${mmss(sinceOf('octave', `${name}|${ts.octaveLock}`, now))}; ${how}`);
    }
    // 3. side
    const side = ts.lane && ts.lane.side ? ts.lane.side.offset : undefined;
    if (side === undefined || side === null) out.push(`side    unknown; hand flips since restart: ${flips}`);
    else {
      const v = side ? 'flipped (1/2 beat)' : 'on the beat';
      out.push(`side    ${v} since ${mmss(sinceOf('side', v, now))}; hand flips since restart: ${flips}${hand && hand.flipDue ? '; a flip lands at the next bar line' : ''}`);
    }
    // 4. nudge
    const nm = nudgeMs(ts.offsetBeats, bpm);
    if (nm === null) out.push('nudge   unknown');
    else if (nm === 0) { sinceOf('nudge', '0', now); out.push('nudge   0 ms'); }
    else out.push(`nudge   ${signed(nm)} ms since ${mmss(sinceOf('nudge', (ts.offsetBeats - Math.round(ts.offsetBeats)).toFixed(4), now))} (a tap or restart clears it)`);
    // 5. bar 1
    const bar = active(['bar']).pop();
    if (bar) out.push(`bar 1   by hand (${bar.label}) at ${mmss(bar.ms)}`);
    else if (view.hasBeats) out.push('bar 1   the clock\'s own count (no set 1)');
    else out.push('bar 1   none (no beat yet)');
    // 6. hold
    if (!h) out.push(`hold    unknown; auto-hold ${view.autoHold ? 'on' : 'off'}`);
    else if (!h.on) out.push(`hold    off; auto-hold ${view.autoHold ? 'on' : 'off'}`);
    else {
      const sus = h.suspect ? `; SUSPECT (${h.suspectWhy || 'no reason given'}) since ${mmss(at(h.suspectSince))}` : '';
      out.push(`hold    on since ${mmss(at(h.since))} at ${f1(h.bpm)} bpm; auto-hold ${view.autoHold ? 'on' : 'off'}; re-centre ${h.recentreArmed ? 'ready' : 'used'}${sus}`);
    }
    // 7. the tracker took over
    out.push(takeover ? `tracker took over at ${mmss(takeover.ms)}: ${takeover.text}` : 'tracker took over: none');
    return out;
  }

  const history = (n = HISTORY_ROWS) => rows.slice(-n).reverse().map(r => ({ id: r.id, ms: r.ms, label: r.label, effect: r.effect, status: STATUS[r.status] || r.status }));
  const historyLines = (n = HISTORY_ROWS) => history(n).map(r => `${mmss(r.ms)} ${r.label}: ${r.effect} [${r.status}]`);
  function text(view) {
    observe(view);
    const h = historyLines();
    return [...nowLines(view), ...(h.length ? ['last fixes (newest first):', ...h] : [])].join('\n');
  }
  return { fix, jump, observe, nowLines, history, historyLines, text, get rows() { return rows; }, get flips() { return flips; }, get takeover() { return takeover; } };
}
