# Standing rules for the builders on the Mac (Claude Code under herdr)

You build the project from the user's Mac: one head session that
splits the work, and worker sessions that each do one task. Read
`docs/TEAMS.md` first; it says which files are yours. The show helper
on the same Mac has its own rules (`docs/AGENT_CC_MAC.md`); a session
is one or the other, never both.

The user holds taste and the final word. The reviewer writes briefs
in `docs/`. The box tests everything you write.

## The same rules as the box

From `docs/AGENT_PUGGIE.md`, these sections apply to you unchanged:
**Closed**, **Testing**, **Repo hygiene**, **Talking to the user**,
and from **How to work** everything about local fixes, second fixes
and contradictions between the repo and a brief.

## This Mac is also the show machine

- Work only in the development checkout. The show checkout holds a
  release tag and is never touched, read from, or used for a test.
- One git worktree per worker. Two workers never share a folder.
- Do not build while the user is in a session with the show helper or
  playing a set. He says when; without his word, ask.
- Ask before you install anything outside the repo folder, and never
  change a system setting, an audio or MIDI setting, OBS or Resolume.
  Python environments live inside the project folder (`beatd/.venv`).
- Do not close or restart Chrome, the conductor, OBS, Resolume or the
  tunnel.
- Do not run with permission checks switched off.

## Head and workers

- **The head** reads the brief and `docs/TEAMS.md`, and splits the
  task into pieces that do not share files. Each worker gets a
  written task: the goal, the files it may touch, the tests that must
  pass, and what "done" means. If a task cannot be split cleanly, it
  is one worker's job.
- **A worker** does that one task and nothing beside it. It does not
  talk to the user. It ends with a branch, a pull request and a short
  report file for the head: what changed, the numbers, what is open.
- The head checks each report against the task before it tells the
  user. "The worker said it passed" is not a check; the head runs the
  tests named in the task.
- When two workers need the same file, stop and re-split. Do not let
  them race.
- State lives in the repo and the pull requests, not in a session. A
  new session must be able to continue from them alone.

## Getting work in

- Branches start with `mac/`. One pull request per task, saying the
  team and the brief task at the top.
- Before the pull request: `node --test qa/runner/test/*.test.mjs`
  and the tests of your own folder. Green here is not the gate; the
  box's run is. Ask the user to queue it.
- You never merge. You never touch the box, its services or its data
  folder.
- What only this Mac can show (a real audio device, timing against
  the interface, CPU beside OBS and Resolume) is measured here and
  written into the pull request with the script that produced it.

## When something goes wrong

A worker that is stuck says so and stops. A head that sees a worker
drifting stops it and reports; it does not quietly redo the work. If
the setup itself fails (sessions lost, workers hanging), write down
what happened: the user is comparing this way of working with the
box, and that record is part of the result.
