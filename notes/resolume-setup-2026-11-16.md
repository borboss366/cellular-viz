# Resolume setup on the Mac (16-17 Nov)

The MVP runbook (docs/MVP_RUNBOOK.md) run on the show Mac, guided by Claude Code per docs/RESOLUME_MAC_BRIEF.md.

## Summary
- Gates: phase 0 PASS (2 FAILs deferred to the phases that fix them), 1 PASS, 2 PASS (flip judged by eye), 3 PASS,
  4 PASS, 5 PASS, 6 PARTIAL (the Resolume part works; hold and auto hold are tested on 17 Nov).
- Route working: Chrome scene windows -> OBS macOS Screen Capture (Window) + Crop/Pad -> DistroAV NDI Output
  (CV-16, CV-12, CV-06) -> Resolume layers 1-3 -> projector; LCXL3 faders 1-3 -> conductor bridge -> IAC Driver Bus 1 ->
  Resolume layer opacity.
- Fixed in the repo: set.html opened no windows (fb11e7f).
- Open: the Chrome occlusion pause (below), the mac-check LCXL3 name, the runbook's DistroAV filter name, the delay
  and the conductor log (not taken yet).

Brief: docs/RESOLUME_MAC_BRIEF.md (main 88c277b). Runbook: docs/MVP_RUNBOOK.md.

## Versions
- Mac: Apple M3 Pro, macOS 14.3 (23D56)
- Chrome: 157.0.8103.79
- BlackHole 2ch: installed (driver in /Library/Audio/Plug-Ins/HAL)
- OBS: 33.0.1 (installed by the user with brew, 16 Nov)
- DistroAV: 6.2.2 (brew cask distroav/tap/distroav; the plugin in /Library/Application Support/obs-studio/plugins, symlinked into ~/Library/...)
- NDI runtime: libndi 6.3.2.0.260413 (pkg com.newtek.libndi, /usr/local/lib/libndi.dylib; came with the DistroAV cask)
- Resolume: Arena 7.29.0 (/Applications/Resolume Arena/Arena.app), installed 16 Nov by the user, no licence yet (demo)

## State at start
- Tunnel on :8790: opened in step 2 (ssh on [::1] and 127.0.0.1); set.html and setup-check.html answer 200
- LCXL3 on USB: connected (LCXL3 1: MIDI + DAW ports; IAC Driver Bus 1 online)
- Displays: built-in + BenQ PJ 1920x1080 @ 60 Hz, extended (mirror off); the projector needed a second look

## Gates
| Phase | Result | Notes |
|---|---|---|
| 0 Check the Mac | PASS (2 FAILs deferred) | mac-check 8 PASS / 3 WARN / 1 FAIL: capture route, fixed in Phase 3. setup-check 6 PASS / 1 FAIL: shared clock, needs the conductor playing (Phase 1). WebGL2 on Metal M3 Pro, LCXL3 DAW ports, IAC bus, BlackHole input, panic channel all PASS |
| 1 Audio and conductor | PASS | output = Multi-Output Device (checked); conductor page through the tunnel; a track with a clear kick plays and is heard; header: controller: on, bridge: on; setup-check again: 7 PASS, shared clock 56 messages in 3 s, 116.7 bpm, locked |
| 2 Scene windows | PASS (flip by eye) | set.html broken (see problems), 3 scene windows opened by hand: 16b, 12, 06 (shared clock, line in BlackHole, capture=1); all move with the beat; Shift+F: all three seem to flip at the same bar (the user is not 100 % sure; visual only) |
| 3 OBS to NDI | PASS on the network (Resolume gate in Phase 4) | 3 macOS Screen Capture (Window) sources, DistroAV NDI Output filter each; dns-sd shows <mac>.LAN (CV-16), (CV-12), (CV-06) |
| 4 Resolume | PASS | Local Network step n/a on macOS 14.3; composition 1920x1080 (seen on a screenshot); CV-16/12/06 in layers 1/2/3, column 6; Output > Fullscreen > BenQ PJ; three scenes on the projector without bars after the crop; layer opacity faders blend them |
| 5 Controller into Resolume | PASS | IAC Driver online; Resolume midi.xml: input IAC Driver Bus 1 only, no outputs (no LCXL3 port); faders 1-3 MIDI-learned to layer 1-3 opacity; a listener on IAC saw 412 x BF 05, 192 x BF 06, 346 x BF 07; the user saw the layers fade |
| 6 Test run | PARTIAL | the user (17 Nov): the Resolume part works fine; hold / auto hold left for tomorrow. Not reported tonight: the 20 min run with breakdown + track change, panic to black, the delay, the conductor log |

## Problems and fixes
- mac-check (main 88c277b): 7 PASS, 3 WARN, 2 FAIL. FAIL Resolume (not installed), FAIL capture route (no OBS / DistroAV /
  NDI yet: Phase 3). WARN default output (Phase 1), WARN Wi-Fi (ignored, as the brief says).
- mac-check false WARN "LCXL3 on USB: not found": the controller is connected, but system_profiler lists it as "LCXL3 1",
  and the check greps for "Launch Control". The MIDI ports are there (LCXL3 1 MIDI / DAW). For the repo: match "LCXL3" too.
- Resolume FAIL fixed: the user installed Arena 7.29.0. Re-check: 8 PASS, 3 WARN, 1 FAIL (capture route, Phase 3).

- set.html (main 88c277b): "Open all scenes" and every "Open" button do nothing. The page shows "Maximum call stack size
  exceeded at open (set.html:45/46)". Cause: set.html declares a top-level `function open(i)` in a classic <script>, which
  replaces window.open; its own call `window.open(...)` on line 46 then calls itself forever. Fix for the repo: rename
  the function (e.g. openScene) or wrap the script. Workaround tonight: open the three scene URLs by hand (same query as
  set.json: clock=shared&audio=line&in=BlackHole&capture=1).
  Fixed on main at the user's request: fb11e7f (openScene + a regression test that fails on the old page; suite 472 pass,
  0 fail). The box served the old set.html for a few minutes after the push (it serves its own checkout), then the fix.

- DistroAV install: `brew install --cask distroav/tap/distroav` stopped at its dependency libndi: its pkg installer needs
  sudo, and Claude Code has no terminal for the password. Fix: the user ran the same command in their own Terminal.

- OBS: the first macOS Screen Capture (Window) of a scene window showed a still frame. The OBS log said
  "[ mac-screencapture ]: init_screen_stream: Failed to start capture with error (null)". Screen Recording was granted and
  OBS had been restarted. Fix: in the source properties, Method to Display Capture and back to Window Capture, then pick
  the window again. The capture started and no new error came.

- DistroAV 6.2.2 names the filter "DistroAV NDI Output", not "Dedicated NDI output" as the runbook says (it is in Effect
  Filters). Its "NDI name" field defaults to `${filter} (${source})`, so naming only the filter gave "CV-16 (CV-16)". Fix:
  set NDI name to CV-16 / CV-12 / CV-06 and click "Apply changes". The runbook could say both.

- Runbook Phase 4 step 1 (Local Network for Resolume): the pane doesn't exist on macOS 14.3. Local Network privacy
  starts with macOS 15, so the step is skipped here. (The mac-check INFO line says the same thing.)

- Resolume: CV-16 (Hodge) was static while CV-12 and CV-06 moved. The OBS log had no errors. Cause: the Hodge Chrome window
  was covered by other windows, and Chrome stops drawing a covered window (macOS occlusion), so OBS captured a still
  frame. Fix tonight: no scene window fully covered (the user brought Hodge to the front: OK). For the show: start
  Chrome with --disable-backgrounding-occluded-windows (needs a Chrome restart), or tile the windows. Also: the
  conductor window was minimized; keep it open (minimized pages get throttled).

- The projector showed Chrome's title + address bar: OBS Window Capture records the whole window. Fix: a Crop/Pad
  filter on each source ABOVE the DistroAV NDI Output filter (the NDI filter sends the filtered source, so a scene
  transform crop would not reach NDI). Top = 126 px (63 pt bar on Retina). Scene windows set by AppleScript to
  960 x 603 pt (bar + 960 x 540 = 1920 x 1080 px after the crop): Hodge {0,38}, Mass Gap {768,38}, Lenia {384,514}.

- Same occlusion pause again: when WebStorm (on the laptop screen) covered the scene windows, all scenes froze on the
  projector. Left as is for tonight (the user's call). TODO for the show: start Chrome with
  --disable-backgrounding-occluded-windows (then re-open the scenes and re-pick the 3 windows in OBS: Chrome's window
  ids change; the crop and NDI filters stay), or never cover the scene windows fully.

## Next time
- Kept: the installs and permissions, the IAC Driver, Resolume's MIDI input, the OBS scene (sources, crops, NDI names),
  the Resolume composition if saved (Composition > Save As).
- Each time: projector + LCXL3, the tunnel, the conductor page, set.html > Open all scenes, the scene windows at
  960 x 603 pt, re-pick the window in each OBS source (Chrome's window ids change), Resolume Output > Fullscreen.

## Delay seen
- Not measured yet (Phase 6 is partial).
