# cellular-viz — brief: the conductor rehearsal (the user as DJ, the tracker as the band)

Written by the reviewer, 7 Nov. Follows the tracker (clock PR 3, #173).

## Why

The party gets the PAIR: the tracker plus the person at the laptop with
the hand fixes. The corpus measures the tracker alone; this measures the
pair, and it tells the user whether he can keep the clock right by hand
through fifteen tracks and the transitions between them. If he can, the
clock is done — in his words: "if I manage to control everything, we
are fine." Nothing here changes the tracker.

## Task 1 — `experiments/clock-conductor.html` (QA-only page name)

A rehearsal page on the laptop. One screen, readable from a metre away.

**Playlist.** The private tracks folder (the user's four, the reviewer's
twelve, the DJ-set recordings), served by `qa/serve.mjs` from a local
path (env, never committed). Full tracks or excerpts; the user picks.
Play, Next, and a crossfade of N s into the next track (default 8 s) so
every switch is a transition the tracker has to live through. No
beat-matching of the incoming track — the DJ-set recordings carry the
real mixes.

**Audio path.** The track plays through the page's AudioContext; the
tracker listens to THAT stream, not the mic: `?clock=line:page` — the
`line` source fed from a MediaStreamDestination of the playback instead
of getUserMedia. Same tracker, same analysis, same hand fixes. The mic
variant (`?clock=line`) stays for the mixer later; the page shows which
one it is on.

**Monitor (the part that makes errors the user's to fix).**
- BPM: the tracker's own and the output's (they differ after a hand fix),
  confidence as a bar, state (acquire / locked / free-run), lane and side.
- A beat lamp on the output beat and a kick lamp on the kick band's
  onset: when they flash together the clock is right; when the kick lamp
  flashes between beat lamps, the side is wrong — the user sees it
  before hearing it.
- A phase scatter: the last 16 broadband onsets against the output beat,
  ±½ beat wide. A tight cluster at 0 is a lock; a cluster at ½ is a flip;
  two clusters is an octave; a drifting cluster is tempo.
- Octave hint: the autocorrelation's half-lag ratio; side hint: the low
  lane's direction and R. Hints only — the user decides.
- The eight bands as bars (the equaliser), the click toggle through the
  speakers (`click=1`), and the hand fixes as on-screen buttons next to
  the Shift keys (tap, ÷2, ×2, flip, nudge −/+, set 1, reset), with a
  "last fix" line: what, when, and the beat it landed on.

**Log.** One JSONL per session, `sessions/conductor-<stamp>.jsonl`,
POSTed line by line to `serve.mjs` (and downloadable at the end):
- every 100 ms: `t` (audio time), own and output bpm/phase/beats,
  confidence, state, lane, side, the half-lag ratio;
- every hand fix: kind, arg, origin, `t`, own and output beats before
  and after;
- every jump and state change (as the tracker logs them);
- every track event: load, play, crossfade start/end, end — with the
  file name, the element's `currentTime` and the audio time at that
  instant, repeated every 5 s as a (position, audioTime) pair so the
  reference grid aligns without a marker and drift is visible.
- `__qa.conductor` exposes the same for a headless run.

## Task 2 — `qa/conduct-score.mjs` (the scorer)

Input: a session JSONL plus each track's reference (Beat This! sidecar
v2, the fitted grid where it fits). Output: a markdown report and a
per-track error timeline (ASCII or PNG), committed as
`reports/conductor-<stamp>.md`.

Per track, for the TRACKER ALONE (own model) and for the CONDUCTED clock
(output): phase error against the reference over time; fraction of
played time inside ±35 ms; octave errors (output bpm vs reference ratio
≈ 2 or ½); side errors (|error| ≈ ½ beat); re-lock time after the
crossfade.

Per error EPISODE (output outside the gate for > 4 beats): when it began,
what the user pressed and when (reaction time in beats), whether the
error after the fix was smaller than before (a right fix) or larger (a
false fix), time to clean. Episodes with no fix are MISSED.

Session summary — the conductor score:
- % of played time the output was inside the gate (the one number);
- episodes: caught / missed / false, with reaction-time p50/p90;
- hand fixes per track; tracks that needed none;
- the tracker-alone number next to it, so the user's contribution is
  visible: (conducted − alone).

Tests: synthetic sessions with planted errors (an octave at 40 s, a
flip at 70 s, a 3 s dropout, a crossfade) and scripted fixes, asserting
the episodes, reactions and verdicts the scorer must find.

## Task 3 — Replay on the box (small)

The runner can play a session back: the same files, the hand fixes
re-issued at the same track positions (origin `fix:qa`). Reproducibility
of the tracker under the user's fixes; also the corpus report "tracker
alone" falls out of a session with no fixes. Report-only.

## The user's gate

One sitting, the whole playlist with crossfades, click on, no looking at
code. Then the report. "Fine" means: output inside the gate ≥ 90 % of
played time across the corpus; every episode longer than 4 beats caught
within 8 beats; false fixes ≤ 1 per track; the DJ-set recordings' mixes
survived with at most one fix each. Anything below that is a numbered
finding against the tracker OR against the monitor (if the user didn't
see an error, the monitor failed, not the user).

## Out of scope

Changing the tracker; beat-matched transitions; the controller (the
Shift keys and on-screen buttons stand in; the Novation maps to the same
`fix()` calls later); Resolume. Gesture, camera, pages: separate briefs.
