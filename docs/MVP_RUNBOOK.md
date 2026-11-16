# MVP runbook: scenes into Resolume (Mac)

Goal: 20 minutes of music, three scenes blended in Resolume on the projector. One flip on the conductor reaches all three scenes at the same bar. Panic on the conductor makes all black.

Route: Chrome scene windows -> OBS (window capture) -> DistroAV (one NDI stream per window) -> Resolume (NDI sources) -> projector.
Fallbacks: NDI Scan Converter (one copy per window), or the OBS Syphon plugin (github.com/ryrotella/obs-syphon-plugin, "Syphon Output" filter per source).

## Phase 0 - Check the Mac (10 min)
1. Connect the projector to HDMI. Connect the LCXL3 to USB.
2. In Terminal, run `ssh -L 8790:localhost:8790 puggie@192.168.8.164`. Keep this window open.
3. In a second Terminal window, run `curl -fsSL https://raw.githubusercontent.com/borboss366/cellular-viz/main/tools/mac-check.sh | sh`
4. Do the fix step of each FAIL. Without wired Ethernet, keep Wi-Fi on (the tunnel needs it) and ignore the Wi-Fi WARN. Phase 1 fixes the "Chrome occlusion" WARN.
5. On the check page in Chrome, push "Run checks". Allow MIDI and the microphone.
Gate: no FAIL.

## Phase 1 - Audio and conductor (5 min)
1. In System Settings > Sound, set the output to the Multi-Output Device (speakers + BlackHole).
2. Quit Chrome (Cmd+Q). Chrome stops drawing a window that other windows cover fully, and OBS then captures a still frame. The flag in step 3 stops this.
3. In Terminal, run `open -na "Google Chrome" --args --disable-backgrounding-occluded-windows`. Start Chrome this way before you open the tunnel pages.
4. In Chrome, open http://localhost:8790/experiments/clock-conductor.html
5. Load a track with a clear kick.
6. Push Play.
7. Do not minimize the conductor window. Chrome slows down minimized pages.
Gate: you hear the music. The header shows "controller: on" and "bridge: on".

## Phase 2 - Scene windows (5 min)
1. In a new tab, open http://localhost:8790/experiments/set.html
2. Push "Open all scenes". If only one window opens, allow pop-ups for this site and push again.
3. Set each scene window to 960 x 603 pt. The window minus Chrome's 63 pt bar is then 960 x 540 pt, which is 1920 x 1080 px on Retina. Claude Code can do this with AppleScript, for example (the positions of 16 Nov):
   `osascript -e 'tell application "Google Chrome" to set bounds of (first window whose title contains "Hodge") to {0, 38, 960, 641}'`
   Mass Gap: `{768, 38, 1728, 641}`. Lenia: `{384, 514, 1344, 1117}`.
4. Do not cover a scene window fully with other windows.
5. In each scene window, push Play.
Gate: the three scenes move with the beat. Push Shift+F on the conductor: all three flip at the same bar.

## Phase 3 - OBS to NDI (20 min)
1. If OBS is not installed, run `brew install --cask obs` (31.1.1 or newer).
2. Open your own Terminal window for steps 3 to 5. The libndi package (it comes with DistroAV) asks for the sudo password. Claude Code cannot type it.
3. Run `brew tap distroav/tap`.
4. Run `brew trust distroav/tap`.
5. Run `brew install --cask distroav/tap/distroav`. Type your password when the libndi package asks.
6. Start OBS. If OBS says the NDI runtime is missing, install it from ndi.video (6.3 or newer). Restart OBS.
7. Allow Screen Recording for OBS when macOS asks. Restart OBS.
8. In one OBS scene, add three "macOS Screen Capture" sources. Set each to "Window" and select one scene window.
9. If a source shows a still frame, set Method to "Display Capture". Then set Method to "Window Capture" again and select the window again.
10. On each source, open Filters. In Effect Filters, add "Crop/Pad". Set Top to 126 px. This removes Chrome's bar (63 pt on Retina).
11. On each source, add the effect filter "DistroAV NDI Output" (its old name is "Dedicated NDI output"). Keep "Crop/Pad" above it in the list. A crop in the scene transform does not reach NDI.
12. In each "DistroAV NDI Output" filter, set the field "NDI name" to CV-16, CV-12 or CV-06. Click "Apply changes". Without this step, the name is "CV-16 (CV-16)".
13. Keep this OBS scene visible in the preview. DistroAV sends a stream only while its source shows.
Gate: the three names show in Resolume (Phase 4).

## Phase 4 - Resolume (15 min)
1. Only on macOS 15 or newer: allow Resolume in System Settings > Privacy & Security > Local Network. macOS 14 does not have this setting.
2. Set the composition size to 1920x1080.
3. In the Sources tab, open NDI. Drag CV-16, CV-12 and CV-06 into layers 1, 2 and 3.
4. In Output > Fullscreen, select the projector.
Gate: the three scenes show on the projector. The layer faders blend them.

## Phase 5 - Controller into Resolume (10 min)
1. Open Audio MIDI Setup > Window > Show MIDI Studio. Double-click "IAC Driver". Tick "Device is online". Click Apply.
2. In Resolume Preferences > MIDI, turn on input for "IAC Driver Bus 1" only. Turn off input and output for every LCXL3 port.
3. In MIDI shortcut mode, link the LCXL3 faders to the opacity of layers 1 to 3. Knob rows 2 and 3 are free for effects. Knob row 1 and both button rows belong to the conductor page.
Gate: a fader moves its layer. The MIDI monitor shows the messages.

## Phase 6 - Test run (20 min)
1. Play 20 minutes. Include one breakdown and one track change.
2. Try hold: push Shift+L when the beat is right. If SUSPECT comes on, tap again or release (Shift+L).
3. At the end, push panic on the conductor. All goes black.
4. Look at the delay: the beat flash on the conductor against the projector.

## Phase 7 - Report
1. Send the FAIL lines of the check, if any.
2. On the conductor, push "Download log". Send the file (the box scores it, with the hold presses).
3. Write a few words: what lagged, what broke, what felt good.

## Next time
These stay set:
- The installs and the permissions (Screen Recording for OBS, MIDI and the microphone in Chrome).
- IAC Driver Bus 1 (online).
- The MIDI input in Resolume (IAC Driver Bus 1 only) and the fader links.
- The OBS scene: the sources, the Crop/Pad filters and the NDI names.
- The Resolume composition, if you saved it with Composition > Save As.

Do these each time:
1. Connect the projector to HDMI. Connect the LCXL3 to USB.
2. In Terminal, run `ssh -L 8790:localhost:8790 puggie@192.168.8.164`. Keep this window open.
3. Quit Chrome. Run `open -na "Google Chrome" --args --disable-backgrounding-occluded-windows`.
4. In Chrome, open the conductor page (Phase 1, step 4).
5. Load a track and push Play.
6. In a new tab, open set.html. Push "Open all scenes".
7. Set each scene window to 960 x 603 pt (Phase 2, step 3).
8. In OBS, open each source. Select its scene window again. Chrome's window ids change each time Chrome starts.
9. In Resolume, open Output > Fullscreen. Select the projector.
