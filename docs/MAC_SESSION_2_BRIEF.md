# Brief for Claude Code on the user's Mac: session 2 (test run, hold, OBS Browser Source)

You are on the user's Mac (Apple silicon M3 Pro, macOS 14.3). On 16 Nov the user set up the route with you: Chrome scene windows -> OBS Window Capture + Crop/Pad -> DistroAV NDI Output (CV-16, CV-12, CV-06) -> Resolume Arena layers 1-3 -> projector; LCXL3 faders -> conductor bridge -> IAC Driver Bus 1 -> layer opacity. Gates 0-5 passed. Your notes of that night: notes/resolume-setup-2026-11-16.md in the repo. Read it first.

Tonight has three parts, in this order. Do one step at a time. Tell the user each step in short, simple sentences. Wait until he says it is done.

Repo (public): https://github.com/borboss366/cellular-viz . Also read docs/MVP_RUNBOOK.md (phases 0-7) and qa/CONDUCTOR_GUIDE.md (the conductor keys and the controller).

## Part 0 - Bring the route up (use "Next time" in the notes file)
1. Projector and LCXL3 connected. The tunnel open in its own Terminal window: `ssh -L 8790:localhost:8790 puggie@192.168.8.164`.
2. Quit Chrome. Start it with `open -na "Google Chrome" --args --disable-backgrounding-occluded-windows`. Without this flag Chrome stops drawing a covered window and the projector freezes on that scene.
3. Open the conductor page (http://localhost:8790/experiments/clock-conductor.html). Do not minimize its window.
4. Open http://localhost:8790/experiments/set.html. Push "Open all scenes". Set the scene windows to 960 x 603 pt (as on 16 Nov).
5. In OBS, select the window again in each of the 3 sources (Chrome window ids change). The crop and NDI filters stay.
6. In Resolume, Output > Fullscreen > the projector.
Gate: the three scenes move on the projector. A fader fades its layer.

## Part 1 - The test run (runbook Phase 6)
1. Play 20 minutes from the conductor. Include one breakdown and one track change. Use tracks with a clear kick.
2. Hold: when the beat is right, push Shift+L (or top button 1). If SUSPECT comes on, tap again or release with Shift+L. Try auto-hold once (Shift+U or top button 2).
3. Try one hand fix on the conductor (Shift+F flip or a tap) and see that all scenes follow.
4. Measure the delay: film the conductor screen and the projector in one shot with the phone in slow motion. Count the frames between the conductor's beat flash and the scene's beat on the projector. Write the result in ms.
5. At the end, push panic on the conductor. All goes black.
6. On the conductor, push "Download log". Copy the file to the box: `ssh puggie@192.168.8.164 mkdir -p /home/puggie/pi-durable-worker/data/conductor-logs` then `scp <file> puggie@192.168.8.164:/home/puggie/pi-durable-worker/data/conductor-logs/`. Write down the file name.
Gate: 20 minutes without a freeze or a crash; the log is on the box.

## Part 2 - OBS Browser Source test (no code)
The next setup uses 2 slots (A shows, B is prepared) as OBS Browser Sources instead of Chrome windows. This test finds out if that works.
1. In OBS, make a new scene "BrowserTest". Add a "Browser" source. URL: http://localhost:8790/experiments/setup-check.html . Width 1920, height 1080. Tick "Use custom frame rate", 60. Leave "Shutdown source when not visible" OFF.
2. Keep the conductor playing in Chrome.
3. In OBS, right-click the source, select "Interact". Push "Run checks".
4. Write down each result line: WebGL2 and the GPU name, BlackHole input, shared clock, panic channel, MIDI.
5. Change the URL to the Hodge scene with the same query as set.json: http://localhost:8790/experiments/16-hodge-kaleidoscope.html?clock=shared&audio=line&in=BlackHole&capture=1 . Does it draw? Does it move with the beat? Does it flip with Shift+F on the conductor? Is it smooth (OBS Stats: render and dropped frames)?
6. Add a DistroAV NDI Output filter to it, NDI name CV-TEST. Does Resolume see CV-TEST?
7. Look at the OBS log for browser or CEF errors (Help > Log Files).
Expected: the shared clock and maybe BlackHole FAIL (OBS runs its own browser). That is a useful result, not a problem. Write what you see.

## Rules
- Do not change the code. At the end, with the user's OK, you may commit ONE file to main: notes/mac-session-2026-11-17.md. No other commits.
- Ask the user before you install anything or change a system setting.
- Do not close Chrome, the conductor or the scene windows unless the user agrees. Do not stop the tunnel.
- Keep Wi-Fi on (the tunnel needs it). Ignore the Wi-Fi WARN.
- Resolume MIDI: input from "IAC Driver Bus 1" only; input and output OFF for every LCXL3 port.
- No track names or file names of tracks in the repo (say "a house track", "track 2"). Do not commit the conductor log (it goes to the box only).

## At the end
Write notes/mac-session-2026-11-17.md: the gate of each part, the hold presses and what SUSPECT did, the delay in ms and how you measured it, the conductor log file name on the box, every Part 2 result line, and problems with fixes. Give the user a short summary to paste to his Orchestrator bot.
