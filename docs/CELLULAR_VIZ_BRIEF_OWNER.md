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
