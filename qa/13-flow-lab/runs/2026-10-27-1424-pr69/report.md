# 13-flow-lab · #69 @3ddb5cb

13 Flow Lab brightness (#58): curl and plume at +0.6 EV with the display curve's white point capped at 0.97 (no clipping); plume source 1.5x, dissipation 0.35 -> 0.2. kh is the reference (the user's winner): curl and plume should be at least as bright, with < 2 % of pixels clipped.

13/14 gates pass · warm-up 6 s · 12 s per run · swipe run `qa/13-flow-lab/runs/2026-10-27-1424-pr69-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | errors | gpuBusy | value.exposure | value.tone |
|---|---|---|---|---|---|---|---|---|---|---|---|
| kh@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 3.173 | 0.112 | 0 | 0 | 0 | 0 |
| kh@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 2.053 | 0.072 | 0 | 10 | 0 | 0 |
| curl@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 0 | 10 | 0.6 | 1 |
| curl@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 0 | 7 | 0.6 | 1 |
| plume@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 0 | 8 | 0.6 | 1 |
| plume@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 0 | 11 | 0.6 | 1 |

- ✅ clip ≤ 2 (curl, plume) · curl@1080p 0 · curl@4k 0 · plume@1080p 0 · plume@4k 0
- ✅ fps.p05 ≥ 55 · kh@1080p 59.88 · kh@4k 59.52 · curl@1080p 59.88 · curl@4k 59.88 · plume@1080p 59.52 · plume@4k 59.52
- ✅ longFrames ≤ 0.5 · kh@1080p 0 · kh@4k 0 · curl@1080p 0 · curl@4k 0 · plume@1080p 0 · plume@4k 0
- ✅ errors ≤ 0 · kh@1080p 0 · kh@4k 0 · curl@1080p 0 · curl@4k 0 · plume@1080p 0 · plume@4k 0
- ❌ gpuBusy ≤ 10 · fails on plume@4k · kh@1080p 0 · kh@4k 10 · curl@1080p 10 · curl@4k 7 · plume@1080p 8 · plume@4k 11
- ✅ check-13: dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) · plume: -0.47 % in 21 s (-0.23 %/10 s, page log -0.43 %) · kh: -0.66 % in 21 s (-0.32 %/10 s, page log -0.70 %) · ink: -0.06 % in 21 s (-0.03 %/10 s, page log -0.27 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.61 %) · plume+conserve: 0.00 % in 21 s (0.00 %/10 s, page log -0.03 %)
- ✅ check-13: natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) · calibrate(): fNat 1.2081 → 1.2054 · 90 BPM: 0.757 Hz real (Fourier 0.755), St 0.1995 (sim 0.1995), amp 150.52 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1979 (sim 0.1979), amp 151.22
- ✅ check-13: art mode (lock on): swirl on the beat, BPM/120 ±5 % · 90 BPM: want 0.750, got 0.749 (Fourier 0.75), wake amp 155.33 · 120 BPM: want 1.000, got 1.002 (Fourier 1), wake amp 156.74 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.86
- ✅ check-13: sync from __qa.events (≤ 40 ms) · kick 9.5 ms (n 60) · hat 9.1 ms (n 119) · snare 9.3 ms (n 30)
- ✅ check-13: 🎲 then morph finishes, no NaN · vortex → kh (25 % at 4 s) → kh
- ✅ check-13: page alive
- ✅ check-13: 1080p p95 ≤ 16.8 ms (hard)
- ✅ check-13: 1440p p95 ≤ 16.8 ms
- ✅ check-13: errors · none
