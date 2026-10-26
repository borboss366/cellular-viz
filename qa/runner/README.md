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

## What it does

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
