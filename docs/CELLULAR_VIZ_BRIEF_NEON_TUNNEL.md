# cellular-viz — brief: 29 Neon Tunnel (a ride that turns where it is told)

Owner, 27 Nov, on the user's request and his reference picture.
Owner of the work: the Mac builders, with the scene skill
(`.claude/skills/webgl-scene/SKILL.md`). Tests on the box.

## What the user asked for

Flying through a tunnel of neon rings. The ride changes direction:
toward the centre, then left, up, into a corner. The point it flies
toward either drifts slowly by itself or is set from outside (the
lidar later).

His reference is a stock picture and is not in the repo. Do not copy
it. What to take from it: thin neon rings nested one inside the next
and sliding off toward the far end, a lit grid floor running to the
same point, small neon stars and spirals on the dark walls, a soft
glow where the tunnel ends.

## The look (the skill's five lines)

1. **Reference.** A 1980s neon tunnel ride: laser rings and a grid
   floor, as on synthwave record sleeves and arcade racing games.
   The guest DJ liked exactly this feel on Hodge (22 Nov).
2. **Palette.** Deep violet-black `#07030f` for the walls, never grey.
   Rings in hot pink `#ff2e88`, cyan `#22e6ff` and orange `#ff8a1f`,
   in runs of several rings per colour. Floor grid in orange fading
   to pink. Accent: white-blue `#dff6ff`, only for the far glow and
   the kick's ring.
3. **Light.** Everything is lit by the rings. Thin bright cores with
   soft halos; the wall between rings carries faint dust, stars and
   spirals, so no part of the frame is empty. The brightest things
   are small: the far glow and the ring the kick lights.
4. **Motion.** Within a beat: one ring passes the viewer per beat, so
   the ride is in time with the music. Across a bar: the tunnel
   leans into its turn and the colour runs travel toward the viewer.
   Across a section (16 bars): the turn target moves on, the colours
   change, the ring shape may change (circle, rounded square,
   hexagon).
5. **Kick and silence.** The kick lights the nearest ring and that
   light runs away down the tunnel, ring by ring. No brightening of
   the whole frame. With no beat, the rings follow the music's own
   kicks; in silence the ride slows to a calm drift and stays lit.

## Turning: the part that makes this scene

**The tunnel bends; the picture does not just shift.** Near rings
stay around the viewer and far rings slide toward the turn, so the
rings nest off-centre as in the reference. Moving only the vanishing
point of a straight tunnel reads as a tilted camera, not a turn.

- The **target** is one point on the screen, x and y from -1 to 1.
  The far end of the tunnel sits on it.
- The tunnel's axis bends toward the target smoothly with depth (the
  offset grows with distance; a parabola is enough).
- The view rolls a little into the turn, like banking.
- The ride **eases** toward a new target. It has a top turning speed
  and never snaps, whatever the input does.

**Where the target comes from**, in this order:
1. **Outside**, when a fresh one arrives (see below).
2. **The turn knob**: how far the far end may leave the centre, from
   0 (a straight tunnel) to the corners.
3. **By itself**: a slow seeded path that visits the centre, the
   sides, the top and the corners over tens of bars, and moves to a
   new place on section changes.

`18-little-bang-2-math.mjs` already has a far end that wanders. Share
that code if it makes both scenes smaller; do not fork it.

## The target from outside

One small message through the relay and the channel, so any page or
bridge can steer:

`{ type: 'pointer', v: 1, id, x, y, t }`

- `x`, `y` from -1 to 1, `t` wall time, `id` a short name (`pad`,
  `lidar`). A message class of its own, lossy like the levels.
- The scene uses the newest pointer younger than 2 s. Older than
  that, it glides back to its own path. Nothing jumps either way.
- To test it now: `pad.html`, a plain page with a dot to drag with
  the mouse, publishing that message. It runs on the Mac.
- The lidar bridge will send the same message later. Do not build
  the bridge here. The fuller `pointers` input of the owner's brief
  (touches, strokes, which scene listens) stays for later too; this
  message must not block it.

## Worth adding

- **Speed in beats.** The speed knob picks rings per beat (half, one,
  two), so the ride always stays on the grid.
- **Breathing.** The bass widens the tunnel a little; highs make the
  wall stars twinkle.
- **The build.** In the last four bars of a section the ride picks up
  speed and the view widens; on the next 1 the colours change with
  one bright ring. One, not a strobe.
- **Buttons.** One recentres the ride. One steps the ring shape.
- **Knobs** (four): beat, speed, turn, colour (pink and cyan only at
  one end, the full set at the other).

## Limits

- **Comfort.** A turning tunnel on a large wall can make people
  queasy. Cap the turning speed, the roll (about 15 degrees) and the
  change of view width. State the caps as numbers in the maths file,
  with a test. The user judges the feel on the projector.
- The box's light and flash gates apply as they are.
- One full-screen pass at half size plus the bloom chain, as Little
  Bang 2 does. It must hold 60 fps as slot B with another scene in
  slot A.
- No change to shared files beyond the pointer message.

## Checks

- Node tests on the maths: the far end lands on the target; near
  rings stay centred within a stated tolerance; the eased target
  never exceeds the turning cap, including for a pointer that jumps
  corner to corner; a stale pointer hands back smoothly; one ring per
  beat at each speed setting.
- The scene's own check with stills: centred, hard left, top corner,
  and one frame in mid turn; both ends of each knob; no-beat mode.
- The beat and level row, once it exists.

## Order, and the party on 4 Dec

1. The scene with its own path and the turn knob.
2. The pointer message and `pad.html`.

Part 1 may go on the wall on 4 Dec only if the user keeps it at an
audition before the Wednesday freeze. Part 2 is not for that night.

## Out of scope

The lidar bridge; the tablet pad; steering any other scene; a second
tunnel scene.
