# Cellular-viz lab notes

Repo: github.com/borboss366/cellular-viz · Live: https://borboss366.github.io/cellular-viz/
Rule (user, 2026-10-21): never delete experiments; Lab Notes logs everything done.

## Best presets (only ones marked keep)
_None yet. No screenshot verdicts posted._

## Project log
- 2026-10-21 · Project started: single-file WebGL experiments for phone. Researcher asked for top-5 CA variants; Dev to start 01 Gray-Scott; Lab Notes to keep this log.
- 2026-10-21 · 01 Gray-Scott built and merged (PR #1, 293502e). 512×512 wrap grid, 10 steps/frame, presets coral / mitosis / worms / fingerprint, finger drawing, f/k/steps/brush/shading sliders, params + fps overlay. Live at experiments/01-gray-scott.html.
- 2026-10-21 · Researcher list: 4 picks (Gray-Scott excluded as built). Pick for 02 = Lenia Orbium (R13 T10 μ0.15 σ0.015), ref github.com/AtsuyaTsuchida/lenia-webgl, start 256². Fallback: cyclic CA. Beat sync plan: AnalyserNode bass flux → pulse uniform.
- 2026-10-21 · User: "Lets go with the dev suggestion" → 02 = Lenia Orbium; beat sync to be its own 03 (not built yet).
- 2026-10-21 · 02 Lenia built (PR #2, merged 881959b). 256² grid, 1 step/frame, presets orbium (5 gliders) / swarm (16) / soup / bloom, R/T/μ/σ sliders, paint/erase, fading trail, params + fps overlay. Live at experiments/02-lenia.html.
- 2026-10-21 · User on 02: "Looks good. But it occupies the screen very fast and then it is static." Researcher: plain Lenia has no mass conservation; soup (σ 0.016) and bloom (σ 0.020) fill the grid then freeze.
- 2026-10-21 · User decision: try all three perpetual routes in order — (1) patch 02 with stagnation reseed + σ governor, (2) Flow Lenia, (3) Particle Lenia. "Lets do it."
- 2026-10-21 · Researcher: Flow Lenia defaults θ_A=1, n=2, dt 0.2, s 0.65, search radius 5; reference uses 10 kernels up to radius 25 (too heavy for phone) → start with 1–3 kernels, R ≤ 13.
- 2026-10-21 · User asked for one-tap copy of the setup. Dev added a **Copy setup** button to 01 and 02 (PR #3, merged 6bd91c2): copies experiment · preset, all params, grid, fps, time since reset, and a link that reopens the settings (fresh random seed, so not the same picture).
- 2026-10-21 · User asked to keep this log on GitHub too → notes/cellular-viz-log.md in borboss366/cellular-viz (Pages: notes/cellular-viz-log.html). Lab Notes pushes updates.
- 2026-10-21 · 03 audio-reactive Lenia merged (PR #4 was empty by mistake; files came in PR #5, 9459ea1). Orbium defaults R13 T10 μ0.15 σ0.015, polynomial growth; audio from Mic or File; bass beat pulse → flash/glow, μ nudge, blob inject (toggles); BPM via realtime-bpm-analyzer; `?size=512` option. Live at experiments/03-lenia-audio.html.
- 2026-10-21 · 04 Lenia on a metronome merged (PR #6, 4196e98). Built-in Web Audio clock: BPM 60–180 (120), beats/bar 2–7, swing, humanize, grooves four/break/half/waltz; kick → μ / blob, snare → flash, hat → shimmer, pad → hue drift / σ ±0.001. Live at experiments/04-lenia-metronome.html.
- 2026-10-21 20:38 · User asked for links to review. None of 01–04 browser-tested by Dev yet.

## Open
- Step 1 (02 stall reseed + σ governor): not on main yet (checked 20:38).
- Step 2 Flow Lenia, step 3 Particle Lenia: queued.
- Fps on phone for 01–04: not reported yet.

## Entries by CA type
_Screenshot entries go here: date · experiment · CA type · exact params · verdict (keep / maybe / dull) · your words._

### Reaction-diffusion (Gray-Scott)
_none yet_

### Lenia
_none yet_
