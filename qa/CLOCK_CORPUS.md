# Clock corpus

What the conducted clock is judged on for the step-1 gate (#188: rulings R1–R12, amendments A1–A9). People read this file; the scorer reads `qa/corpus.json` beside it. Where the two differ, **`corpus.json` wins** — it is the canonical table, this file is its prose.

**House rule (R9).** No audio file names and no folder paths in this file, ever: artist, title, BPM, character, role and expectation only. The box keeps file names in its own untracked manifest. Audio never leaves the machine it sits on; only beat-grid sidecars do.

**Constants are frozen while the corpus grows.** A new track adds a row, never a knob. A failing track gets a numbered finding that names a rule, not a number. The frozen set is the F3/F4 tracker as merged (main 44308b4), plus the side decision at the first lock (fix A of the half-beat ruling, 14 Nov): every named constant of the tracker is listed under "Frozen tracker constants" below, with the source file's sha256, and `qa/runner/test/tracker-frozen.test.mjs` fails when the code and that list differ.

## Status and flags

- **gate** — scored, counts towards the R7 corpus gate. **provisional** — scored, confirmed or dropped after its grid summary. **report-only** — logged and reported, outside the gate %. **missing** — the row exists, the audio does not.
- **octaveFree** (A1): the scorer picks one octave per track (the factor 1, 2 or ½ that minimises median error), logs it, and scores phase against it. A change of that factor mid-track is an `octaveFlip` and must be 0.
- **backbeatOk** (A2): acquisition to the first flip is reported as `sideSpan` and left out of the gate %, capped at 16 beats; longer is a finding, not an exclusion.
- **lockFrom** (A4): `start`, or `mark` when acquisition is measured from a logged mark (key **M**) instead of track start. `lockBeats` = mark or first audio to the first run of 8 in-gate beats.
- **BPM** says where the number comes from: *fit* = least-squares fit over the file; *fit-core-pending* = a fit exists, but a beatless intro or outro pollutes it, so the body value waits for the converter's core-trimmed fit; *label* = the user's number, no fit yet. Never a median of quantised beat intervals (that median carries up to ±2.2 %).

## Synthetic controls (node renders, PR1's own fixtures — not uploads)

| # | What | BPM | Role | Gate |
|---|---|---|---|---|
| C1 | metronome render | 120.00 exact | timeline truth | Q5, hard |
| C2 | second render plus playlist | 128.00 exact | cut and 8 s crossfade | Q7, hard |
| C3 | render with its sidecar withheld | any | the UNSCORED path | Q8, hard |

Every PR1 hard gate (Q5–Q10) rides on C1–C3, not on the real tracks. The real tracks carry Q12 (report-only) and the human gate R7.

## Role slots

| Slot | Role | Covered by | When |
|---|---|---|---|
| T1 | steady club 4/4, constant tempo, clear kick | 7, 10 (control), 19 | must |
| T2 | off-beat or side-stressed accents | 1, 13, 20, 12 | must |
| T3 | real tempo drift, live-drummed | 11, 4 | must (conditional on driftCore) |
| T4 | sparse intro, 16 or more beats with no percussion | 6, 7, 13, 20 | must |
| T5 | long breakdown then a drop | 5, 9 | must |
| T6 | DJ-set recording, real transitions | 18 | must — **the only empty must-have** |
| T7 | tempo-different transition | mix recipe b | gate once the mix exists |
| T8 | double or half ambiguity | 3, 16, 16b | report-only |
| T9 | swing and shuffle | 21 (primary), 15, 14 | gate |
| T10 | downtempo | 8 | report-only |
| T11 | fast end of the range | 6, 9, 2 | covered |
| T12 | lossy twin of a track already here | 10-lossy | report-only |
| T13 | beat-matched blend | mix recipe a | gate once the mix exists |

## The tracks

| # | Artist – title | BPM | Character | Why it is here | Expectation, and hand fixes | Slot, status |
|---|---|---|---|---|---|---|
| 1 | Darude – Sandstorm | 136 (label) | trance, off-beat bass | the known side lock (viz-183-16) | kick-side lock from acquisition, no hand fix; p90 of the error reported, the gate is 90 % or more in | T2, gate |
| 2 | The Prodigy – Voodoo People | 149.0 (fit; the user confirmed by ear, the 128 label was wrong) | breakbeat, syncopated kicks | the kick is not the anchor | lock within 4 bars on the backbeat; one flip or tap allowed | T11-b, gate |
| 3 | Massive Attack – Teardrop | 78 (label) | sparse trip-hop, half-time feel | octave-double predicted | a halving that then HOLDS is the pass; octaveFlips 0 | T8, report-only |
| 4 | James Brown – Hot | 97 (label) | live drums, loud eighth hats | the octave trap on a real band | octave error likely until the half-lag override lands; a hand fix of ÷2 should hold | T3-b, report-only |
| 5 | Daft Punk – One More Time | 122.9 (fit) | filtered house, long breakdown | free-run and re-lock | free-run through the breakdown at tempo, re-lock within 2 bars when the kick returns, jumps 0 | T5, gate |
| 6 | Underworld – Born Slippy | 140.0 (fit, core pending) | beatless intro then relentless 4/4 | lock from nothing | lock within 4 bars after the kick-entry mark, then constant; also the fast end of the range | T4, gate |
| 7 | Eric Prydz – Opus | 126.0 (fit, core pending) | nine-minute build | honest confidence under a slow build | no false lock before the kick, constant tempo after | T1, gate |
| 8 | The Chemical Brothers – Block Rockin' Beats | 110.0 (fit, core pending) | big-beat breaks | side stress on a breakbeat | tempo right, the side may land on the snare (one flip at most); a T3 candidate if driftCore is real | T10, report-only |
| 9 | Skrillex – Scary Monsters and Nice Sprites | 140 (fit, core pending) | half-time dubstep, hard drop | re-lock after a drop | re-lock within 2 bars after the drop; grid not credible yet, so report-only until confirmed | T5-b, report-only |
| 10 | Michael Jackson – Billie Jean | 117.2 (fit) | dry, machine-steady pop | the control | clean lock, p90 near the metronome's, no hand fix | T1-control, gate |
| 10-lossy | the same master as a 320 kbps CBR export | 117.2 (twin of 10) | lossy copy, same master | alignLag on lossy audio | alignLag constant, 30 ms or less, ±2 ms over the file; scores within 2 points of the lossless row. Measured 9 Nov (R14, xcorr at 48 kHz): **0 samples**, constant start to end, so the exporter trimmed the encoder delay | T12, report-only (6729053853) |
| 11 | Chic – Good Times | 111.5 (fit) | live band, unquantised | a follower tracking a real wander | jumps 0, phase stays in while bpm moves; driftCore recorded | T3, gate |
| 12 | Daddy Yankee – Gasolina | 96.0 (fit) | dembow, 3-3-2 | the bar, not the beat | beat fine, the 1 wrong: set 1 by hand, then barMoves 0; the only credible bar count in the new batch | T2-d, gate |
| 13 | Robert Miles – Children | 137.2 (fit) | trance, off-beat bass | second trance record: did the kick-side rule generalise past Sandstorm, or was it fitted to it? | lock measured from kick entry (long piano intro). Hand: none | T2-b, gate |
| 14 | Burial – Archangel | ~133 (fit, core pending) | swung, smeared drums | the hardest audio here: no kick transient | low confidence expected; UNSCORED until a Shift+S-confirmed grid | T9-c, report-only |
| 15 | Artful Dodger – Re-Rewind | ~130 (fit) | 2-step, swung hats | swing against the quarter-beat window | lock holds, hats must not pull. Hand: none | T9-b, gate |
| 16 | Travis Scott – SICKO MODE | ~155 / ~77 (fit, core pending) | hip-hop, 808 sub, section switches | the 808 is tonal sub-bass; the switches are real tempo changes | either octave if it holds, re-lock within 4 bars per switch. Hand: ×2 or ÷2 | T8-c, report-only |
| 16b | Kendrick Lamar – HUMBLE. | ~150 (fit, core pending) | hip-hop, 808 sub | the 808 question without the section switch | report-only until its core-trimmed fit is stable and the user confirms by ear | T8-b, report-only |
| 18 | Boris Brejcha – ten minutes of a real DJ set | per-transition fit | real transitions, EQ moves, breakdowns | the number the party is judged on | 90 % or more of played time inside the gate, at most one hand fix per transition | T6, gate (**audio not made yet**) |
| 19 | Disclosure – Latch | ~122 (fit, core pending) | vocal 4/4, clear kick, thin arrangement | not 2-step: the kind of track a set opens with | kick lock expected; a side or octave error is a real finding | T1-b, gate |
| 20 | Energy 52 – Café del Mar | ~133 (fit) | trance, off-beat bass | third off-beat trance record; three make the kick-side rule answerable | no false lock on the arpeggio before the kick, then kick-side lock within 4 bars | T2-c, gate |
| 21 | MJ Cole – Sincere | ~132.5 (fit) | UK garage 2-step | the reviewer's 2-step record | the 2-step gate track; bar positions suspect (3.70 beats per bar), so position rows are report-only | T9, gate |

**Replacements and originals.** All of these are on the box, and the replacements (13, 14, 15, 16, 16b, 19, 20, 21) **sit beside the originals — they did not replace them**.

## 17 The mix recipes (made by the box, not by hand)

The box's mix tool builds mixes from the committed recipe list: two tracks by corpus id, two cut windows, a fade and a mode. Truth is **derived** from the two single-track references plus arithmetic, and never detected on the mixed file (R12). The output is a derived render, never a source track.

Per cut window the truth is a least-squares straight grid through the reference beats: `fitMode: "linear"` when window drift is under 0.3 % (half against half, and across 64-beat blocks when the window holds 128 or more beats; R17a), else the window is refused unless its side opts into `allowDrift`, which gets an 8-beat moving fit (`"piecewise"`). Residual RMS (and excessRms above the frame floor) is reported, not a limit: Beat This! jitters ~8 ms on every track (R17); a window over 25 ms RMS refuses as `jitter`. Hard self-check: refitting the written truth deviates by 1 ms at most.

- **Mode A, beat-matched blend (T13, gate):** the incoming track is resampled to the outgoing tempo and started on a bar line (`bar1At`, set by ear). 16 bars of equal-power fade, one tempo throughout; what changes is the drums, the EQ and two kicks nearly aligned. Expect: phase holds through the overlap (90 % or more in, the beats within ±1 beat of the midpoint excluded), confidence stays high, no rewind. A drifting record is allowed anywhere except as mode A's *incoming* track.
- **Mode B, unmatched crossfade (T7, gate):** same cut, no resampling, 8 s fade, 123 against 126 then 126 alone. Expect: confidence FALLS in the overlap (a clock that stays confident while two tempos play is wrong), the tempo follower re-locks within 8 beats of the overlap ending, no rewind. The overlap's own phase score is reported, not gated.
- **First pair:** One More Time (123) into Opus (126), the ratio from a fit over the cut windows, never from a median BPM.

## 18 Ten minutes of a real DJ set (T6, gate)

Real transitions, EQ moves, breakdowns. 90 % or more of played time inside the gate, at most one hand fix per transition. The number the party is judged on.

## Unusual tempo / meter tracks (hc-01 … hc-12, report-only, slot T14)

The user's batch of 10 Nov: tracks that are **hard for the tracker**, not a genre: odd meters, swing, unusual or slow tempos, maybe polyrhythm. Their ids map to files in the box's own corpus-map.json; this file names neither artists nor titles for them yet. The first reference grids (Beat This! alone, 18:20) were gridSuspect on 7 of 11, with 3.49, 3.15, 2.46, 1.86 and 2.07 beats a bar: those may be real odd meters, not errors. These rows take their reference from **the three-tracker vote** (`qa/ref-beats-vote.sh`, `refTool: "vote"` in corpus.json):

- **A** Beat This! frame logits decoded by madmom's DBN beat tracker; bar positions from madmom's DBN downbeat tracker, which may choose 2, 3, 4, 5, 6 or 7 beats a bar; the meter it picks is reported per track. **B** madmom's RNN beat activation and the same DBN. **C** essentia's RhythmExtractor2013, multifeature, with its confidence.
- **Range:** wide, 60–260 BPM (essentia stops at 250): 87.7 (hc-05) and 91.06 (hc-04) may be the true tempos, and hc-06 (~130), hc-07 (~128) and hc-01 (~122.9) must fit too. A row may set `refMinBpm` / `refMaxBpm`; the vote uses them only when the wide vote does not agree.
- **Ear checks (14 Nov):** a row with `bpmSource: "user-ear"` and `refMinBpm` / `refMaxBpm` (about ±4 % around the tempo the user heard) is decoded in that range from the start, so an agreement in the wrong octave cannot win. A row with `meter` gives the downbeat DBN that meter only. A row with `noRef: true` never gets a reference grid from the vote. A changed range or meter votes again (the plan is kept in `.vote.json`).
- **Accepted** when two of three agree within 1 % after octave folding **and** essentia's confidence is at least 1.5. When the agreement needed an octave fold, no prior picks the octave: both candidates are reported and the track is flagged for the user's ear, unless essentia's confidence is at least 3.5. gridSuspect stays a reported number.
- **Swing and tempo changes:** each track's line carries its tempo over 8-bar windows (p5 / p50 / p95 and the spread), so a drifting or swung track shows as one instead of being forced to a single BPM.
- The vote also runs, as a report, on the 22 earlier tracks: their `.ref.*` files and grids are never touched by it.

| Id | BPM | Status | Reference |
|---|---|---|---|
| hc-01 | ~122.9 (user) | report-only | vote |
| hc-02 | 173.05 (the accepted vote); 5 beats a bar (the user's bar presses, 14 Nov: `meter: 5`) | report-only | vote, downbeat DBN on 5 only |
| hc-03 | 160 (user by ear, 14 Nov; range 153.6-166.4) | report-only | vote, ear range first |
| hc-04 | 90.91 (user by ear, 14 Nov; range 87.27-94.55) | report-only | vote, ear range first |
| hc-05 | none: the tempo drifts (user by ear, 14 Nov) | report-only | none (`noRef`; the vote is a report) |
| hc-06 | ~130 (user) | report-only | vote |
| hc-07 | ~128 (user) | report-only | vote |
| hc-08 | none: the tempo floats (user by ear, 14 Nov) | report-only | none (`noRef`; the vote is a report) |
| hc-09 | 189.1 (user by ear, 14 Nov; range 181.5-196.7) | report-only | vote, ear range first |
| hc-10 | 107.5 (user by ear, 14 Nov; range 103.2-111.8) | report-only | vote, ear range first |
| hc-11 | 172 (user by ear and the log check, 14 Nov; range 165.1-178.9) | report-only | vote, ear range first |
| hc-12 | 140.16 (the accepted vote, 14 Nov; added later, the box map only) | report-only | vote |

## House set, 15 Nov (house-01 … house-05, report-only, slot T15)

The user's five house tracks of 15 Nov: steady 4/4 club music, to check the tracker on the music it will mostly play. Their ids map to files in the box's own corpus-map.json only. The three-tracker vote accepted all five with 3 of 3 trackers agreeing, meter 4 and no gridSuspect (248-519 s long). They take their reference from the vote (`refTool: "vote"`); the range is about ±4 % around the accepted tempo and is used only if a later vote disagrees. They were voted before these rows existed, so the vote wrote no reference then; an accepted vote row with no reference yet is voted again once and gets it. **Report-only: they never fail a run.** They print a gate-table row, a side-diag row and an F3 shadow row (the tracker under test beside main 501cfe1), kept out of the gate-table sums and the F3 no-regression check.

| Id | BPM | Status | Reference |
|---|---|---|---|
| house-01 | 128.0 (the accepted vote) | report-only | vote |
| house-02 | 124.99 (the accepted vote) | report-only | vote |
| house-03 | 124.0 (the accepted vote) | report-only | vote |
| house-04 | 123.0 (the accepted vote) | report-only | vote |
| house-05 | 124.21 (the accepted vote) | report-only | vote |

**Known limitation (user, 15 Nov):**

- On house with a loud off-beat bass the tracker can slide to the off-beat after the first lock. Routes found: a tempo excursion while locked (house-01, house-02), and the persistent-dissent jump after a breakdown (house-03). Accepted for the MVP. Remedy: a hand flip (Shift+F on the conductor page, or the flip button on the controller). If a flip does not hold, the tempo is wrong (seen on house-01 after a breakdown): tap 4 or more even beats (Shift+A or the tap button), or restart (Shift+R / hold button 8).
- The house rows stay report-only. The fix is parked; candidates: a side gate on side-crossing moves, a tempo gate while locked (see #221, F2), holding the phase through breakdowns.

## Reading the corpus

Per track: the share of played time inside the gate (±35 ms), for the tracker alone (the shadow) and for the conducted clock, plus p50, p90 and p95 of the error as reported numbers. The corpus number: how many tracks need no hand fix, and how many fixes the rest needed.

Every BPM used by a rule comes from a least-squares fit over the window, never from the median of 20 ms-quantised beat intervals (that median carries up to ±2.2 %). Drift is `driftCore`: the peak-to-peak of a 16-beat moving fit over the track minus its first and last 30 s. Bar positions are trusted only when a grid's `barOk` is true, which needs the user's Shift+S confirmation with the bar lamp shown; 13 of the 16 new grids are `barSuspect`.

Constants are frozen while the corpus grows (the list is under "Frozen tracker constants"): a new track adds a row, never a knob. A failing track gets a numbered finding that names a rule, not a number.

## Frozen tracker constants (F3/F4, main 44308b4; side fixes A and A3; hand-held mode)

The live tracker as merged on 14 Nov: F3 (the locked tempo from a fit of the onsets, with the short-window step path) and F4 (the first-lock candidate scan, the second look and the re-acquire scans), plus fix A of the half-beat ruling (the side at the first lock from two hypotheses, phase 0 or 1/2, by the low lane's onset weight, ties broken by the attack's brightness), plus fix A3 (15 Nov: after a lock, every re-lock measures the error against the model's own beat, the side kept before the free-run; up to `reacqSlew` it slews, up to `sideGuard` it jumps once on the next bar line, beyond `sideGuard` the jump is refused and logged), plus the net-displacement budget (15 Nov: the signed sum of the re-lock corrections since the last confirmed lock never passes `sideGuard`; a step is clipped to the remainder or refused, and `netConfirmBeats` consecutive in-window beats at the lock confidence confirm the lock and reset the sum), plus persistent dissent (15 Nov: `dissentCount` sideGuard refusals in a row, the same sign, |e| >= `dissentMinE`, spread <= `dissentSpread`, over >= `dissentBeats` beats with no gap > `dissentGapS` s and the drums present, authorise one bar-line jump of their median). These are its values. Changing any of them, or any line of the tracker, needs a decision first, and this list and the sha256 change in the same PR: `qa/runner/test/tracker-frozen.test.mjs` compares both with the code.

- tracker source sha256: `1e78297af2da5f7ff0c7b8d38940c930f6808109efcab38ff3e84eae175cc1a4`
- 15 Nov, logging only (no behaviour change): the tracker records each silent free-run -> locked re-lock with its size (`relocks`) and the PLL's applied phase correction while locked (`phaseApplied`), for the side-diag and phase-diag rows.
- 15 Nov (house off-beat diagnosis), logging only: the side track (`sideTrack`): every phase move after the first lock summed since the last confirmed lock (`sideNet`) and since the first lock, its largest size, the number of side changes, and `sideBlocked` (0 until a side gate exists). Same day, still logging only: every source of the output beat's phase (the slew attributed to whoever wrote the pending correction, jumps by kind, and the period against a reference period), a second running sum `sideNetQ` that resets only after a quiet confirmation (8 in-window beats at the lock confidence with median |e| < 0.1), and side changes counted on arrival at another half beat. Then (still logging only) every write to the period with its writer and the old and new bpm (`periodLog`).
- 15 Nov (the user's go 23:15, docs/CELLULAR_VIZ_BRIEF_HOLD.md): hand-held mode. Off (the default, no hand): no line of it runs and the tracker behaves as before. On (`handHold`, from clock.js `fix('hold')` or an accepted tap, flip, nudge or set-1): the phase is trimmed only from broadband onsets within `holdWindow` beat of the held model (the 3 % rate limit), the net trim since the hold stays within `holdNetMax` beat, only the F3 long fit moves the period and only within `holdTempoTol` of the held tempo (x2 and /2 by hand scale it); every other period writer (acf-*, scan-*, fit-step, fit-short-refine, hold-release, lock-lost-restore) and every jump but the hand's flip (acquire, dissent, relative, octave, rescan, secondlook, side, override) is refused and counted. `holdSuspect` (a hint, nothing moves): the free tempo estimate more than `holdSuspectTempo` off, or the drums more than `holdSuspectPhase` beat off the held beat, for more than `holdSuspectBeats` beats.

Module constants:

| Constant | Value |
|---|---|
| `ANALYSIS_DELAY_MS` | `12` |
| `HOLD_PROTECT_BARS` | `16` |
| `EDGES` | `[20, 60, 120, 250, 500, 2000, 4000, 8000, 16000]` |
| `BANDS` | `[sub, kick, low, lowMid, mid, upperMid, presence, air]` |

The tracker's defaults (`DEFAULTS`, in the code's order; F3's are `fitBeats` to `fitChainTol`, F4's are `acqBeats` to `acqLookRatio`, side fix A's are `sideBeats` to `sideBrightLag`, fix A3's is `sideGuard`, the net budget's is `netConfirmBeats`, persistent dissent's are `dissentCount` to `dissentOnsets`, hand-held mode's are `holdWindow` to `holdSuspectBeats`; fix A3 renamed `reacqJump` to `reacqSlew`, same value):

| Constant | Value |
|---|---|
| `minBpm` | `60` |
| `maxBpm` | `180` |
| `priorBpm` | `120` |
| `priorOct` | `0.7` |
| `halfLag` | `0.55` |
| `acWindow` | `4` |
| `refineWindow` | `8` |
| `estHz` | `6` |
| `onsetK` | `2` |
| `onsetWin` | `1` |
| `refractory` | `0.15` |
| `floorRel` | `0.15` |
| `peakTau` | `10` |
| `strongRel` | `0.4` |
| `acqConf` | `0.4` |
| `lockConf` | `0.5` |
| `lostConf` | `0.3` |
| `acqWindow` | `0.5` |
| `trackWindow` | `0.25` |
| `trackGain` | `0.15` |
| `driftOnsets` | `4` |
| `driftMin` | `0.02` |
| `confAlpha` | `0.15` |
| `confTau` | `1.0` |
| `maxRate` | `0.03` |
| `refRel` | `0.3` |
| `reacqSlew` | `0.25` |
| `reacqOnsets` | `3` |
| `bpb` | `4` |
| `escapeTempo` | `0.03` |
| `escapePhase` | `0.25` |
| `escapeSecs` | `4` |
| `escapeConf` | `0.7` |
| `laneBeats` | `8` |
| `laneMinOnsets` | `4` |
| `relRatios` | `[4/3, 3/2, 2/3, 3/4]` |
| `relMargin` | `1.2` |
| `relMinGain` | `0.1` |
| `relSecs` | `8` |
| `relMinR0` | `0.2` |
| `tempoTol` | `0.03` |
| `tempoHoldN` | `12` |
| `trustR` | `0.3` |
| `trustTol` | `0.01` |
| `relMinR` | `0.25` |
| `relMinGainR` | `0.15` |
| `relEverySecs` | `8` |
| `fitBeats` | `16` |
| `fitMinOnsets` | `8` |
| `fitMinSpanBeats` | `8` |
| `fitInlier` | `0.15` |
| `fitMinPairGap` | `2` |
| `fitCoverage` | `0.5` |
| `fitHz` | `6` |
| `fitAccept` | `0.12` |
| `tempoRateMax` | `0.02` |
| `stepPct` | `0.03` |
| `stepEstimates` | `12` |
| `fallbackAfter` | `2` |
| `stepOnsets` | `4` |
| `stepResid` | `0.1` |
| `stepAgree` | `0.025` |
| `stepNear` | `0.4` |
| `stepYoungBeats` | `8` |
| `fitNewestOff` | `0.08` |
| `stepSlewRate` | `0.06` |
| `stepSlewBeats` | `8` |
| `stepCooldown` | `8` |
| `fitStrongRel` | `0.25` |
| `fitChainTol` | `0.1` |
| `acqBeats` | `24` |
| `acqMargin` | `1.15` |
| `acqMaxSecs` | `8` |
| `secondLookAt` | `8` |
| `acqPeaks` | `3` |
| `acqDedup` | `0.015` |
| `acqSame` | `0.04` |
| `acqRatios` | `[1, 2, 1/2, 4/3, 3/4, 3/2, 2/3]` |
| `acqFloor` | `0.25` |
| `acqRelScore` | `0.5` |
| `acqLookRatio` | `1.5` |
| `holdOct` | `0.75` |
| `holdSlow` | `0.8` |
| `holdFast` | `0.6` |
| `holdSecs` | `2` |
| `holdProtectBars` | `16` |
| `sideBeats` | `16` |
| `sideBin` | `0.125` |
| `sideTie` | `0.2` |
| `sideBrightLead` | `0.1` |
| `sideBrightLag` | `0.03` |
| `sideGuard` | `0.42` |
| `netConfirmBeats` | `8` |
| `dissentCount` | `6` |
| `dissentMinE` | `0.4` |
| `dissentSpread` | `0.06` |
| `dissentBeats` | `16` |
| `dissentGapS` | `4` |
| `dissentDrumRel` | `0.5` |
| `dissentOnsets` | `2` |
| `holdWindow` | `0.125` |
| `holdTempoTol` | `0.01` |
| `holdNetMax` | `0.25` |
| `holdSuspectTempo` | `0.03` |
| `holdSuspectPhase` | `0.25` |
| `holdSuspectBeats` | `8` |

## Still owed

1. **18**, ten minutes of a real DJ set — the only empty must-have (T6).
2. The **lossy twin** of 10: one 320 kbps CBR, 44.1 kHz export of the same master, no normalising or trimming (the 192 kbps, 32 kHz file on the box is a different master and must not be used).
3. The **`bar1At` and mark timestamps by ear** for the tracks that need them: 7, 6, 13, 20, 5, 16, 9 and the DJ set's transitions.
4. One **Shift+S pass** over the new grids, 14 first.

Made-by: VIZ research
