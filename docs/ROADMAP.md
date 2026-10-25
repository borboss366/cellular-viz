# Roadmap: music visualisation platform

The goal (from the user): a visualisation platform for live DJ sets on a powerful laptop. The phone is a bonus. Every visualisation is a **module**: shared clock and audio, start/frame/stop, controls declared ISF-style. That way modules can later be merged into scenes.

## Phase 1: a big set of visualisation MVPs (now)

Build a wide set of good-looking MVPs, each one true to its source (maths or physics), checked by QA box and graded by the user. Blending and music behaviour stay simple for now.

### Millennium Prize problems

| Problem | Page(s) | Status |
|---|---|---|
| Riemann | 09 phase portrait, **11 Riemann show** (ribbon, march, scope, primes, canyon, map) | ✅ MVP on main. User's ranking: ribbon > scope > canyon > march > map > primes. Auto-mix is deferred to phase 2 |
| Birch–Swinnerton-Dyer | 10 first version, 17 Skater, **19 Skate Park** (torus, morph, free) | ✅ MVP, on main (#50 merged). 19 won the final grade. Later: the line looks like it ends right in front of the skater in one clip (effects) |
| Yang–Mills | 12 Mass Gap, **18 Little Bang** (collide, strings, quench) | ✅ MVP (#43, #49) |
| Navier–Stokes | 13 Flow Lab (stable fluids + curl noise, presets) | ⏳ spec on #37, next build |
| Poincaré | 14 Round Point (curve-shortening flow, neck pinch, Thurston fly-through) | ⏳ spec on #37 |
| P vs NP | 15 Hard Problems (2-opt salesman, 3-SAT cliff at 4.26, Rule 110) | ⏳ spec on #37 |
| Hodge | 16 Calabi–Yau (Fermat n=5 slice, Hodge diamond) | ⏳ spec on #37. Check the formula against Hanson 1994 before building |

### Cellular automata and physics

| Topic | Status |
|---|---|
| Lenia family 01–08 (Gray-Scott, Lenia, Flow Lenia, effects, Particle Lenia, blends) | ✅ |
| FHP lattice gas (CA → Navier–Stokes): F1 particle rain, F2 zoom to fluid, F3 vortex street, F4 collision synth, F5 two inks, F6 sound rings | ⏳ all six rated 'workable' by the user. Mock-ups in `docs/proposals/fhp` (#51). Pick list on the grading page |
| Runners-up from the evangelist report: sandpile avalanches, Chladni plates, Turing reaction–diffusion | 💡 ideas |

Rule for every MVP: art first, maths true underneath, a QA truth check, 60 fps at 1440p on the box, and drums drawn ≤ 40 ms after the sound.

## Phase 2: music and DJ craft (after phase 1)

Go deep on how the visuals change with the music once the MVP set is complete:
- **Scene mixing and auto modes:** for example the Riemann show's ribbon-heavy mix (deferred on 2026-10-25).
- **Blending in depth:** the Lenia blends (08, #27–#35) are the proof of concept. Fade and screen won round 1.
- **Real-music tests:** an audio file fed in like a mic, plus one phone-filmed sound-to-picture sync test.
- **Trick pacing and section awareness:** the skater controls are the first example.

## Phase 3: the orchestrator (next project)

A separate project that picks, layers and switches modules live through a set, using each module's declared controls.
