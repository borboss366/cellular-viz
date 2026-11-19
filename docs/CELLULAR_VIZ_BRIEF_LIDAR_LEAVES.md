# cellular-viz — brief: falling leaves, with the lidar as the wind

Reviewer, 19 Nov, from the user's description. NOT before the DJ visit
(Sunday 22 Nov). It starts when `docs/SATURDAY_BRIEF.md` ends, and it
is the first sensor scene. The Bolt comes later and is not part of it.

## The scene, in the user's words

By default the leaves just fall, like autumn, and pulse to the kicks
and beats. When someone moves in front of the lidar, the movement acts
like wind and sends the leaves flying. It must look natural: a gust
must not push every leaf the same way.

## What the lidar gives (Slamtec RPLIDAR C1)

One flat slice of the room, about 10 scans a second, up to 12 m. So:
where people are on the floor and how they move. No gestures, no
height. Mounted at chest height (about 1.1 to 1.3 m) so a swinging arm
changes the outline; the user finds the spot with the viewer (task 1).

## Design

### The look: why it will not all go one way
1. **The wind is a fluid, not a push.** A 2D incompressible flow over
   the floor plan (the solver from 13 Flow Lab, as the module of task 0). A body that
   moves injects momentum where it is. An incompressible flow answers
   a local push with a swirl on each side and a return flow, so leaves
   near the body are carried along, leaves beside it curl back, and
   leaves far away barely move.
2. **Every leaf is its own flyer.** Per leaf: size, mass, drag, a
   flutter rate and a tumble axis, drawn once from a seeded spread. A
   leaf in still air flutters side to side as it falls; in a gust,
   light leaves go far and heavy ones lag. No two answer alike.
3. **Height matters.** The wind is strongest at body height and fades
   toward the ceiling and the floor, so a gust lifts a band of leaves,
   not the whole picture.
4. **It dies away.** The flow has viscosity and a slow decay to rest.
   A few seconds after the movement stops, the leaves are falling
   again. Leaves that reach the ground lie there, and a later gust
   near the floor lifts some of them.
5. **Small turbulence always.** A weak curl-noise drift on top, so
   the default fall is never straight lines.

### Music
- Kick: each leaf pulses a little (scale and brightness), and a soft
  downdraft or updraft pulse passes through the wind. Small. The
  falling stays the main motion.
- Bars and phrases: the palette drifts (greens to yellows to reds to
  browns), and the fall thickens or thins.
- No-beat mode (confidence low): the pulses fade to the energy bands,
  the fall continues. The scene must look right with no beat at all.
- Controls (declared in the kit's form): macro1 leaf count, macro2
  wind strength from bodies, macro3 fall speed, macro4 palette;
  trigger1 one gust across the room, trigger2 shake all settled leaves
  loose.

### Leaves
A few thousand, instanced, drawn in 3D with depth (near leaves larger
and softer). Shapes are generated, not photos: fractal leaf outlines
from an iterated function system, a handful of species made at load
time and kept as textures. The user picks the species by eye.

**Variety (the user, 19 Nov): leaves of different kinds, big and
small, some more yellow, some more green.**
- Several species with clearly different outlines, mixed in one fall.
- Size: a wide spread, from small to several times larger, with many
  small leaves and few big ones. Size ties to flight: big leaves are
  heavier, fall faster and answer a gust slowly; small ones flutter
  and travel far.
- Colour: each leaf has its own place between green and yellow (with
  some orange and brown), drawn once and kept, plus a little variation
  across the leaf itself. At any moment the picture holds a mix, never
  one flat colour.
- The palette control (macro4) and the drift over bars move the whole
  mix toward greener or toward yellower. They do not make every leaf
  the same.
- Check: at the default settings, a still shows at least three
  species, a size range of at least 4 to 1, and both green and yellow
  leaves. The user grades the still.

### Light (the user, 19 Nov): lit so it looks natural
- One low autumn sun, from one upper side, warm. Its direction is a
  scene setting, not per leaf.
- Each leaf is shaded by its own facing as it tumbles, so a turning
  leaf brightens and darkens. That flicker is most of what makes a
  falling leaf read as real.
- Leaves let light through: a leaf between the viewer and the sun
  glows in its own colour and shows its veins; a leaf lit from the
  front is more matt.
- Depth: far leaves are dimmer, cooler and softer, near leaves are
  crisp and may blur slightly out of focus. A faint haze in the air
  catches the sun.
- Leaves on the ground lie in softer light, with a simple dark patch
  under them. No full shadow maps unless the frame budget allows.
- Music moves the light only gently: the sun's strength breathes with
  the level, and a kick gives a small lift. No strobing; the flash
  limiter applies.
- Stay in budget: per-leaf shading in the vertex and fragment shader
  of the instanced draw, no extra passes at first. Anything heavier is
  added only if the 1080p frame time holds at the maximum leaf count.
- The user grades stills: one backlit, one front-lit, one with the
  light low. He picks the default.

### GPU budget (the user, 19 Nov): the scene must not be heavy
The scene never runs alone. On the show Mac (M3 Pro) it shares the
GPU with two other scenes, OBS and Resolume. So the budget is set and
measured there, not only on the box.
- **Budget.** With the full set running on the Mac, the route holds
  its frame rate with this scene on screen at its default leaf count.
  Alone at 1080p the scene uses at most a third of a 60 fps frame
  (about 5 ms) at the default count. If the first build cannot meet
  that, the count comes down before anything else is added.
- **Cheap by design.**
  - The wind grid is small (128 or 256 across). Wind is smooth; a fine
    grid buys nothing.
  - Leaf flight is a few thousand leaves: do it on the CPU in typed
    arrays, or in one GPU pass. No per-leaf readback.
  - One instanced draw for all leaves. Leaf textures in one atlas.
  - Haze and any blur at half resolution, and optional.
- **A quality dial.** Three levels (low, default, high) set the leaf
  count, the grid size and the optional passes together. macro1 moves
  the count inside the level's range.
- **A guard.** If the frame time stays over budget for 2 s, the scene
  steps the leaf count down smoothly (leaves fade out, none pop), and
  steps back up when there is room. It reports its level in `__qa`.
- **Measure, in the repo.** A bench mode (`?bench=1`) steps the leaf
  count and prints frame time per step: GPU time where the timer query
  is available, frame intervals otherwise. Two tables go in the
  scene's report:
  - the box at 1080p, alone;
  - the Mac, alone and with the set running. Claude Code on the Mac
    runs the bench and writes the numbers in the session notes.
- **Check.** The scene's check fails if the default level is over
  budget on the box, and the Mac table is required before the user's
  gate.

### The input path (no new kind of thing)
- `tools/lidar-bridge`: reads the scans; learns the empty room for
  10 s at start (button to relearn); what is not background is grouped
  into blobs; blobs are tracked with position, velocity and size;
  10 Hz in, smoothed and published at 30 Hz.
- It publishes on the server relay (owner's brief, task 3) as `bodies`,
  the same shape as the tablet's `pointers` plus a velocity and a
  size. A scene reads both through the scene kit. The tablet or the
  mouse can therefore stand in for a person, and the scene is built
  and tuned before the lidar is on the wall.
- Room to picture: the lidar sits under or beside the projection and
  looks into the room. Across the room maps to across the picture;
  distance from the wall maps to depth in the scene. One calibration
  (two corners walked or clicked) saved as a venue profile, like the
  visual offset.
- Routing by the controller's faders, as for the tablet. Nothing reads
  back from Resolume.

## Tasks, in order

0. **The fluid solver becomes a module (the user, 19 Nov).** Today
   one scene holds a Navier-Stokes solver, 13 Flow Lab, written inside
   its page (advection, pressure projection, vorticity, obstacles,
   forces). The leaves are its second customer, so it moves out first:
   - `experiments/fluid/`: the solver as a module with a small API:
     create (grid size, the GL context), step (dt), add force and add
     dye at a point, set obstacles, read the velocity texture, and a
     low-resolution CPU readback for scenes that need it. Shaders live
     beside it.
   - 13 Flow Lab is moved onto the module with its look unchanged.
     Its own checks must pass as they are: the divergence before and
     after projection, the dye mass, the Strouhal number at 90, 120
     and 150 BPM, the beat-match row, and a before and after still for
     the user.
   - The lattice gas (26) is a different method and already has its
     own module. It stays where it is; do not force the two under one
     interface.
   - Not part of this step: new solver features. Add what the leaves
     need (a height falloff is the scene's job, not the solver's) only
     when the leaves scene asks for it.
1. **Lidar viewer** (`experiments/lidar-view.html` + the bridge): the
   scan as dots, the learned background, the blobs with their velocity
   arrows, the calibration. Record and replay of scans to a file
   (private, not committed, except one short synthetic fixture).
   Mac check gains a "lidar" line. The user's gate: he walks, the blob
   follows him; he waves an arm, the outline changes.
2. **The relay and the `bodies` / `pointers` input**, if the owner's
   brief has not delivered them yet: the smallest version that serves
   this scene, shaped so the tablet pad uses the same path.
3. **The leaves scene** on the scene kit, driven by the mouse and by
   replayed scans. Default fall, per-leaf flight, the fluid wind, the
   music, no-beat mode, the controls.
4. **Connect and tune** with the user in the room. His words per
   change go in the Mac notes.

## Checks (box, on replayed and synthetic input)

- No input for 60 s: leaves fall, mean horizontal drift near zero,
  none stuck in the air, the count steady.
- One synthetic walker crossing left to right: the leaves that move
  do NOT share one direction. Measure the spread of their velocity
  directions (a circular variance above a stated floor), and that some
  leaves move against the walker (the return flow).
- After the walker stops: within a stated time the horizontal motion
  is back to the default level.
- Two walkers crossing: no blow-up, no NaN, frame time within budget
  at 1080p with the leaf count at its maximum.
- Kick pulses land in the beat-match row like any scene.
- No-beat: 30 s at confidence 0, 30 s locked, 30 s at 0; stills at
  each phase for the user's grading.
The floors and times above are set once from the first build and
written in the scene's check, not tuned per run.

## Out of scope

The Bolt, skeletons, gestures; the lights; reading anything from
Resolume; any change to the clock or the tracker; more than one lidar.

## The user's gate

On the projector, with music: left alone, it reads as autumn and moves
with the beat. He walks through the room and the leaves swirl around
him, some with him and some curling back, and settle after he stops.
Two people moving make two different swirls. If it reads as "a fan was
switched on", it has failed.
