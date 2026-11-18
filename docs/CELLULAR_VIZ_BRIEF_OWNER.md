# cellular-viz — owner's brief, 17 Nov: put the weight on the scenes

Reviewer, acting as owner and long-term maintainer (the user's
instruction, 17 Nov). From a full read of main at ea945b0 and a run of
the test suite (482 pass, 15 skip without the private tracks).

## Where the project stands

- The product is the scenes plus the hand (conductor, controller, hold).
- Scenes: 24 pages, about 19,000 lines. Clock and tracker: 2,700 lines
  and most of the last three weeks. QA: about 23,000 lines, plus 647
  run files and 200 images committed on main.
- The clock's design is the best thing in the repo and stays: a
  flywheel, sources that only steer it, one `read()`, hand fixes with
  authority.
- The tracker is sealed (frozen hash test). It is 1,536 lines, 108
  constants, 9 writers of the tempo. It is not to be refactored or
  tuned. Hold and the hand cover its limits; Pro DJ Link is the real
  improvement, when the friend's gear is known.

## The plan this serves (the user, 15 Nov)

1. Resolume on the projector, any scenes (done 16 Nov, gates 0 to 5).
2. Pick the solid seven and tune them by hand, with the controller.
3. A set release, like a DJ's prepared USB stick.
4. Test on the friend (house) at the user's place.
5. Test somewhere else.
Then the Bolt and the lidar, then the dance capture.

## Closed until the user reopens them

- `clock-tracker.js`, and any tracker PR without a finding from the
  user's own sitting.
- New scenes, until the seven are tuned.
- Reference-grid and corpus tooling.
- The browser host page (#85). Resolume is the host.

## Tasks, in order

### 1. Truth in the docs (half a day)
- Rewrite `docs/ROADMAP.md` to the plan above. Move the old text to
  `docs/ROADMAP_2026-10.md`.
- A root `README.md`: what the project is, how to run the conductor
  and a scene, where the runbook and the briefs are. One screen.
- Every "#N comment M, whose amendments win" (18 places): copy the
  amendment's text into the doc that cites it. A spec must be readable
  from the repo alone.
- `.gitignore`: `__pycache__/`.

### 2. The scene kit, born with the seven
The roadmap says every visualisation is a module. In code, 22 pages
make their own WebGL context, 17 carry a copy of `program`, all 24
parse their own parameters; no-beat mode is in 3, macros in 8,
triggers in 4.
- `experiments/scene-kit.mjs`, small and boring: GL setup and the
  shader helpers, parameters from the query string, control
  declaration (macro1 to macro4, trigger1 to trigger4, with range,
  default and label), the no-beat mix, capture mode, panic, the `__qa`
  basics.
- Move ONLY the scenes the user marks keep in the audition onto it,
  one PR per scene. The look must not change: the scene's own check
  and a before and after still, graded by the user.
- Scenes not kept move to `experiments/archive/`, still loadable, out
  of the nightly runs.
- Do not start before the audition has verdicts. Until then, prepare
  the kit against one scene only (12 Mass Gap, it has no-beat mode).

### 3. The shared clock through the server
`?clock=shared` uses a BroadcastChannel, so it reaches only pages in
the same browser. Add a WebSocket relay in conduct-serve and let the
`shared` source use it when the channel is silent (same messages, same
authority, same tests plus a two-browser test). This allows OBS
Browser Sources in place of window capture, and a second machine.
Wait for the Mac session 2 result on OBS Browser Source before
merging.

### 4. A click test for every page the user touches by hand
`set.html` passed the box while its only button did nothing. For
`set.html`, `audition.html`, `clock-conductor.html`, `setup-check.html`:
a headless-browser test that pushes each button and asserts the
visible result. Hard gate on PRs that touch those pages.

### 5. Run artifacts off main
Runs, checks, history and images go to a `qa-results` branch (or a
second repo) that the viewer reads. Main keeps code, tests, docs.
No history rewrite; just stop adding and move the current ones.

### 6. Only when next touched
`clock.js`'s `create()` is 930 lines. When a source is added (task 3
or Pro DJ Link), split the sources into files behind the same API.
Not before.

## Done when

The README and roadmap describe what exists; the user's seven run on
the kit with unchanged looks; a release is tagged and served; the
click test would have caught the `set.html` bug; main no longer grows
with run files.

## Amendments (Orchestrator, after the review by VIZ dev, VIZ pages and QA box; the user's go, 18 Nov)

1. Task 2, first scene: 16 Hodge Kaleidoscope, not 12 Mass Gap (the user, 17 Nov). 16b has no Math.random, has macro1-4 and trigger1, and has its own checks, so its look can be proven unchanged. It is also the hardest page to move (2D and WebGL, trigger declared outside the controls block): move it mechanically. Keep context options, devicePixelRatio and canvas caps, float formats, UNPACK state and frame order exactly as they are.
2. The look check: same page before and after, seeded Math.random, fixed-step frame time and performance.now, ?audio=clock&muted=1, a still at frame N before Play. Byte-equal on SwiftShader, within 1/255 per channel on the 780M. Then the scene's own check and the __qa numbers on a played run. Then the user grades a before and after still.
3. Two slots (the user, 17 Nov): the show uses 2 slots, A and B (one shows, one is prepared), crossfaded by Resolume layer opacity. A slot page (experiments/slot.html?slot=A|B) loads one scene from the set and switches it on a command from the conductor. It is allowed: it is a loader of one scene, not the closed browser host or mixer page (#85). It comes after task 3 and the user's OBS Browser Source result.
4. The controller (the user, 17 Nov): bottom button row = the clock (tap, flip, /2, x2, -10, +10, set 1, restart). Top buttons 1-4 = slot A, 5-8 = slot B. Hold and auto-hold move to a long press. The audition page's previous and next (CC 39 and 40 today) move too. Top knobs 1-4 = slot A's scene, 5-8 = slot B's. Fader 1 = A opacity, fader 5 = B opacity (through the bridge to Resolume). Faders 2-4 and 6-8 and knob rows 2-3: Resolume effects per slot, open for the user to map.
5. Set-release Task 2 stays. set.json v2 `controls` are per scene, at most 4 knobs and 4 buttons, and land on the slot that loads the scene. `resolume` names the slot layer (CV-A, CV-B), not a per-scene NDI name. set-release.sh and --set are unchanged.
6. Task 3, the relay: the server lets only the conductor's connection publish. Scenes only receive. The relay drops clock, jump and panic messages from anyone else, and hand fixes still do nothing on a scene. A page that gets both the channel and the socket drops duplicates by sequence number. Times stay epoch ms (same Mac). A second machine needs a clock-offset estimate later. Check first that the box's socket-to-TCP forward passes a WebSocket upgrade. No new npm dependency without the user's OK. The slot page's scene-switch commands use the same relay.
7. Task 4: the click test fakes requestMIDIAccess, the audio input and the pop-up windows. It catches window.open as a popup page. Playwright is already on the box.
8. Task 5 changes the QA box's fixed scripts (runner.mjs, exp-run.mjs, board.mjs, post.mjs, experiment.mjs read the run files). It needs the user's OK before it starts.
9. Corrected counts on main ea945b0: macros and triggers are in 5 scenes (15, 16b, 16-neon, 24, 26), not 8 and 4. clock.js create() is 882 lines, not 930. "#N comment M" is in 13 places in .md files (54 in all files, most of them code comments). Task 1 covers the .md files only. The suite has 498 tests on main (497 + the #253 tests). 15 of them skip without the private tracks.
10. Order: nothing in this brief starts before the user's Mac session 2 report.
