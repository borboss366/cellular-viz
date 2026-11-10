# cellular-viz — brief: the controller (Novation Launch Control XL 3 → the clock's hands)

Written by the reviewer, 10 Nov. Follows the conductor page (#188).
Hardware: Novation Launch Control XL 3 (8 faders, 24 pots in three rows,
two rows of 8 buttons under the pots, a small display, USB MIDI).

## Why

The sitting on the 10th conducted on Shift keys. The party is conducted
on hardware: eyes on the room, one hand on the controller, no keyboard.
The scorer keys on `origin`, so controller presses score separately
from keyboard presses and the second sitting tells us whether keyboard
reaction times were ever representative. LEDs make the controller a
monitor you can read without looking at the screen.

## Design

### D1. One module, one map, no guessed bytes
- `experiments/midi-controller.js`: Web MIDI → `clock.fix(kind, arg,
  { origin: 'fix:controller' })`; LED and display updates from the same
  `read()` the page's lamps use, diffed and sent at ≤ 20 Hz; hot-plug
  (device appears/disappears) without a reload; a "controller" lamp in
  the page header (connected / not).
- `experiments/lcxl3.map.json`: the CC/note numbers per control, the
  LED palette indices, and the display message format. Numbers come
  from a Custom Mode built in Novation Components and from the "Launch
  Control XL [MK3] Programmer's Reference Guide" — the implementer reads
  the guide and cites the section per message type; nothing is
  guessed. The Custom Mode file is committed next to the map.
- Web MIDI needs a secure context and SysEx needs its own permission
  (`requestMIDIAccess({ sysex: true })`); the page asks once, remembers,
  and degrades: no SysEx → no display text, LEDs still work (they are
  note velocity in a Custom Mode).

### D2. The map (bottom button row = the hand's one line)
| Button | Command | Note |
|---|---|---|
| 1 | tap | ≥ 4 even taps set tempo + phase and CLEAR the octave hold; one tap moves the beat. Uneven taps (IBI spread > 8 %) are rejected and the button blinks red. |
| 2 | flip | half a beat at the next bar line |
| 3 | ÷2 | pressing again while ÷2 holds RELEASES the hold (toggle) |
| 4 | ×2 | same |
| 5 | nudge −10 ms | |
| 6 | nudge +10 ms | |
| 7 | set 1 | |
| 8 | restart | hold 1 s to arm; the LED fills while held |

Top button row: Load NEXT (the playlist's selection), Play/pause,
Crossfade, Mark (the selected name), Shift+S "confirm the 1", click
on/off, K lamp (disabled in scored runs, as the guide says), free.

Pots, row 1: `visualOffsetMs` (1 ms per detent, accelerating as Alt+,
does), click volume, crossfade time, phase trim (±1 ms per detent →
`nudge(±1)`, for the fine work the ±10 buttons are too coarse for).
Rows 2–3 and the faders: unmapped. They belong to Resolume (its own
MIDI-learn) or to module controls later; this brief does not touch them.

### D3. LEDs are the monitor
- tap button pulses on the output beat: green locked, amber acquiring,
  red free-run.
- flip lights when the side hint (low-lane direction) disagrees with the
  lock; ÷2 / ×2 light when the half-lag ratio says the octave is
  suspect; the one that is held shows its hold colour.
- nudge − / + glow toward the direction the last 8 onsets lean.
- set 1 lights while the bar-1 lamp is on (same source as the page).
- Display: BPM, confidence as a bar, the last fix. Off without SysEx.
All from `read()`; no second computation. If a state can't be shown on
the page, it isn't shown on the controller either.

### D4. The clock changes that the sitting found (command layer only)
- Tap quality: ≥ 4 taps, IBI spread ≤ 8 %, else rejected. Tap clears
  the octave hold (tap is the higher authority in #95's table).
- Octave hold toggles off on a second press of the same key.
- `restart` stays, hold-to-arm on the controller, Shift+R on the keys.
The tracker's own code is untouched; this is `clock.js`'s `fix()`.

### D5. Serving without an ssh tunnel
Web MIDI, like the audio input, needs a secure context. Decide once:
serve the conductor page from the laptop (conduct-serve runs there,
tracks on a local folder or over the LAN), or over HTTPS from the box
with a certificate the laptop trusts. Document the chosen one in the
guide; the tunnel is not a party procedure.

## Tasks

1. Custom Mode in Components + `lcxl3.map.json` + the loopback check:
   a node test with a fake `MIDIAccess` asserts message → `fix()` for
   every control and `read()` → LED/display message for every state;
   a hardware checklist in the guide (press each button, watch the
   page's "last fix"; each LED state forced from the console).
2. `midi-controller.js` with hot-plug, permission handling, degrade
   without SysEx, the header lamp.
3. D4 in `clock.js` with tests: uneven taps rejected; even taps clear
   the hold; second press releases the hold; the authority table in the
   header comment updated.
4. The scorer reports `fix:controller` and `fix:key` separately, with
   reaction-time p50/p90 per origin, and the first sitting's keyboard
   numbers beside the second's.
5. Guide: a "Controller" section; the map as a picture (a labelled
   photo or a diagram of the two button rows).

## The user's gate (the second sitting)

The whole playlist on the controller, keyboard closed. Then: look away
for ten seconds, look back at the controller only — can you say the
clock's state (locked / acquiring / free-run, side suspect, octave
suspect) without the screen? Every fix the first sitting made by key,
made by button this time; reaction time per fix in the report. Pass:
the conductor score at least the first sitting's, no fix needed the
keyboard, the ten-second test passed on every state that occurred.

## Out of scope

Resolume's mapping (its MIDI-learn; note: on Windows one MIDI port can
be opened by one application at a time — Chrome and Resolume sharing
the XL 3 needs a virtual MIDI splitter or the device's second port;
macOS shares freely); module/ISF controls on the pots and faders; the
tracker; the display beyond BPM / confidence / last fix.
