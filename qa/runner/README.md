# QA runner (systemd service on the box)

Runs the page checks by itself: no commands from chat, no approval cards, and it survives reboots.

```
GitHub (read only, anonymous)          the box
  open PRs ──poll every 2 min──▶  runner.mjs ──▶ git fetch PR head + trusted checks ref
                                       │          experiments/ from the PR, qa/ from CHECKS_REF
                                       ├──▶ node qa/check-NN.mjs --experiments <PR pages>   (headless Chromium)
                                       ├──▶ qa/builds.mjs start / set running / finish     → qa/builds.json → /builds
                                       └──▶ GET-only API: /health /api/status /api/builds /api/log
```

## The three commands QA box types

All of them run inside Puggie's worker container (QA box's shell). `update-runner.sh` refuses on the host (exit 2, nothing
pulled); from the host use `podman exec --env-file ~/.config/cellular-viz-runner.env pi-durable-worker sh <RUNNER_HOME>/qa/update-runner.sh`.

Always the same strings, so each needs approval once (RUNNER_HOME is the runner's own clone of main):

```
sh <RUNNER_HOME>/qa/update-runner.sh     # pull the runner's clone + kill -TERM the runner; systemd starts the new code
sh <RUNNER_HOME>/qa/run-next.sh          # one round without the service: poll once, run the queue, exit
git -C /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz push -q     # on its own, as today
```

Two more fixed scripts exist for the rare case something is left over; the runner already does both after every build:
`sh <RUNNER_HOME>/qa/board-sync.sh` (board moves, replaces `qa/board.py`) and `sh <RUNNER_HOME>/qa/commit-reports.sh`
(commits changed .md/.json reports, never pushes).

More, each run alone, no arguments, no pipes (so the judge sees the same string every time):

```
sh <RUNNER_HOME>/qa/status.sh          # read only: runner /health + /api/status (now, queue, last 3 with each build's
                                       # current status), last 10 log lines, viewer HTTP codes for / and /builds, gpu_busy_percent
sh <RUNNER_HOME>/qa/swipe-ready.sh     # ask the runner for a swipe on every build that finished green without one (it records
                                       # them at its next poll and the builds land on the grading page; experiment builds
                                       # only, open PRs and PRs merged in the last 3 days). Experiment files
                                       # without "swipe" get a default one (first variant, new vs base, 30 s) from now on.
sh <RUNNER_HOME>/qa/emit-test-event.sh # write one "test" event into QA_EVENTS_DIR (the runner writes finished / discarded /
                                       # waiting / error events there for QA box's folder trigger)
```

Daily runs on main (no script): the runner re-runs each experiment file listed in `qa/runner/daily.json` once a UTC
day at main's head, inside its daytime window (08–20 UTC, clear of the ML jobs). They are builds of kind `daily`
(`daily-159-1`, `-2`, …): never a round of the PR, never settled to merged, no swipe. `DAILY_EXPERIMENTS`,
`DAILY_FROM_UTC` and `DAILY_TO_UTC` in the env override the file.

```
sh <RUNNER_HOME>/qa/commit-checks.sh   # in QA_HOME: commit only qa/check-*.mjs, todo.json, builds.json and the .md/.json
                                       # reports as "QA box"; never videos/screenshots, never pushes; nothing changed = no-op
sh <RUNNER_HOME>/qa/test-pr.sh         # PR from ~/.cache/cellular-viz-runner/test-pr, else newest open PR labelled
                                       # runner-test: /tmp/test-pr clone, node --check qa/runner/*.mjs + node --test; PASS/FAIL
```

`board-sync.sh` prints at most 8 lines (failures first) and a count; `node qa/runner/board.mjs sync --verbose` prints all.
The viewer (`qa/serve.mjs`) is code like the runner: bugs go to VIZ dev as PRs, and `update-runner.sh` restarts it.

Nothing about which PR to run is on a command line: the runner finds the work itself (below). Both scripts read
`~/.config/cellular-viz-runner.env` inside the container if it is there (`RUNNER_ENV` points elsewhere). Otherwise
`run-next.sh` uses `RUNNER_STATE/runner.env`, the copy of its settings the service writes every time it starts
(the host's env file isn't visible in the container), so no copy by hand is needed. No ad-hoc probing on the box: a probe QA box needs is a field in the PR's experiment file
(`debug`, see `qa/experiments/README.md`), and a probe that doesn't exist yet is a small runner PR.

## Experiments: PRs labelled `qa-ready`

A PR labelled `qa-ready` (`RUNNER_LABEL`) carries `qa/experiments/<PR>.json`, its experiment file. Format, gates, swipe
and debug probes: [`qa/experiments/README.md`](../experiments/README.md). For every new head commit of such a PR the
runner validates the file, then runs it with its own measuring code (`exp-run.mjs`, `experiment.mjs`, `probes.mjs`,
`gpu.mjs`, copied from this clone, never from the PR or the checks ref) and the check scripts it names (from
`CHECKS_REF`). Results go to `qa/<id>/runs/<YYYY-MM-DD-HHMM>-pr<N>/` in QA box's tree (`check.md`, `report.md`,
`results.json`, `stills/`, `debug/`, `checks/`, `gpu-gate.json`), the swipe run to `qa/<id>/runs/<stamp>-pr<N>-swipe/`,
and the build to `qa/builds.json` (start → running → finish, with `--swipe` when there is one).
Pass or fail is in `state.json` (`recent`) and `/api/status`.
Unlabelled PRs keep the page checks below.

## Viewer at :8787 (a service too)

`cellular-viz-viewer.service` only starts and stops the fixed script `qa/runner/viewer.sh` from RUNNER_HOME (main's
clone) inside the container, with `Restart=always`; the unit holds no logic, so it never changes. `viewer.sh` runs
main's `qa/serve.mjs` on QA box's data in QA_HOME (`QA_HOME` tells serve.mjs and builds.mjs where the runs, grades and
builds are), so the viewer only runs merged code. It first stops a viewer started some other way (the old `nohup` one)
and a stale socket, then writes `RUNNER_STATE/viewer.pid`. The socket is `VIEWER_SOCKET`, by default `qa-viewer.sock`
next to `RUNNER_SOCKET`, so the host's existing :8787 forward keeps working. `update-runner.sh` restarts the viewer
as well, so a merged change to `serve.mjs` is live after one update.

Install once on the host (the user, no sudo), like the runner unit:

```
cp /home/puggie/pi-durable-worker/data/cellular-viz-runner/qa/runner/cellular-viz-viewer.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now cellular-viz-viewer
```

Check it took: `systemctl --user status cellular-viz-viewer` is active, http://192.168.8.164:8787/builds answers,
and `update-runner.sh` prints `stopped viewer <pid>` and the page is back within a few seconds.

## After each build (the runner, not QA box)

1. **Builds log:** `qa/builds.mjs` start → running → finish `--check <dir>` [`--swipe <url>`], and merged when the PR merges.
2. **History:** `qa/history/<YYYY-MM-DD-HHMM>-runner-pr<N>-<page>.md` (build, result, report, swipe, GPU readings) and the
   same-name `.sh` with every command the runner ran for it, in order.
3. **Reports commit** (`RUNNER_COMMIT=1`): a local commit in QA_HOME of only that build's `.md`/`.json` files, the history
   entry and `qa/builds.json` (no stills, no videos). Other staged work in QA_HOME stays staged. The message comes from
   the results: `qa: #57 25-shape-shifter-2 @e046b75 failed 13/15 (viz-57-7)`, then the failed gates and where the
   report is. It never pushes: QA box's push command sends it.
4. **Board** (`RUNNER_BOARD=1`, `board.mjs`, with the box's gh login): the latest build of each open PR moves its card
   (queued/running → QA, failed → In progress, ready → Your review, merged → Done); closed items → Done; open items not
   on the board → Ideas. Each build moves a card once (`RUNNER_STATE/board.json`), so a card moved by hand stays put
   until the PR's next build. The first sync (no board.json yet) only records the builds there are and moves no card
   for them. A failure that is only "no check script for this page" moves nothing (that is QA box's gap, not dev's),
   nor does a queued/running build older than `RUNNER_TIMEOUT_MIN` that never finished; a finished "running" build
   (every gate passed, swipe run to come) counts as Your review.

The commit uses QA_HOME's git identity, or `RUNNER_GIT_NAME` / `RUNNER_GIT_EMAIL` (default `QA box`,
`qa-box@puggie.local`) when it has none. If the commit fails, what it staged is unstaged again.

A failed step is logged and never fails the build.

## GPU gate

Before every build (both kinds) the runner takes the box's GPU lock (`GPU_LOCK`, one GPU job at a time, whoever runs it)
and waits until `gpu_busy_percent` stays at or under `GPU_IDLE_MAX` % for `GPU_IDLE_SECS` readings in a row. The readings
go with the result (`gpu-gate.json` and an ℹ️ row in `check.md`). If the GPU stays busy for `GPU_WAIT_MIN` minutes
nothing is measured: the job stays queued and is tried again after the next poll, and `/api/status` shows why (`gpu`).
Each measured run also records `gpuBusy` just before its page opens, so an experiment can gate on it.

Tests (no browser, no network): `node --test qa/runner/test/*.test.mjs` (Node 22 does not search a folder given to `--test`).

## What it does (unlabelled PRs)

1. Every `RUNNER_POLL` seconds it lists the open PRs (ETag, so an unchanged list costs nothing).
2. For a PR with a new head commit, from an allowed author and a branch in this repo, it reads which
   `experiments/NN-*.html` the PR touches and queues one build per page. A newer commit replaces a queued older one.
3. One build at a time:
   - fetch `refs/pull/N/head` and `CHECKS_REF` into its own clone
   - take `experiments/` from the PR commit and `qa/` from `CHECKS_REF`
   - run the page's check (`qa/runner/checks.json`, else `check-NN.mjs` by page number)
   - copy the result folder into QA box's tree and finish the build with `builds.mjs`:
     - failed → waiting on dev
     - all gates passed → waiting on QA box for the swipe run, then ready
4. When a PR is merged, its builds are marked merged.

QA box keeps the parts that need taste or a push: swipe runs, rulings, the one push at ready-to-merge.
QA box's own commit watcher should stop once this runs, so no commit is checked twice (the runner also skips a commit
that already has a build for that page).

## Guard rails

- **Check scripts never come from the PR.** A PR can change `qa/check-*.mjs`, so the runner takes `qa/` from
  `CHECKS_REF` (QA box's `qa/headless-runner` until #20 is merged, then `main`). Only the PR's pages run, inside
  the browser sandbox.
- **No forks, allowed authors only** (`RUNNER_AUTHORS`).
- **No token.** It reads GitHub anonymously and never pushes.
- **Read-only API** on 127.0.0.1 or a Unix socket. Nobody can send it commands.

## Install (once, on the host)

After #59 is merged, as your normal user on the box (over SSH):

```
loginctl enable-linger $USER                                           # user services start at boot and survive logout
cp qa/runner/cellular-viz-runner.service ~/.config/systemd/user/
cp qa/runner/runner.env.example ~/.config/cellular-viz-runner.env      # fill in the paths
systemctl --user daemon-reload && systemctl --user enable --now cellular-viz-runner
```

Check it took:

- `systemctl --user status cellular-viz-runner` says active (running)
- `journalctl --user -u cellular-viz-runner -f` shows `runner up: …` with no errors after it
- the next commit on an open PR appears on `/builds` as queued, then running, with nobody touching anything

Only then does QA box switch its own commit watcher off, so there is no gap where nobody checks commits.

It restarts itself: `Restart=always` every 30 s with no start limit, so a crash mid-check, a reboot or the
container restarting heals by itself instead of leaving the pipeline stopped.

Updates need no host step: inside the container, `git -C $RUNNER_HOME pull`, then
`kill -TERM "$(cat $RUNNER_STATE/runner.pid)"`; systemd starts the new code 30 s later.
A dry run next to the service needs its own state folder (`--once --state /tmp/runner-dry`); with the
service's folder `--once` refuses, so it can never stop the service's runner.

A crash exits with code 70 and shows as Failed in `systemctl --user status` (exit 1 and 143 count as a clean stop,
because that is what `podman exec` reports when systemd stops it); `runner.log` has the stack.

A change to the unit file itself (rare) is a host step: copy it again to `~/.config/systemd/user/`, then
`systemctl --user daemon-reload && systemctl --user restart cellular-viz-runner`.

Optional API from the host or the LAN: `cellular-viz-runner-api.socket` + `.service` (systemd-socket-proxyd,
as for the 8787 viewer), then `curl http://127.0.0.1:8788/api/status`.

Try one round by hand first, inside the container: `node qa/runner/runner.mjs --once` (polls once, runs the queue, exits).

## API (GET only)

| path | what |
|---|---|
| `/health` | `{ok, running, queued}` |
| `/api/status` | settings, last poll, GitHub rate left, the running build, the queue, the last 30 results |
| `/api/builds` | the latest line of every build in `qa/builds.json`, newest first |
| `/api/builds/<id>` | every line of one build |
| `/api/log?lines=200` | the runner's log tail |
