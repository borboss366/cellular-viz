// Swipe runs for the grading page (1 Nov): every green experiment build should give the user a swipe to grade.
//   - an experiment file without "swipe" gets a default one (the first variant, new vs the base page, 30 s); a brand-new
//     page has no base page, so its swipe shows the new side only. A default swipe that fails is a note, never a fail.
//   - qa/swipe-ready.sh asks the runner for a swipe on builds that finished green without one (e.g. #155 before this);
//     the runner runs a swipe-only experiment at the build's commit and finishes the same build with the swipe.
// Pure helpers here, so qa/runner/test/swipe.test.mjs can test them without a box.
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_SWIPE = { vs: 'base', seconds: 30, warmup: 4 };

/** the default swipe for a raw experiment file: its first variant (or "default"), new vs the base page */
export function defaultSwipe(raw) {
  const first = raw && Array.isArray(raw.variants) && raw.variants.length && raw.variants[0] && raw.variants[0].name;
  return { ...DEFAULT_SWIPE, variants: [first || 'default'] };
}

/** an experiment file reduced to its swipe: no measured runs, gates, checks, probes or shared passes; audio jobs
 *  become plain page runs (the swipe records the picture only) */
export function swipeOnlyRaw(raw) {
  const out = { ...raw, seconds: 0, gates: [], checks: [], values: {}, debug: {}, swipe: raw.swipe || defaultSwipe(raw) };
  delete out.shared; delete out.audio;
  if (out.kind === 'audio') out.kind = 'both';
  return out;
}

const green = b => Array.isArray(b.gates) && b.gates.length > 0 && b.gates.every(g => g && g.ok);
// how long after it finished a merged build can still get its swipe (e.g. #155, merged before swipe-ready.sh ran)
export const MERGED_DAYS = 3;
// an experiment build's run folder (runner: <page>/runs/<stamp>-pr<N>); page builds (<page>/checks/<stamp>) have no
// experiment file to reduce to a swipe, so the swipe-only job would only fail on them
const expReport = b => /\/runs\/[^/]+-pr\d+\/check\.md$/.test(String(b.report || ''));
/** builds (latest line per id) → the newest round of each PR that finished green on a real page without a swipe:
 *  ready or still "running" (open PRs), or merged within MERGED_DAYS (the user still grades a merged page) */
export function swipeCandidates(builds, { now = Date.now() } = {}) {
  const newest = new Map();
  for (const b of builds) {
    if (!b || !b.pr) continue;
    const cur = newest.get(b.pr);
    if (!cur || String(b.started || b.at || '') > String(cur.started || cur.at || '')) newest.set(b.pr, b);
  }
  const recent = b => now - Date.parse(b.finished) <= MERGED_DAYS * 864e5;
  return [...newest.values()].filter(b => (['ready', 'running'].includes(b.status) || (b.status === 'merged' && recent(b)))
    && b.finished && green(b) && !b.swipe && /^\d\d-[a-z0-9-]+$/.test(String(b.page || '')) && expReport(b));
}

/** a swipe request for the runner: <state>/swipe-requests/<pr>.json (the runner takes and deletes it at its next poll) */
export function writeRequest(stateDir, b) {
  const dir = path.join(stateDir, 'swipe-requests');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${b.pr}.json`), tmp = `${f}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify({ pr: b.pr, id: b.id, commit: b.commit, page: b.page, report: b.report, at: new Date().toISOString() }) + '\n');
  fs.renameSync(tmp, f);
  return f;
}
/** the requests waiting in <state>/swipe-requests, each removed as it is read: [{pr, id, …}] */
export function takeRequests(stateDir) {
  const dir = path.join(stateDir, 'swipe-requests'), out = [];
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)); } catch { return out; }
  for (const f of files) {
    const p = path.join(dir, f);
    try { out.push(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch {}
    fs.rmSync(p, { force: true });
  }
  return out;
}
