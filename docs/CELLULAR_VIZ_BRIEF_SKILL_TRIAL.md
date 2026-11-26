# cellular-viz — brief: does a scene skill make better scenes? (a trial)

Owner, 21 Nov. Not before Monday 23 Nov; the Saturday brief's freeze
stands until then.

## Question

The user's hypothesis: the agents would write better-looking WebGL
scenes with a skill to read first. `docs/skills/webgl-scene/SKILL.md`
is that skill: the house conventions, what the projector route does to
a picture, a technique sheet, and a loop where the agent looks at its
own frames. This trial tests it once, cheaply, before anyone relies
on it.

## Task 0, before the trial: a fixed strip script (Puggie)

Builders cannot ask the box for an arbitrary run, so the skill's look
loop needs a fixed one. Found in review by the box's agent, 21 Nov.

- `qa/strip.mjs`, registered with the runner like the other checks.
  It works on any scene: the experiment file names the page, its query
  and its `*Knob` parameters.
- Output: one contact sheet PNG at 960×540 per frame: 8 frames across
  one bar with the clock locked, 4 in no-beat mode, 1 at each end of
  every knob. Posted where the builder can open the image.
- It runs only when a PR asks for it, never by itself. Both arms can
  ask; only the skill tells a builder to.
- Built and merged by a session that takes no part in the trial.
- The trial does not start until a strip of an existing scene (Paint
  Pour) has come back and been opened by an agent.

## The trial

One scene brief, built twice, graded blind.

- **Arm A:** a fresh agent session with the scene brief only.
- **Arm B:** a fresh agent session with the scene brief and the
  instruction "read `docs/skills/webgl-scene/SKILL.md` first and
  follow it".

Everything else is the same: model, repo commit, the scene brief word
for word, and the budget (one build and at most three rounds of the
agent's own revisions; no feedback from the user to either arm).

**Keeping the arms apart**
- The skill lives under `docs/skills/`, not `.claude/skills/`, so no
  session loads it by itself. Arm A is told not to read `docs/skills/`.
- Branches `trial/a` and `trial/b`. Neither session sees the other's
  branch, PR or stills.
- Neither arm is told this is a comparison.

**The scene brief.** The user writes it (about ten lines: the
reference, the mood, what the kick does). If he has none ready, the
default is **Aurora**: curtains of northern light over a dark horizon,
slow drift, folds that travel sideways, the kick sends a ripple up the
curtains, silence leaves a faint slow glow. Knobs: beat, height,
colour. It is chosen because the look carries it; there is no
simulation to hide behind.

This is an exception to the closed list (no new scenes), for this one
scene, by the owner.

## Grading

**Blind.** Puggie flips a coin, puts the two builds on the audition
page as X and Y, and keeps the mapping in the private folder until the
user has graded.

**The user, on the projector, with music:**
1. First ten seconds: which one would you keep?
2. Two minutes each on a house track: does the beat read?
3. A breakdown: does no-beat mode hold up?
4. Each knob end to end.
5. Blended over Paint Pour in Resolume: does it stay clean?

One verdict: X, Y, or no real difference.

**Measured, reported beside the verdict (not part of it):**
- frame time with a second scene running;
- QA failures on first submission;
- agent rounds, wall time and tokens for each arm;
- box runs each arm asked for, strips included;
- for arm B, its change log: how many changes came from the technique
  sheet, how many from looking at a strip, how many from neither;
- whether the conventions were followed (capture mode, no-beat mode,
  beat gain, knobs, seeded, dispose).

## Reading the result

- **B clearly better:** move the skill to `.claude/skills/webgl-scene/`
  and name it in `docs/AGENT_PUGGIE.md`. The scene kit (owner's brief,
  task 2) then carries the conventions half in code, and the skill
  shrinks to the look.
- **No real difference:** drop the skill. Keep only what the measured
  list shows helped (for example fewer QA failures).
- **A better:** drop it, and note what the skill pushed the agent
  toward that hurt.

One scene is one data point. If the verdict is close, run a second
scene before deciding. The skill mixes two things, a technique sheet
and the look loop. Arm B's change log says which one the changes came
from. It is the builder's own account, so treat it as a hint: if it
says the loop did the work, the next step is to cut the sheet down and
see whether anything is lost.

## Afterwards

The winning build goes through the audition like any other scene. The
other branch is deleted. Neither enters the set without the user's
keep.

## Out of scope

Three.js or any library; changes to shared files; the scene kit;
levels or any audio work.

## Result, 26 Nov

The user graded the two Aurora builds: **the build with the skill was
much better.** It is merged (#305) and in the set as scene 8 (#318);
the other build is closed (#299).

What the result does and does not show:
- **The skill is adopted.** It moves to
  `.claude/skills/webgl-scene/SKILL.md` and both agent files name it.
- **The look loop was never run.** The build with the skill did zero
  rounds: the strip script (task 0) was not built, and the build was
  written on a machine with no browser. So the win came from the rest:
  the five lines of the look written first, the projector facts and
  the technique sheet. The owner and the box's agent both guessed the
  loop would do most of the work; this one scene says otherwise.
- **The loop is therefore still untested**, not disproved. Task 0
  stays open as an ordinary task. Its first use is the two scenes the
  guest DJ found too empty (Little Bang, Lenia).
- **Limits.** One scene. The winning build also added a lake and a far
  shore where the scene brief said no landscape; part of the win may
  be that fuller picture. The grading was not confirmed blind.
