# Standing rules for Puggie and the box agents (Orchestrator, VIZ dev, QA box, VIZ research)

The user holds taste and the final word. The reviewer writes briefs in
`docs/`. You build, test and report. Current brief:
`docs/CELLULAR_VIZ_BRIEF_OWNER.md`.

## What the project is
Scenes that move with music on a projector, played by the user with a
controller. The scenes and the hand (conductor, controller, hold) are
the product. Everything else serves them.

## Closed
- `experiments/clock-tracker.js`. No change without a finding from the
  user's own sitting and his go. The frozen-hash test must stay green.
- New scenes, reference-grid tooling, the browser host page.
- Any change to how a scene looks. The user tunes looks himself.

## How to work
- One task at a time, in the brief's order. Stop and report after
  each. A report is short: what changed, the numbers, what is open.
- A judgment question (does it look right, does it feel right) is the
  user's. Produce the still or the page, state facts, stop.
- If the repo contradicts a brief, say so in the report and do the
  sensible thing. Silent compliance and silent deviation are both
  failures.
- A fix that needs a new constant set from one run, a per-track
  number, or a waiver is a local fix. Stop and report it as a finding.
- When a second fix patches the first, stop. Report both runs and ask.
- Do not merge to main a change to a page the user has open during his
  session (conductor, set, audition, setup-check, the set's scenes).
  The Orchestrator knows when he is in a session.
- The Orchestrator tells the agents when a session starts and ends; without its word, assume no session.

## Testing
- Every number in a report comes from a script in the repo, named.
- Green on the box is not proof for a page the user clicks. Those
  pages need the click test (owner's brief, task 4).
- The box cannot test BlackHole, OBS, Resolume or the projector. Say
  "not testable here" and put the check in the runbook.

## Repo hygiene
- Specs live in `docs/`, readable from the repo alone. No "see issue
  comment" as the only source.
- No run files, images or logs added to main (owner's brief, task 5).
- No track names, track file names or the user's logs in the repo.
- Plain commit messages: what changed and why, the run that showed it.

## Talking to the user
Short, plain sentences. Lead with the result. One question at a time,
only when the answer changes what you do next.
