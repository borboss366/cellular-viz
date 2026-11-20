# Guest DJ runbook (Saturday 21 Nov)

A guest DJ plays house on a Pioneer DDJ-FLX4. You play the visuals on the projector with the LCXL3. The music comes
from the DJ's controller, not from the conductor page. Brief: `docs/SATURDAY_BRIEF.md`. Background:
`docs/MVP_RUNBOOK.md` (the 16 Nov route: OBS, NDI, Resolume) and `qa/CONDUCTOR_GUIDE.md` (keys and controller).

Rule: no DJ name, no track names and no audio in the repo. Files go to the box folder only (section 7).

## 1. The audio chain
Route: FLX4 master out (one RCA pair) -> two RCA Y-splitters -> (a) the speakers, (b) the USB audio interface's line
input -> the Mac.
1. Connect the FLX4 master out (left and right RCA) to the two Y-splitters.
2. Connect one leg of each splitter to the speakers.
3. Connect the other leg of each splitter to the line input of the USB audio interface.
4. Connect the interface to the Mac with its USB cable.
5. Set the interface's input gain low. Turn it up until the input meter shows signal on the loud parts, without clip.
6. Write down the interface's name as the Mac shows it (System Settings > Sound > Input). Below it is `<interface>`.
Gate: music from the FLX4 plays on the speakers, and the interface's meter moves.

Fallback, if the interface does not work: use the Mac's built-in microphone. Put the Mac near a speaker. Use
`in=Microphone` everywhere below.

## 2. Check the Mac
1. In Terminal, run `ssh -L 8790:localhost:8790 puggie@192.168.8.164`. Keep this window open.
2. In a second Terminal window, run `curl -fsSL https://raw.githubusercontent.com/borboss366/cellular-viz/main/tools/mac-check.sh | sh`
3. Read the line "Line input". It must say PASS and name `<interface>`.
4. Do the fix step of each FAIL. Ignore the Wi-Fi WARN.
Gate: no FAIL, "Line input" PASS.

## 3. Guest mode: the conductor and the scenes
1. Quit Chrome (Cmd+Q).
2. In Terminal, run
   `open -na "Google Chrome" --args --disable-backgrounding-occluded-windows --autoplay-policy=no-user-gesture-required`.
   (The second flag lets each scene start its audio clock without a key press; the slot windows need it, below.)
3. In Chrome, open http://localhost:8790/experiments/clock-conductor.html?clock=line&in=<interface>
   (a part of the name is enough, for example `in=USB`).
4. Push "Start audio". Allow the microphone when Chrome asks.
5. Do not load a track. Do not push Play.
6. Wait until the state shows "locked" and the beat lamp flashes with the music.
7. Do not minimize the conductor window.
8. In a new tab, open http://localhost:8790/experiments/set.html?in=<interface>
9. Check that the "Input" field shows `<interface>`.
10. Push "Open all scenes".
11. Check the scene windows: "Open all scenes" opens the set's seven scenes (Hodge Kaleidoscope, Lenia Effects,
    Paint Pour, Riemann Ribbon, EQ Calibrate, Neon Lines, Little Bang Beamline; experiments/set.json) at 960 x 603 pt
    on a diagonal. Move one only if it does not fit. EQ Calibrate (scene 5, the kick square on) is for setting the
    mixer's EQ; it needs no OBS source. Neon Lines (scene 6) and Little Bang Beamline (scene 7) are shown through the
    slot windows below; this fallback path has no OBS source for them.
12. In each scene window, push a key one time.
Gate: the scenes move with the music. Shift+F on the conductor flips all of them at the same bar.

The slot windows (instead of steps 10 to 12; "Open all scenes" stays the fallback):
1. On set.html, push "Open slots". Two windows open on the diagonal: slot A (starts on scene 1) and slot B (scene 2).
   Each shows one scene of the set at a time.
2. Step through the set (seven scenes; the ends wrap around). One half of the controller per slot: upper buttons
   3 / 4 = slot A previous / next, 7 / 8 = slot B previous / next (upper 1 / 2 stay hold / auto-hold; 5 / 6 are the
   audition page's). Presses from each slot's start:

   | Scene | Slot A (starts on 1) | Slot B (starts on 2) |
   |---|---|---|
   | 5 EQ Calibrate | 3 x button 3, or 4 x 4 | 3 x button 8, or 4 x 7 |
   | 6 Neon Lines | 2 x button 3, or 5 x 4 | 3 x button 7, or 4 x 8 |
   | 7 Little Bang Beamline | 1 x button 3, or 6 x 4 | 2 x button 7, or 5 x 8 |

   In a slot window the left / right arrow keys do the same. A switch is
   black for about a second, until the new scene is on the beat. A blackout stays black across a switch.
3. OBS: two Window Capture sources, the window "slot A" and the window "slot B", with DistroAV NDI Output CV-A and
   CV-B (hide the four scene sources).
4. Resolume: CV-A in layer 1 (fader 1), CV-B in layer 2; map fader 5 (IAC, CC 9) to layer 2's opacity. The fallback
   clip stays in layer 5.
Gate: both slots move with the music; a press on upper button 4 shows the next scene in slot A within about a second.

## 4. OBS, Resolume and the recording
1. In OBS, open each source. Select its scene window again (Chrome's window ids change). The set has four scenes:
   one Window Capture source per scene, each with its DistroAV NDI Output (CV-16, CV-06, CV-24, CV-11). Mass Gap
   (CV-12) is no longer in the set: remove or hide its source.
2. In Resolume, open Output > Fullscreen. Select the projector.
3. In Resolume, put one of Resolume's own clips (for example a generator from the Sources tab) in layer 5. This is
   the fallback picture (section 6). Layers 1 to 4 hold the four scenes (NDI sources CV-16, CV-06, CV-24, CV-11).
   The 16 Nov MIDI shortcuts map faders 1 to 3 to layers 1 to 3; map fader 4 (IAC, CC 8) to layer 4's opacity too.
4. Ask the DJ: "May we record the audio and film the projector?" Continue with steps 5 to 7 only after a yes.
5. In QuickTime Player, select File > New Audio Recording. Click the arrow next to the Record button. Select `<interface>` as the Microphone and Quality: Maximum (uncompressed 24-bit AIFF-C, 44.1 kHz; about 16 MB per minute in stereo). Push Record.
   If box task 3 (#261, the conductor's own recording) is merged, it is the main recording; QuickTime is the fallback.
6. Put the phone on the tripod. Point it at the projector and the room. Start the video.
7. If Friday showed no frame drops: in OBS, start one recording (the audio input, the four captures, the conductor).

Calibrate the delay (in the 15:30 sound check, with music that has a clear kick): watch the projector, not the laptop.
On the conductor, move the "offset" slider (or Alt+, / Alt+.) until the beat on the projector lands on the kick you
hear. + makes the pictures earlier. On this setup start at +140 (measured on 18 Nov: the projector about 140 ms
behind the conductor's beat lamp), then fine-tune by eye. The slider moves every scene. The conductor's beat
lamp stays on the sound; its white flash bar runs early; that is expected. Type a name next to it (for example
`saturday`) and push Save. After a reload the slider starts at 0: pick the saved name in the list.
Do not move it during the set. The parts of a scene that follow the sound level itself (the line-input band levels)
stay late by the route delay; only the beat-timed parts move.

The controller's top knob row (pot row 1) goes to the scenes, one half per slot: knobs 1-4 (above fader 1; slot A's
buttons are upper 3 / 4) belong to slot A's scene, knobs 5-8 (above fader 5; slot B's buttons are upper 7 / 8) to slot
B's. The first knob of each slot (1 or 5) is the beat: fully down =
the beat off, the middle = as before, fully up = three times as strong. The next knobs depend on the scene:

| Scene | Slot A knobs | Slot B knobs |
|---|---|---|
| Hodge Kaleidoscope | 1 beat, 2 dive (a fast turn down = a burst), 3 glints | 5 beat, 6 dive, 7 glints |
| Lenia Effects, Riemann Ribbon, Neon Lines | 1 beat | 5 beat |
| Paint Pour | 1 beat, 2 pulse | 5 beat, 6 pulse |
| EQ Calibrate | none | none |
| Little Bang Beamline | 1 beat, 2 travel speed (down = the camera stops, up = one lap a bar) | 5 beat, 6 travel speed |

The conductor shows the knob values ("knobs 1-8") and, below, each slot's buttons and knobs and what its scene does
with them ("slot knobs: A (btn 3/4, knobs 1-4): 1 beat . 2 dive . 3 glint | B (btn 7/8, knobs 5-8): 5 beat . 6
pulse"). Until a knob is turned, its scene uses its own default (the beat as
before). "Open all scenes" (the fallback) uses slot A's knobs 1-4 for every scene.
Before the show: set knobs 1 and 5 to the middle. The knobs are absolute: the first touch jumps to where the knob is,
so a knob left fully down turns the beat off at the first touch.
The beat knob works on a scene once that scene has been updated for it (the VIZ pages scene PRs); until then the
scene ignores it.

## 5. Saturday: the order of steps (setup done by 16:00)
| Time | Step |
|---|---|
| 14:00 | The projector, the LCXL3, the audio chain (section 1). |
| 14:30 | Check the Mac (section 2). |
| 14:45 | Guest mode, the conductor and the scenes (section 3). |
| 15:15 | OBS and Resolume (section 4, steps 1 to 3). |
| 15:30 | Sound check: play any music from the FLX4 for 10 minutes. Check the beat, a flip, hold, panic. |
| 16:00 | Setup done. Do not change anything after this. |
| 17:00 | The visit. Recording (section 4, steps 4 to 7). |

## 6. What to do if
- A scene freezes:
  1. Bring its window to the front (click it, or use Mission Control).
  2. If the projector still shows a still picture: in OBS, open that source and select its window again.
- The beat is off:
  1. Push flip (Shift+F, or the controller's flip button). It lands at the next bar.
  2. When the beat is right, push hold (Shift+L, or top button 1).
  3. If SUSPECT comes on and the beat is wrong: tap 8 times on the beat (Shift+A), or push hold again to release it.
- All else fails:
  1. Push panic on the conductor (B, or "Blackout"). The scenes go black.
  2. In Resolume, raise layer 5 (its own clip). Lower layers 1 to 4.
  3. Fix the cause. Then push "Clear" on the conductor and bring layers 1 to 4 back.

## 7. After the visit: the files to the box
All files go to one folder on the box, outside the repo: `/home/puggie/pi-durable-worker/data/saturday-2026-11-21/`.
1. Stop the QuickTime recording. Save it (File > Save) as `saturday-audio.aifc`.
2. Stop the phone video. Copy it to the Mac.
3. On the conductor, push "Download log".
4. In Terminal, run:
   `ssh puggie@192.168.8.164 mkdir -p /home/puggie/pi-durable-worker/data/saturday-2026-11-21/audio /home/puggie/pi-durable-worker/data/saturday-2026-11-21/log /home/puggie/pi-durable-worker/data/saturday-2026-11-21/video`
5. Run `scp saturday-audio.aifc puggie@192.168.8.164:/home/puggie/pi-durable-worker/data/saturday-2026-11-21/audio/`
6. Run `scp <the downloaded log>.jsonl puggie@192.168.8.164:/home/puggie/pi-durable-worker/data/saturday-2026-11-21/log/`
7. Run `scp <the phone video> puggie@192.168.8.164:/home/puggie/pi-durable-worker/data/saturday-2026-11-21/video/`
8. If you made an OBS recording, copy it to the `video/` folder the same way.
9. Write the file names in `notes/mac-session-2026-11-21.md`. Do not put the files, the DJ's name or the track names
   in the repo.
