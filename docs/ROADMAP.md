# Roadmap: music visualisation platform

The goal (from the user): a visualisation platform for live DJ sets on a powerful laptop. The phone is a bonus. Every visualisation is a **module**: shared clock and audio, start/frame/stop, controls declared ISF-style. That way modules can later be merged into scenes.

**Workflow:** page PRs auto-merge once the box's QA, the user's grade (≥ Good) and the page-only check pass (spec #80, in rollout). Runner and script PRs are merged by VIZ dev after QA box's `test-pr.sh` passes.

## Step 1: a solid live set

1. **Finish the MVPs for all seven Millennium problems.** Remaining: 15 P vs NP and 16 Hodge.
2. **Controller.** Once the Novation Launch Control XL 3 arrives (the user is waiting for it), build controller support for the visualisations: Web MIDI in Chromium, mapped to each module's ISF-style controls.
3. **Blending.** With the controller, work further on blending scenes together. The Lenia blends (08, #27–#35) are the proof of concept; fade and screen won round 1.
4. **Fine-tune from reviews.** Once that's solid, adjust each visualisation (add or remove things) based on the user's grades of how it looks.

### Millennium Prize problems

| Problem | Page(s) | Status |
|---|---|---|
| Riemann | 09 phase portrait, **11 Riemann show** (ribbon, march, scope, primes, canyon, map) | ✅ MVP on main. User's ranking: ribbon > scope > canyon > march > map > primes. Auto-mix deferred |
| Birch–Swinnerton-Dyer | 10 first version, 17 Skater, **19 Skate Park** (torus, morph, free) | ✅ MVP on main (#50). 19 won the final grade. Later: in one clip the line seems to end right in front of the skater (effects) |
| Yang–Mills | 12 Mass Gap, **18 Little Bang** (collide, strings, quench) | ✅ MVP on main (#43, #49). User's grade: collide ≈ auto > quench. Beamline scene and quench Mach-cone wake on #75 (in QA) |
| Navier–Stokes | 13 Flow Lab (stable fluids + curl noise, presets) | ✅ MVP on main (#53): 60 fps to 4K, raw dye drift ≤ 0.7 %/10 s, swirls on the beat. Brighter curl/plume (#69) and stone rocks with more fluid (#72) merged. Next: living obstacles (#54); 3-D smoke and multigrid later |
| Poincaré | 14 Round Point, **23 Shape Shifter**, 25 Shape Shifter II | ✅ on main: 14 (#55, kick pulse + fades #68), 23 (#56), 25 (#57, user: "Very good") |
| P vs NP | 15 Hard Problems (2-opt salesman, 3-SAT cliff at 4.26, Rule 110) | ⏳ spec on #37 |
| Hodge | 16 Calabi–Yau (Fermat n=5 slice, Hodge diamond) | ⏳ spec on #37, plus the psychedelic specs 16a–16e (#37 comment 6444942841). On hold until #68/#69 are done (both merged 28 Oct). Check the formula against Hanson 1994 before building |

### Cellular automata and physics

| Topic | Status |
|---|---|
| Lenia family 01–08 (Gray-Scott, Lenia, Flow Lenia, effects, Particle Lenia, blends) | ✅ |
| 26 FHP lattice gas (CA → Navier–Stokes): F1 particle rain, F2 zoom to fluid, F3 vortex street, F4 collision synth, F5 two inks, F6 sound rings | ⏳ build spec on #71. Mock-ups in `docs/proposals/fhp` (#51); all six rated 'workable' by the user |
| 24 Paint Pour | 💡 idea, held |
| Runners-up from the evangelist report: sandpile avalanches, Chladni plates, Turing reaction–diffusion | 💡 ideas |

Rule for every MVP: art first, maths true underneath, a QA truth check, 60 fps at 1440p on the box, and drums drawn ≤ 40 ms after the sound.

## Step 2: audience interaction

Add input from the party: dancers and crowd, through a depth camera with skeleton tracking (Orbbec Femto Bolt, or a used Kinect v2 for a cheap test), a 2D lidar "laser curtain", camera optical flow, or wrist sensors. The research is done (VIZ evangelist reports, 28 Oct); the build comes after step 1.

## Later: the orchestrator

A separate project that picks and switches modules live through a set, using each module's declared controls.
