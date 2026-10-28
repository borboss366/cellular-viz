# Roadmap: music visualisation platform

The goal (from the user): a visualisation platform for live DJ sets on a powerful laptop. The phone is a bonus. Every visualisation is a **module**: shared clock and audio, start/frame/stop, controls declared ISF-style. That way modules can later be merged into scenes.

**Workflow:** page PRs auto-merge once the box's QA, the user's grade (≥ Good) and the page-only check pass (spec #80, in rollout). Runner and script PRs are merged by VIZ dev after QA box's `test-pr.sh` passes.

## Step 1: a solid live set

The user is in charge ("for now I want to be in charge"): during step 1 the user runs the set live by hand with the controller, choosing, blending and switching scenes. Nothing automatic picks scenes.

1. **Finish the MVPs for all seven Millennium problems.** Remaining: 15 P vs NP and 16 Hodge.
2. **Controller.** Once the Novation Launch Control XL 3 arrives (the user is waiting for it), build controller support for the visualisations: Web MIDI in Chromium, mapped to each module's ISF-style controls.
3. **Blending.** With the controller, work further on blending scenes together. The Lenia blends (08, #27–#35) are the proof of concept; fade and screen won round 1.
4. **Fine-tune from reviews.** Once that's solid, adjust each visualisation (add or remove things) based on the user's grades of how it looks.

How it fits together: one control contract for every scene, an input bus (sliders and keyboard now, the controller later, sensors in step 2) and a host page that blends scene modules in one WebGL context (design #85). A panic key works in every scene: B blackout, ` calm fallback (#86).

**First set list:** 10–12 scenes, the user picks.

**Step 1 is done when** a recorded 60-minute rehearsal set plays end to end with no crash, at 60 fps with two scenes blended, with every scene reachable from the controller, on the real projector with real mixer audio.

### Millennium Prize problems

| Problem | Page(s) | Status |
|---|---|---|
| Riemann | 09 phase portrait, **11 Riemann show** (ribbon, march, scope, primes, canyon, map) | ✅ MVP on main. User's ranking: ribbon > scope > canyon > march > map > primes. Auto-mix deferred |
| Birch–Swinnerton-Dyer | 10 first version, 17 Skater, **19 Skate Park** (torus, morph, free) | ✅ MVP on main (#50). 19 won the final grade. Later: in one clip the line seems to end right in front of the skater (effects) |
| Yang–Mills | 12 Mass Gap, **18 Little Bang** (collide, strings, quench) | ✅ MVP on main (#43, #49). User's grade: collide ≈ auto > quench. Beamline scene and quench Mach-cone wake on #75 (in QA) |
| Navier–Stokes | 13 Flow Lab (stable fluids + curl noise, presets) | ✅ MVP on main (#53): 60 fps to 4K, raw dye drift ≤ 0.7 %/10 s, swirls on the beat. Brighter curl/plume (#69) and stone rocks with more fluid (#72) merged. Next: living obstacles (#54); 3-D smoke and multigrid later |
| Poincaré | 14 Round Point, **23 Shape Shifter**, 25 Shape Shifter II | ✅ on main: 14 (#55, kick pulse + fades #68), 23 (#56), 25 (#57, user: "Very good") |
| P vs NP | 15 Hard Problems (2-opt salesman, 3-SAT cliff at 4.26, Rule 110) | ⏳ spec on #37 |
| Hodge | 16 Calabi–Yau (Fermat n=5 slice, Hodge diamond), **16b Hodge Kaleidoscope** | ⏳ 16b on #84 (QA 10/10, waits on the user's grade). Then 16a Liquid Light, 16c 27 Neon Lines, 16d Diamond Sky, one at a time (#37 comment 6444942841). Check the 16 formula against Hanson 1994 before building |

### Cellular automata and physics

| Topic | Status |
|---|---|
| Lenia family 01–08 (Gray-Scott, Lenia, Flow Lenia, effects, Particle Lenia, blends) | ✅ |
| 26 FHP lattice gas (CA → Navier–Stokes): F1 particle rain, F2 zoom to fluid, F3 vortex street, F4 collision synth, F5 two inks, F6 sound rings | ⏳ build spec on #71. Mock-ups in `docs/proposals/fhp` (#51); all six rated 'workable' by the user |
| 24 Paint Pour | ⏳ v1 spec on #87 (closed-form marbling) |
| Runners-up from the evangelist report: sandpile avalanches, Chladni plates, Turing reaction–diffusion | 💡 ideas |

Rule for every MVP: art first, maths true underneath, a QA truth check, 60 fps at 1440p on the box, and drums drawn ≤ 40 ms after the sound.

## Separate track: real beats (beat sync, #95)

The user calls this **super important**, but it runs on its own track: every scene keeps working on the metronome meanwhile, so nothing in step 1 waits for it. The shared clock gets its beats from a **beat source** instead of the free metronome, and the scenes don't change.

- **First (v0): audio on a Mac through BlackHole.** The DJ gear isn't known yet, so the first source is the user's own test setup: music played on the Mac is looped through the BlackHole driver into the browser, and an in-browser tracker finds tempo, beat phase and the downbeat (with a tap key on the 1). BeatNet is the stronger v1 if needed. The box tests the same code on annotated test tracks.
- **Later, once the gear is known: Pro DJ Link** (Pioneer CDJs/DJM on Ethernet, protocol reverse-engineered by Deep Symmetry): beat packets announce the next beats and bars ahead of time, with BPM, pitch and beat-in-bar for the downbeat. A small Node bridge (prolink-connect) forwards them to the browser over a local WebSocket.
- **Ableton Link** for DJ software that speaks it, through Carabiner on the same bridge.
- **Audio analysis** stays the fallback live too: line-in from the mixer into the same tracker.
- **Flywheel:** if a source drops, the clock keeps time; sources switch without a visible jump. The metronome stays the last fallback.
- **Test rig:** annotated test tracks, a recorded CDJ packet capture replayed on the box, and a synthetic beat source.

**Done when:** visual beats land within ±20 ms of the real beat (p95), downbeats are right on ≥ 95% of bars, and a tempo change or track change re-locks within 2 beats.

## Step 2: audience interaction

Add input from the party: dancers and crowd, through a depth camera with skeleton tracking (Orbbec Femto Bolt, or a used Kinect v2 for a cheap test), a 2D lidar "laser curtain", camera optical flow, or wrist sensors. The research is done (VIZ evangelist reports, 28 Oct); the build comes after step 1.

## Later: auto modes and the orchestrator

Only after step 1. First auto modes (for example the Riemann show's auto-mix), then the orchestrator: a separate project that picks and switches modules live through a set, using each module's declared controls.
