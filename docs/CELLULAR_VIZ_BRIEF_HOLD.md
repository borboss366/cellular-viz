# cellular-viz — brief: hand-held mode (the hand confirms the beat, the tracker only trims)

Reviewer, 15 Nov. Follows the house off-beat diagnosis (#236).

## Finding

On house with a loud off-beat bass the tracker slides to the off-beat
after a correct lock. #236 found two routes: a tempo excursion while
locked (house-01, house-02) and the persistent-dissent jump after a
breakdown (house-03). A hand flip fixes it, and then the same routes
undo the flip. The estimator fixes so far (A3, A3b, A3c) each closed
one loophole and opened another.

## Decision

No new detection rule. One authority rule: after the hand confirms the
beat, the tracker may trim and may not move. House tempo is constant
within a track and beat-matched across a mix, so a confirmed beat stays
right until the DJ changes something, and the hand sees that.

This is opt-in. With hold off, the tracker behaves exactly as today,
and its frozen constants and sha are untouched except for the new
gate.

## The rule

**Entering hold.** `fix('hold')` (a toggle), and implicitly any
accepted `tap`, `flip`, `nudge`, `setOne`. Hold records the output's
tempo and phase at that moment as the held model.

**While held, the tracker may:**
- trim phase from in-window broadband onsets, as now, but with the
  window narrowed to `holdWindow` (±1/8 beat) and the usual 3 % rate
  limit;
- follow tempo within `holdTempoTol` (±1 %) of the held tempo, by the
  F3 fit only.

**While held, the tracker may not:**
- book any jump (acquire, rescan, secondlook, relative, octave, side,
  the persistent-dissent half-beat move);
- let the ACF, the scan or the step path write the period;
- accumulate a net phase move of more than `holdNetMax` (1/4 beat)
  away from the held model. Reuse #236's `sideNet` sum. At the limit,
  trimming stops and the clock free-runs on the held model.

**Breakdowns.** No onsets in the window: the held model free-runs
(tempo and phase kept). Confidence may fall and the scenes go to
no-beat mode, but the state stays `held`, and nothing re-acquires.
When onsets return, trimming resumes from the held phase.

**Leaving hold.** Only by hand: `hold` again, or `restart`. A new
`tap`, `flip` or `nudge` re-anchors the held model and stays in hold.
`x2` / `half` apply to the held model and stay in hold.

**The hand needs to know when hold is wrong.** While held, the tracker
keeps computing its own free estimate without applying it (the shadow
path already exists). When that estimate disagrees with the held model
by more than 3 % in tempo or 1/4 beat in phase for more than 8 beats,
raise `holdSuspect`: a lamp on the conductor page, the hold button's
LED on the controller turns amber. It is a hint only; nothing moves.

Three constants (`holdWindow`, `holdTempoTol`, `holdNetMax`), global,
stated here, not tuned per track.

## Tasks

1. Tracker: the hold gate at every writer of the period and every jump
   booking (#236's writer log names them all), state `held`,
   `holdSuspect`, `snapshot().hold`.
2. `clock.js`: `fix('hold')`, the implicit entry on hand fixes, the
   authority table in the header updated (held: the hand owns tempo
   and side; the tracker trims).
3. Conductor page: a hold lamp and key (Shift+H), the `holdSuspect`
   lamp. Controller: hold on a free top-row button, LED green held,
   amber suspect.
4. Scorer and log: `hold` and `holdSuspect` records; time held per
   track; inside-gate % reported separately for held and free time.
5. Tests (node, no audio):
   - the #236 `houseTrap` fixture and the real-breakdown trap: lock,
     flip to the right side, hold; the side never changes again and the
     net move stays under `holdNetMax`;
   - a tempo excursion bait (off-beat bass at +12 dB) under hold: tempo
     stays within 1 %;
   - a 16-bar breakdown under hold: phase on the beat within 35 ms when
     the kick returns;
   - a real 120 to 128 step under hold: nothing moves, `holdSuspect`
     raises within 16 beats;
   - hold off: every existing tracker test passes unchanged.
6. Box, report-only: the five house rows and Sandstorm with the script
   "lock, flip if the side is wrong, hold". Print inside-gate % held
   against today's free rows, and the number of hand presses per track.

## The user's gate

One house track from the corpus and ten minutes of the friend's mix on
the conductor page with the controller: lock, fix once if needed, hold.
Pass: no more than one press per track after hold, and one press per
transition (re-tap or flip, which stays in hold). If the mix needs more
than that, the finding is about transitions, not about hold.

## Out of scope

Any new estimator rule; the parked side gate and tempo gate (#221 F2);
Pro DJ Link (if the friend's players have Link, it becomes a source
above this one and hold is the fallback).
