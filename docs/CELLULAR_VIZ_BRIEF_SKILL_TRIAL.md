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
and the look loop; if B wins, a later trial can separate them. It is
not worth doing first.

## Afterwards

The winning build goes through the audition like any other scene. The
other branch is deleted. Neither enters the set without the user's
keep.

## Out of scope

Three.js or any library; changes to shared files; the scene kit;
levels or any audio work.
