# cellular-viz — brief for 16 Nov: audition and the set release (box agents, while the user sets up Resolume)

Reviewer, 16 Nov. Tonight the user runs docs/MVP_RUNBOOK.md on the Mac
with Claude Code there (docs/RESOLUME_MAC_BRIEF.md). This brief is for
the agents on the box, for the same evening and the day after. It
covers steps 2 and 3 of the user's plan (15 Nov): pick the solid seven
scenes, and build a VJ set the way a DJ prepares a USB stick.

## Rules for tonight

- The tracker, clock.js and the hold code are closed. No change without
  a new finding from the user's own sitting.
- No new scenes. No change to how any scene looks: the user tunes the
  seven himself.
- Nothing merged to main that changes a page the user has open tonight
  (the three in set.json, the conductor, set.html, setup-check). Work
  on branches; merge after he reports the test run.
- No box test runs while the user plays tonight (they load the box that
  serves his tracks). Branches are pushed; the box runs them after his
  report.

## Task 1 — Audition page (so the user can pick seven with the controller in hand)

`experiments/audition.html`: every scene page in the folder as a row.
- Open: one scene in a window with the set defaults (`clock=shared`,
  `audio=line`, `in=BlackHole`), one at a time, next and previous by
  key and by two controller buttons. Use two of the free top buttons 3
  to 8 (CC 39 to 44). Top buttons 1 and 2 are hold and auto-hold (#239).
- Per row, facts the box already knows: has no-beat mode (yes or no),
  passes its beat-match row, frame time at 1080p from the last run,
  which knobs and buttons it declares (the module's own control tags;
  none declared is shown as none).
- Per row, the user's verdict: keep, maybe, drop, and a free note.
  Saved through conduct-serve to `sessions/audition-<stamp>.json`
  (not committed), downloadable.
- A filter: keep only. The count of keeps against the target of 7.
No ranking, no scoring by the page. The verdict is the user's.

## Task 2 — The set release (a tag the set is served from)

A release is a set the user has rehearsed, fixed so main can keep
moving under it.
- `set.json` version 2. Per scene, added: `controls` (which pot or
  button of knob row 1 spare slots and the top button row drives which
  declared control, with range and default), `resolume` (the NDI name,
  for example CV-16, and the layer), `notes` (the user's line for
  himself). Version 1 files still load.
- `tools/set-release.sh <name>`: checks the set (every page exists,
  every mapped control is declared by its scene, no two controls on one
  pot, every scene has no-beat mode or is marked accepted without it),
  then tags the commit `set/<name>` and writes `sets/<name>.json` (the
  resolved set with the commit hash).
- set-release.sh creates and pushes a git tag: VIZ dev or the user runs
  it, never a box agent on its own.
- conduct-serve gains `--set <name>`: serves `experiments/` from that
  tag (a git worktree under a temp folder), the tracks and sessions as
  now. The conductor and set.html show the release name and hash in
  the header, or "main (not a release)".
- Tests: version 1 loads; a set with a missing page, an undeclared
  control or a double-mapped pot is refused with the line that names
  it; a served release does not change when main changes.
The faders and knob rows 2 and 3 stay Resolume's (the bridge). This
brief maps only what the page owns.

## Task 3 — Tonight's report, when it arrives

The user sends the check's FAIL lines, the conductor log and the Mac
notes file (`~/cellular-viz-resolume-notes.md`). Then:
- score the log as usual, with hold presses and re-centres per track;
- one short report: what passed, the delay he saw between the
  conductor's beat flash and the projector, frame rate if he noted it,
  every step of the runbook that was wrong or missing;
- fix the runbook and mac-check.sh from that report, nothing else.

## Out of scope

The tracker and hold; new scenes; the host page (#85); the Bolt and
the lidar (their own brief when they arrive); Pro DJ Link.

## The user's gate

Later this week: the audition done with the controller, seven keeps,
their knobs mapped in a set.json he edited himself, one release tagged
and served, and twenty minutes played from that release with main
changed underneath and nothing on the projector changing.
