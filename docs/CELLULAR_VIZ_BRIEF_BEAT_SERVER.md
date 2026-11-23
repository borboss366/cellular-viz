# cellular-viz — brief: the beat server (the show's messages through the server)

Owner, 23 Nov. This is task 3 of the owner's brief, made larger and
moved to the front. The rehearsal is in early December.

## Why now

1. **OBS Browser Sources.** On 18 Nov a scene in OBS's own browser
   drew on the GPU and reached Resolume over NDI, but got no clock:
   the BroadcastChannel stays inside Chrome. MIDI and the microphone
   hung there too (no permission prompt). Browser Sources would
   replace window capture, the Chrome flag and the crop, and should
   shorten the 163 ms route.
2. **More than one beat source.** After 22 Nov the beat will come from
   several places over time: our tracker, the user's hand, a helper
   reading the DJ software, players with a link port. They need one
   place to arrive and one place to leave from.

## What it is

A WebSocket relay inside `conduct-serve` (same origin, same port, no
new process). The conductor stays the only authority: it decides the
clock and publishes; the server passes messages on and remembers the
latest state.

**It carries everything the channel carries today:** the clock state,
jumps and hand fixes, the knobs, slot commands, the controls lists,
panic.

**And one new thing, the levels.** A page in OBS's browser cannot
open an audio input. The conductor already listens; it publishes the
band envelopes and the kick onsets (what `audio.energy` holds) at up
to 60 a second, and a scene started with `?audio=shared` reads them
from the server. Without this, no-beat mode and every level-driven
effect are dead in a Browser Source.

**Rules**
- A page that joins late gets the current state at once: clock,
  knobs, slot state, panic. A scene loaded during a blackout stays
  black.
- Time is stamped as wall time (`performance.timeOrigin +
  performance.now()`), so two browsers on one machine agree. Clock
  messages carry their own time, so relay delay must not move the
  beat. Level messages are used as they arrive; report their delay.
- The `shared` source listens to the channel and the socket and uses
  whichever speaks; the messages and the authority table are the
  same. Nothing changes for a Chrome-only setup.
- Socket lost: free-run as today (the 2 s rule), reconnect quietly.
- The protocol has a version and reserves a message kind for beat
  sources (`{ kind: 'source', id, t, beats, bpm, confidence }`). Do
  not build any source in this brief.
- Nothing is read back from Resolume. No names of people or tracks in
  any message that is logged.

## Tasks

1. **The relay** in `conduct-serve`, with tests in node: fan-out,
   late join, version mismatch, reconnect, a slow subscriber does not
   stall the others.
2. **`shared` over the socket**: the existing shared-clock tests pass
   through the relay, plus a test with two separate browser processes
   (a flip lands on both at the same bar line; panic reaches both).
3. **Levels**: the conductor publishes them; `audio-in` gains the
   `shared` source. A scene's no-beat row passes with `?audio=shared`.
4. **`setup-check.html`**: every check has a timeout (the MIDI check
   hung the page in OBS on 18 Nov), and there is a line for the
   server connection.
5. **Slots as Browser Sources**: `slot.html` works in OBS's browser
   with no audio input and no MIDI. The runbook gets the OBS steps
   (size, 60 fps, "shutdown when not visible" off, the NDI filter per
   source). The Chrome route stays documented as the fallback.
6. **Report**: relay delay p50 and p99, on the box through the tunnel
   and on one machine.

`clock.js` is touched here. Split out only the `shared` source if
that makes the change smaller (owner's brief, task 6); no wider
refactor.

## Mac session (Claude Code on the Mac, with the user)

Both routes side by side, same scenes, same music:
- the delay of each, measured as on 21 Nov (120 fps video);
- 30 minutes on Browser Sources: no freeze, no drift between slots;
- ten slot switches each, knobs, a flip, panic and its release.

## The user's gate

Both slots run as Browser Sources, follow the beat and the hand, obey
the knobs and the panic key, and the measured delay is no worse than
window capture. Then the rehearsal uses Browser Sources; otherwise it
stays on Chrome windows and the relay is still kept for the sources
to come.

## Out of scope

Other trackers (`CELLULAR_VIZ_BRIEF_BEAT_BAKEOFF.md`); the bridge for
the DJ software helper or for link players (their own briefs, they
plug into the reserved message); a second machine or the tablet (they
need clock offset between machines); HTTPS.

## Owner's calls, 23 Nov (after VIZ research's notes on #308)

**A. Clock basis: wall time stays.** Everything runs on one machine,
and the channel already relies on it inside Chrome. One addition,
report only: on joining, each page does a short ping exchange with
the conductor through the relay and logs its measured offset. Nothing
applies it. An offset above 5 ms on one machine is a finding, and the
numbers are what a second machine will need later. Note that every
slot switch loads a new page with a new time origin, so the log
should show the offset per load across a long run.

**B. Kick hits stay in the levels message, with two rules.**
- Scenes use them only for no-beat effects, weighted as the no-beat
  mix is today. No page derives tempo, phase or the bar from levels
  or kicks. A scene that does fails review.
- Each kick carries its own time, so a scene ages it from when it
  happened, not from when the message arrived.

**C. Slots as Browser Sources: build now.** The relay's delay report
does not compare routes; only the Mac session does, and it needs the
feature. Until the user's gate passes, nothing in `set.json`, the
runbook's main path or the Chrome route changes.

The order in #308 (delay report before levels, so the measured delay
sets the levels rate) is accepted. The "up to 60 a second" above is
then a ceiling, not a target.

## Task 7: the show runs from the Mac (owner, 23 Nov; the user's go)

**Why.** With the relay on the box, every message for an OBS source
goes from the Mac to the box and back over Wi-Fi and the tunnel. The
beat is safe (clock messages carry their own time), but a Wi-Fi stall
freezes the levels and a dropped tunnel stops every OBS source. A
party, here or elsewhere, must not depend on that. `conduct-serve`
already runs on a laptop and needs only Node, so this is a start
script and a test, not an extraction.

**What stays the same.** The address is still
`http://localhost:8790`. OBS sources, the saved offset profiles and
the runbook's URLs therefore do not change. The box keeps its own
conduct-serve for building and testing; the tunnel becomes the
development route.

**For the box**
1. `tools/start-show.sh`, in the style of `start-chrome.sh` (with
   `--dry-run` and node tests):
   - checks Node (the box runner's major version or newer);
   - prints the tag and commit of the checkout, and warns when it is
     not on a release tag or has local changes;
   - refuses to start when port 8790 is taken, and says why (the
     tunnel uses the same port: close it);
   - starts `conduct-serve` on 127.0.0.1 with the sessions folder
     outside the repo, in guest mode by default (no tracks folder),
     `--dir` for a playlist;
   - then calls `start-chrome.sh` with the conductor and the slots.
2. A test: conduct-serve with no tracks folder serves the pages, the
   relay and the session log.
3. `/api/relay` and the setup check's "Beat server" line say where the
   server runs, from a `--label` given at start (`mac`, `box`). No
   host names.
4. `tools/copy-session.sh`: copies a session's log and audio from the
   Mac to the private folder on the box and prints the sha256 of both
   ends (done by hand on 21 Nov). Nothing from a session enters the
   repo.
5. Fill the box row of the table in `docs/BEAT_RELAY_DELAY.md`; the
   protocol doc quotes a figure the table does not have.
6. Runbook: the local server is the main path; the tunnel is the
   fallback and the development route.

**Mac session (Claude Code on the Mac, with the user)**
- Fill the delay table: through the tunnel and on the Mac alone, at
  20 and 60 a second. Then set the levels rate from the numbers.
- From the local server, **with Wi-Fi off**: 30 minutes on Browser
  Sources and on Chrome windows; ten slot switches each; knobs, a
  flip, panic and release.
- The route comparison of the main brief (window capture against
  Browser Sources, 120 fps video) is done in the same session, from
  the local server.
- Copy the session to the box with the new tool.

**The user's gate.** A full set runs with Wi-Fi off and the tunnel
closed. If it does, the rehearsal runs from the Mac.

**Out of scope.** Beat source adapters (each one is its own small
process on the Mac, sending the reserved `source` message, when a
source is proven). Moving the conductor's logic out of its page.
Starting at login.
