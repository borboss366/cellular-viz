# QA box run history

Every script I run on the box is kept here with its date (`YYYY-MM-DD-HHMM-name`), next to a `.sh` of the same name that runs it again.
- `.sh` + `.mjs` pairs: one-off probes, kept as they ran.
- `.sh` only: chains of repo checks (`qa/check-*.mjs`, `qa/run.mjs`); `*.snapshot.mjs` keep the check scripts as they were that day.
- Pages under test were unpacked to `/tmp/qN/…` from the PR branch named in the matching check report; to re-run on a newer build, re-unpack with `git archive origin/<branch> experiments | tar -x -C /tmp/qN/x`.
- Started 2026-10-25 16:30. Earlier one-off probes that day (13 Flow Lab wall-leak flux, fps-vs-iterations, default-fNat lock) were deleted after use; their results are in the follow-up sections of `qa/13-flow-lab/checks/*/check.md`.

## Builds log (from 2026-10-26)
Every check round is also a build in `qa/builds.json` (shown at http://192.168.8.164:8787/builds):
`node qa/builds.mjs start --page <page> --pr <n> --commit <sha>` when a commit lands (queued), `set --id <id> --status running` when the browser starts,
`finish --id <id> --check <check dir> [--swipe <url>]` at the end (failed → waiting on dev, ready → waiting on you), `merged` after merges.
`2026-10-26-1745-builds-backfill.sh` rebuilt the log for #53, #55, #56 and #57 from their check reports.
