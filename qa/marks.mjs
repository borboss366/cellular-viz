// Marks by ear (#188 R13, VIZ research 6728993586): key M on the conductor page, never typed timestamps, and never a raw
// keypress. A press is ±100–200 ms, so every mark is stored as the NEAREST reference beat (its index in the track's grid)
// plus that beat's fitted time, with the raw press kept beside it: { name, beat, atMs, rawMs, markSource }.
// `bar1` is the mark that sets a mix side's bar1At (qa/mixes.json); `[` and `]` step it one beat at a time while the page
// shows the bar lamp. A hand-typed value (markSource "typed") is snapped the same way: one code path.
//
// Pure and browser-safe (no node imports): the page imports it from /qa/marks.mjs, qa/marks-apply.mjs from node.
export const MARK_NAME = /^[a-z][A-Za-z0-9]*$/;
export const BAR1 = 'bar1';
export const FIT_HALF = 8;   // the fitted time of a beat: a least-squares line through it and up to 8 beats each side
const num = x => typeof x === 'number' && Number.isFinite(x);

/** a grid's beats (sidecar { beats: [{ ms }] } or a plain ms array) → sorted ms */
export function beatTimes(grid) {
  const b = Array.isArray(grid) ? grid : grid && Array.isArray(grid.beats) ? grid.beats : [];
  return b.map(x => (num(x) ? x : x && num(x.ms) ? x.ms : NaN)).filter(num).sort((x, y) => x - y);
}

/** index of the beat nearest to tMs (-1 for no beats) */
export function nearestBeat(ms, tMs) {
  if (!ms.length || !num(tMs)) return -1;
  let lo = 0, hi = ms.length - 1;
  if (tMs <= ms[lo]) return lo;
  if (tMs >= ms[hi]) return hi;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ms[m] <= tMs) lo = m; else hi = m; }
  return tMs - ms[lo] <= ms[hi] - tMs ? lo : hi;
}

/** beat i's fitted time (ms): a line through beats i−8 … i+8 (the detector's ~10 ms jitter averages down, R17) */
export function fittedBeatMs(ms, i, half = FIT_HALF) {
  if (i < 0 || i >= ms.length) return null;
  const lo = Math.max(0, i - half), hi = Math.min(ms.length - 1, i + half), n = hi - lo + 1;
  if (n < 3) return ms[i];
  let sk = 0, st = 0;
  for (let k = lo; k <= hi; k++) { sk += k; st += ms[k]; }
  const mk = sk / n, mt = st / n;
  let sxx = 0, sxy = 0;
  for (let k = lo; k <= hi; k++) { sxx += (k - mk) ** 2; sxy += (k - mk) * (ms[k] - mt); }
  const b = sxy / sxx;
  return mt + b * (i - mk);
}

const r1 = x => Math.round(x * 10) / 10;
/** a press (or a typed time) → the stored mark; null when the grid has no beats */
export function snapMark(grid, name, rawMs, markSource = 'key') {
  if (!MARK_NAME.test(String(name))) throw new Error(`mark name ${name}: letters and digits, starting lower-case`);
  if (markSource !== 'key' && markSource !== 'typed') throw new Error(`markSource ${markSource}: "key" or "typed"`);
  const ms = beatTimes(grid), beat = nearestBeat(ms, rawMs);
  if (beat < 0) return null;
  return { name, beat, atMs: r1(fittedBeatMs(ms, beat)), rawMs: r1(rawMs), markSource };
}

/** `[` (−1) and `]` (+1): the same mark moved by whole beats, its raw press kept */
export function stepMark(grid, mark, delta) {
  const ms = beatTimes(grid);
  if (!mark || !ms.length) return mark;
  const beat = Math.min(ms.length - 1, Math.max(0, mark.beat + Math.trunc(delta)));
  return { ...mark, beat, atMs: r1(fittedBeatMs(ms, beat)) };
}

/** the page's session-log record for a mark (schema v1 `mark`, qa/conduct-score.mjs): trackMs is the snapped time */
export const markRecord = (ctx, idx, mark) => ({ type: 'mark', ctx, idx, name: mark.name, trackMs: mark.atMs, beat: mark.beat, atMs: mark.atMs, rawMs: mark.rawMs, markSource: mark.markSource });
