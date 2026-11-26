# Two teams, one repo

Owner, 27 Nov. The user is moving the main coding to Claude Code on
his Mac (several sessions run side by side under herdr) and keeping
Puggie's agents on the box for testing and non-critical work. This
page says who owns what, so the two teams do not write over each
other. It applies from the day this file is merged.

## The one rule that makes it safe

**Every pull request gets the box's QA run before it is merged,
whoever wrote it.** The box is the gate for both teams. Nobody merges
their own work; the user merges.

## Who owns what

| Area | Owner |
|---|---|
| `beatd/` (the beat sources service and its plug-ins) | Mac builders |
| `experiments/clock.js`, `shared-link.js`, the conductor page, the controller code | Mac builders |
| Scenes, the scene kit, `experiments/slot.*`, `set.json` | Mac builders |
| `qa/conduct-serve.mjs`, `qa/beat-relay.mjs` | Mac builders |
| The QA runner, its checks and scripts (`qa/runner/`, `qa/check-*.mjs`, `qa/strip.mjs`, `qa/bakeoff*`) | Box |
| Scorers and reference tools (`qa/conduct-score.mjs`, `qa/ref-beats*`) | Box |
| The box's services (its runner, its conduct-serve, the private data folder) | Box |
| `tools/` start and check scripts | whoever the brief names |
| `docs/` briefs | the owner (reviewer) |
| Runbooks and guides in `docs/` | the team that built the thing described |
| `notes/` session notes | the show helper on the Mac |
| `experiments/clock-tracker.js` | nobody; closed |

- A file has one owner. To change a file you do not own, ask its
  owner through the user, or hand over a finding. A test for your own
  change may live under `qa/runner/test/`; that is not a change to
  the runner.
- **A task already started stays with the team that started it,**
  whatever the table says. Nothing is taken over half-done.
- Each brief names the owner of each task. A task with no owner named
  is not started; ask.

## Open work, by owner (27 Nov)

| Work | Owner |
|---|---|
| Beat sources, task 1: the comparison on recordings (#322) | Box |
| Beat sources, task 2: `beatd` skeleton and tracker plug-ins | Mac builders |
| Beat sources, task 3: the `ext` source and the conductor rows | Mac builders |
| Beat sources, task 4: scorer | Box |
| Beat sources, task 4: delay per source, CPU on the Mac | Mac session |
| Beat server, task 7: the show runs from the Mac | the team that has started it; else Mac builders |
| The beat and level row (check-pulse as a gate) | Box |
| The strip script for the look loop | Box |
| Automatic calibration | Mac builders, tests on the box |
| Filling the empty scenes, a backdrop layer | Mac builders, with the scene skill |
| Owner's brief: scene kit | Mac builders |
| Owner's brief: click tests, run files off main, truth in docs | Box |

## Branches and pull requests

- Mac builders' branches start with `mac/`. The box keeps its names.
- A PR says at the top which team wrote it and which brief task it
  serves.
- The box's test is queued the way it is today (the test label). The
  Mac team asks the user for it; it does not reach into the box.

## What does not change for the box

Its agents, its runner, its services and its rules
(`docs/AGENT_PUGGIE.md`) stay as they are. It loses no access. It
gains pull requests it did not write, to test like any other.

## The first step, and when to widen

The Mac builders start with one job: the `beatd` skeleton and its
plug-ins (a new folder, nothing shared). After it, the user compares
the two ways of working on three points: did it stay up, how long did
it take, how much of his attention did it need. The table above is
the plan if that goes well; if it does not, work goes back to the box
task by task.
