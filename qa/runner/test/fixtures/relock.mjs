// Re-lock figures for the cost of #214 ruling (i) (report-only rows in clock-tracker.test.mjs and tracker-corpus.test.mjs).
export const BUDGET_BEATS = 8;
/** from tc: the first sample within 1 % of B, and the start of the first run of BUDGET_BEATS beats locked within 1 % */
export function relockFigures(trace, tc, B) {
  const P = 60 / B, after = trace.filter(x => x.t >= tc), ok = x => Math.abs(x.bpm / B - 1) <= 0.01;
  const first = after.find(ok);
  let stable = null;
  for (let i = 0; i < after.length && stable === null; i++) {
    if (!(ok(after[i]) && after[i].state === 'locked')) continue;
    let j = i; while (j < after.length && ok(after[j]) && after[j].state === 'locked' && after[j].t - after[i].t < BUDGET_BEATS * P) j++;
    if (j < after.length && after[j].t - after[i].t >= BUDGET_BEATS * P - 0.1) stable = after[i];
    else if (j >= after.length && after.length && after[after.length - 1].t - after[i].t >= BUDGET_BEATS * P - 0.1) stable = after[i];
  }
  const fig = x => x ? { s: +(x.t - tc).toFixed(2), beats: +((x.t - tc) / P).toFixed(1) } : null;
  return { first: fig(first), stable: fig(stable) };
}
export const relockText = (label, f) => {
  const one = (name, x) => x ? `${name} ${x.beats} beats (${x.s} s)${x.beats > BUDGET_BEATS ? ' OVER' : ''}` : `${name} never OVER`;
  return `${label}: ${one('within 1 %', f.first)}, ${one('stable lock', f.stable)}`;
};
