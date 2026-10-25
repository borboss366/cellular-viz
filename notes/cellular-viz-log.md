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
- 2026-10-22 · User reviewed 02 (entry below): still fills the background; "reviewing the other pages would make more sense". User: "Lets work with the metronome lenia for a while, as i see it has potential. Also i did not know i can draw on it."
- 2026-10-22 · Step 1 done: 02 Auto mode (PR #7): σ lowered when crowded, back up when sparse, 2 Orbiums dropped after 3 s still; info line `auto σ … · mass … · moving …`.
- 2026-10-22 · 04 draw hint "Draw with a finger · two fingers erase" (PR #8). User: "Lets add auto mode" to 04.
- 2026-10-22 · 04 Auto mode + controls panel fix on all pages (PR #9); Auto measures cover and cuts holes on the downbeat when crowded (PR #10); reseeds with a noisy blob too (PR #11); page scrolls as a whole for in-app viewers (PR #12); cover band sliders (refill below 10%, thin above 40%) + short info box (PR #13).
- 2026-10-22 · User screenshot: 04 on raw.githack preview filled with worms (old copy without Auto). Shot: shots/2026-10-22-04-githack-preview-worms.jpg
- 2026-10-22 · User screenshot: 04 live page stuck on "loading…". Cause: variable declared twice; fixed in PR #14. Shot: shots/2026-10-22-04-stuck-loading.jpg
- 2026-10-22 · User: 04 custom (from four) "All filled up" (entry below). Cause: cover counted lit cells, so a ring field read 21%; fixed in PR #15 (cover = share of 16×16 patches with anything lit; < 2.5% moving counts as still).
- 2026-10-22 · User on 04 after PR #15: "It creates quite cool effect when it clears out. But it takes a lot of time for orbitals to produce new filling again and screen feels empty." → PR #16: refill speed slider 1–5 (default 3 = 3 Orbiums + 2 blobs every 1.3 s), batches land on the kick, σ snaps back when refilling, thinning stops 10 points below "thin above".
- 2026-10-22 · User on 04: "this one looks more or less nice, lots of fine tuning though". Moved on to Flow Lenia.
- 2026-10-22 · Step 2 done: 05 Flow Lenia (PR #17). Mass-conserving; presets calm / blobs / cells / fizz; 🎲 Randomize (μ, σ); drag stirs, Touch toggles paint, Erase; View: mass or flow direction; info shows total mass. Not yet reviewed by user.
- 2026-10-23 · Researcher effects list for Lenia: bloom (kick-pumped), emboss + sheen, cosine palettes on pad, MilkDrop-style trails, kick bulge.
- 2026-10-23 · New bot visualisation QA joined. QA harness qa/harness.html + qa/04, qa/05, qa/06 index folders (PR #18): records 12 s .webm per variant, measures coverage / motion / beat / colour / fps, scores 0–10.
- 2026-10-23 · 06 Lenia + effects (PR #19, bf80aa0): copy of 04 with bloom, emboss, sheen, palette, trail zoom, trail length, kick bulge sliders; bloom-on-kick and palette-drift toggles; looks clean / glow (default) / chrome / dream / pulse; Copy setup has an `fx …` line. 04 unchanged.
- 2026-10-23 · User installed Termux so QA can run headless sweeps.
- 2026-10-24 · User: visualisers needn't be cellular automata; the main target is a powerful laptop at DJ sets, the phone is a bonus. Millennium-problem track (#37), 09 Riemann first: phase portrait of ζ(s) (Borwein η + functional equation in logs, per pixel), travel/overview camera, metronome-driven, fullscreen (branch exp-09-riemann).
- 2026-10-24 · QA box check (hue winding on a 1080p screenshot): zeros 14.13/21.02/25.01, trivial zeros and pole correct, 60 fps; left half black above height ~29. Cause: sin(πs/2) overflowed float32 inside the functional equation. Fixed by computing log sin directly (and a scaled complex log).
- 2026-10-25 · User graded 09 (run 2026-10-24-1958): travel beats overview, kept as default. The left-half-black fix (e08422d) was never re-checked on its own; branch riemann-height-60 lets ?height go to 60 (held with speed=0 or paused) so QA box can sweep Im s 0–60 for black regions.
- 2026-10-24 · User on 09: correct but dull; maths pages should be art first, still true. VIZ research's v2 spec (#37). Built as a new page, 11 Riemann show (branch exp-11-riemann-show, 09 kept as the calm baseline): ribbon chase-cam, zero march, Z(t) scope over the beat's waveform, primes from the explicit formula (one zero per beat, staircase at the drop), canyon over log|ζ|, plus 09's map; zeros land on downbeats; scenes switch every 8 bars with a fade.
- 2026-10-25 · QA box vs LMFDB: 11's maths all correct (38/38 zeros, ribbon and scope cross at them, primes within 0.44), 60 fps, but auto and primes froze on frame 1: the first rAF timestamp is older than clockStart, so bars < 0 (scene index −1, prime count −1). Fixed: bars clamped at 0, and the loop books the next frame first and survives a throwing frame.
- 2026-10-25 · User's 11 picks: ribbon (3–0) > scope > canyon > march > map > primes (0–3); "canyon needs to be more alive, like pulses on the surface". Canyon now sends rings out of every zero pit on each beat (bigger on the downbeat), glowing in the surface's phase colour and bending the light, with the valley breathing on the kick, snare bands and hat twinkle (branch riemann-canyon-pulses). The terrain itself stays log|ζ|.
- 2026-10-25 · User: "pulsating bumps on the surface" (spec on #37). The rings now lift the ground (0.32·ring, swelling on the kick, hat goosebumps), faded to zero within 1.2 units of each zero so the pits stay exact (branch riemann-canyon-bumps).
- 2026-10-25 · QA box on #42: all checks pass, but calibrated beat sync showed light ~65 ms and bumps ~95 ms late (target ≤ 40) and GPU headroom halved (146 → 69 fps). Cause of the lag: rings were born at the pit and hidden by the damping for ~0.2 beat. Now born at radius 1.2, and the march skips the ring sum when the ray is far above the ground.
- 2026-10-25 · QA box on #42 @e43e0df: canyon headroom about halved (p99 33.5 ms uncapped), since near the ground every march step still paid 8 zeros × 3 exp. Now the ring lift is baked once a frame into a 512×1024 world-space texture (x −20…20, z tc−8…tc+64) and the march reads it; the refine (8 bisections from the last step above), the normal and the glow keep the exact ring sum. Target ≥ 100 fps uncapped.
- 2026-10-25 · QA box, canyon uncapped at 1080p on the Radeon 780M, all builds back to back in one session: main f0979e9 338 fps (p99 6 ms), 4106047 93 fps (p99 29 ms), 74c71ca 155 fps (p99 13.6 ms); 60 fps with vsync and no frame over 20 ms on all three. The earlier "main 141" overlapped another GPU job and is void. The look matches 4106047 (≤ 0.16% of pixels differ). User merged #42 (7b220eb).
- 2026-10-25 · QA box correction: 11's beat clock is already the heard clock (currentTime − outputLatency), so subtracting the latency again double-counted. Real: canyon kick flare ~65 ms after the sound (fails ≤ 40), ribbon zero flashes ~5–15 ms after (passes; #47 closed). The canyon now reads the drums 40 ms ahead from the metronome's look-ahead (?canyonLead=ms to tune), and the page logs every drum hit and zero flash as window.__qa.events {type, tBeat, tHeard, perfHeard, perfDrawn, lead} so moving-camera scenes are timed from flashes (branch riemann-canyon-lead).
- 2026-10-25 · Roadmap phase 1 (user: a big set of MVPs first). Built 13 Flow Lab (branch exp-13-flow-lab, spec #37 comment 6391682810): GPU stable fluids (forces → semi-Lagrangian advection → vorticity confinement → Jacobi viscosity → Jacobi pressure projection; solid discs) plus curl-noise engine. Recipes vortex (inflow U = f·d/0.2 with f = BPM/120, so a vortex per beat), kh, plume (buoyancy, kick heat), ink, rocks, curl. Presets are JSON; 🎲 randomise in safe ranges, save (localStorage), morph over N bars (params and palette blend, forces by weight, rocks shrink/grow). __qa: divergenceRMS, dyeMass + massLog (sourcesOff), probe, wake log (?probe=1), sheddingHz, strouhal. 3-D smoke volume not built yet.
- 2026-10-25 · QA box on 13 @5e83b58: 60 fps to 4K, sync 8 ms, morph fine; fails: projection removed only ~45 % of the divergence (2-cell central div and gradient vs the 5-point Jacobi Laplacian), dye −30 %/10 s raw, shedding 18 % slow (St ≈ 0.165, Re ≈ 100). Fix: staggered MAC velocity, forward-difference divergence + backward-difference gradient (div∘grad = the 5-point Laplacian), faces next to solids and walls shut, MAC-aware advection; 32-bit float fields; inflow from Roshko's St(Re) with an effective ν of 85 cells²/s fitted to QA box's three tempos, plus a small wake forcing at f (lock-in; ?lock=0 for natural shedding); 40 pressure iterations.
- 2026-10-25 · QA box on 13 @70fc2c4 (raw, conserve=0&lock=0): divergence left 10–42 % (Jacobi-limited), dye −17–25 %/10 s leaking out of the top/right walls (unstored MAC faces clamped), St 0.197/0.175/0.161 across 90/120/150 BPM. VIZ QA's revised bar: divergence ≤ 5 %, dye ≤ 5 %/10 s, St constant ±10 %, art lock ±5 %. Fix: velAt falls to 0 past a closed right/top wall; red-black SOR (ω 1.85, 40 red+black sweeps); the vortex street now runs one fixed flow (Uref 219 cells per sim-second, fixed 1/120 s steps) on a sim clock at (BPM/120)/fNat, so St is the same at every tempo by Strouhal similarity; fNat 1.07 from QA box's 120 BPM run, __qa.calibrate() re-measures it; lock forcing 15 % of U.
- 2026-10-23 · User ranked the 06 run by swipes (dream > glow > trails > pulse …). In all of them a full screen collapsed to blank and stayed empty. Cause: Auto's σ only recovered below 10% cover, cuts were big and kept going on a 2 s-lagged cover. Fix on 04 and 06 (branch auto-no-blank): σ floor 75%, σ recovers whenever not crowded, smaller cuts that stop once really thinned, refill judged on current cover, at once and 2–3× bigger when sparse, plus a "catching" drop when cover falls fast.
- 2026-10-23 · QA box 90 s test: main boom-bust (<10% cover 44–46% of the time, empty up to 7.8 s); first fix overcorrected (~99.8% full; σ floor 0.6–0.75 never thins). Second try on the same branch: σ creeps down slowly while crowded (floor back to 50%), jumps up as soon as cover falls fast, holds in the band; tuning via URL (aStep, aFloor, aKick, aFall, aCut) so QA box can sweep it.

## Open
- Step 3 Particle Lenia: queued.
- 05 Flow Lenia: waiting on user's first run (fps, mass constant?).
- 06 effects: waiting on QA sweep / user review.
- Verdicts (keep / maybe / dull) not given yet for the two entries below.
- Fps on phone: 02 60, 04 59–60. 01, 03, 05, 06 not reported.

## Entries by CA type
_Screenshot entries go here: date · experiment · CA type · exact params · verdict (keep / maybe / dull) · your words._

### Reaction-diffusion (Gray-Scott)
_none yet_

### Lenia

**2026-10-22 · 02 Lenia · custom (from orbium)**
- Params: R 13 · T 24 · μ 0.159 · σ 0.0255 · steps 1 · brush 10 · trail 0.36 · 256² f32 · 60 fps · 8 s since reset
- Link: https://borboss366.github.io/cellular-viz/experiments/02-lenia.html?preset=orbium&R=13&T=24&mu=0.159&sigma=0.0255&steps=1&brush=10&trail=0.36
- Verdict: not given
- Your words: "As i already mentioned there is situation that the cellular automata fills all the background. Looks nice though, i think reviewing the other pages would make more sense"
- Note: taken before 02 Auto mode (PR #7).

**2026-10-22 · 04 Lenia metronome · custom (from four)**
- Params: 120 bpm · 6/4 · swing 0.00 · humanize 8 ms · pad 1 bar · kick `x...x...x...x...` · snare `....x.......x...` · hat `x.x.x.x.x.x.x.x.` · maps kick→μ, kick→blob, pad→hue, pad→σ · R 13 · T 10 · μ 0.150 · σ 0.0280 · 256² f32 · 59 fps · 81 s since reset
- Auto line: auto σ 0.0280 · cover 21% · mass 20.5% · moving 0.8% · steady · band 10–40% · 0 cuts · 21 reseeds
- Link: https://borboss366.github.io/cellular-viz/experiments/04-lenia-metronome.html?preset=four&bpm=120&bpb=6&swing=0&human=8&T=10&mu=0.15&sigma=0.028&fill=10&thin=40&kick=x...x...x...x...&snare=....x.......x...&hat=x.x.x.x.x.x.x.x.&padBars=1&mKickMu=1&mKickBlob=1&mSnareFlash=0&mHatShimmer=0&mPadHue=1&mPadSigma=1&muted=0&auto=1
- Verdict: not given
- Your words: "All filled up"; after PR #15: "It creates quite cool effect when it clears out. But it takes a lot of time for orbitals to produce new filling again and screen feels empty"; after PR #16: "looks more or less nice, lots of fine tuning though"
- Shot: ![04 rings](shots/2026-10-22-04-custom-four-rings.jpg)
