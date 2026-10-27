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

Always the same strings, so each needs approval once (RUNNER_HOME is the runner's own clone of main):

```
sh <RUNNER_HOME>/qa/update-runner.sh     # pull the runner's clone + kill -TERM the runner; systemd starts the new code
sh <RUNNER_HOME>/qa/run-next.sh          # one round without the service: poll once, run the queue, exit
git -C /home/puggie/pi-durable-worker/data/scratch/c14/cellular-viz push -q     # on its own, as today
```

Nothing about which PR to run is on a command line: the runner finds the work itself (below). Both scripts read
`~/.config/cellular-viz-runner.env` inside the container if it is there (`RUNNER_ENV` points elsewhere); `run-next.sh`
needs it for `QA_HOME`. No ad-hoc probing on the box: a probe QA box needs is a field in the PR's experiment file
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
