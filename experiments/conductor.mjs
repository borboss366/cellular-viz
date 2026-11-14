// The conductor page's pure parts (#188 Task 1; experiments/clock-conductor.html): deck positions, the shadow tracker's
// beat records, the bar lamp, the calibrate steps and profiles, and the page's own keys. No DOM, no audio: the page
// imports it, node tests check it (qa/runner/test/conduct-page.test.mjs).
export const KICK_QUARTERS = 'x---x---x---x---', SILENT = '----------------';   // R2: a kick on every quarter = the output beats
export const XFADE_S = 8, PAIR_S = 5, SAMPLE_S = 0.1, START_LEAD_S = 0.05;
export const OFFSET_MIN = -100, OFFSET_MAX = 200, LAMP_MS = 120;
export const FIX_KIND = { tap: 'tap', half: 'half', x2: 'x2', flip: 'flip', nudge: 'nudge', setOne: 'set1', reset: 'reset', restart: 'restart' };   // clock.fix → schema v1
const num = x => typeof x === 'number' && Number.isFinite(x);

/** a deck started with start(at, offsetS): its track position (ms) at audio time t, and the audio time of a position */
export const deckPosMs = (deck, t) => (deck.offsetS + (t - deck.at)) * 1000;
export const deckCtxAt = (deck, posMs) => deck.at + posMs / 1000 - deck.offsetS;

/** the equal-power crossfade gains at x ∈ [0, 1] (out, in) */
export const xfadeGains = x => { const c = Math.min(1, Math.max(0, x)); return [Math.cos(c * Math.PI / 2), Math.sin(c * Math.PI / 2)]; };

/**
 * the shadow tracker's beats as records (R3): call with its beatsAt / timeOf at each frame's time; returns the audio times
 * of the whole beats crossed since the last call (none on the first call, at most 8 at once, none while it has no model)
 */
export function beatCounter() {
  let last = null;
  return (beatsAt, timeOf, t) => {
    const b = beatsAt(t);
    if (!num(b) || b < 0) { last = null; return []; }
    const k = Math.floor(b);
    if (last === null || k < last) { last = k; return []; }
    const out = [];
    for (let j = last + 1; j <= k && out.length < 8; j++) { const at = timeOf(j); if (num(at)) out.push(at); }
    last = k;
    return out;
  };
}

/** the bar lamp (A7b): on while the reference beat nearest posMs is a "1" (pos 1) within ±LAMP_MS; → { on, beat } */
export function barLamp(beats, posMs, winMs = LAMP_MS) {
  if (!Array.isArray(beats) || !beats.length || !num(posMs)) return { on: false, beat: -1 };
  let lo = 0, hi = beats.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m].ms <= posMs) lo = m; else hi = m; }
  const i = Math.abs(beats[lo].ms - posMs) <= Math.abs(beats[hi].ms - posMs) ? lo : hi;
  return { on: beats[i].pos === 1 && Math.abs(beats[i].ms - posMs) <= winMs, beat: i };
}

/** R10: Alt+, / Alt+. move the visual offset 1 ms, accelerating while held (1 1 2 2 4 4 8 8 10 …) */
export const calStep = run => Math.min(10, 2 ** Math.floor(Math.max(0, run - 1) / 2));
export const clampOffset = ms => Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, Math.round(Number(ms) || 0)));

/** venue profiles { name: { offsetMs } } ↔ JSON (R10 Export / Import); import throws on anything else */
export const exportProfiles = p => JSON.stringify({ version: 1, profiles: p }, null, 2);
export function importProfiles(text) {
  const doc = JSON.parse(text);
  if (!doc || doc.version !== 1 || typeof doc.profiles !== 'object' || Array.isArray(doc.profiles)) throw new Error('not a conductor profiles file (version 1)');
  const out = {};
  for (const [name, v] of Object.entries(doc.profiles)) {
    if (!/^[\w .-]{1,40}$/.test(name) || !v || !num(v.offsetMs)) throw new Error(`profile ${name}`);
    out[name] = { offsetMs: clampOffset(v.offsetMs) };
  }
  return out;
}

/**
 * the page's own keys → an action, or null (Shift + the clock's keys stay the clock's hand fixes):
 *   M mark · [ / ] step bar1 · Shift+S confirm the bar (only with the bar lamp shown) · Alt+, / Alt+. offset ±
 *   Space play/pause · N next with a crossfade · K the answer-key lamp · ? the Help panel
 */
export function pageKey(e) {
  if (!e || e.ctrlKey || e.metaKey) return null;
  const tag = e.target && e.target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range')) return null;
  if (e.altKey) return e.code === 'Comma' ? { type: 'offset', dir: -1 } : e.code === 'Period' ? { type: 'offset', dir: 1 } : null;
  if (e.repeat) return null;
  if (e.key === '?') return { type: 'help' };   // the Help panel (Shift+/ on most layouts)
  if (e.shiftKey) return e.code === 'KeyS' ? { type: 'barOk' } : null;
  return { KeyM: { type: 'mark' }, BracketLeft: { type: 'step', delta: -1 }, BracketRight: { type: 'step', delta: 1 },
    Space: { type: 'playPause' }, KeyN: { type: 'next' }, KeyK: { type: 'keyLamp' } }[e.code] || null;
}

// ---------- the clock-off banner and the band bars (9 Nov sitting: the LAN address is not a secure context) ----------
/** the banner text when the clock cannot listen, else null (plain ASCII, #205). AudioWorklet exists only in a secure
 *  context (https or localhost), so on http://<LAN address> the tracker never starts (clock.js attachInput → 'error'). */
export const CLOCK_OFF_TEXT = 'Clock is off: this address is not secure. Open http://localhost:8790/ through the ssh tunnel (see Help).';
export function clockWarning({ secure, status, error } = {}) {
  if (secure !== false && status !== 'error') return null;
  const why = error ? ` (${String(error).replace(/[^\x20-\x7e]/g, '?').slice(0, 160)})` : '';
  return (secure === false ? CLOCK_OFF_TEXT : 'Clock is off: the tracker did not start. Reload the page.') + why;
}
/** bar heights in px for the band levels (dB, about -80 ... 0): all empty without live tracker frames, and never full
 *  from a placeholder (all-zero bands, as the clock reports before any frame) or a non-number */
export const BAND_MAX_PX = 70;
export function bandHeights(bands, names, live) {
  const vals = names.map(b => (bands ? bands[b] : undefined));
  if (!live || !bands || vals.every(v => v === 0 || !Number.isFinite(v))) return names.map(() => 0);
  return vals.map(v => (Number.isFinite(v) ? Math.round(Math.max(0, Math.min(BAND_MAX_PX, (v + 80) * 0.9))) : 0));
}

// ---------- the monitor's text lines and the deck tags (9 Nov sitting fixes); plain ASCII (#205) ----------
/** the tracker's beat side (laneReport().side.offset: 0 or 0.5) → '0' | '1/2', or '-' without one */
export function sideText(side) {
  if (!side || typeof side.offset !== 'number' || !Number.isFinite(side.offset)) return '-';
  return Math.abs(side.offset - 0.5) < 1e-6 ? '1/2' : side.offset === 0 ? '0' : String(+side.offset.toFixed(2));
}
/** the octave hold (tracker octaveLock, a bpm) → { text, warn }: text only while a hold is on; warn when it is more
 *  than 1.5x or less than 0.67x the output tempo (a hold that no longer matches what the clock plays) */
export function octaveText(lock, outBpm) {
  if (!(lock > 0)) return { text: '', warn: false };
  const r = outBpm > 0 ? lock / outBpm : 1;
  return { text: `octave hold ${Math.round(lock)} bpm`, warn: r > 1.5 || r < 0.67 };
}
/** the line under the state: "lane broad . side 1/2 . octave hold 136 bpm" (parts that are missing are left out) */
export function laneLine(ts, outBpm) {
  const parts = [];
  if (ts && ts.lane) parts.push(`lane ${ts.lane.lane || '-'}`, `side ${sideText(ts.lane.side)}`);
  const o = octaveText(ts && ts.octaveLock, outBpm);
  if (o.text) parts.push(o.text);
  return { text: parts.join(' . '), warn: o.warn };
}
/** a deck's tag: LIVE while it plays, or when it is the live deck and holds a track; NEXT when it holds a track;
 *  '-' when it is empty (an empty deck never shows LIVE) */
export function deckTag(d, liveIdx) {
  const has = !!(d && d.buffer && d.track);
  if (d && d.playing) return 'LIVE';
  if (has && d.n === liveIdx) return 'LIVE';
  return has ? 'NEXT' : '-';
}
/** the deck and message line text for a track that did not load */
export function loadErrorText(name, err) {
  const why = String((err && (err.message || err.name)) || err || 'unknown error').replace(/[^\x20-\x7e]/g, '?').slice(0, 160);
  return `could not load ${String(name).replace(/[^\x20-\x7e]/g, '?')}: ${why}`;
}

// ---------- the phase wheel (#188, the user 10 Nov 20:46; VIZ research's design) ----------
// A round dial: the clock beat at 12 o'clock, each kick at (its phase against the clock beat) x 360 degrees. Clockwise
// = the kick comes AFTER the clock beat (the clock is early). The kicks of the last 8 bars make a weighted ring (48
// angle bins, older kicks fade): a groove's syncopated kicks are extra lobes, not an error. The marker is the
// weighted median of the kicks within 1/4 beat of 12 o'clock, in ms. One hint names the key to push.
export const WHEEL_BINS = 48, WHEEL_BARS = 8, WHEEL_ON_MS = 15, WHEEL_NUDGE_MS = 10, WHEEL_MARK = 0.25, WHEEL_DRIFT_DEG = 30;
export const WHEEL_MIN_KICKS = 4;
const wrapPhase = x => x - Math.round(x);   // -1/2 .. 1/2 of a beat (+ = after the clock beat)
export const wheelBin = ph => (Math.round((((ph % 1) + 1) % 1) * WHEEL_BINS)) % WHEEL_BINS;   // bin 0 is centred on 12 o'clock
/** kicks: [{ b }] (or numbers): each kick's place on the clock's beat count when it was heard; opts: { bpm, bpb,
 *  nowBeats (the clock's beat count now), state (the tracker state) } →
 *  { bins, total, kicks, medianPhase, medianMs, twelve, six, sixShare, driftDegPerBar, driftBars, kind, hint, grey } */
export function phaseWheel(kicks, { bpm = 120, bpb = 4, nowBeats = null, state = null } = {}) {
  const span = WHEEL_BARS * bpb, P = bpm > 0 ? 60 / bpm : 0.5, bins = new Array(WHEEL_BINS).fill(0);
  const ks = [];
  let last = -Infinity;
  for (const k of kicks || []) { const b = typeof k === 'number' ? k : k && k.b; if (Number.isFinite(b) && b > last) last = b; }
  const now = Number.isFinite(nowBeats) ? nowBeats : last;
  for (const k of kicks || []) {
    const b = typeof k === 'number' ? k : k && k.b;
    if (!Number.isFinite(b)) continue;
    const age = now - b;
    if (age < -1 || age > span) continue;
    const w = 1 - 0.9 * Math.min(1, Math.max(0, age) / span);   // the newest 1, the oldest 0.1
    const ph = wrapPhase(b);
    ks.push({ b, ph, w });
    bins[wheelBin(ph)] += w;
  }
  let total = 0, twelve = 0, six = 0;
  for (const k of ks) { total += k.w; if (Math.abs(k.ph) <= 0.125) twelve += k.w; if (Math.abs(k.ph) >= 0.375) six += k.w; }
  // the marker: the weighted median of the kicks within 1/4 beat of 12 o'clock
  const near = ks.filter(k => Math.abs(k.ph) <= WHEEL_MARK).sort((a, b) => a.ph - b.ph);
  let medianPhase = null;
  if (near.length) {
    const half = near.reduce((s, k) => s + k.w, 0) / 2;
    let acc = 0;
    for (const k of near) { acc += k.w; if (acc >= half) { medianPhase = k.ph; break; } }
  }
  const medianMs = medianPhase === null ? null : Math.round(medianPhase * P * 1000);
  // the ring turning: one circular mean angle per bar (bars whose kicks point one way, R >= 0.5), unwrapped, and the
  // least-squares slope in degrees per bar. A 2-step bar (kicks at 12 and 6) has R near 0 and is left out
  const perBar = new Map();
  for (const k of ks) {
    const bar = Math.floor(k.b / bpb), a = 2 * Math.PI * k.ph, e = perBar.get(bar) || { c: 0, s: 0, w: 0, n: 0 };
    e.c += k.w * Math.cos(a); e.s += k.w * Math.sin(a); e.w += k.w; e.n++; perBar.set(bar, e);
  }
  const pts = [];
  for (const [bar, e] of [...perBar.entries()].sort((x, y) => x[0] - y[0])) {
    if (e.n < 2 || Math.hypot(e.c, e.s) / e.w < 0.5) continue;
    let deg = Math.atan2(e.s, e.c) * 180 / Math.PI;
    if (pts.length) { const prev = pts[pts.length - 1].deg; while (deg - prev > 180) deg -= 360; while (deg - prev < -180) deg += 360; }
    pts.push({ bar, deg });
  }
  let driftDegPerBar = null;
  if (pts.length >= 3) {
    const mx = pts.reduce((s, p) => s + p.bar, 0) / pts.length, my = pts.reduce((s, p) => s + p.deg, 0) / pts.length;
    let sxx = 0, sxy = 0;
    for (const p of pts) { sxx += (p.bar - mx) ** 2; sxy += (p.bar - mx) * (p.deg - my); }
    if (sxx > 0) driftDegPerBar = +(sxy / sxx).toFixed(1);
  }
  const out = { bins, total: +total.toFixed(3), kicks: ks.length, medianPhase: medianPhase === null ? null : +medianPhase.toFixed(4), medianMs,
    twelve: +twelve.toFixed(3), six: +six.toFixed(3), sixShare: total > 0 ? +(six / total).toFixed(3) : 0, driftDegPerBar, driftBars: pts.length,
    kind: 'none', hint: '', grey: false };
  if (state !== 'locked') { out.grey = true; out.kind = 'state'; out.hint = String(state || 'no clock').replace(/[^\x20-\x7e]/g, '?'); return out; }
  if (ks.length < WHEEL_MIN_KICKS) { out.hint = 'waiting for kicks'; return out; }
  if (driftDegPerBar !== null && Math.abs(driftDegPerBar) > WHEEL_DRIFT_DEG) { out.kind = 'tap'; out.hint = 'tempo wrong: tap 6 to 8 times (Shift+A)'; return out; }
  if (six > 0 && six > 2 * twelve && six / total >= 0.4) { out.kind = 'flip'; out.hint = 'half a beat off: flip (Shift+F)'; return out; }
  if (medianMs === null) { out.hint = 'no kicks near the beat'; return out; }
  if (Math.abs(medianMs) <= WHEEL_ON_MS) { out.kind = 'on'; out.hint = 'on the beat'; return out; }
  // nudge + = clock ahead: a kick BEFORE the clock beat (medianMs < 0, the clock is late) wants +10
  const n = Math.max(1, Math.round(Math.abs(medianMs) / WHEEL_NUDGE_MS));
  out.kind = 'nudge';
  out.hint = medianMs < 0 ? `+10 (Shift+.) about ${n} times` : `-10 (Shift+,) about ${n} times`;
  return out;
}

// ---------- the wheel hint in the session log (the user 10 Nov 22:27) ----------
export const WHEEL_HOLD_S = 0.5;
/** the hint kind as logged: on | nudge | flip | tap | grey (not locked) | none (waiting for kicks) */
export const wheelKind = w => (!w ? 'none' : w.grey ? 'grey' : w.kind || 'none');
/** a debounced logger: call it every frame with (ctx seconds, the wheel); it returns the record fields once a new hint
 *  (kind + text) has held for holdS (ctx = when that hint began), else null. A flicker shorter than holdS writes
 *  nothing, and the same hint never twice in a row. */
export function wheelHintLog(holdS = WHEEL_HOLD_S) {
  let logged = null, cand = null, since = 0;
  return (t, w) => {
    const kind = wheelKind(w), hint = (w && w.hint) || '', key = `${kind}|${hint}`;
    if (key === logged) { cand = null; return null; }
    if (key !== cand) { cand = key; since = t; return null; }
    if (t - since < holdS) return null;
    logged = key; cand = null;
    return { ctx: since, kind, hint, medianMs: w ? w.medianMs : null, sixShare: w ? w.sixShare : null, driftDegPerBar: w ? w.driftDegPerBar : null };
  };
}
