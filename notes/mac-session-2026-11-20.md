# Mac session 4 (20 Nov): two slots, LCXL3 rings and buttons, beat strength, calibration

The user's steps for tonight (pasted at the start). Main at the start: 3be539d (Merge #286, Little Bang beat strength),
which is after bd886e6. Background: notes/mac-session-2026-11-18.md, notes/mac-session-2026-11-19.md (not committed).

## Open from earlier sessions (Part 0)
| Item | State before tonight |
|---|---|
| Slot check (slot.html A/B) | not done (new in #273) |
| OBS/Resolume slots (CV-A layer 1 / fader 1, CV-B layer 2 / fader 5) | not done (19 Nov set up 4 per-scene sources CV-16/06/24/11) |
| EQ calibration | not done (19 Nov step 3 left open) |
| Video A (route delay) | done once on 18 Nov at offset 0: about 140 ms (125-150). Not re-measured with the offset applied |
| Video B (kick vs flash) | not done |

## Part 1: start
| Step | Result |
|---|---|
| 1 Chrome restart | PASS. Chrome runs with --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required. Tunnel up (ssh on [::1] and 127.0.0.1 :8790); conductor, set, slot and 27-eq-calibrate pages answer 200 |
| 2 Conductor, profile "home" | controller: on, bridge: on. **No profile "home" existed** (it was never saved: 19 Nov step 3 was not done). The user made it now: offset +140 ms |
| 3 Open slots | PASS: two windows opened. Chrome showed no MIDI/SysEx prompt (permission likely kept from earlier sessions) |
| 4 Slots on the beat, no click | Slot A (Hodge) PASS, slot B (Lenia) PASS: both move on the beat with no click in the windows |
| 5 "slot knobs" line | PASS, matches A = Hodge, B = Lenia: `slot knobs: A (btn 3/4, knobs 1-4): 1 beat . 2 dive . 3 glint \| B (btn 7/8, knobs 5-8): 5 beat` |

## Part 2: controller rings and buttons
| Step | Result |
|---|---|
| 1 Rings, A = Hodge, B = Lenia | PASS: knobs 1-3 blue, 4 dark, 5 orange, 6-8 dark. SysEx works (no prompt shown tonight) |
| 2 Button 4, slot A next | PASS: the user stepped slot A through all the scenes with button 4; the scene and the blue rings changed with each step |
| 3 Button 8, slot B next | PASS: Paint Pour = knobs 5-6 orange; EQ Calibrate = knobs 5-8 dark |
| 4 Buttons 3 / 7, previous | PASS: each slot goes back one scene |
| 5 Buttons 5 / 6 | PASS: no slot changes |
| 6 Rings fallback | not needed: the rings lit from the start |

## Part 3: beat strength
| Scene | Down | Middle | Up | Comment |
|---|---|---|---|---|
| Hodge (slot A, knob 1) | stops (not sure: the effect is small) | as before | reaction visible only at 100, weak | **the user: make Hodge's beat effect about 4x stronger** |
| Neon Lines (A knob 1 = 0 and B knob 5 = 100, side by side) | no difference seen | - | no difference seen | **FAIL by eye**: the same scene in both slots, one at 0 and one at 100, looks the same to the user. The knobs reach the conductor (knobs line 0 / 100). Served 16-neon-lines.html = main (beatKnob default 1, slot B +4). The user likes the picture |
| Lenia (A knob 1 = 0, B knob 5 = 100, side by side) | no beat reaction | - | B beats to the music | PASS, but small: the beat only changes the colour |
| Paint Pour (A knob 1 = 0, B knob 5 = 100, side by side; pulse knobs 2 / 6 untouched) | no reaction | - | no reaction to the beat at all | FAIL by eye with the pulse knob untouched. By the code, the beat knob scales only the kick's gloss and the colour pulse; the pulse starts at 0 until knob 2 / 6 moves, and the set has beatFx=0 |
| Paint Pour, pulse knobs 2 and 6 at 100 (A beat 0, B beat 100) | no reaction | - | B pulses to the music | PASS once the pulse knob is up: B (beat 100) pulses, A (beat 0) stays still. For the show: with the pulse knob untouched, Paint Pour shows no beat at all |
| Riemann Ribbon (A knob 1 = 0, B knob 5 = 100) | no reaction | - | B beats | PASS for the knob. The user does not like the beat effect: it looks like the picture just tilts fast |
| Hodge in slot B (knob 5: 0 / 50 / 100) | | | | PASS: B's Hodge reacts to knob 5 like A's to knob 1 (same small effect). See Problems: the stuck hexagons after the switch |

## Problems
- **Hodge stuck after switching slot B to it:** right after the switch the hexagons did not travel, they shook on the spot (not a full freeze). It came back to normal once a knob was moved. Looks like a maths glitch (perhaps a knob value / state not set until the first knob message). Not fixed; for the box.

## Requests from the user (for the box)
- LCXL3: light the scene-change buttons (3/4 slot A, 7/8 slot B) purple, so the active buttons stand out like the knob rings.
- Hodge beat strength: the reaction is only more or less visible at knob 100; make it about 4x stronger.
- Neon Lines beat strength: no visible effect between knob 0 and 100 (A and B side by side). Needs a much larger effect, or check that the knob reaches the scene in a slot.
- Lenia beat strength: the effect is small, only a colour change. The user expects flashes of light around the field on the beats, with the number of lights and their radius also scaled by the beat knob.
- Paint Pour: the beat shows only after the pulse knob (2 / 6) is raised; untouched it is 0, so knob 1 / 5 alone does nothing. Consider a non-zero pulse default in the set.
- Paint Pour idea (the user will think about it later): merge the pulse knob into the beat knob (knob 1 / 5 does both), and add a button that switches the automatic pour mode on and off.
- Riemann Ribbon (the user will think about it): the beat effect looks like the picture tilting fast; the user does not like it.

## Not done yet (at this push)
- Little Bang beat strength (#286 merged on main 3be539d; not tried tonight).
- The rest of the user's steps (the paste was cut off in Part 3 step 6): OBS/Resolume slots (CV-A / CV-B), EQ
  calibration, video A (route delay at +140), video B (kick vs flash).
