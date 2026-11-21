---
name: webgl-scene
description: Build or restyle a cellular-viz scene (raw WebGL2, no library) so it looks good on a projector and follows the repo's scene conventions. Read before writing any shader or scene module.
---

# Writing a scene for cellular-viz

On trial (see `docs/CELLULAR_VIZ_BRIEF_SKILL_TRIAL.md`). Until the
trial ends, read this only when your task says so.

A scene here is judged by eye, in a dark room, on a projector, next to
a second scene blended over it. Passing checks is the floor. The work
is the look.

## 1. Before any code: write the look (five lines, in the PR)

1. **Reference.** A real thing or a named piece of work. "Aurora over
   water", not "flowing colours".
2. **Palette.** Two or three hues and one accent, as hex. Say which is
   the background (normally true black).
3. **Light.** Where it comes from, and what is bright. Most of the
   frame should be dark or mid; highlights are small.
4. **Motion at three scales.** What changes within a beat, across a
   bar, across a section (16 to 32 bars).
5. **Kick and silence.** The one or two things the kick does, and what
   the scene looks like with no beat at all.

If you cannot write these, ask. Do not start.

## 2. House conventions (copy the wiring, do not invent it)

Take `24-paint-pour.html` + `24-paint-pour.mjs` as the pattern; it is
the newest scene.

- **Module and page.** The scene is `NN-name.mjs` exporting
  `createScene()` with `init / resize / frame / press / release /
  dispose` and `qa`, plus `MACROS`, `TRIGGERS`, `DETAIL`. The page
  `NN-name.html` loads `panic.js`, `clock.js`, `audio-in.js` and owns
  the context (`webgl2`, `antialias: false`, `alpha: false`).
- **Maths apart from drawing.** Anything a test should check goes in a
  plain module that node can run.
- **Time comes from the clock.** `beats`, `bpb`, `bpm` and the hits as
  beat positions. Never `Date.now()` or a private timer for anything
  musical.
- **Beat strength.** Read `clock.beatGain(?beatKnob)` every frame and
  multiply it only into the beat terms, each with its own cap. At
  gain 1 the scene is unchanged.
- **Knobs.** A `somethingKnob=N` query parameter (1 to 4) read with
  `clock.knob(N)`. The slot renumbers for slot B. Both ends of every
  knob must look good; a knob with an ugly end is a bug.
- **No-beat mode.** Below confidence 0.4 the beat effects fade to the
  energy envelopes (`audio.beatWeight()`, `audio.energy`) over a bar.
- **Capture mode.** `?capture=1`: no text, no buttons, no cursor.
- **Seeded.** No `Math.random()` in the scene; randomness comes from
  the seed and the beat, so a still can be reproduced.
- **Slots.** The scene is loaded and thrown away many times a night.
  It must start clean, look right within its first second, and free
  everything in `dispose`.
- **Errors are loud.** Check `getShaderInfoLog` and framebuffer
  completeness, and fail into the panic path, not a black frame.
- Closed files stay closed (`clock-tracker.js`). Shared files
  (`clock.js`, `audio-in.js`, `slot.js`) are not changed for a scene.

## 3. Where it is shown (this changes what looks good)

- The window is captured at **960×540** and scaled up. Detail finer
  than two pixels turns to shimmer. Lines and points need real width.
- **Black is black.** Scenes are blended by adding. A grey floor
  washes out the other scene, so the background stays at zero.
- Eight bits per channel through capture: dark gradients band. Dither
  the final colour (noise of ±0.5/255).
- Two scenes run at once, beside OBS and Resolume on one GPU. Halve
  the resolution of expensive passes first.
- Light and speed are **gated by the box, with numbers**: the #88
  light limiter and the GPU and flash gates in your PR's experiment
  file (`qa/runner/README.md`, format and gates). Build to those
  numbers. Nothing in this file replaces or loosens them; if this
  file and a gate disagree, the gate is right.

## 4. Technique sheet (raw WebGL2)

**Colour**
- Work in linear light. Tone map at the end (the ACES fit or Reinhard
  is enough), then encode to sRGB by hand; the canvas does not do it.
- Build palettes with a cosine palette (Inigo Quilez) or fixed stops
  mixed in Oklab. Mixing in RGB gives muddy middles.
- Keep saturated colour for small areas. Large areas stay quiet.

**Glow**
- Bloom is a downsample chain, not a wide blur: render to a float
  target, downsample 5 or 6 times (13-tap or dual Kawase), upsample
  with a tent filter, add a few per cent back. No hard threshold;
  use a soft knee or none.
- Glow must come from bright sources in linear light. A glow painted
  on with a wide smoothstep looks flat.

**Buffers**
- Rendering to `RGBA16F` needs `EXT_color_buffer_float`; ask for it
  and fall back to 8 bits with dithering. Linear filtering of 32-bit
  floats needs `OES_texture_float_linear`; 16-bit is enough.
- Feedback (trails, fluid, reaction) is two targets swapped each
  frame. Never read the target you write. Give trails a decay so they
  reach zero.

**Shape and line**
- `gl.LINES` is one pixel wide. Draw lines as quads or as a distance
  field, and antialias with `fwidth`.
- Distance fields: smooth minimum for joins, `fwidth` for edges.
  Supersample only where an edge shimmers.

**Noise and flow**
- Hash without `sin` (Dave Hoskins' hashes); the `sin` hash differs
  between GPUs. Layer noise at 3 or 4 octaves, warp the domain for
  organic shapes, use curl noise when things should flow without
  piling up.

**Motion**
- Envelopes have a fast attack and a slow release. Nothing snaps
  unless the look calls for it.
- Give things inertia: the kick pushes a velocity, not a position.
- Not everything moves with the beat. One layer on the beat, one
  drifting, one changing per section.
- The kick should be readable in a still strip of one bar, without
  being a brightness pump on the whole frame.

## 5. The look loop (do this before asking for review)

1. Ask the box for a strip with the fixed strip script (trial brief,
   task 0): one contact sheet at 960×540 with 8 frames across one bar
   with the clock locked, 4 frames in no-beat mode, and 1 frame at
   each end of every knob. You cannot run arbitrary scripts on the
   box; this one is the way. If the strip script is not there, say so
   in the PR and stop the loop. Do not pretend to have looked.
2. **Look at the images yourself** and answer in writing:
   - Is there one place the eye goes?
   - Are there true blacks and only a few highlights, or grey mush?
   - Can you point at the beat from the frames alone?
   - Any banding, aliasing, shimmer, or detail lost at this size?
   - Shrunk to a thumbnail, is it still the reference?
   - Do the knob ends still look intended?
3. Change the one thing that hurts most. Capture again.
4. At most three rounds. Put the last strip in the PR, with one line
   per round on what changed, and one honest line on what still looks
   wrong.
5. Keep a change log in the PR: for each change to the look, one line
   and where it came from, as `sheet` (section 3 or 4), `loop` (you
   saw it in a strip), or `own` (neither).

## 6. What a finished scene PR contains

The five lines of the look; the scene, its check and its experiment
file with the usual gates; the strip; the change log; the list of
knobs with what each end does.
