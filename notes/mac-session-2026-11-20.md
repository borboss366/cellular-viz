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

- **The conductor shows the wrong track (part 2, evening):** the conductor's track label named one track while a different track was playing (names left out, rule R9). Not investigated; for the box: where the conductor's label comes from and when it updates.

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

## Part 2 (evening)

### Part 1: start
| Step | Result |
|---|---|
| 1 Reload conductor, profile "home" | PASS: "home" survives the reload; it shows **+143 ms** (the user had set 143, not 140, in part 1) |
| 2 Reload both slots | PASS: both back on the beat (A Hodge, B Lenia) |
| 3 Knobs 1 and 5 to the middle | PASS: `knobs 1-8: 50 - - - 50 - - -`; `slot knobs: A (btn 3/4, knobs 1-4): 1 beat . 2 dive . 3 glint \| B (btn 7/8, knobs 5-8): 5 beat` |

### Part 2: Hodge stuck after a switch
| Step | Result |
|---|---|
| B: Lenia -> Hodge with button 8 (3 or 4 presses), no knob touched (steps 1-4) | **Glitch seen, short:** for a fraction of a second right after the switch. The user's impression: "the beats accumulate and then get processed all at once" (a burst of catch-up, not a long shake this time) |
| B: Console after the switch (step 5) | empty (no errors, no warnings) |
| B: state after the switch, before any knob (step 6) | `metronome` is not a global in Hodge (module const), so the brief's knobs command gives "n/a". Output: `{"beat":{"g":1.008688014075748,"knob":5,"fixed":null,"fake":null,"kickSize":0.0026252633254184622,"pop":0.004409270862107646,"breath":0.02017376028151496,"glow":0.030628072129882056,"hueG":1.008688014075748},"knobs":["n/a","n/a","n/a","n/a","n/a","n/a","n/a","n/a"]}`. So beatKnob = 5 (slot B) and g = 1.009 (knob 5 = 50, about the middle): the beat gain looks right. Object.keys(__qa) has 66 keys, among them: beat, dive, knobs, nobeat, clockLate, beatLog, sharedClock, beatWeight, fakeKnob, fakeBeatGain |
| B: after a knob move (step 7) | Output (the brief's command again): `{"beat":{"g":3,"knob":5,"fixed":null,"fake":null,"kickSize":0.03700832930511042,"pop":0.06946437239674451,"breath":0.06,"glow":0.43176384189295486,"hueG":2},"knobs":["n/a",...]}`. g = 3 means knob 5 was at the top at that moment (the user asked "knob 5?" just before) |
| B: Hodge after the knob moves | Normal; knob 6 (dive in slot B) "dives quite nicely". The glitch had already passed (it lasted a fraction of a second), so this run can't show whether a knob move is what ends it |
| A: Lenia -> Hodge with button 4 (step 8) | **Glitch seen, and the user found a pattern: the more scenes pass before Hodge, the longer the glitch.** slot.js removes the old scene's frame on a switch (each scene loads fresh), so this is not a hidden frame piling up beats. A guess for the box: the fresh Hodge catches up on something that grows with time since the slot opened or the clock started (e.g. stepping through all missed beats or morphs from 0, a little per frame) |
| A: Hodge state during the glitch | `{"beats":1889.6086124482235,"bars":472.4021531120559,"morph":1,"morphBeats":1,"idx":198,"pop":1,"clockLate":{"late":0,"lateMaxMs":0,"maxGapMs":19.3,"lookAheadMs":100}}`. **idx = 198 on a page that loaded seconds before**: Hodge had stepped through 198 shape changes. Likely cause (read from the code, not changed): 16-hodge-kaleidoscope.html schedStep() returns at most one change per frame and sets s.next only on the first frame. If that first frame sees a small `beats` (before the shared clock's beat count arrives) and the next frames see ~1890, the clock did not jump *back*, so there is no reset, and the scene then fires one shape change per frame until s.next catches up with ~1890 beats. A new shape every frame = the shake. The catch-up takes about (beats since the clock started) / (hold beats) frames, so it grows the longer the set runs, which matches the user's "the more scenes pass, the longer the glitch". A change of hold (shapeRate) re-aligns s.next to now, which may be why a knob move seemed to end it on 20 Nov. Fix idea for the box: also reset the schedule when the clock jumps *forward* by more than a hold |
| A: Hodge state after the glitch, calm | `{"beats":2043.2498629021482,"bars":510.81246572553704,"morph":1,"morphBeats":1,"idx":920,"pop":0.02985423505169318,"clockLate":{"late":0,"lateMaxMs":0,"maxGapMs":19.3,"lookAheadMs":100}}`. idx went from 198 to 920 while beats went from 1890 to 2043 (+153). So about 720 shape changes in about 150 beats: the page kept firing changes far faster than one per hold, which fits the catch-up |
| A: Hodge state ~30 s later, no switch | `{"beats":2117.6256960184032,"bars":529.4064240046008,"morph":1,"morphBeats":1,"idx":955,"pop":0.00857172987554947,"clockLate":{"late":0,"lateMaxMs":0,"maxGapMs":19.3,"lookAheadMs":100}}`. +35 changes in +74 beats = one change per ~2 beats: the normal rate once caught up. **Summary of the three readings:** the catch-up ran at hundreds of changes per 150 beats, then the normal rate. Total changes ≈ beats / 2 (955 vs 2118 / 2 = 1059; the gap fits a first frame at a small, non-zero beat count). clockLate stayed 0 throughout: the clock was fine, the scene's own schedule was not |
| B: knob 5 moved before the switch to Hodge (step 9) | **Shakes anyway.** Moving the beat knob first does not prevent it (as expected from the cause above). The user took a screenshot (Desktop, 19:52, kept on the Mac, not in git): octagons with stacked, ghosted outlines and smeared trails, as if many shapes were drawn over each other in quick succession |
| Other scenes | The user: **all scenes seem to have this switch glitch; Hodge shows it most. Riemann Ribbon also shook quite intensely after a switch.** The same one-change-per-frame schedule (`next === null` set only on the first frame) is in 16-neon-lines.mjs (and 17-bsd-skater, 19-skate-park, not in the set). Riemann and the others don't use it, so their shake may have a related but different catch-up: for the box to check every scene for work that grows with the clock's beat count at load |
