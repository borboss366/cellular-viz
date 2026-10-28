# FHP lattice gas: six visualiser options to choose from

FHP is a cellular automaton: particles hop on a hexagonal grid and collide by simple rules that conserve mass and momentum. Averaged over many cells, it obeys the Navier–Stokes equations, which makes it the CA way into the Navier–Stokes Millennium problem. It's also our own CA roots. Sources: https://en.wikipedia.org/wiki/Lattice_gas_automaton, and the VIZ evangelist report.

The pictures are **mock-ups** (hand-made SVGs from `gen.sh`) showing the look, not renders of the real simulation. Pick the ones you want built. Each would be a module with ISF-style inputs, and they can be combined as scenes of one page.

| # | Name | What you see | Music | Truth check (QA) |
|---|---|---|---|---|
| F1 | **Particle rain** | The micro view: glowing particles hop between hexagon nodes, coloured by one of 6 directions, and spark white where two collide head-on and scatter. | Kick = burst of new particles; hat = more collisions sparkle | Particle count and total momentum are exactly conserved every step (the state is boolean, so it's exact) |
| F2 | **Zoom to fluid** | Starts as noisy particles, and the camera pulls back on the build-up. Averaging blocks of cells turns the noise into smooth swirling streamlines: a CA becoming a fluid, live. | Drop = full zoom-out to the fluid | The averaged velocity field is divergence-free (≈0) at large scale |
| F3 | **Vortex street** | A stream flows past an obstacle (a logo or a Lenia creature) and sheds alternating vortices, drawn by dye tracers. | Inflow speed set so a vortex sheds on each beat (Strouhal ≈ 0.2) | Shedding frequency ≈ 0.2·U/d |
| F4 | **Collision synth** | The inverted pipeline (CodeCraftedPhysics idea): the gas plays the music. Collisions in regions light rings and trigger notes on a piano-roll strip. | The sim makes the rhythm, or a hybrid follows the track's tempo | Note count = logged collision events |
| F5 | **Two inks** | Two coloured gases (FHP with colour tags) slide past each other and curl into Kelvin–Helmholtz billows. | Shear speed on the bass; drop = a big mixing roll | Each colour's particle count is conserved |
| F6 | **Sound rings** | A kick injects a density pulse, and a pressure ring travels through the gas and bounces off the walls: sound inside a CA. | Every kick = new ring; walls echo | Ring speed constant (the lattice sound speed) |

Possible combos: F2 is a natural frame for F1 → F3/F5 (zoom from particles out to the flow), and F6 sits well on top of any of them.
