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
