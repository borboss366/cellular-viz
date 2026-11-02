// The runner's job queue, kept pure so it can be tested without a box (qa/runner/test/queue.test.mjs).
// A job is { pr, page, sha, kind?, … }; one job per PR and page: a newer commit replaces the queued older one
// in its place, so a PR whose head moves while its jobs wait (at the GPU gate overnight, #94) keeps its turn.

/** Put job in the queue. → { queue, replaced: the job it replaced or null }. Same PR and page = same slot. */
export function putJob(queue, job) {
  const i = queue.findIndex(j => j.pr === job.pr && j.page === job.page);
  if (i < 0) return { queue: [...queue, job], replaced: null };
  const next = queue.slice();
  const replaced = next[i];
  next[i] = job;
  return { queue: next, replaced };
}

/** true when job is no longer the queued job for its PR and page (replaced by a newer commit, or dropped). */
export const superseded = (queue, job) => !queue.includes(job);

/**
 * Settle (#183, 2 Nov: an empty commit and the real one pushed a minute apart; the runner started the first at once
 * and built it as viz-183-14): a PR job may start only once it has been queued for settleMs, so a newer push within
 * that time replaces it in the queue first (putJob). → ms still to wait (0: go). Daily runs and swipes never wait.
 */
export function settleLeft(job, now, settleMs) {
  if (!job || job.daily || job.kind === 'swipe' || !(settleMs > 0)) return 0;
  const at = Date.parse(job.at);
  return Number.isFinite(at) ? Math.max(0, at + settleMs - now) : 0;
}
