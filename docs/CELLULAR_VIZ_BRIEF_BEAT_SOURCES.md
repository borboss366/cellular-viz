# cellular-viz — brief: beat sources (a service on the Mac, several trackers side by side)

Owner, 26 Nov, on the user's go. Follows the beat server brief (the
relay and its reserved `source` message) and its task 7 (the show
runs from the Mac). It contains `CELLULAR_VIZ_BRIEF_BEAT_BAKEOFF.md`
as its first task.

## Finding

The user tested the wired input (controller master out, audio
interface, 26 Nov). Our tracker does not do much better on the line
than on the microphone. So the input was not the problem; the tracker
is. It stays closed, and no more work goes into it.

## Decision

A separate process on the Mac, `beatd`, listens to the same audio
input and runs other trackers. Each one reports its beat to the
relay as a source. The conductor shows every source side by side,
steers the clock from the one the user picks, and logs them all. The
hand stays on top of whichever is picked.

The same process is where the non-audio sources will live later (the
DJ software helper, players with a link port), so the skeleton is
worth building whatever the trackers turn out to be.

**What to expect.** On steady four-on-the-floor a good live tracker
should beat ours. On syncopated, half-time tracks no live audio
tracker is reliable; a beat from the decks is still the real answer
there. This brief makes the audio route as good as it can be and
makes the choice visible; it does not promise a lock on everything.

## Rules

- `experiments/clock-tracker.js` is closed. It is one source among
  several, unchanged.
- No tuning of any tracker to a recording or a track. A tracker is
  used as its authors ship it, with its documented live settings.
- The conductor is still the only authority. A source proposes; the
  conductor's flywheel decides and publishes. Hold, tap, flip and the
  rest work the same on any source.
- No automatic switching or voting between sources in this brief.
  The user picks. The default stays ours until the numbers say
  otherwise.
- Nothing is read back from Resolume. No names of people, tracks or
  files in messages or logs.
- If a tracker does not install and run on the Mac within an hour of
  honest effort, it is dropped with one line saying why.

## Task 1: the comparison on recordings (one day, the box)

As written in `CELLULAR_VIZ_BRIEF_BEAT_BAKEOFF.md`, with two changes:
- Its inputs now include the user's wired recording of 26 Nov.
- Its result no longer decides whether the service is built. It
  decides **which trackers go live**: the best two candidates, plus
  ours.

Candidates to try: BeatNet in its online mode, madmom in its online
mode, and aubio's tempo tracker as the light baseline. VIZ research
checks first what installs today on the box and on macOS (Apple
Silicon), and may swap one candidate for a better live tracker it
finds. Three candidates at most.

## Task 2: `beatd`, the skeleton (can start at once)

A small Python program in `beatd/`, with its own pinned environment
and a one-line start (`tools/start-beatd.sh`, in the style of the
other start scripts).

- **Audio.** Opens the input by a part of its name, like `?in=` (for
  example `M-Track`). macOS lets Chrome and `beatd` read the same
  input at once. Mono mix of both channels.
- **Time.** Every beat a tracker reports is turned into wall time
  (the same clock the pages use) from the audio callback's own
  timestamps, not from when the code got round to it. Each source
  has one stated delay constant for its own look-back, measured in
  task 4, never tuned per track.
- **Out.** Connects to the relay as a client and sends, per source,
  at most 20 a second:
  `{ type: 'source', v: 1, id, t, beats, bpm, confidence, state }`.
  `id` is a short fixed name (`beatnet`, `madmom`, `aubio`). It
  reconnects by itself.
- **Plug-in shape.** One file per tracker with the same three calls
  (start, feed audio, read beats). A fake source (a metronome at a
  set tempo) ships first and is what the tests use.
- **If it dies, nothing else does.** The pages, the conductor and our
  own tracker do not depend on it.
- Tests in node for the message and the relay side; tests in Python
  for timing with the fake source (a click track in, beats out within
  a stated tolerance).

## Task 3: the conductor side

- `clock.js` gains the source `ext`: the flywheel is steered by the
  picked external source under the same authority table as `line`
  (lock, slew for small corrections, jumps booked and logged). Split
  the sources out of `clock.js` if that keeps the change small.
- The conductor page shows one row per source: a beat lamp, tempo,
  confidence, and how far its beat is from the clock that is playing.
  Ours is one of the rows.
- Picking the source: keys on the page and two free buttons on the
  controller (previous, next), with the picked row lit. A change of
  source lands on a bar line and is logged.
- A source that falls silent for 2 s is marked lost; if it was the
  picked one the clock free-runs, as with a lost shared clock.
- The session log records every source's messages (thinned to what
  the scorer needs), not only the picked one.

## Task 4: measure and score

- **Delay per source.** On the calibration page with a click track:
  each source's constant offset, written into its plug-in. Report the
  spread; a source whose delay wanders by more than 20 ms is noted.
- **Scorer.** From a session log and the recording, against the
  Beat This! reference: time inside ±35 ms per source, the wrong-side
  share, recovery after mix points, and the same for the clock as
  played (with the hand).
- **CPU.** `beatd` with all picked trackers running, on the Mac with
  the set running (OBS, Resolume, two slots). If the set drops
  frames, trackers come out until it does not.

## Mac session and the user's gate

Thirty minutes mixed by hand through the wired input, half house and
half the guest's kind of tracks, recorded, all sources running, the
user switching between them.

Gate: at least one new source keeps the beat with clearly fewer
presses than ours on the house half, and the scorer agrees. Then
that source becomes the default for the rehearsal. If none does, the
rehearsal runs on ours with the hand, and the next brief is the DJ
software helper.

## Out of scope

Changes to our tracker; an ensemble or automatic switching; the
helper and link-player bridges (they will be more plug-ins here);
running `beatd` on the box; a second machine.
