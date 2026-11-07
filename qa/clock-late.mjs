// The check-shared clock booking row (__qa.clockLate, #148), hard since 7 Nov (#95 6704881403, the user's go 7 Nov
// 10:12): one row per page per check-shared pass.
//   fail  late > 0 (a step booked after its own time), or a page that loads the shared clock (experiments/clock.js)
//         reports no __qa.clockLate, so a missing row can't pass silently
//   n/a   a page not on the clock: listed, not failed
// Hard on every page like the beat-match row: no downgrade for pages from before #88. Pure, so node --test can load it
// (qa/runner/test/clock-late.test.mjs); qa/check-shared.mjs reads the page and writes the row.

export const NAME = 'clock booking under long frames (__qa.clockLate, #148)';
/** a <script src> that is the shared clock: clock.js, ./clock.js, /experiments/clock.js?v=2 (not clock-tracker.js) */
export const CLOCK_SRC_RE = /(^|\/)clock\.js([?#]|$)/;
export const loadsClock = srcs => Array.isArray(srcs) && srcs.some(s => typeof s === 'string' && CLOCK_SRC_RE.test(s));

/**
 * c: __qa.clockLate as read from the page ({late, lateMaxMs, maxGapMs, lookAheadMs}), null when the page has none,
 * {err} when reading failed, undefined when not measured (a flash-only run). onClock: whether the page loads clock.js
 * (true / false; anything else means it couldn't be told, which fails rather than passes when the row is missing).
 * → { pass: true | false | null (ℹ️, listed), detail }
 */
export function clockLateRow(c, onClock) {
  if (c === undefined) return { pass: null, detail: 'not measured (flash-only run)' };
  if (c && c.err) return { pass: false, detail: `could not read __qa.clockLate: ${c.err}` };
  if (c === null) {
    if (onClock === false) return { pass: null, detail: 'n/a: page not on the shared clock (no experiments/clock.js)' };
    return { pass: false, detail: onClock === true
      ? 'page loads experiments/clock.js but reports no __qa.clockLate (clock.js from before #148, or __qa not wired)'
      : 'no __qa.clockLate, and could not tell whether the page loads experiments/clock.js' };
  }
  const late = Number(c.late);
  if (!Number.isFinite(late)) return { pass: false, detail: `__qa.clockLate has no late count (${JSON.stringify(c).slice(0, 120)})` };
  return { pass: late === 0,
    detail: `late ${late}${late ? ` (worst ${c.lateMaxMs} ms)` : ''} · max frame gap ${c.maxGapMs} ms · look-ahead ${c.lookAheadMs} ms` };
}
