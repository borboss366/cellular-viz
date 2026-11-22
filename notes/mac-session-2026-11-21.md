# Mac session 21 Nov: Saturday rehearsal (fix checks, OBS/Resolume slots, EQ calibrate, dress rehearsal)

The user's steps for today (pasted at the start). Main at the start: b5be08d (Merge #297), after ec34bef. Background:
notes/mac-session-2026-11-20.md (part 2 stopped after its Hodge step). Input on Sunday: the built-in microphone.

## Part 1: start
| Step | Result |
|---|---|
| 1 Chrome, tunnel, pages | PASS: Chrome restarted (pid 33652) with --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required; tunnel up on [::1] and 127.0.0.1 :8790; conductor, set, slot, 27-eq-calibrate answer 200; the box serves main (set.json, 16-hodge-kaleidoscope.html, slot.js identical to b5be08d) |
| 2 Conductor, profile "home" | PASS: "home" = +143 ms |
| 3 Open slots | PASS: two windows, both move on the beat (A Hodge, B Lenia) |
| 4 Knobs 1 and 5 to the middle | PASS: `knobs 1-8: 57 - - - 53 - - -`; `slot knobs: A (btn 3/4, knobs 1-4): 1 beat . 2 dive . 3 glint \| B (btn 7/8, knobs 5-8): 5 beat` |
| 5 Purple buttons (#288) | PASS: upper buttons 3, 4, 7, 8 purple; 1, 2, 5, 6 dark |

## Part 2: check yesterday's fixes
| Step | Result |
|---|---|
| 1 Hodge switch shake (#290): slot A Little Bang 2 min -> Hodge | **Visually gone**: no shake, ghosted outlines or burst seen |
| 1 Hodge state, two readings ~10 s apart | `{"beats":291.5101829789638,"idx":49,"morph":0.5058038967262476,"pop":0.1777916611549838,"clockLate":{"late":0,"lateMaxMs":0,"maxGapMs":42.7,"lookAheadMs":100}}` then `{"beats":329.1845615442151,"idx":63,"morph":0.541754726430159,"pop":0.15881742610693064,"clockLate":{"late":0,"lateMaxMs":0,"maxGapMs":42.7,"lookAheadMs":100}}`. **PASS: +14 changes in +37.7 beats = one per 2.7 beats** (yesterday: ~720 in 150 beats during the catch-up). idx 49 at the first reading fits about 130 beats (~1 min) since the switch at that rate, not a burst: the first reading was not taken right after the switch. clockLate 0; maxGapMs 42.7 (one long frame, yesterday 19.3) |
| 2 Riemann switch (#290): slot B 2 min on another scene -> Riemann Ribbon | PASS: no camera jump or shake |
| 3 Knob pick-up (#289), Hodge dive knob 2 fully up before the switch | PASS: no dive at once after the switch. To pick it up the user had to turn knob 2 back and then forward: turning further up did nothing, because at the top (127) the knob sends no new value. For the runbook: "after a switch, wiggle a scene knob (back, then forward)"; at an end stop only the move away from it counts |
| 4 Hodge beat (#292, 4x) | Still too weak for the user: "could be bigger, 100 is not enough". **On the fix list** (the user asked for it as a fix) |
| 5 Paint Pour pulse on by default (#291), knob 2 untouched | PASS: it pulses with knob 1 alone; only the colour pulses (by design: the beat knob scales the colour pulse and the gloss, the paint is not stirred, beatFx=0) |
| 6 Paint Pour tilt (#293), knob 3 0 -> 100 | **The paint flows upwards** on screen; it would make more sense flowing downwards. Idea from the user (not for Sunday unless asked): on each beat, stir the whole plane a little at points on a grid, so the paint mixes slowly with the music |
| 6 (cont.) | The user: "probably knob 4" (read here as: put the new control, the grid stir, on knob 4 in slot A / 8 in slot B; knob 4 is free in Paint Pour). Also asked for **diffusion** of the paint: Paint Pour has no diffusion parameter today (no diffus* in 24-paint-pour.html / .mjs), so it is new code. Both are ideas, not on the Sunday fix list unless the user says so |
| 7 Lenia beat lights (#295) | The user saw no flashes. Lenia frame: `{"on":false,"fired":119,"skipped":23,"maxPerSec":3,"maxJump":0.29749299999999995,"amp":0}`: the lights **had been on and fired 119 times** (23 skipped by the flash limit, max 3/s), but were off at the reading (L pressed twice?). So the key works; the flashes were not seen |
| 7 (cont.) lights on, knob 5 at 100 | Seen now: `{"on":true,"fired":123,...}`. The spots light only the Lenia mass (by design: "never the dark ground"), so **single cells hardly flash; when the mass covers the area, the flashing is clear and knob 5 controls it well** |
| 7 (decision) | The user wants the Lenia beat lights **on by default** on Sunday (set.json: Lenia query lights=1). On the fix list. The user may make fixes today |
| 8 Neon bigger beat (#296), A knob 1 = 0 vs B knob 5 = 100 | Visible now, but small: the lines only get a bit thicker. The user: **at 100 they should be about 10x thicker**. On the fix list |
| 8 (cont.) user request | Add a volumetric light (glow) around the lines that jumps with the beat; add a scene knob for the line thickness (knob 2 in slot A / 6 in slot B). On the fix list (the user plans fixes today) |

## Part 3: Little Bang
| Step | Result |
|---|---|
| 1 Slot A on Little Bang, kick playing | showing |
| 2 Speed knob 2 (after a wiggle) | PASS: fully down stops the camera; the user: "actually rather cool effect" |
| 3 Beat knob 1 (0 / middle / 100) | The kick reaction changes, but only slightly |
| 3 (idea from the user) | The path: today the endless tube bends to the left all the time. The user wants the curvature to drift toward a point in the view that changes over time: sometimes straight ahead, then drifting toward the top left so the camera travels round a tube curved that way, then elsewhere, and so on |
| 3 (decision) | Little Bang beat stronger: **on the fix list**. The path idea stays an idea |
| 4 Travel view too dark? | Not too dark for now: "ok if we add the motion I described". Brighter effects maybe later, not decided today. Judged on the slot window, not the projector (the slots are not in OBS/Resolume yet) |

## Part 4: slots in OBS and Resolume
| Step | Result |
|---|---|
| 1 OBS CV-A / CV-B | Scene "Scene 2 slots": sources "slot A" (window 15285 = slot A) and "slot B" (15286 = slot B), Show cursor off, Crop/Pad top 126 above the NDI filter. Two slips found from Untitled.json and dns-sd: (a) the NDI filters were named "Crop A" / "Slot B" with NDI name ${filter}, so the network saw "crop A" and "Slot B", not CV-A / CV-B; (b) the slot A window had been resized to 1022 x 700 pt (would give ~2044 x 1274 px after the crop), set back to 960 x 602 by AppleScript at the user's request. The old per-scene sources (CV-16/06/24/11, scene "Scene multiple") still send: the fallback |
| 1 (fixed) | PASS: NDI filters renamed CV-A / CV-B; dns-sd shows BORISS-MBP.LAN (CV-A) and (CV-B), and "crop A" / "Slot B" are gone. OBS sources keep the names "slot A" / "slot B" |
| 2 Faders did nothing after the MIDI mapping | Cause: the LCXL3 had come unplugged (the bridge had nothing to forward). After reconnecting, all faders work. For the runbook: if the faders stop, check the USB cable and the conductor header "controller: on, bridge: on" first |
| 2 + 5 Resolume, saved composition | Saved 18:28 as ~/Documents/Resolume Arena/Compositions/**cellular-viz-2-slots.avc** (the brief said "cellular-viz-slots"). 2 layers, 9 columns: layer 1 column 6 = NDI BORISS-MBP.LAN (CV-A), layer 2 column 6 = NDI (CV-B). Resolume clips (IntoTheGlow, Bass/Beat/Synth demo clips) sit in other columns of layers 1-2; there is **no layer 5 fallback** and no old per-scene layers in this composition (they stay in Example.avc, 19 Nov). **MIDI (Shortcuts/MIDI/Default.xml, unchanged since 19 Nov 23:43): IAC CC 5 -> layer 1, CC 6 -> layer 2, CC 7 -> layer 3, CC 8 -> layer 4. So layer 2 (CV-B) is on fader 2, not fader 5; no CC 9 mapping is saved** |
| 2 (decision) | The user keeps **CV-B on fader 2** (more convenient than fader 5): Sunday = fader 1 CV-A, fader 2 CV-B. The Resolume demo clips in other columns of layers 1-2 serve as the fallback. Runbook/brief correction: "CV-B layer 2 / fader 5" -> fader 2 |
| 3 Ten switches per slot (buttons 4 and 8), on the projector | Longest switch about 50 ms by eye |
| 3 (cont.) | PASS: no black that stays, no scene that does not move |
| 4 Crossfade A <-> B with faders 1 and 2 | PASS: no freeze on the projector |
| 5 Save | see step 2: cellular-viz-2-slots.avc |

## Part 5: EQ calibration and the delay
| Step | Result |
|---|---|
| 1 EQ page | With the brief's URL (no capture=1) the page waited for Play and did not flash. **Runbook/brief correction: add `&capture=1`** (`27-eq-calibrate.html?clock=shared&audio=mic&kick=1&capture=1`): then it starts by itself, shows the clean stage, and flashes on the beat. Window set to 960 x 602 pt by AppleScript for the crop |
| 1 (OBS / NDI) | PASS: OBS source "calibrate" (scene "Scene 2 slots", window 16535), Show cursor off, Crop/Pad top 126 above the NDI filter "CV-EQ"; dns-sd shows (CV-EQ). Resolume layer: the user put it on (not saved yet) |
| 1 (Resolume, saved 18:42) | cellular-viz-2-slots.avc now has 3 layers: **layer 1 = CV-EQ, layer 2 = CV-A, layer 3 = CV-B** (column 6). The new layer went in at the bottom and pushed the slots up. The MIDI maps by layer number (CC 5 -> layer 1, CC 6 -> 2, CC 7 -> 3), so fader 1 now fades CV-EQ, fader 2 CV-A, fader 3 CV-B: not the Sunday plan (fader 1 CV-A, fader 2 CV-B) |
| 4-6 First two clips (phone, 30 fps, ~9 s each, with sound; in ~/Downloads, not in git) | Clip 1 = offset 0, clip 2 = offset +151 (read off the conductor in the frame). Both show the projector (white clock square, cyan kick square) and the conductor's Calibrate flash bar. Measured per frame (mean brightness of each square / the bar, onset at the threshold crossing interpolated between frames) and from the audio (low band < 120 Hz, onset peaks). **Clip 1, route (projector white − conductor bar): n = 9, median 138 ms, IQR 134..149, min 105, max 220** (18 Nov: ~140). Clip 1, projector white − loud kick heard by the phone: n = 5, median −19 ms (IQR −22..−15): at offset 0 the flash already landed ~20 ms *before* the heard kick, because the conductor's beat was 158 ms ahead of the heard kick (n = 5, IQR −162..−154). Cyan kick square − heard kick: median 54 ms. Clip 2 (offset 151): projector white − heard kick median +38 ms (n = 4); conductor bar − projector not consistent (median 102, IQR 97..157). **Clip 2 contradicts clip 1** (more offset should make the flash earlier, not later). Likely reasons: the track is not four-on-the-floor (heard kicks alternate 570 / 980 ms, the tracker read 77 BPM, so the clock can sit on either kick), the clips are short (9 s) and 30 fps (33 ms per frame). The phone's audio/video offset (tens of ms) adds to every audio number. **Usable number: the route delay ~138 ms.** The user is re-filming in slow motion |
| 4 Offset by eye | The user: around **+180 ms** looks good by eye (with the input as set today). Slow-motion video to follow |
| 5 Video A, slow motion (route delay) | ~/Downloads/1000022594.mp4 (not in git): com.android.capture.fps = 120 (1 frame = 8.33 ms), 1166 frames = 9.7 s, no audio. Tracker 124.2 BPM, offset +181 ms. Conductor Calibrate bar: 20 flashes, period 483 ms (124.2 BPM). **Projector white square − conductor bar: n = 13, median 163 ms (19.6 frames), IQR 150..170, min 137, max 186.** Values: 170, 163, 137, 164, 150, 186, 162, 147, 172, 143, 170, 156, 176. Higher than 18 Nov (~140) and today's 30 fps clip 1 (138); today the route carries 3 NDI layers in Resolume plus the old per-scene senders. The conductor bar moves with the offset like the scenes (W − C stayed positive at +181), so W − C is the route alone. The cyan kick square (mic onsets, same route) lit ~190 ms after the white one (n = 9 paired ones, 169..230), which includes the mic and onset-detection latency, so it cannot give the final result. Video B (kick vs flash with sound) not filmed |

## Mic input test (built-in microphone, as on Sunday)
| Step | Result |
|---|---|
| 1 Conductor ?clock=line&in=Microphone, offset by eye | With the mic as the input the user finds about **+230 ms** good by eye (vs +180 with today's earlier input). This fits: the route alone measured 163 ms, and with the mic the clock also hears the room sound late (mic + onset detection; the cyan kick square lit ~190 ms after the white one at +181) |
| 1 (profiles) | Saved two profiles: **"home" = +180** (line input), **"mic" = +230** (built-in microphone, the Sunday fallback) |
| 2 set.html?in=Microphone, Open slots | PASS: both slots move on the beat with the mic input |
| 3 Old slot windows closed, OBS re-pointed | The user: all good. Chrome now has slot A = window 17114 {0,38}, slot B = 17115 {768,445}, both 960 x 602 (old 15285 / 15286 gone). OBS had not written its scene file since 18:34 at the check, so the new ids are not confirmed from the file; the user checked by eye |

## Runbook corrections (found today)
- EQ calibrate URL needs `&capture=1` (`27-eq-calibrate.html?clock=shared&audio=mic&kick=1&capture=1`); without it the
  page waits for Play and shows its panel.
- Faders: Sunday = fader 1 CV-A, fader 2 CV-B (the user's choice; the brief said fader 5). Resolume MIDI maps by layer
  number, so adding a layer at the bottom shifts every fader: add new layers at the top.
- OBS: set the DistroAV "NDI name" (or name the filter) CV-A / CV-B and click Apply changes; check with the Resolume
  NDI list. Keep slot windows at 960 x 602 pt (a resized window breaks the 1920 x 1080 crop).
- Re-opening slots gives new Chrome windows: close the old ones and re-pick the window in each OBS source.
- After a scene switch, wiggle a scene knob back then forward; at an end stop only the move away from it counts.
- If the faders stop: check the LCXL3 USB cable and the conductor header "controller: on, bridge: on" first.
- Offset profiles: "home" = +180 (line input), "mic" = +230 (built-in microphone). Pick one after every conductor reload.

## Fix list (only what blocks Sunday)
- Hodge beat strength: still too weak after #292 (4x); knob 1 / 5 at 100 is not enough. Make it clearly stronger (the user asked for this as a fix).
- Lenia beat lights on by default in the set (set.json, Lenia: `"lights": "1"`; the page reads ?lights=1). L still toggles them.
- Neon Lines beat: at knob 1 / 5 = 100 the lines should be about 10x thicker on the beat (now only a bit thicker after #296).
- Neon Lines: a volumetric light (glow) around the lines that jumps with the beat.
- Neon Lines: a scene knob for the line thickness (knob 2 / 6; Neon has only the beat knob today).
- Little Bang beat: the kick reaction changes only slightly between knob 0 and 100; make it clearly stronger.
- Resolume (the user, no code): move the CV-EQ layer to the top so CV-A = layer 1 / fader 1 and CV-B = layer 2 /
  fader 2 again (cellular-viz-2-slots.avc at 18:42 had CV-EQ on layer 1), then save.

## Ideas (after Sunday, not on the fix list)
- Paint Pour: the tilt (knob 3) makes the paint flow upwards; it should flow downhill. A beat stir at grid points over
  the whole plane (on knob 4 / 8). Diffusion of the paint (no such parameter today).
- Little Bang: a path whose curvature drifts toward changing points in the view, not always left. Brighter effects maybe.

## Part 7: dress rehearsal (long set on the microphone)
| Step | Result |
|---|---|
| Start | 21 Nov 22:31, tunnel up (ssh -L 8790), input = built-in microphone, profile "mic" |
| Run | The user played a **4-hour set** (4x the brief's 1 hour) and reported: "everything works after 4 hour session and it is fine". No glitch, freeze or crash reported |
| Not recorded | The 15-minute status-line checks, the QuickTime audio and the conductor log Download (no new conductor-*.jsonl in ~/Downloads). Result is from the user's report only |

## Part 8: files on the box
Copied to `/home/puggie/pi-durable-worker/data/conductor-logs/2026-11-21/`, sha256 the same on the Mac and the box:
| File | sha256 |
|---|---|
| delay-route-offset0-2026-11-21.mp4 | 070d314541441fdcb7a5d7bd1cffaa8fe293d58914a4353adc9e53fd3bc9195c |
| delay-route-offset151-2026-11-21.mp4 | 09b35eb2f0c7556d27aba4a74178211be09c38cac8e77ce851befcc6f3bd6b08 |
| delay-route-slowmo-2026-11-21.mp4 | 6ae5218ac8f96c21a4acbe360740d87ee2b98391dd154df6964640aa64b4ab54 |

## Offset for Sunday
- Sunday runs on the Mac's microphone (#297): use profile **"mic" = +230 ms**.
- Profile **"home" = +180 ms** is for the line input (next week). The measured route delay is 163 ms (slow-mo, n = 13).

## Not done
- Part 5 step 3 (peak dBFS / CLIP) and video B (kick vs flash with sound).
- Part 6 Paint Pour finger test (open since 19 Nov).
- Part 7 15-minute checks, QuickTime audio and conductor log (see Part 7).
- Part 8 panic test (B).
