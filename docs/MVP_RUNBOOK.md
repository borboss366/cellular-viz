# MVP runbook: scenes into Resolume (Mac)

Goal: 20 minutes of music, three scenes blended in Resolume on the projector. One flip on the conductor reaches all three scenes at the same bar. Panic on the conductor makes all black.

Route: Chrome scene windows -> OBS (window capture) -> DistroAV (one NDI stream per window) -> Resolume (NDI sources) -> projector.
Fallbacks: NDI Scan Converter (one copy per window), or the OBS Syphon plugin (github.com/ryrotella/obs-syphon-plugin, "Syphon Output" filter per source).

## Phase 0 - Check the Mac (10 min)
1. Connect the projector to HDMI. Connect the LCXL3 to USB.
2. In Terminal, run `ssh -L 8790:localhost:8790 puggie@192.168.8.164`. Keep this window open.
3. In a second Terminal window, run `curl -fsSL https://raw.githubusercontent.com/borboss366/cellular-viz/main/tools/mac-check.sh | sh`
4. Do the fix step of each FAIL. Without wired Ethernet, keep Wi-Fi on (the tunnel needs it) and ignore the Wi-Fi WARN.
5. On the check page in Chrome, push "Run checks". Allow MIDI and the microphone.
Gate: no FAIL.

## Phase 1 - Audio and conductor (5 min)
1. In System Settings > Sound, set the output to the Multi-Output Device (speakers + BlackHole).
2. In Chrome, open http://localhost:8790/experiments/clock-conductor.html
3. Load a track with a clear kick. Push Play.
Gate: you hear the music. The header shows "controller: on" and "bridge: on".

## Phase 2 - Scene windows (5 min)
1. In a new tab, open http://localhost:8790/experiments/set.html
2. Push "Open all scenes". If only one window opens, allow pop-ups for this site and push again.
3. In each scene window, push Play.
Gate: the three scenes move with the beat. Push Shift+F on the conductor: all three flip at the same bar.

## Phase 3 - OBS to NDI (20 min)
1. If OBS is not installed, run `brew install --cask obs` (31.1.1 or newer).
2. Run `brew tap distroav/tap`, then `brew trust distroav/tap`, then `brew install --cask distroav/tap/distroav`.
3. Start OBS. If OBS says the NDI runtime is missing, install it from ndi.video (6.3 or newer). Restart OBS.
4. Allow Screen Recording for OBS when macOS asks. Restart OBS.
5. In one OBS scene, add three "macOS Screen Capture" sources. Set each to "Window" and select one scene window.
6. On each source, add the filter "Dedicated NDI output". Names: CV-16, CV-12, CV-06.
7. Keep this OBS scene visible in the preview. DistroAV sends a stream only while its source shows.
Gate: the three names show in Resolume (Phase 4).

## Phase 4 - Resolume (15 min)
1. Allow Resolume in System Settings > Privacy & Security > Local Network.
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
