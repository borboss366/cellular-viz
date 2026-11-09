// The conductor page's pure parts (#188 Task 1; experiments/clock-conductor.html): deck positions, the shadow tracker's
// beat records, the bar lamp, the calibrate steps and profiles, and the page's own keys. No DOM, no audio: the page
// imports it, node tests check it (qa/runner/test/conduct-page.test.mjs).
export const KICK_QUARTERS = 'x---x---x---x---', SILENT = '----------------';   // R2: a kick on every quarter = the output beats
export const XFADE_S = 8, PAIR_S = 5, SAMPLE_S = 0.1, START_LEAD_S = 0.05;
export const OFFSET_MIN = -100, OFFSET_MAX = 200, LAMP_MS = 120;
export const FIX_KIND = { tap: 'tap', half: 'half', x2: 'x2', flip: 'flip', nudge: 'nudge', setOne: 'set1', reset: 'reset' };   // clock.fix → schema v1
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
 *   Space play/pause · N next with a crossfade · K the answer-key lamp
 */
export function pageKey(e) {
  if (!e || e.ctrlKey || e.metaKey) return null;
  const tag = e.target && e.target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && e.target.type !== 'range')) return null;
  if (e.altKey) return e.code === 'Comma' ? { type: 'offset', dir: -1 } : e.code === 'Period' ? { type: 'offset', dir: 1 } : null;
  if (e.repeat) return null;
  if (e.shiftKey) return e.code === 'KeyS' ? { type: 'barOk' } : null;
  return { KeyM: { type: 'mark' }, BracketLeft: { type: 'step', delta: -1 }, BracketRight: { type: 'step', delta: 1 },
    Space: { type: 'playPause' }, KeyN: { type: 'next' }, KeyK: { type: 'keyLamp' } }[e.code] || null;
}
