# Roadmap: music visualisation platform

The goal (from the user): a visualisation platform for live DJ sets on a powerful laptop. The phone is a bonus. Every visualisation is a **module**: shared clock and audio, start/frame/stop, controls declared ISF-style. That way modules can later be merged into scenes.

**Workflow:** page PRs auto-merge once the box's QA, the user's grade (≥ Good) and the page-only check pass (spec #80, in rollout). Runner and script PRs are merged by VIZ dev after QA box's `test-pr.sh` passes.

## Step 1: a solid live set

The user is in charge ("for now I want to be in charge"): during step 1 the user runs the set live by hand with the controller, choosing, blending and switching scenes. Nothing automatic picks scenes.

**Build order** (the user, 29 Oct; replaces "finish all visualisations before the clock"):

1. **Close the Millennium core.**
   - Finish 16b Hodge Kaleidoscope (#84), with the fastest shape speed as the default (the user's round-2 grade).
   - Build 15a Pulsing salesman (#37 comment 6493121591).
   - After that, every Millennium problem has at least one scene.
2. **Clock** (see the Clock section below): one shared clock that follows the music, not a per-page metronome.
   - Offline beat grids for recorded tracks and DJ sets first, as beat grids along a tempo curve (blends, ramps and hand nudges; downbeats per beat).
   - Then `experiments/clock.js`, with `?clock=metronome` as the default.
   - Then 13 Flow Lab moves over as the first page.
3. **New pages are born on the clock.** Everything else not yet built is built on the shared clock:
   - 15b–15f
   - 16a/c/d/e and the original 16
   - 20 Modular Discs and 21 Prime Spectrum
   - 24 Paint Pour (#87)
   - 22 Endless Labyrinth
   - 26 FHP (#71)

   The user picks the order within this group later.
4. **Controller.** Once the Novation Launch Control XL 3 arrives (the user is waiting for it), build controller support for the visualisations: Web MIDI in Chromium, mapped to each module's ISF-style controls.
5. **Blending.** With the controller, work further on blending scenes together. The Lenia blends (08, #27–#35) are the proof of concept; fade and screen won round 1.
6. **Fine-tune from reviews.** Once that's solid, adjust each visualisation (add or remove things) based on the user's grades of how it looks.
   - **Knob tags become scene macros.** A grading comment can carry `knob: <what>`. VIZ research turns each tag into a knob spec: mapping, range, default and a `macro1`–`macro4` slot (#85).
   - VIZ dev builds it as that macro, with an on-screen slider until the controller arrives, and exposes it in `__qa`.
   - QA box sweeps the knob, and the scene's picture metric must change across the sweep.
   - **`button:` tags become scene triggers** (`trigger1`–`trigger4`: bottom buttons 1–4, keys `Z X C V`), specced the same way. Every bump goes through the #88 light limiter, so mashing a button can't break the flash rule.
   - Existing pages get a knob pass later, before the rehearsal; the user accepts redoing them.

How it fits together: one control contract for every scene, an input bus (sliders and keyboard now, the controller later, sensors in step 2) and a host page that blends scene modules in one WebGL context (design #85). A panic key works in every scene: B blackout, ` calm fallback (#86).

**First set list:** 10–12 scenes, the user picks.

**Step 1 is done when:**
- A recorded 60-minute rehearsal set plays end to end on the shared clock, driven by the file beat grids, with:
  - no crash
  - 60 fps with two scenes blended
  - every scene reachable from the controller
  - the real projector
- One live-audio test at the mixer: line-in steers the clock, and the beats land on the kick by ear.
- The visual offset is calibrated in the venue (profile saved from the dance floor, loaded on start).

### Clock

The brief is `docs/CELLULAR_VIZ_BRIEF_CLOCK.md`; the user decided this order on 28 Oct.

There is **one shared clock module**. The #85 host owns it, and standalone pages use it the same way. Its heart is a metronome that always runs. Every source (a file grid, line-in, Pro DJ Link) only steers its tempo and phase, like a flywheel or PLL. The clock never stops and never jumps. Scenes fire on the **predicted** next beat, so they are never late.

`read()` gains **bars and downbeats** next to beats and phase, because several things fire on the bar: TAKE (#85), the skater tricks (17/19) and 25's phrases.

1. **Files first** (in step 1). Tracks and recorded DJ sets get an offline beat grid, ported from processing-llm's gridder (brief task 3).
   - The grid **follows tempo changes**, as beat grids along a tempo curve (blends, ramps and hand nudges; downbeats per beat). A recorded DJ set changes tempo at every mix, so the brief's single global tempo isn't enough.
   - Sidecar v2 is `beats: [{ms, pos, conf}]` plus `edits`, and v1 readers still work. On `file:`, `read()` uses a monotone-cubic warp: beats and phase = W⁻¹(t), bpm = 60/W′, and bar and beatInBar come from each beat's `pos` (#95).
   - Grid-editor fixes are local: move a beat, set "1" here, and a ranged nudge, ×2, ÷2 or tap.
   - The rehearsal set runs on these grids.
2. **The shared clock module** (`experiments/clock.js`).
   - `?clock=metronome` is the default, so every existing check stays unchanged: brief task 1, plus task 4's metronome parity (byte-for-byte the same events).
   - Pages move over one at a time; 13 Flow Lab goes first.
   - **Projector-latency compensation:** a signed `visualOffsetMs`. Scenes fire at the predicted beat − (`latency()` + `visualOffsetMs`).
     - It is calibrated once per venue by ear and eye: a click and a flash on the beat, adjusted until they sit together.
     - The calibration page is `experiments/calibrate.html`. Profiles go to localStorage with JSON export and import, and the last-used one loads on start. Changes slew at ≤ 5 ms per beat.
     - It is saved per venue and projector, and can be adjusted live from one master-column encoder (#85).
     - Details and the QA truth are on #95.
3. **Live audio** (research).
   - Line-in steers the metronome through processing-llm's PLL (brief task 2).
   - Hand fixes on the controller: tap, ×2 / ÷2, downbeat ("this is the one") and nudge.
   - Sync is measured against the waveform, not the schedule (brief task 4). On the box, a fake audio capture feeds known wavs.
4. **Pro DJ Link** (research).
   - The user's friend has Pioneer gear to test with; the models aren't known yet.
   - A Node bridge as in #95.
   - Record a pcap plus the audio once from his setup, so the box can replay it headless.

### Millennium Prize problems

| Problem | Page(s) | Status |
|---|---|---|
| Riemann | 09 phase portrait, **11 Riemann show** (ribbon, march, scope, primes, canyon, map) | ✅ MVP on main. User's ranking: ribbon > scope > canyon > march > map > primes. Auto-mix deferred |
| Birch–Swinnerton-Dyer | 10 first version, 17 Skater, **19 Skate Park** (torus, morph, free) | ✅ MVP on main (#50). 19 won the final grade. Later: in one clip the line seems to end right in front of the skater (effects) |
| Birch–Swinnerton-Dyer extras | 20 Modular Discs (the "fractal discs"), 21 Prime Spectrum (Sato–Tate) | ⏳ not built. MVP specs on #37 (comment 6401224167, 25 Oct); the user picked both |
| Yang–Mills | 12 Mass Gap, **18 Little Bang** (collide, strings, quench) | ✅ MVP on main (#43, #49). User's grade: collide ≈ auto > quench. Beamline scene and quench Mach-cone wake on #75 (in QA) |
| Navier–Stokes | 13 Flow Lab (stable fluids + curl noise, presets) | ✅ MVP on main (#53): 60 fps to 4K, raw dye drift ≤ 0.7 %/10 s, swirls on the beat. Brighter curl/plume (#69) and stone rocks with more fluid (#72) merged. Next: living obstacles (#54); 3-D smoke and multigrid later |
| Poincaré | 14 Round Point, **23 Shape Shifter**, 25 Shape Shifter II | ✅ on main: 14 (#55, kick pulse + fades #68), 23 (#56), 25 (#57, user: "Very good"). 14's eight-geometries fly-through (laptop extra) is not built |
| P vs NP | 15 Hard Problems (2-opt salesman, 3-SAT cliff at 4.26, Rule 110) | ⏳ not built. Spec on #37; scenes 15a–15f specced in comment 6493121591. 15a Pulsing salesman comes first (build order step 1); 15b–15f come later, on the clock |
| Hodge | 16 Calabi–Yau (Fermat n=5 slice, Hodge diamond), **16b Hodge Kaleidoscope** | ⏳ 16b on #84: graded; it is finished with the fastest shape speed as the default. Then 16a Liquid Light, 16c 27 Neon Lines, 16d Diamond Sky, one at a time (#37 comment 6444942841). Check the 16 formula against Hanson 1994 before building |

### Cellular automata and physics

| Topic | Status |
|---|---|
| Lenia family 01–08 (Gray-Scott, Lenia, Flow Lenia, effects, Particle Lenia, blends) | ✅ |
| 26 FHP lattice gas (CA → Navier–Stokes): F1 particle rain, F2 zoom to fluid, F3 vortex street, F4 collision synth, F5 two inks, F6 sound rings | ⏳ build spec on #71. Mock-ups in `docs/proposals/fhp` (#51); all six rated 'workable' by the user |
| 24 Paint Pour | ⏳ v1 spec on #87 (closed-form marbling) |
| 22 Endless Labyrinth (first-person maze: Eller's algorithm + CA walls + raycast; not a Millennium page) | ⏳ not built. MVP spec on #37 (comment 6401505993, 25 Oct) |
| Runners-up from the evangelist report: sandpile avalanches, Chladni plates, Turing reaction–diffusion | 💡 ideas |

Rule for every MVP: art first, maths true underneath, a QA truth check, 60 fps at 1440p on the box, and drums drawn ≤ 40 ms after the sound.

## Step 2: audience interaction

Add input from the party: dancers and crowd, through a depth camera with skeleton tracking (Orbbec Femto Bolt, or a used Kinect v2 for a cheap test), a 2D lidar "laser curtain", camera optical flow, or wrist sensors. The research is done (VIZ evangelist reports, 28 Oct); the build comes after step 1.

## Later: auto modes and the orchestrator

Only after step 1. First auto modes (for example the Riemann show's auto-mix), then the orchestrator: a separate project that picks and switches modules live through a set, using each module's declared controls.
