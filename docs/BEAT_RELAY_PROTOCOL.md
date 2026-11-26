# Beat relay protocol (version 1)

What goes between the pages, by the BroadcastChannel `cellular-viz-clock` (inside one
Chrome) and by the beat relay's socket (`/relay?v=1` in conduct-serve, for pages in
OBS's browser). From `docs/CELLULAR_VIZ_BRIEF_BEAT_SERVER.md` and the owner's calls of
23 Nov (A, B, C). Code: `qa/beat-relay.mjs` (the relay), `experiments/relay-lib.js`,
`experiments/shared-link.js` (a page's link: channel + socket), `experiments/levels.js`.

## How the beat relay works

1. **The conductor is the brain.** The conductor page runs in Chrome on the Mac. It
   hears the music, finds the beat and reads the LCXL3. The relay makes no beat
   decisions.
2. **The relay is a post office only.** The relay is part of conduct-serve on the box.
   It sends the conductor's clock, controls, panic and levels to each page that is
   connected.
3. **Chrome does not need the relay.** Chrome windows also get all messages directly
   through the BroadcastChannel. If the relay stops, the Chrome windows continue to work.
   OBS Browser Sources need the relay.
4. **Nothing to install on the Mac.**
   1. Open the normal tunnel: `ssh -L 8790:localhost:8790 puggie@192.168.8.164`.
   2. Open the pages from `http://localhost:8790`. A page that conduct-serve sends turns
      the relay on (the cookie `cvrelay=1`).
   3. To check the relay, open `http://localhost:8790/experiments/setup-check.html` and
      push "Run checks". Make sure that the "Beat server" line shows PASS.
5. **Why the relay is on the box.** conduct-serve already sends the pages from the box.
   The cost:
   - OBS messages go from the Mac to the box and back to the Mac. The delay on the box
     alone is p50 0.36 ms, max 1.26 ms. The delay through the tunnel was measured on
     26 Nov: p50 4.71 ms, p99 9.46 ms, max 11.97 ms, 0 of 600 lost (see
     `docs/BEAT_RELAY_DELAY.md`).
   - The OBS sources need the tunnel and the Wi-Fi. If the tunnel stops, the OBS sources
     stop. The Chrome windows continue.
6. **Option for later: the relay on the Mac.** conduct-serve with the relay can run on
   the Mac. This needs Node and a copy of the repo. Nobody has tested it on macOS yet.
   Decide after the tunnel delay result.

## Rules

1. **The conductor is the only authority.** It decides the clock and publishes it. The
   relay decides nothing: it passes messages on and keeps the latest state.
2. **Wall time.** Every time in a message is the sender's wall time in ms
   (`performance.timeOrigin + performance.now()`). Pages on one machine agree on it. A
   clock message carries its own time, so relay delay does not move the beat.
3. **Offset, report only (call A).** Each scene measures its offset to the conductor
   once per page load (`clock-ping` / `clock-pong`, 5 pings, the shortest round trip) and
   reports it (`offset-report`). The conductor logs it (`offset` record). Nothing applies
   it. Over 5 ms on one machine is a finding.
4. **Each message once.** A page in Chrome hears the channel and the socket. Commands
   (`panic`, `slot`, `jump`) carry an `id` and apply once. `clock`, `knobs` and `levels`
   apply once per `t`. Socket messages carry a `seq` per type; an older one is not news.
5. **Late join.** A page that joins gets `hello` and the latest state: `knobs`,
   `controls` per slot, `panic` (until `clear`), `clock`. A late clock older than 2 s is
   not used: the page free-runs and does not jump. Jumps and slot steps are not replayed.
6. **Two classes.** `levels` may be lost (a backed-up page gets only the newest).
   Everything else is never dropped: a page that cannot keep up is cut off and joins
   again through the late state.
7. **Lost socket.** The channel goes on. After 2 s without a clock message the scene
   free-runs (as today). The socket comes back by itself (250 ms doubling to 8 s, with
   jitter). A page that becomes visible again asks for `resync`.
8. **R9.** No names of people or tracks in any message. Pages send file names and
   random ids only. The relay logs nothing per message.

## Levels: intensity only (call B)

**No page works out tempo, phase or the bar from levels or kicks. A scene that does
fails review.** The beat comes only from the clock messages. Levels and kicks are for
the no-beat effects, weighted as the no-beat mix is today
(`mix = beatWeight * beatDriven + (1 - beatWeight) * energyDriven`).

- Each kick carries its own time (the conductor's wall time of the onset). A scene ages
  a kick from when it happened, not from when the message arrived. `audio-in.js`
  (`?audio=shared`) maps it onto the page's audio clock with the shared clock.
- The kick time is the conductor's reading time, to within one reading (33 ms at 30 a
  second).
- `phase` and `side` in the message are the conductor's own, carried for the record.
  They are not a beat source.
- Rate: 30 a second (`LevelsLib.RATE_HZ`). Up to 60 is a ceiling; the delay report
  (`docs/BEAT_RELAY_DELAY.md`) sets the rate.
- The scene re-smooths the bands with its own frame time and today's attack (10 ms) and
  release (250 ms).
- The node test `levels.test.mjs` checks that only the shared code reads the levels
  (`audio-in.js`, `clock.js`, `shared-link.js`, `levels.js`, the conductor and the QA
  host). A scene reads `audio.read().energy` / `audio.readEnergy()`, never the message.

## Messages

| type | from | what |
|---|---|---|
| `hello` | relay | on join: `{ ok, relay, t, clients }`; another `v`: `ok: false`, close 4001 |
| `relay-error` | relay | to the sender only: `{ error }` (version, type, reserved, not JSON, binary) |
| `time-ask` / `time` | page / relay | `{ id, t0 }` / `{ id, t0, ts }`: the relay's clock (delay report) |
| `resync` | page | the late state again, to the asker only |
| `clock` | conductor | `{ t, beats, bpm, phase, bar, beatInBar, bpb, confidence, state, offsetMs, knobs? }`, at most 20 a second |
| `jump` | conductor | `{ t, kind, origin, fromBeats, toBeats, id }`: a jump or hand fix, lands at its own `t` |
| `knobs` | conductor | `{ t, knobs: [8] }` |
| `panic` | conductor | `{ t, mode: blackout / calm / clear, id }` |
| `slot` | conductor | `{ t, slot: A / B, dir: -1 / 1, id }` |
| `controls` / `controls-ask` | slot / conductor | a slot's knob names / the conductor asks for them |
| `clock-ping` / `clock-pong` | scene / conductor | `{ id, t0, from }` / `{ id, t0, to, tc }`: the offset to the conductor |
| `offset-report` | scene | `{ loadId, page, slot, ms, rttMs, n, finding }`, once per load |
| `levels` | conductor | `{ t, broadband, low, bands: [8], kicks: [{ t, vel }], phase, side }`: an object on the channel, one binary frame on the socket (below) |
| `delay-probe` | delay tool | `{ i, t }`: the delay report's probes, on a test relay |
| `source` | (reserved) | for beat sources later; only the version is checked |

Every message has `v: 1`. The relay adds `rt` (its arrival time) and `seq` to the JSON
messages it passes on.

### The levels binary frame

Little-endian, 60 + 12 n bytes:

| bytes | what |
|---|---|
| 0 | `0x4c` ('L') |
| 1 | version 1 |
| 2 | n, the kick count (0 to 8) |
| 3 | 0 |
| 4-11 | f64 `t` |
| 12-27 | f32 `broadband`, `low`, `phase`, `side` |
| 28-59 | 8 x f32 `bands` (sub, kick, low, lowMid, mid, upperMid, presence, air) |
| 60 + 12 i | f64 kick `t`, f32 kick `vel` |

The relay checks the head and the length and passes the frame on unchanged.
