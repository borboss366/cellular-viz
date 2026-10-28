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
