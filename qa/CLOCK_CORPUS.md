# Clock corpus

What the conducted clock is judged on for the step-1 gate (#188: rulings R1–R12, amendments A1–A9). People read this file; the scorer reads `qa/corpus.json` beside it. Where the two differ, **`corpus.json` wins** — it is the canonical table, this file is its prose.

**House rule (R9).** No audio file names and no folder paths in this file, ever: artist, title, BPM, character, role and expectation only. The box keeps file names in its own untracked manifest. Audio never leaves the machine it sits on; only beat-grid sidecars do.

**Constants are frozen while the corpus grows.** A new track adds a row, never a knob. A failing track gets a numbered finding that names a rule, not a number.

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
| T12 | lossy twin of a track already here | 10-lossy | missing |
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
| 10-lossy | the same master as a 320 kbps CBR export | 117.2 (twin of 10) | lossy copy, same master | alignLag on lossy audio | alignLag constant, 30 ms or less, ±2 ms over the file; scores within 2 points of the lossless row | T12, **missing** |
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

## Reading the corpus

Per track: the share of played time inside the gate (±35 ms), for the tracker alone (the shadow) and for the conducted clock, plus p50, p90 and p95 of the error as reported numbers. The corpus number: how many tracks need no hand fix, and how many fixes the rest needed.

Every BPM used by a rule comes from a least-squares fit over the window, never from the median of 20 ms-quantised beat intervals (that median carries up to ±2.2 %). Drift is `driftCore`: the peak-to-peak of a 16-beat moving fit over the track minus its first and last 30 s. Bar positions are trusted only when a grid's `barOk` is true, which needs the user's Shift+S confirmation with the bar lamp shown; 13 of the 16 new grids are `barSuspect`.

Constants are frozen while the corpus grows: a new track adds a row, never a knob. A failing track gets a numbered finding that names a rule, not a number.

## Still owed

1. **18**, ten minutes of a real DJ set — the only empty must-have (T6).
2. The **lossy twin** of 10: one 320 kbps CBR, 44.1 kHz export of the same master, no normalising or trimming (the 192 kbps, 32 kHz file on the box is a different master and must not be used).
3. The **`bar1At` and mark timestamps by ear** for the tracks that need them: 7, 6, 13, 20, 5, 16, 9 and the DJ set's transitions.
4. One **Shift+S pass** over the new grids, 14 first.

Made-by: VIZ research
