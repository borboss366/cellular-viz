# Brief for Claude Code on the Mac: Launch Control XL 3 → conductor page

Repo: https://github.com/borboss366/cellular-viz (public). Main = `f1130d4`.
The Launch Control XL 3 (LCXL3) is plugged into THIS Mac by USB. You can talk to it directly.
Close Ableton, Resolume and Novation Components while you work.

## Read first
- `docs/CELLULAR_VIZ_BRIEF_NOVATION.md` and `docs/LCXL3_RESEARCH.md` on branch `lcxl3-probe` (PR #213). The design (D1–D5) and the button map (D2) are there.
- `experiments/lcxl3-probe.html` on the same branch: the browser probe. Its byte strings are from Novation's Programmer's Reference.
- `experiments/clock.js` on main: `clock.fix(kind, arg, { origin: 'fix:controller' })`. The origin `fix:controller` is already allowed. Kinds: tap, nudge (ms), x2, half, setOne, reset, flip, restart.

## Facts from the Programmer's Reference (verify each one on the hardware)
- Two USB MIDI port pairs. DAW traffic uses the port whose name contains "DAW".
- DAW mode ON: `9F 0C 7F` (or SysEx `F0 00 20 29 02 15 02 7F F7`). OFF: `9F 0C 00`. Always send OFF on exit.
- In DAW mode: faders CC 5–12 ch16; encoders rows 1–3 CC 13–36 ch16; buttons ch1 (upper row CC 37–44, lower row CC 45–52 per community sources); Shift on ch7.
- Mode report: ch7 CC 30 (1 DAW Mixer, 2 DAW Control, 6–9 / 18–29 Custom Modes).
- Relative encoders per row: `B6 45|48|49 7F`. Pivot 64 (65 = +1, 63 = −1). In relative mode the CCs move +64 (row 1 = CC 77–84).
- LED colour: `B0 <control CC> <palette index>`. RGB: `F0 00 20 29 02 15 01 53 <cc> <R> <G> <B> F7`.
- Display: configure `F0 00 20 29 02 15 04 <target> <config> F7`, text `… 06 <target> <field> <ascii> F7`, show `… 04 <target> 7F F7`. Target 35h = stationary.

## Job 1: hardware check (no repo change except the two output files)
1. Use a scratch folder OUTSIDE the repo. Use node (`@julusian/midi` or `easymidi`) or python (`mido` + `python-rtmidi`). Do not add dependencies to the repo.
2. List all MIDI ports. Record the exact names.
3. KEY QUESTION (decides the Resolume plan): with DAW mode ON, does the non-DAW (standalone MIDI) port still send messages when a fader moves? Count messages per port for: before DAW mode, DAW on, DAW off. Ask the user to move fader 1 in each phase.
4. Ask the user to press every button, turn every knob and move every fader. Record CC and channel for each control in DAW mode. Check the Shift button.
5. Find palette indices that look green, amber, red and off. Ask the user what he sees. Check the blink/pulse channel if the guide has one.
6. Turn on relative mode for row 1. Record the CCs and values for one step each way, and for a fast turn.
7. Show "CONDUCTOR READY" on the stationary display (35h). Ask the user if it shows.
8. Check if a button LED lights on its own when pressed (local feedback) in DAW mode.
9. Send DAW mode OFF at the end. Check that the device returns to its normal mode.
10. Write `experiments/lcxl3.map.json` (every value marked `"verified": "hardware 15 Nov"` or `"unverified"`) and `notes/lcxl3-hardware-check.md` (port names, the per-phase count table, the answer to step 3, anything that differs from the guide).

## Job 2: the controller module (only after Job 1)
1. Branch `lcxl3-controller` off main `f1130d4`. Add `experiments/lcxl3.map.json` and the notes file from Job 1.
2. Write `experiments/midi-controller.js` per D1 (Web MIDI, `requestMIDIAccess({ sysex: true })`, DAW port by name, enter DAW mode, map → `clock.fix(…, { origin: 'fix:controller' })`, LEDs and display from the same `read()` the page lamps use, diffed, ≤ 20 Hz, hot-plug, a "controller" lamp, DAW mode OFF on `pagehide`). No SysEx → no display, LEDs still work.
3. Bottom button row per D2: tap, flip, ÷2, ×2, nudge −10, nudge +10, set 1, restart (hold 1 s to arm). Faders and rows 2–3 stay free for Resolume.
4. LEDs per D3: tap pulses on the beat, green locked / amber acquiring / red free-run.
5. Hook it into `experiments/clock-conductor.html` only. Do not touch scene pages.
6. Tests: `node --test` with a fake MIDIAccess: every control → the right `fix()`; every clock state → the right LED bytes; no DAW port → no crash. Put them in `qa/runner/test/`. Run `node --test qa/runner/test/*.test.mjs` locally; all must pass.
7. Test on the real device with the conductor page (secure context: `http://localhost:8790` through the ssh tunnel, or a local server). Check with the user: each button does its job; the LEDs follow the clock.
8. Push and open a PR. Do NOT merge. Do NOT add the `runner-test` label. Our QA box runs the full test, then the user says "merge".

## Rules
- Do NOT change `experiments/clock-tracker.js` (frozen) or `tracker-frozen.test.mjs`.
- D4 (tap rules in `clock.js`) is a SEPARATE later PR. Not in this one.
- No track names or file paths in git (corpus ids only).
- One change per commit. Small commits.

## Report back (paste to Orchestrator in Puggie)
- Port names, the DAW-mode count table and the answer to the key question.
- The palette indices that the user confirmed.
- PR number and full head sha.
