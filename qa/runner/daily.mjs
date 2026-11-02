// Daily experiment runs on main (QA box, #95 6564383139): a merged PR's experiment file has no new heads, so nothing
// re-runs it, but a flip from report-only to hard needs clean builds on several days (the 7 #159 audio gates on 8 Nov
// need >= 3 between 2 and 8 Nov). The list is qa/runner/daily.json (trusted, next to runner.mjs, so update-runner.sh
// brings changes and nobody edits the box's env file): {"experiments": [159], "fromUtc": 8, "toUtc": 20}. The env keys
// DAILY_EXPERIMENTS / DAILY_FROM_UTC / DAILY_TO_UTC override it. The runner queues qa/experiments/<N>.json at main's
// head once a UTC day, inside the window (default 08..20, clear of the ML jobs at about 21:00Z and 04:00Z). The build is kind "daily" (id daily-159-1, -2, …), so it never counts as a round of the PR,
// never settles the PR to merged and never asks for a swipe. Pure helpers here; runner.mjs does the queueing.

/** DAILY_EXPERIMENTS → PR numbers ("159, 160" → [159, 160]); anything else is ignored */
export function parseDaily(s) {
  return [...new Set(String(s || '').split(',').map(x => x.trim()).filter(x => /^\d+$/.test(x)).map(Number).filter(n => n > 0))];
}
/** an hour 0–23 from the env, or the default */
export const hourOf = (s, d) => (/^\d{1,2}$/.test(String(s ?? '').trim()) && +s >= 0 && +s <= 24 ? +s : d);

/**
 * the PRs whose daily run is due now: in the window, not run (queued) yet today, not already queued or running.
 * done: {pr: 'YYYY-MM-DD'} of the last UTC day each was queued. → [pr]
 */
export function dailyDue({ prs, now = new Date(), done = {}, from = 8, to = 20, busy = [] }) {
  const h = now.getUTCHours(), day = now.toISOString().slice(0, 10);
  if (h < from || h >= to) return [];
  return (prs || []).filter(pr => done[pr] !== day && !busy.includes(pr));
}
export const dayOf = (now = new Date()) => now.toISOString().slice(0, 10);

/** the daily list and window: env keys win over the file's; a missing or broken file means none */
export function dailyConfig(fileText, env = {}) {
  let f = {};
  try { f = JSON.parse(fileText || '{}') || {}; } catch {}
  const list = env.DAILY_EXPERIMENTS !== undefined && env.DAILY_EXPERIMENTS !== '' ? env.DAILY_EXPERIMENTS
    : Array.isArray(f.experiments) ? f.experiments.join(',') : '';
  return { prs: parseDaily(list), from: hourOf(env.DAILY_FROM_UTC, hourOf(f.fromUtc, 8)), to: hourOf(env.DAILY_TO_UTC, hourOf(f.toUtc, 20)) };
}
