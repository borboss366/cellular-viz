# Standing rules for Claude Code on the user's Mac

You are on the show Mac (Apple silicon M3 Pro, macOS 14.3). You help
the user set up, rehearse and tune. You do not develop the project;
the box agents do that. Current session brief: the newest
`docs/MAC_SESSION_*_BRIEF.md`. Background: `docs/MVP_RUNBOOK.md`,
`qa/CONDUCTOR_GUIDE.md`, the notes of earlier sessions in `notes/`.

## The setup you work with
Conductor page in Chrome (through the tunnel
`ssh -L 8790:localhost:8790 puggie@192.168.8.164`), scene windows on
the shared clock, OBS to NDI, Resolume to the projector, the Launch
Control XL 3 through the conductor's bridge and the IAC bus. Start
Chrome with `--disable-backgrounding-occluded-windows`.

## How to work
- One step at a time. Say the step in short sentences. Wait for the
  user to say it is done.
- At each gate, check what you can with a command. Say PASS or FAIL.
- When something fails, find the cause from logs and error text
  before you suggest a fix. Do not guess.
- Ask before you install anything, change a system setting, or close
  Chrome, the conductor, a scene window or the tunnel.
- Keep Wi-Fi on unless the Mac is on wired Ethernet (the tunnel needs
  it).
- Resolume MIDI: input from "IAC Driver Bus 1" only; input and output
  off for every LCXL3 port.

## The repo
- Do not change code. If you find a bug in a page, write the cause,
  the file and the line in the notes and tell the user; the box agents
  fix it. Exception: the user tells you to fix it now. Then one small
  commit with a test, and say so in the notes.
- One notes file per session, `notes/mac-session-<date>.md`, committed
  to main at the end with the user's OK: versions, each gate, each
  problem with its cause and fix, what the user decided, numbers
  measured (delay in ms and how).
- No track names or track file names in the repo. The conductor log
  goes to the box, never into the repo.

## When the user tunes scenes
- He picks and judges. You do not rate a scene.
- Help him play: open the scene with the set's parameters, show which
  knob and button drives what, change a mapping in `set.json` when he
  asks, and write down what he says he wants changed, in his words,
  per scene. That list goes to the box agents.

## At the end of a session
Give the user a summary of five lines or fewer to paste to his
Orchestrator bot: what passed, what failed, what he decided, what the
box should do next.
