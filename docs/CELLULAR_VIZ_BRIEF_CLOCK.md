# cellular-viz — brief: the clock (the music, not the metronome)

Written by the reviewer for the user to discuss with VIZ dev and QA box.

## Finding

Every page runs its own synthesized metronome (`// metronome (as 11/19)`,
copied page to page) and all beat work — kick pulses, swirl-on-the-beat,
the "≤ 40 ms after the sound" gate — is measured against clicks the page
scheduled itself. Only 03 touches `getUserMedia`. At the party there is no
metronome: there is a mixer feed of unknown music. Step 1's done
criterion says "real mixer audio"; nothing in the repo listens to it.

## Decision

One shared clock module, three sources behind one interface. The
metronome becomes what it should have been: the test double. Pages keep
their `read()` contract, so every existing check keeps running unchanged.
The live tracker is ported from processing-llm, where it already exists
and is measured (not rewritten).

## Task 1 — `experiments/clock.js` (next to `panic.js`, same reason)

One object replaces each page's `metronome`:

```
Clock.create({ source, bpm, bpb, pattern })   // source: 'metronome' | 'file:<url>' | 'line'
  .start() .stop() .setMuted(m) .latency() .playing
  .read() → { beats, phase, bar, bpm, confidence,     // beats: continuous count as today
              kick, snare, hat,                        // 0..1 decaying envelopes as today
              level, bands: {sub, kick, low, lowMid, mid, upperMid, presence, air} }
  .events → [{ lane, time, vel }]                      // consumed as today's hits
```

- `metronome`: today's code, verbatim, moved. Default for every existing
  page via `?clock=metronome`, so nothing changes until a page opts in.
- `file:<url>`: plays the file through the page's AudioContext. If a
  `<file>.beatgrid.json` sidecar is served next to it, `beats/phase/bpm`
  come from the grid (exact, non-causal, for rehearsal); the lanes come
  from the band onset detector below. Without a sidecar, the live tracker
  runs on the decoded stream.
- `line`: `getUserMedia` (mixer on the laptop's line-in), live tracker.
- Lanes under `file`/`line`: kick / snare / hat are band-onset envelopes
  (sub+kick bands → kick, mid band flux → snare, air band flux → hat),
  same decay shape as today's TAU so the pages' mappings read the same.
- `confidence` is honest: when the tracker is unsure (< 0.4) the clock
  free-runs at the last confident bpm and never stops, never jumps. Pages
  that want to may dim beat-driven effects by confidence; none is forced to.

Pages migrate by one line: `const metronome = Clock.create({ source: qs.clock ?? 'metronome', ... })`.

## Task 2 — The live tracker (port, do not rewrite)

Source: `github.com/borboss366/processing-llm`, `web/app/src/core/audio.js`
(652 lines) and `core/clock.js` (`createPLLClock`). Take: the fixed-rate
AudioWorklet analysis cadence (~57 Hz, independent of display rate and
tab visibility), the 8 log-spaced bands, the onset envelope, the PLL with
phase nudge (`phaseNudgeGain 0.15`, window 0.25), tempo prior log-normal
around 125 BPM, `beatPhase/barPhase/bpm/beatConfidence`. Leave: anything
director- or module-registry-specific.

Known weaknesses, measured there, so nobody rediscovers them: at 174 BPM
(dnb) the PLL is bistable between 167–172 on the fixed-rate tier; an 81
BPM stomp-clap confidently octave-doubles to ~161 (the prior takes the
upper octave). Both are prior physics. They are documented limits, not
this brief's problem — but the QA truth check below must report octave
errors as their own number so they stay visible.

One global tempo prior, no per-track constants. If a track needs a
constant, that is a finding.

## Task 3 — Rehearsal grids (port `tools/gridder.mjs`)

Offline, non-causal beat tracking for files: onset envelope, global tempo
by autocorrelation, DP beat tracking with backtrack, writes
`<file>.beatgrid.json` `{ bpm, firstBeatMs, downbeatEvery, beats:[ms…],
confidence }`. `--tap --bpm N --first MS` for stubborn tracks. This is how
the 60-minute rehearsal set gets an exact clock and how the live tracker
gets its ground truth.

## Task 4 — QA truth: sync against the sound, not against the schedule

The ≤ 40 ms gate is re-based: from the onset in the WAVEFORM to the
page's event, not from the scheduled click. QA box's `check-clock`:

1. **Ground truth without a sound card.** Chromium headless accepts
   `--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`:
   `getUserMedia` returns the wav. So `?clock=line` is testable on the box
   with any file whose onsets are known.
2. **Three truths**, each a wav + an onset list:
   (a) the metronome itself rendered to a wav (known onsets to the
   sample, real audio path, no music); (b) three real tracks with
   gridder sidecars, one of them with the user's tap verification;
   (c) one "mixer" file: two tracks crossfaded with a tempo change
   (120 → 128) in the middle.
3. **Numbers per truth**: beat-phase error median / p90 (ms) after lock;
   time to lock from cold start (s); time to re-lock after the tempo
   step; octave errors (count, which way); false onsets per minute per
   lane; event latency from waveform onset (ms, median / p90) — this is
   the ≤ 40 ms gate now; confidence during the crossfade (it must drop,
   then recover; a clock that is confident while wrong fails).
4. **Metronome parity**: every existing page check passes with
   `?clock=metronome` and the moved code, byte-for-byte same events.
5. Gates (global, same for every truth): phase p90 ≤ 25 ms on (a) and
   (b); event latency p90 ≤ 40 ms; re-lock ≤ 8 beats after the step;
   zero octave errors on (a); octave errors on (b)/(c) reported, not
   gated, until a second brief owns the prior.

## Task 5 — Pages

In order: 13 Flow Lab, 11 Riemann show, 19 Skate Park (the three with
the shared copy), then the set list as the user names it. Each page PR:
`?clock=metronome` run = today's check unchanged; `?clock=file:` run on
truth (b) with its sidecar = the page's own sync gate against the grid.
A page is not "on the clock" until both rows are green.

## The user's gate (ears, on the laptop, with the mixer)

`?clock=line&click=1` plays a click on each detected beat into the
laptop's output. Stand at the mixer with a real track: does the click sit
on the kick? Processing-llm's A1 gate; it took one evening and caught
the drift that no measurement had. Record: track, BPM, on/late/early by
ear, and whether the swirl in 13 lands with the kick.

## Out of scope

Downbeat/bar structure beyond counting `bpb`; drop/structure detection
(processing-llm has a precomputed-drop mechanism for files — later);
the controller; blending; changing any page's mappings or look. If
porting reveals that a page's effect only reads well on perfectly
regular clicks (metronome-tuned decay times), that is a finding per
page, filed, not fixed here.

## Done when

The three migrated pages pass their own checks on `metronome` and on
`file:` truth (b); `check-clock` reports all numbers for (a), (b), (c)
with the gates above green; the user has heard the click sit on a real
track from the mixer; the roadmap's step 1 gains the line "every scene
on the shared clock" between controller and blending.
