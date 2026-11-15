# LCXL3 hardware check (Job 1), 15 Nov

On the Mac with the controller on USB, with Ableton, Resolume and Components closed. I used a scratch node script
(`@julusian/midi`, CoreMIDI) outside the repo. It opened both inputs, logged every message per port, and sent bytes
to the DAW port. The user moved and pressed controls and reported what the LEDs and the display did. The results
are in `experiments/lcxl3.map.json`.

## Ports

| Direction | Standalone | DAW |
|---|---|---|
| Input (device → host) | `LCXL3 1 MIDI Out` | `LCXL3 1 DAW Out` |
| Output (host → device) | `LCXL3 1 MIDI In` | `LCXL3 1 DAW In` |

The `1` is the device ID. Matching on `DAW` works.

## Key question: does the MIDI port still send in DAW mode?

**No.** Fader 1 was moved bottom → top → bottom in each phase:

| Phase | `LCXL3 1 MIDI Out` | `LCXL3 1 DAW Out` |
|---|---|---|
| Before DAW mode | 273 | 0 |
| DAW on (`9F 0C 7F`) | **0** | 250 |
| DAW off (`9F 0C 00`) | 275 | 0 |

While the conductor page holds DAW mode, Resolume on the MIDI port gets nothing from the faders or pots. The
Resolume plan needs the bridge (the page forwards the free controls to a virtual port) or a second controller.

## Matches the guide

- DAW mode on/off with `9F 0C 7F/00`, and with the SysEx form. The device echoes each one in the form it was sent.
- Faders: CC 5–12 on ch16. Encoders, absolute: CC 13–20, 21–28 and 29–36 on ch16.
- Buttons on ch1, 7F on press and 00 on release. Upper row CC 37–44, lower row CC 45–52 (the community value is right).
- Shift is ch7 CC 63, 7F/00.
- Mode report on ch7 CC 30: 1 = DAW Mixer, 2 = DAW Control, 6 = Custom Mode 1.
- Relative row 1 with `B6 45 7F` gives CC 77 (+64), pivot 64: 65 = +1, 63 = −1.
- Display on target 35h: configure 01, field 0 and field 1, show 7F. The user saw "CONDUCTOR" / "READY". Cancel
  with `04 35 00`.

## Differs from, or is missing in, the guide

- **No local LED feedback in DAW mode.** Entering DAW mode turns every LED off, and pressing a button lights
  nothing. The page owns every LED.
- **Palette:** the standard Novation palette. 0 off, 5 red, 9 orange (amber), 13 yellow, 21 green, 37 light blue,
  45 blue, 53 purple, 3 white, 1 grey. 96 looks the same as 9, and 72 the same as 5.
- **Flash is ch2 (`B1`), pulse is ch3 (`B2`).** The guide text says nothing about this; it works as on Launchpads.
  To clear a button, send index 0 on ch1, ch2 and ch3.
- **Relative encoders accelerate.** A fast turn sends up to 68 (+4) and down to 60 (−4) per message, so decode it as
  `value − 64`, not by its sign. Feature-controls enable (`9F 0B 7F`) is **not** needed for `B6 45 7F`.
- **Mode query works:** `B7 1E 00` (ch8 CC 30) is answered with ch7 CC 30 `<mode>`. **The host can also set the
  mode:** ch7 CC 30 1 / 2 is applied and echoed.
- **CC 31 travels with CC 30** in every mode report. It is equal to CC 30 for modes 1, 2 and 6, and CC 30 − 5 for
  Custom Modes 9–16. Its meaning isn't documented.
- **DAW off reply:** before echoing `9F 0C 00`, the device sends the mode report (CC 30/31 = 6) twice.
- **Device-only buttons:** these send no button CC.
  - Mode sends nothing. It opens and closes the device's **Mode Select** page.
  - Solo/arm reports CC 30 = 2 (DAW Control). Mute/select reports CC 30 = 1 (DAW Mixer).
  - The button CCs are the same in DAW Mixer and DAW Control.
- **Other buttons on ch1:** page up 106, page down 107, record 118, play 116, small button next to solo/arm 104, track
  102/103. The track direction was not isolated, so it is marked unverified.

## Trap for the controller module: the Mode Select page

While the Mode Select page is open, the 16 buttons send **no button CCs**. Each press picks a Custom Mode
(CC 30 = 6, 22…29), and the surface leaves DAW Mixer.
- DAW mode itself stays on: `9F 0C 7F` gets no echo, because it is already on.
- DAW off/on and setting CC 30 from the host do **not** close the page. Only the Mode button closes it.
- An accidental Mode press at a party would look like dead buttons.

What the module should do:
- Watch ch7 CC 30. If it isn't 1 or 2, re-send CC 30 = 1 and show the "controller" lamp as degraded.
- Show "press MODE" on the display (untested whether the display takes text while the page is open), because the host cannot close the page itself.
- On every connect, send `B7 1E 00` to read the mode.

## Not checked

- RGB SysEx (`01 53`).
- Relative mode on rows 2 and 3.
- The bitmap display.
- Fader pickup and touch events.

## Job 2 on the hardware (15 Nov, the conductor page on the Mac, Chrome, http://localhost:8790)

- Status lamp "controller: on". SysEx was granted, and the display showed `120.0 BPM ACQ` / `C0%` until the first lock.
- All lower-row buttons 1–7 were logged as `fix:controller` (tap, flip, half, x2, nudge −10, nudge +10, set1).
- Button 8 (restart): a 1.5 s hold restarts the clock, and the LED flashes red while held. A 0.15 s press does nothing.
- The tap LED is steady amber before the first lock, then flashes green on every beat once locked (at 138 bpm).
- **Chrome throttles the page's timer to ~1 Hz when its window is covered.** Sampled LEDs then flashed on every
  second beat or so. The module now books each flash ahead with `MIDIOutput.send(bytes, timestamp)`, and it stays on
  every beat with the window covered.
- Mode Select trap: two presses on the page arrived as CC 30 = 0x18 / 0x19. The module set CC 30 = 1 back each time.
  After Mode closed the page, tap worked again.
- Closing the tab (`pagehide`) put the device back in standalone mode at once.
- A listen-only node client on the DAW port ran beside Chrome without trouble (CoreMIDI multi-client).
