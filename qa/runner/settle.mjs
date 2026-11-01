// A finished build's final status (QA box, 1 Nov). qa/builds.mjs `finish` leaves a build whose gated rows all pass but
// that has no swipe run at status "running" / waiting on QA box (the old flow had QA box start the swipe by hand). The
// user's page and the reporter then show it as still running. The runner settles it right after `finish`, and once at
// start-up for builds left like that before this fix:
//   every gated row passes → ready, waiting on the user · any gated row fails → failed, waiting on dev
// Gated rows are the ✅/❌ rows of check.md (qa/builds.mjs gatesFromCheck); ℹ️ and ⚠️ rows are report-only and never
// reach b.gates, so they don't count either way.
export function settled(b) {
  if (!b || b.status !== 'running' || !b.finished || !Array.isArray(b.gates) || !b.gates.length) return null;
  return b.gates.every(g => g && g.ok) ? { status: 'ready', waitingOn: 'user' } : { status: 'failed', waitingOn: 'dev' };
}
