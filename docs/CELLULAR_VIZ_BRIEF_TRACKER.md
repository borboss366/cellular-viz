> **Status (1 Nov):** tracking issue **#173**. VIZ research's amendments in #95 comment 6560018120 are binding and win where they conflict with this brief. Task 3's gridder port is replaced: Beat This! (`qa/ref-beats.sh`) is the gridder, and a small converter turns its `.ref.beats` into sidecar v2 (#173). Drum & bass at 174 is out of scope (user, 1 Nov).

# cellular-viz — brief: the live tracker (clock PR 3, `?clock=line`)

Written by the reviewer, 1 Nov, from processing-llm's tracker (measured
there since August) and the clock as it stands on main today.

## Where the clock is (review, 1 Nov)

- `clock.js`: metronome, `file:` grid with a monotone warp, hand fixes
  with beat authority (`tap`, nudge, ×2, ÷2, setOne, reset; Shift keys and
  controller origins), rebooking after a command, booking under long
  frames, visual offset. `line` falls back to the metronome.
- `audio-in.js`: per-lane onset envelopes (band flux vs running mean +
  1.5 σ) computed once per rAF frame; the kick/snare/hat the pages read
  under `?audio=line`. These are DRUM ENVELOPES, not a beat tracker:
  there is no tempo, no phase, no bar anywhere on the live path.
- QA: Beat This! (CPJKU 2024) reference grids for the four private tracks;
  audio jobs through Chromium's fake capture with an offline AnalyserNode
  mirror; level/band gates report-only. The beat-match row pins the
  visual half of sync on every page.

So: everything around the tracker exists and is tested; the tracker is
the hole. What follows is the port, with two improvements processing-llm
did not have, and the integration rules so the tracker and the hand
fixes don't fight.

## What processing-llm measured (so nobody re-learns it)

`web/app/src/core/audio.js` (652 lines) + `core/clock.js`:
- Onset strength = positive spectral flux over 340 bins, bass-weighted;
  adaptive onset threshold mean + 2 σ (~1 s), refractory 150 ms.
- Tempo: autocorrelation of ~4 s of onset strength over 60–180 BPM,
  log-normal prior centred 120 (σ 0.7 octave), half-lag override at 0.55,
  parabolic peak interpolation, period refined against onset event span
  over ~8 s, octave hysteresis around the current tempo (×2 / ÷2 ratios
  snap back), EMA 0.7/0.3, re-estimated at ~6 Hz.
- Phase: PLL. Acquisition (confidence < 0.4): snap to any onset, window
  0.5 beat, gain 1. Tracking: window 0.25, gain 0.15. Confidence = EMA of
  1 − 2|err|. Free-run at `lastConfidentBpm` when confidence drops; dt
  capped at 100 ms, gaps logged.
- Results: synthetic suite bpm ±2, phase error ≤ 0.031 beat at 60 and
  120 Hz cadence; real 4/4 matrix ±2 BPM; 174 BPM dnb bistable 167–172;
  81 BPM stomp-clap octave-doubles to ~161 (the prior takes the upper
  octave). Analysis on a fixed ~57 Hz AudioWorklet TICK (the worklet only
  posts ticks; the analyser was still read on the main thread).

## Design

### D1. Analysis in the worklet, not on the main thread (improvement 1)
16b showed 150 ms frames at 4K. A tracker whose analysis runs per rAF
frame loses onsets exactly when the picture is heaviest. The AudioWorklet
gets the raw input at 128-sample quanta regardless of the main thread:
- `clock-tracker-worklet.js` (loaded by `addModule`, or a Blob URL string
  inside `clock-tracker.js` so the QA servers keep serving one folder):
  mono down-mix, 1024-point FFT (the radix-2 in `qa/runner/audiocheck.mjs`
  is fine), hop 512 (11.6 ms at 44.1 kHz), the 8 bands with audio-in's
  EDGES, bass-weighted positive flux → one `{ t, flux, bands }` message
  per hop. `t` is the AudioContext time of the hop's end.
- Main thread: tempo + PLL on the posted stream. A burst of late messages
  after a blocked frame is processed in order with their own `t`, so
  nothing is lost, and the PLL integrates real dt, not frame dt.
- `audio-in`'s lanes under `line` read the worklet's bands instead of the
  per-frame analyser (one analysis, one detector — the AnalyserNode stays
  for `wave` and the audio-job log only).

### D2. The tracker is a SOURCE that steers; the clock still owns beats
Port processing-llm's estimator and PLL as `clock-tracker.js`, output
`{ bpm, phaseAt(t), confidence, lastConfidentBpm }`. `clock.js` applies
it exactly as it applies the file warp: `baseBeats(t)` comes from a
tracked anchor (beat k at time t_k) plus the current period. Corrections
go through one rule, by authority (#95):
- **acquiring** (confidence < 0.4): a correction may be a jump; logged as
  `jump { kind: 'acquire' }`.
- **tracking**: phase corrections are applied as a bounded RATE change
  (≤ 3 % tempo deviation until caught up — a 25 ms error closes within
  ~2 beats, never a step). Tempo changes slew likewise.
- **hand fixes win**: `tap` seeds bpm + phase and the tracker only nudges
  from there; `x2`/`half` set an OCTAVE LOCK the estimator may not undo
  until the raw estimate leaves the locked octave by > 20 % for > 4 s;
  `nudge` shifts the anchor and the PLL continues from the shifted phase;
  `setOne` relabels, the tracker never touches bar position.
- The drum lanes under `line` are the page's pattern laid on the tracked
  beats (as `file:` does), silent unless `settings.click` — so pages
  behave identically on every source, and the click is the ear check.

### D3. Bars (improvement 2, light)
`beatInBar` counts from acquisition unless `setOne` was pressed. One
suggestion only: a 4-beat template on the kick/snare lanes (snare energy
on 2 and 4) proposes the "1" with low authority, applied once at
acquisition and never afterwards. Everything else about downbeats is the
Shift+1 button.

### D4. What stays global
One tempo prior (120, σ 0.7), one onset threshold rule, one slew bound,
one acquisition threshold. No per-track numbers. Predicted and accepted:
Teardrop (~78 BPM) octave-doubles like Queen did; that is the ÷2 button's
demonstration, not a tuning job. If a second slow track at a real party
matters, widening the prior is a numbered finding with its own truth.

## Tasks

1. **Worklet analysis** (D1) + node test: a synthetic click stream through
   the worklet's math gives flux peaks within one hop of the clicks;
   bands match `audiocheck.mjs`'s offline mirror within 1 dB.
2. **Tracker port** (`clock-tracker.js`): estimator + PLL from
   processing-llm with its constants; node suite ported from
   `tools/beat-test.mjs` and extended, all synthetic, no audio files:
   128 BPM at 57 Hz and at bursty cadence (150 ms gaps); 127.3 BPM
   (non-integer lag); 174 dnb kick/snare alternation; 81 stomp-clap; a
   120 → 128 step; a 2 s dropout; ±10 ms humanize. Numbers per scenario:
   bpm error, phase error p50/p90 at true beats after lock, lock time,
   re-lock time after the step, octave errors (count and direction).
   Gates (synthetic, hard): bpm ±2 → ±1 after refine; phase p90 ≤ 0.03
   beat; re-lock ≤ 8 beats; dropout → confidence falls and recovers, no
   phase rewind (beats monotonic).
3. **Clock integration** (D2, D3): `line` source in `clock.js`; the
   authority table in code and in the header comment; `jump` kinds
   `acquire` / `track`; `lateStats` unchanged; metronome parity byte-for-
   byte (existing test) and `file:` untouched (existing tests).
   Tests: tap then tracker (tracker nudges, never re-seeds); ×2 then
   tracker (octave lock holds against a half-tempo estimate); nudge then
   tracker (phase continues from the shift); source switch
   metronome → line at bar 9 (beats monotonic, one logged jump).
4. **QA truth on the box** (audio jobs, `kind: "audio"`, `via: "fake"`):
   - (a) the metronome rendered to a wav (onsets known to the sample);
   - (b) the four tracks against their Beat This! references
     (`<track>.ref.beats`); reference tolerance noted: Beat This! itself
     is ~15 ms per beat, so gates on (b) are looser than on (a);
   - (c) a 120 → 128 step: an excerpt and the same excerpt resampled by
     1.067 (pitch moves too — irrelevant for tempo truth), concatenated.
   Per run (from `__qa.events` hits and `__qa.audioIn.log`): phase error
   p50/p90 at reference beats after lock; lock time; re-lock after the
   step; octave errors; event latency from the reference beat to the
   clock's hit (this is the "≤ 40 ms", measured against the waveform at
   last — Chromium's capture buffering is inside it, as the real line-in's
   will be); confidence during the step (must drop, then recover).
   Gates: (a) phase p90 ≤ 15 ms and latency p90 ≤ 40 ms, hard; (b) phase
   p90 ≤ 35 ms report-only for a week (their convention), then hard on the
   4/4 tracks; octave errors reported, never gated (hand fix exists).
5. **Ear check** (the user, on the laptop, BlackHole or line-in):
   `?clock=line&audio=line&click=1` on a real track from the mixer. Does
   the click sit on the kick? Tap once, nudge once, ÷2 once — do they
   feel immediate and does the tracker respect them afterwards? Note the
   track, BPM, verdict. `visualOffsetMs` is calibrated separately
   (`calibrate.html`, still to build); don't mix the two.

## Out of scope

Pro DJ Link (its own PR, it becomes another source under D2's table);
downbeat tracking beyond D3; structure/drops; per-track anything;
changing any page.

## Done when

Node suite green; `line` on main with the authority table; audio jobs
(a) hard-green, (b) numbers printed for all four tracks with the Teardrop
octave recorded as predicted, (c) re-lock printed; the user has heard the
click sit and the hand fixes hold against the tracker.
