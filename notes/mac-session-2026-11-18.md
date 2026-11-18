# Mac session 2 (18 Nov): test run, hold, OBS Browser Source

Brief: docs/MAC_SESSION_2_BRIEF.md. Standing rules: docs/AGENT_CC_MAC.md. Week brief: docs/SATURDAY_BRIEF.md.
Previous session: notes/resolume-setup-2026-11-16.md. Main at the start: 8ec264c (Merge #261).

## Preparation (before the user came back, about 20:45-22:50)

| Step | Result |
|---|---|
| 1 git pull on main | done, fast-forward to 8ec264c |
| 2 read CLAUDE.md, AGENT_CC_MAC, SATURDAY_BRIEF, MAC_SESSION_2_BRIEF, GUEST_DJ_RUNBOOK, the 16 Nov notes | done |
| 3 ssh -o BatchMode=yes puggie@192.168.8.164 true | PASS (exit 0, no password prompt) |
| 4 box folders | made: data/conductor-logs, data/saturday-2026-11-21/{audio,log,video} (owner puggie, mode 775). Box disk: 98 G, 22 G free (77 % used) |
| 5 Mac free disk | 44 GiB free of 460 GiB (Data volume 90 % used) |
| 7 audio inputs | see "Audio inputs" below: no input other than BlackHole and the built-in mic |
| 8 OBS and Resolume configs | see "OBS and Resolume, read from their files" below: both as on 16 Nov |

mac-check now (tunnel closed, LCXL3 unplugged, Chrome without the flag): 9 PASS, 4 WARN, 1 FAIL.
- FAIL Tunnel (not open yet).
- WARN Chrome occlusion (Chrome runs without the flag).
- WARN Line input: only BlackHole 2ch and the MacBook Pro Microphone.
- WARN LCXL3 (unplugged).
- WARN Wi-Fi (ignored, as the brief says).

The "LCXL3" match and the occlusion check are new on main and work.

Re-run on the user's request (about 23:00): main still 8ec264c, ssh PASS, the box folders exist (22 G free), Mac 44 GiB
free, the audio inputs unchanged (BlackHole, built-in mic). The tunnel is now open and Resolume is running. Chrome has
run since 17 Nov 00:03 without the flag, with one window (the conductor). mac-check: 11 PASS, 4 WARN (Chrome occlusion,
Line input, LCXL3 unplugged, Wi-Fi), 0 FAIL.

### Disk space for recording
- Mac: 44 GiB free. That is enough for:
  - QuickTime audio at about 1 GB per hour (AIFF-C 24-bit stereo, about 16 MB per minute);
  - one OBS recording (about 5-10 GB per hour at 1080p, depending on the encoder settings).
- Box: 22 GB free. A phone video in 4K can be 20-40 GB per hour, which may not fit there. Film in 1080p, or check the
  size before the copy.

## Audio inputs the Mac sees now (system_profiler SPAudioDataType)
| Device | Input channels | Transport | Note |
|---|---|---|---|
| BlackHole 2ch | 2 | Virtual | BlackHole |
| MacBook Pro Microphone | 1 | Built-in | the built-in mic (default input) |

**No other input.** The USB audio interface for Saturday is not connected or not bought yet. Outputs: BenQ PJ (HDMI),
BlackHole 2ch, MacBook Pro Speakers, Multi-Output Device (the default output).

## OBS and Resolume, read from their files (nothing opened or changed)
OBS, scene collection "Untitled" (~/Library/Application Support/obs-studio/basic/scenes/Untitled.json, 16 Nov 23:21),
scene "Scene":
| Source | Type | Filters, in order |
|---|---|---|
| CV-16 | macOS Screen Capture, Window (id 1135) | Crop/Pad top 126 -> DistroAV NDI Output "CV-16" (name `${filter}`) |
| CV-12 | macOS Screen Capture, Window (id 1139) | Crop/Pad top 126 -> DistroAV NDI Output "CV-12" |
| CV-06 | macOS Screen Capture, Window (id 1140) | Crop/Pad top 126 -> DistroAV NDI Output "CV-06" |

The window ids are the 16 Nov Chrome windows. After a Chrome restart, each source must be given its window again.

Resolume Arena 7.29.0 (not running now):
- Composition: ~/Documents/Resolume Arena/Compositions/Example.avc (the current composition in config.xml). It has 3
  layers, 9 columns, 1920 x 1080, and NDI clips for CV-16, CV-12 and CV-06.
- It was saved under the name "Example", not "cellular-viz-mvp". It works as is. A Save As under its own name would keep
  it safe from a "reset to the example".
- MIDI input: IAC Driver Bus 1 only, no outputs (Preferences/midi.xml).
- Fader mappings: in the MIDI shortcut preset "Default" (Shortcuts/MIDI/Default.xml, 16 Nov 23:28), not in the
  composition. IAC Driver Bus 1 -> /composition/layers/1, 2 and 3/video/opacity. They load with any composition.

## Commands for tonight

### The tunnel (its own Terminal window, keep it open)
```
ssh -L 8790:localhost:8790 puggie@192.168.8.164
```

### Chrome with the occlusion flag
Quit Chrome first (Cmd+Q; it closes every Chrome window, Gmail too). Then:
```
open -na "Google Chrome" --args --disable-backgrounding-occluded-windows
```
mac-check's "Chrome occlusion" line then says PASS.

### The scene windows at 960 x 603 pt (the 16 Nov positions)
Run after "Open all scenes" on set.html. It moves and resizes only the three scene windows (matched by title).
```
osascript <<'EOF'
tell application "Google Chrome"
  repeat with w in windows
    set t to title of w
    if t starts with "16b" then set bounds of w to {0, 38, 960, 641}
    if t starts with "12 " then set bounds of w to {768, 38, 1728, 641}
    if t starts with "06 " then set bounds of w to {384, 514, 1344, 1117}
  end repeat
  return {title, bounds} of every window
end tell
EOF
```
960 x 603 pt = the 63 pt title and address bar + 960 x 540 pt. On Retina that is 1920 x 1080 px after OBS's Crop/Pad
(top 126 px). The conductor window went to {0, 641, 1100, 1117} on 16 Nov:
`osascript -e 'tell application "Google Chrome" to repeat with w in windows' -e 'if title of w starts with "clock conductor" then set bounds of w to {0, 641, 1100, 1117}' -e 'end repeat'`

### The Mac check
```
cd ~/WebstormProjects/cellular-viz && sh tools/mac-check.sh
```
Or the version on main: `curl -fsSL https://raw.githubusercontent.com/borboss366/cellular-viz/main/tools/mac-check.sh | sh`.
Add `--no-open --json` for Claude Code.

### The conductor log to the box
"Download log" saves `<session>.jsonl` to ~/Downloads (the session id is in the page header, `conductor-YYYYMMDD-HHMMSS`).
```
scp ~/Downloads/<session>.jsonl puggie@192.168.8.164:/home/puggie/pi-durable-worker/data/conductor-logs/
ssh puggie@192.168.8.164 ls -l /home/puggie/pi-durable-worker/data/conductor-logs/
```
- The 20-minute run and the hold test (corpus id `gasolina`) are two separate downloads. Copy both and write both
  names below.
- Never put a log in the repo.

## Part 0: bring the route up (fill in)
1. Projector and LCXL3 connected; the tunnel open.
2. Chrome restarted with the flag (needs the user's OK: it closes all Chrome windows).
3. Conductor page (no `?clock=line` tonight: the playlist plays). Do not minimize it.
4. set.html -> "Open all scenes" -> the AppleScript above.
5. OBS: give each of CV-16, CV-12, CV-06 its window again (Method: Window Capture). If a preview stays still: Display
   Capture, then Window Capture again (the 16 Nov fix).
6. Resolume: open Example.avc if it is not open; Output > Fullscreen > BenQ PJ.

Gate: the three scenes move on the projector; a fader fades its layer. Result: **PASS** (about 23:00).
- LCXL3 and the BenQ projector were seen by system_profiler.
- Chrome was quit and started again with the occlusion flag (the user's OK). The flag is checked on the process command
  line.
- set.html > Open all scenes worked (the fixed page).
- The scene windows are 960 x 603 pt in an even cascade, at the user's request: Hodge {0,38}, Mass Gap {384,276},
  Lenia {768,514}, each 384 pt across and 238 pt down from the one before. They overlap, which the flag makes harmless.
- OBS saved the new window ids (3683, 3684, 3685). NDI shows CV-16, CV-12 and CV-06.
- Resolume Fullscreen on the BenQ. Fader 1 fades its layer.

## Part 1: the test run (fill in)
- 20 minutes, one breakdown, one track change, tracks with a clear kick.
- Hold: Shift+L or upper button 1 (CC 37; its LED is green when held, amber when suspect).
- Auto-hold: Shift+U or upper button 2 (CC 38; it is kept in localStorage and starts off). Try it once.
- One hand fix (Shift+F or a tap): all scenes follow.
- Panic at the end: all black.
- Delay: film the conductor screen and the projector in one shot, in slow motion. Count the frames from the beat flash
  to the projector beat. ms = frames x 1000 / fps (for example 240 fps: 1 frame = 4.2 ms).

| What | Result |
|---|---|
| 20 min without a freeze or a crash | PASS by the user's account: about 45 min in the log, no freeze reported (with the occlusion flag on) |
| hold presses and what SUSPECT did | hold and auto-hold used; SUSPECT came on very rarely, and hold fixed the rare problems (the user; see "What the user decided") |
| auto-hold tried | yes (the user: tap, hold and auto-hold "do the trick") |
| hand fix followed by all scenes | ___ |
| panic -> black | PASS: Blackout (B) on the conductor -> all three scenes black on the projector; B again (or Clear) brings them back. "Works perfectly" (the user) |
| delay (frames, fps, ms) | not counted on the Mac. The user's phone video is on the box: data/conductor-logs/delay-slowmo-2026-11-18.mp4 (41.3 MB, 47.8 s, 1080 x 1920 portrait, sha256 a9a93268…eb717, same on both sides). The box counts the frames. ffprobe: 1424 frames, played at about 29.8 fps, and the tag com.android.capture.fps = 120. So **one frame in the file = 1/120 s = 8.33 ms** of real time (not 33 ms). Delay ms = frames between the conductor's flash and the projector's beat x 8.33 **Measured on the Mac afterwards (19 Nov 00:20): about 140 ms, see "Delay measured" below.** |
| log file on the box | `conductor-20261118-225849.jsonl` in data/conductor-logs/ (5.55 MB, 34 025 lines, sha256 35681d6a…6e92, same on the Mac and the box). It covers about 44.7 min (2679 s of ctx) |

What the log counts (read on the Mac, the box scores it):
- 50 hand fixes, all from the keyboard (fix:key): 47 taps and 3 nudges. None came from the controller.
- 17 hold presses (fix:key): 13 hold, 4 auto-hold.
- Records: 22 holdSuspect, 5 holdRecentre, 61 jumps, 26 xfade records, 36 track records.

- All of tonight's run was played on the **keyboard** (the user). The controller test after the run: the live log
  (GET /log/conductor-20261118-225849 through the tunnel) has 4 holdPress `hold` and 3 `tap` fixes with origin
  **fix:controller**, ctx 2970-2985 s; each tap landed as a jump. Upper button 1 (hold) and lower button 1 (tap) both
  reach the clock as controller presses.

### Hold test on the corpus id `gasolina` (on its own, auto-hold OFF)
1. Check that auto-hold says "off" (Shift+U toggles it).
2. Play from the start. Wait for "locked" and a beat that is right.
3. Hold (Shift+L): write the track time and the bpm.
4. Watch for 2 minutes. Write every state change (held, free-run, SUSPECT) and whether the scenes stay on the beat,
   by ear and by eye.
5. If the clock is wrong while held: tap 8 times on the beat (this re-anchors the hold).
6. If it is still wrong: hold again to release it. Write whether the tracker finds the beat again, and after how many
   seconds.
7. "Download log", then scp it (above). Write the file name.
Known for this track (qa/corpus.json): 96 bpm, dembow 3-3-2, "beat fine, the 1 wrong: set 1 by hand".

| Track time | Event | State / bpm | On the beat? |
|---|---|---|---|
| | hold | | |
| | | | |
Log file: the same session as the run (`conductor-20261118-225849.jsonl`); there was no separate download for the hold test.

## Part 2: OBS Browser Source test (no code)
**Result (18 Nov, about 23:50-23:58): partial.**
- In OBS's browser, WebGL2 runs on the M3 Pro's GPU, a scene draws, and NDI reaches Resolume.
- But MIDI and the microphone hang (no permission prompt in CEF), and the shared clock does not arrive (BroadcastChannel
  stays inside Chrome). So a scene there does not follow the beat.
- The 2-slot Browser Source setup needs a clock channel that crosses browsers before it can work. Saturday stays on
  Chrome windows + Window Capture.

1. OBS: Scene Collection stays "Untitled". Make a new scene "BrowserTest" (+ under Scenes). It does not touch "Scene".
2. Add a "Browser" source:
   - URL http://localhost:8790/experiments/setup-check.html
   - width 1920, height 1080
   - "Use custom frame rate" on, 60
   - "Shutdown source when not visible" OFF
3. Keep the conductor playing in Chrome.
4. Right-click the source -> Interact -> "Run checks". Write every line below.
5. Change the URL to
   http://localhost:8790/experiments/16-hodge-kaleidoscope.html?clock=shared&audio=line&in=BlackHole&capture=1
   (the query of set.json). Check: does it draw, move with the beat, and flip with Shift+F? Is it smooth (Docks > Stats, or View > Stats in older OBS:
   render lag and skipped frames)?
6. Add a DistroAV NDI Output filter, with NDI name `CV-TEST` and "Apply changes". Does Resolume see CV-TEST under
   Sources > NDI?
7. Read the OBS log for browser / CEF errors: ~/Library/Application Support/obs-studio/logs/ (the newest file), or ask
   Claude Code to read it.

Expected:
- The shared clock FAILs. OBS's browser is its own Chromium, so the BroadcastChannel from Chrome does not reach it.
- BlackHole may FAIL (no microphone permission in OBS's browser).
- Either result is useful, not a problem.

| Check | Result line |
|---|---|
| WebGL2 / GPU | PASS: WebGL2 on ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro). Secure context PASS too |
| BlackHole input | not reached (the MIDI check hangs first) |
| shared clock | not reached (the MIDI check hangs first) |
| panic channel | not reached (the MIDI check hangs first) |
| MIDI | **hangs**: the page stays on "running ..." after WebGL2 (screenshot 23:53). setup-check.html line 64 awaits `navigator.requestMIDIAccess({ sysex: true })` with no timeout. OBS's browser (CEF) shows no permission prompt, so the promise never settles and the later checks (audio input, shared clock, panic) never run. For the box agents: a timeout on the MIDI check, so the rest still runs |
| Hodge draws / moves / flips / smooth | **draws, does not move with the beat** (the user, 23:55). Cause: the shared clock is a BroadcastChannel ('cellular-viz-clock'), which works only inside one browser. OBS's browser (CEF 150, obs-browser 2.27.5) is a separate browser from Chrome, so it gets no clock messages, and the scene stays on its own clock. By the same logic, flip and panic from the conductor can't reach it either. audio=line (BlackHole) likely waits on a getUserMedia prompt that CEF never shows (the same as MIDI above). So with today's code, the 2-slot OBS Browser Source setup can't follow the conductor. It would need the clock over a channel that crosses browsers (e.g. a WebSocket on the conductor server). That is box work, after Saturday |
| CV-TEST in Resolume | PASS: DistroAV NDI Output on the Browser source, NDI name CV-TEST (sender created 23:56:45). dns-sd shows <mac>.LAN (CV-TEST), and Resolume lists it under Sources (the user). A Browser Source does reach Resolume over NDI; only the clock is missing |
| OBS log, CEF errors | none. The log has: Browser Hardware Acceleration true, obs-browser 2.27.5, CEF 150.0.7871.252, scene BrowserTest and the Browser source added. No errors after that |

## What could not be prepared, and why
- **Chrome with the flag:** it needs Chrome to quit, which closes every Chrome window. The rules say to ask first.
- **OBS window picks and the Resolume output:** these need the new Chrome windows and Resolume open. The rules say only
  to read their config files tonight.
- **The line input:** no USB audio interface is connected. "Line input" WARNs. Saturday's audio chain can't be checked
  until it is there.
- **The tunnel:** it isn't open. Opening it is the user's step, and it stays open in its own window.
- **The NDI runtime version in mac-check:** it is always "not found", even with libndi 6.3.2.0 installed (pkg
  com.newtek.libndi, /usr/local/lib). The check has no version probe (tools/mac-check.sh, about line 212). `pkgutil
  --pkg-info com.newtek.libndi` gives it. For the box agents; not needed tonight.
- **The commit to tag `saturday-rc1`:** named after tonight's gates (see below).

## Seen on the side: OBS runs at 30 fps
- The OBS status bar shows **30.00 / 30.00 FPS** (screenshot 23:53).
- The DistroAV NDI Output filters send at OBS's video frame rate, so CV-16, CV-12 and CV-06 likely reach Resolume at 30
  fps, even though the scenes draw at 60.
- OBS Settings > Video > Common FPS Values = 60 would raise it, at a CPU/GPU cost. That is a setting change: only with
  the user's OK, and best tried on Friday's dress rehearsal with OBS Stats and Resolume's fps in view.

## Delay measured (19 Nov, from the 120 fps video)
**The projector shows the beat about 140 ms after the conductor's beat lamp** (median 16-17 frames; middle half
125-150 ms; range 108-175 ms over 19 beats).
- Video: data/conductor-logs/delay-slowmo-2026-11-18.mp4 on the box, 1424 frames.
  - Capture is 120 fps (com.android.capture.fps), so 1 frame = 8.33 ms.
  - Check: the beat lamp's onsets are 58.4 frames apart = 123.3 bpm, against the conductor's 122.9.
- Signals per frame (ffmpeg -> 270 x 480 RGB, numpy):
  - the count of yellow pixels in the conductor's lamp row: the beat lamp lights for 14 frames ≈ the page's 0.1 s;
  - the mean brightness of the projector area: the scene's bars jump on the beat.
- Each beat-lamp onset was matched to the largest brightness rise in the next 45 frames.
  - 19 of 24 beats gave 13-21 frames.
  - 4 gave 38-44 frames: the scene had no clear jump on that beat, so the next one was picked. They are left out.
  - 1 (the first) gave 14 frames.
- What the number means:
  - The beat lamp marks when the beat is heard (the clock reads now − output latency), so the picture lags the sound
    by about 140 ms. That matches the user's "the visualisation lags a bit".
  - The route is Chrome -> OBS Window Capture -> DistroAV NDI -> Resolume -> the projector, including the projector's
    own input lag.
  - The ±15 ms spread is mostly sampling: the conductor's screen at 60 Hz and OBS at 30 fps.
- Next:
  - The scenes need about +140 ms of visual offset. That is inside today's OFFSET_MAX of 200 ms, but the scenes don't
    apply the conductor's offset yet (see Problems: clock.js sharedMessage). That is box work.
  - OBS at 60 fps (Friday, with the user's OK) may cut the spread and some of the delay. Measure again afterwards the
    same way.

## What the user decided
- **Controls (the user, 18 Nov): "From the tools - tapping, hold and auto hold seem to do the trick. Most likely I won't
  need other controls on the external controller."**
  - Kept on the controller: tap (lower 1), hold (upper 1), auto-hold (upper 2).
  - The other lower-row fixes (flip, ÷2, ×2, nudge −10/+10, set 1, restart) stay mapped, but the user does not expect to
    use them on Saturday.
  - For the box agents: don't spend time on more controller mappings this week (that fits the Saturday freeze).

- **Hold and SUSPECT (the user, 18 Nov): "SUSPECT comes super rarely, hold fixes the rare problems. Not worth
  investing more. With code we reached a reasonable maximum."**
  - The hold test on `gasolina` was played by ear. No per-event track times were written down: the user judged it from
    playing.
  - For the box agents: no more work on hold, SUSPECT or the tracker's beat logic before Saturday.

## Problems and fixes during the session
- **The picture lags the sound (the user, 18 Nov): "the visualisation lags a bit from the sound. Need to always adjust
  the delay."**
  - Likely part of the cause, read from the code: the conductor's offset does not reach the scenes. The conductor
    publishes its visual offset in every shared-clock message (experiments/clock.js line 1181, `offsetMs:
    clock.visualOffsetMs`). The scenes' receiver ignores it (clock.js `sharedMessage`, lines 738-760: it uses beats,
    bpm, bar and t, and never offsetMs). Each scene keeps its own offset at 0, and no scene has an offset control. So
    the conductor's Calibrate slider (Alt+, / Alt+.) moves only the conductor's own flash, not the projector.
  - The lag itself is the route: Chrome -> OBS capture -> NDI -> Resolume -> the projector. It is not measured yet (the
    slow-motion test in Part 1).
  - For the box agents:
    - (a) the scenes apply the publisher's offsetMs (or a set.json "offsetMs" passed to every scene), so one control
      moves all of them;
    - (b) a venue profile keeps the value, so it is set once per setup, not again and again;
    - (c) the scene offset may need a larger range than −100…+200 ms (OFFSET_MIN / OFFSET_MAX, clock.js) once the route
      delay is measured.
  - Not checked on the hardware tonight: whether moving the slider changes the projector at all.
- **HDMI drop (the user, 18 Nov):** when the HDMI connection to the projector drops and comes back, Resolume's
  fullscreen output does not come back by itself. Fix: Output > Fullscreen > BenQ PJ again. For the guest DJ runbook
  (section 6 "What to do if"): add "projector black after a cable bump: Output > Fullscreen > the projector". Secure
  the HDMI cable on Saturday (tape or strain relief).
- **Request for the box agents (the user, 18 Nov): "Open all scenes" should place the scene windows evenly, on a
  diagonal, at the capture size.** Today set.html opens each window at 1920 x 1080 with a 40 px step
  (experiments/set.js, windowFeatures, line 55-58; experiments/set.json "window" line 5). On this Mac that makes the
  windows larger than the screen, so they get moved and resized by hand (the AppleScript above) every session.
  Wanted:
  - each window 960 x 603 pt: the 63 pt Chrome bar + 960 x 540, so OBS's Crop/Pad top 126 gives 1920 x 1080 px on
    Retina;
  - window i at left = i x (screen width - 960) / (n - 1), top = i x (screen height - 603) / (n - 1), using the screen's
    available area (screen.availLeft/availTop/availWidth/availHeight).
  - On this Mac (1728 x 1079 available from y 38), the user's layout tonight is Hodge {0,38}, Mass Gap {384,276},
    Lenia {768,514}.
  - Both sizes should stay settable in set.json "window".
  Not changed here (the Mac doesn't change code).
(fill in)

## Clean-up after Part 2
The user switched OBS back to "Scene" (CV-16/12/06 sending) and removed CV-TEST from Resolume. The OBS scene
"BrowserTest" with its Browser source and CV-TEST filter is **left in OBS** (the user's choice). It sends only while
BrowserTest is the active scene.

## The commit to tag saturday-rc1
**8ec264c92ca3209ecb649ce702f8530fa3921100** (8ec264c, Merge #261: the conductor records its input). The box served exactly this commit
tonight (data/cellular-viz-runner at 8ec264c), and all of tonight's gates ran on it. This notes file is committed on top
of it and changes no code.

## Summary for the Orchestrator
- PASS: Part 0 (route up again, Chrome with the occlusion flag, even diagonal scene layout); Part 1 (about 45 min, no
  freeze, hold / auto-hold / tap enough, panic black; controller tap and hold checked); log
  conductor-20261118-225849.jsonl and delay-slowmo-2026-11-18.mp4 (120 fps capture: 1 frame = 8.33 ms) in
  data/conductor-logs/.
- Part 2 partial: an OBS Browser Source draws on the GPU and reaches Resolume over NDI, but it gets no shared clock
  (BroadcastChannel) and no MIDI or mic (CEF has no prompt). Saturday stays on Chrome windows.
- The user decided: no more work on hold, SUSPECT or controller mappings this week.
- Delay measured from the video: the projector is about 140 ms behind the heard beat (125-150 ms).
- For the box: the scenes ignore the conductor's offsetMs (clock.js sharedMessage), and they need about +140 ms; "Open all scenes" should place the
  windows 960x603 pt on a diagonal; setup-check's MIDI check needs a timeout; a runbook line on HDMI drops (Resolume
  Output again);
- Tag saturday-rc1 = 8ec264c.
