# cellular-viz — brief: the apartment MVP (scenes + conductor + Resolume on the Mac)

Reviewer, 10 Nov. What the agents build so the user can run a set this
week: the conductor page as his DJ deck, three scenes on the projector
blended in Resolume, his hand on the clock. The tracker stays frozen.
The controller brief (probe page, DAW mode) waits; tonight Resolume owns
the Novation in standalone mode through its own MIDI-learn.

## The setup the code must serve (the user's side, no code)

Mac. BlackHole 2ch + a Multi-Output Device (speakers + BlackHole) as the
system output. Conductor page via the tunnel (`?clock=line:page`) plays
the tracks. Scene pages listen to BlackHole. Resolume Avenue takes the
Chrome windows as NDI (OBS + DistroAV) or Syphon sources, blends them,
owns the projector and the blackout. Tracks stay on the box.

## Task 1 — One clock for every scene: `?clock=shared`

Today each scene page runs its own tracker on the cable, so a hand fix
on the deck reaches the deck's click and not the scenes. Conductor and
scenes are served from the same origin, so:
- The conductor page publishes its OUTPUT clock on a `BroadcastChannel`
  (`cellular-viz-clock`): at ≤ 20 Hz `{ t, beats, bpm, phase, bar,
  confidence, state, offsetMs }` in AudioContext-independent terms
  (`performance.now()` stamped, with the deck's audio-time mapping), plus
  every jump and fix as events.
- `clock.js` gains source `shared`: a receiver that steers the flywheel
  from those messages under the authority table (the conductor's output
  is authoritative: lock hard, slew only for sub-¼-beat corrections;
  jumps re-booked as the file source does). No audio input on the scene
  page in this mode; `audio-in` still listens to the cable for the band
  envelopes (`?audio=line`).
- Fallback when no message arrives for 2 s: free-run at the last tempo,
  the page shows "shared clock lost" small, and recovers silently.
- Tests: a fake publisher at 128 → the receiver's beats within 1 ms;
  a flip on the publisher lands on the receiver at the same bar line;
  2 s gap → free-run, then re-lock with beats monotonic; the existing
  beat-match row passes on 13 under `shared`.

## Task 2 — Scenes that are easy to put on a projector

- `?in=<label substring>` on `audio-in` and the line clock: pick the
  input device whose label contains it (e.g. `BlackHole`) via
  `enumerateDevices`, no chooser; fall back to the chooser if absent.
- `?capture=1`: no UI, no text overlays, no cursor, black background,
  1920×1080 canvas regardless of window (letterboxed), so an NDI/Syphon
  capture is clean. The page's keys still work.
- `?panic` channel: every scene listens for `panic` on the same
  BroadcastChannel and goes black; the conductor page gets the button
  and the key (reuse `panic.js`'s behaviour; Resolume's blackout is the
  second layer of safety, not the first).
- `set.html`: a launcher that lists the set list with the right query
  strings and opens each scene in its own window at 1920×1080 (window
  features), so the user doesn't type parameters. Set list from a small
  `set.json` the user edits.

## Task 3 — No-beat mode (the rule from the sitting, applied to the MVP three)

For the three scenes in `set.json` first, then as a contract rule: when
`confidence < 0.4` (or `shared` is lost) the beat-locked effects fade to
energy-driven ones (band envelopes, kick envelope from `audio-in`) over a
bar, and fade back when the clock locks. Nothing pops. QA row: play the
scene 30 s at `confidence = 0`, then 30 s locked, then 30 s at 0:
components 1, no NaN, frame budget held, and a still at each phase for
the user's grading (the swipe page). "Looks wrong without a beat" is a
finding per scene.

## Task 4 — Runbook

`docs/MVP_RUNBOOK.md`: the user's side above as numbered steps with the
exact commands and query strings, tested where the box can (Task 1's
smoke: three scenes with `?clock=shared&capture=1` plus a fake
conductor; the panic channel; `set.html` opening the windows). BlackHole,
OBS and Resolume cannot be tested on the box; the runbook says what to
check by eye at each step (the lamp on the conductor, the scene's small
"shared" badge, the NDI source name in Resolume).

## Out of scope

The tracker; the Novation through Web MIDI (the controller brief); the
host page (#85) — Resolume is the host for this MVP; HTTPS/serving
(the tunnel is the procedure for the apartment); the camera (its own
brief when the box arrives; it joins as one more scene window).

## The user's gate

Twenty minutes of music on the projector, three scenes blended, tracks
mixed on the conductor page, one flip reaching all three scenes at the
same bar line, a breakdown where the scenes degrade gracefully, a
blackout that works from the conductor page. Then friends and a date.
