# Experiment files: what the QA runner does for a PR

A PR that needs QA carries one file, `qa/experiments/<PR number>.json`, and gets the label **`qa-ready`**.
The runner on the box picks it up by itself: no command names the PR, so QA box never types a new command for it.

```
dev pushes the PR + qa/experiments/57.json, adds the label qa-ready
        │
runner (systemd on the box) polls the open PRs ──▶ label qa-ready + new head commit ──▶ queued
        │
        ├─ GPU gate: one GPU job at a time on the box, and only once gpu_busy_percent is idle
        ├─ validate qa/experiments/57.json (errors → a failed build that lists them, waiting on dev)
        ├─ measured runs: every variant × sweep value × resolution in headless Chromium
        ├─ check scripts named in "checks" (from CHECKS_REF, never from the PR)
        ├─ swipe recording, old vs new, for the grading page (optional)
        └─ qa/<id>/runs/<YYYY-MM-DD-HHMM>-pr57/: check.md, report.md, results.json, stills/, debug/, checks/
           + a build in qa/builds.json (failed → waiting on dev, passed → waiting on QA box, or on the user with a swipe run)
```

A new commit on a labelled PR runs again. Changing the file (a gate, a debug probe) is a new commit, so it runs again too.
Check a file before pushing: `node qa/runner/experiment.mjs qa/experiments/57.json`.

## The format (version 1)

| field | default | what |
|---|---|---|
| `version` | required | `1` |
| `id` | required | the `qa/<id>/` folder the results go to, like `"18-little-bang"` |
| `page` | `id` | `experiments/<page>.html` |
| `note` | | one line for the report |
| `params` | `{}` | URL settings for every run: `{"scene": "collide"}` → `?scene=collide` |
| `resolutions` | `["1080p"]` | `720p`, `1080p`, `1440p`, `4k` or `[width, height]` |
| `warmup` | `4` | seconds after load and Play before measuring |
| `seconds` | `12` | measured seconds per run; `0` = no measured runs (checks and swipe only) |
| `play` | `true` | press `#play` after load |
| `variants` | one `default` | `[{"name": "quench", "params": {"scene": "quench"}}]`, params on top of `params` |
| `sweep` | | `{"n": [150000, 1000000]}`: every value becomes a variant of every variant (`collide_n-150000`) |
| `values` | `{}` | page expressions read at the end of each run: `{"crossings": "__qa.crossings"}` → metric `value.crossings` |
| `gates` | `[]` | pass/fail bars, below |
| `checks` | `[]` | check scripts to run: `["check-18"]` or `[{"script": "check-18", "args": ["--fast"]}]` |
| `record` | `{"stills": 1}` | stills per run (0–4), taken after the measured window |
| `swipe` | off | `{"vs": "<older sha>" or "base", "seconds": 40, "warmup": 4, "variants": [names]}` |
| `debug` | `{}` | debug probes, below |
| `timeoutMin` | runner's | stop the whole experiment after this many minutes |

Unknown fields are errors, so a typo never passes silently. At most 64 runs (variants × sweep × resolutions).

### Gates

`{"metric": "<metric>", "min": n, "max": n, "equals": x, "variant": name(s), "resolution": r(s), "name": "own label"}`.
A gate holds on every run it applies to (all runs, or only the `variant` / `resolution` named; a sweep variant also
answers to its parent's name). The report shows the value of every run and which ones failed.

| metric | what |
|---|---|
| `fps` | average frames per second over the window |
| `fps.p05` | 1000 / 95th-percentile frame time: the slow end |
| `frameMs.p95`, `frameMs.max` | frame times, ms |
| `longFrames` | % of frames over 20 ms |
| `clip` | % of pixels with any channel ≥ 254, worst sampled frame (canvas copied right after the page draws, up to 16 s) |
| `clip.mean` | the same, mean over the sampled frames |
| `errors` | page errors + `__qa.errors` |
| `gpuBusy` | GPU busy % before the run's page opens: the lowest of 6 readings over 3 s, so the previous run's tail doesn't count |
| `value.<name>` | a number or value from `values` |

Each check script's own ✅/❌ rows become gates too, named `check-18: <its gate>`. A script that doesn't finish,
or isn't on the checks ref, is a failed gate.

### Check scripts: who writes what

QA box writes `qa/check-NN.mjs` on its QA branch (today `qa/headless-runner`, the runner's `CHECKS_REF`); they ride its
one push. The runner fetches `CHECKS_REF` at the start of **every** build, so a new or changed check script is used by
the next run without updating the runner. The experiment file only names it. A PR can never bring its own check
script: the PR's `qa/` folder is never run.

### Swipe

`"swipe": {"vs": "2ed06a0"}` records the old commit's pages and the PR head's pages through `qa/run.mjs`
(`old-<variant>` and `new-<variant>`, `seconds` each) into one run folder, `qa/<id>/runs/<stamp>-pr<N>-swipe/`, which
the grading page at :8787 opens as `/run/<id>/<stamp>-pr<N>-swipe/compare`. `vs` is any commit in the PR's history or
on main (7–40 hex), or `"base"` for where the PR left main. Without `vs` only the new pages are recorded.
With a swipe run and every gate passed, the build waits on the user.

### Debug probes

When QA box needs to see more, it adds a probe to the PR's experiment file (a commit, so a new run), never a command
on the box. Each probe writes into the run folder's `debug/`.

| probe | setting | writes |
|---|---|---|
| `console` | `true` | `<run>-console.log`: console messages, page errors, failed requests |
| `screenshotAt` | `[2, 8]` seconds into the window | `<run>-t2.png` |
| `screenshotAtFrame` | `[120]` frames since load | `<run>-f120.png`, the canvas right after the page drew that frame |
| `gpu` | `true` | `gpu.json`: WebGL vendor, renderer, limits, extensions, Chromium version (headless can't open `chrome://gpu`) |
| `frameTimes` | `true` | `<run>-frames.json`: every frame time of the window |
| `qaDump` | `{"every": 0.5, "read": {"cam": "__qa.camera(__qa.bars)"}}` | `<run>-qa.jsonl` |
| `gpuBusy` | `{"every": 1}` | `<run>-gpu-busy.jsonl` |
| `trace` | `true` | `<run>-trace.json`, a Chromium performance trace (Perfetto) |

A probe that isn't here yet is one new entry in `qa/runner/probes.mjs` (with `check` for its setting and the hooks it
needs: `init`, `start`, `tick`, `end`, `done`), one row in this table and a test: a small runner PR. Nothing else changes.

## Example

[`example.json`](example.json): 18 Little Bang's white-blob fix (#49) as an experiment: three variants at 1080p and 4K,
a clip gate on collide and quench, a speed gate on collide and quench at 1080p (1M tracks really runs at ~16 fps), no errors, an idle GPU, `check-18`, and a 40 s swipe run
against the old collide commit.
