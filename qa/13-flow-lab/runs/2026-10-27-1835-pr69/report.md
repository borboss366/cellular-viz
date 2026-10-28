# 13-flow-lab · #69 @3907937

13 Flow Lab brightness (#58): curl and plume at +0.6 EV with the display curve's white point capped at 0.97 (no clipping); plume source 1.5x, dissipation 0.35 -> 0.2. kh is the reference (the user's winner): curl and plume should be at least as bright, with < 2 % of pixels clipped.

15/15 gates pass · warm-up 6 s · 12 s per run · swipe run `qa/13-flow-lab/runs/2026-10-27-1835-pr69-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | lum.mean | lum.min | lum.max | errors | gpuBusy | value.exposure | value.tone |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kh@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 2.81 | 0.145 | 87.01 | 82.26 | 90.45 | 0 | 0 | 0 | 0 |
| kh@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 1.005 | 0.055 | 87.34 | 82.69 | 90.95 | 0 | 6 | 0 | 0 |
| curl@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 2.72 | 2.43 | 3.71 | 0 | 6 | 0.6 | 1 |
| curl@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 2.76 | 2.43 | 3.78 | 0 | 1 | 0.6 | 1 |
| plume@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 3.32 | 2.96 | 4.33 | 0 | 2 | 0.6 | 1 |
| plume@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 3.28 | 2.82 | 4.38 | 0 | 6 | 0.6 | 1 |

- ✅ clip ≤ 2 (curl, plume) · curl@1080p 0 · curl@4k 0 · plume@1080p 0 · plume@4k 0
- ✅ brightness, reported for kh vs curl vs plume (the min follows from kh) · kh@1080p 87.01 · kh@4k 87.34 · curl@1080p 2.72 · curl@4k 2.76 · plume@1080p 3.32 · plume@4k 3.28
- ✅ fps.p05 ≥ 55 · kh@1080p 59.88 · kh@4k 59.88 · curl@1080p 59.52 · curl@4k 59.52 · plume@1080p 59.52 · plume@4k 59.52
- ✅ longFrames ≤ 0.5 · kh@1080p 0 · kh@4k 0 · curl@1080p 0 · curl@4k 0 · plume@1080p 0 · plume@4k 0
- ✅ errors ≤ 0 · kh@1080p 0 · kh@4k 0 · curl@1080p 0 · curl@4k 0 · plume@1080p 0 · plume@4k 0
- ✅ gpuBusy ≤ 10 · kh@1080p 0 · kh@4k 6 · curl@1080p 6 · curl@4k 1 · plume@1080p 2 · plume@4k 6
- ✅ check-13: dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) · plume: -0.45 % in 21 s (-0.22 %/10 s, page log -0.30 %) · kh: -0.61 % in 21 s (-0.30 %/10 s, page log -0.64 %) · ink: -0.05 % in 21 s (-0.02 %/10 s, page log -0.24 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.03 % in 21 s (-0.02 %/10 s, page log -0.00 %)
- ✅ check-13: natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) · calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1994 (sim 0.1994), amp 150.44 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.246 Hz real (Fourier 1.245), St 0.1971 (sim 0.1971), amp 150.81
- ✅ check-13: art mode (lock on): swirl on the beat, BPM/120 ±5 % · 90 BPM: want 0.750, got 0.746 (Fourier 0.75), wake amp 154.24 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.49 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.48
- ✅ check-13: sync from __qa.events (≤ 40 ms) · kick 8.6 ms (n 60) · hat 8.6 ms (n 119) · snare 8.6 ms (n 30)
- ✅ check-13: 🎲 then morph finishes, no NaN · vortex → kh (25 % at 4 s) → kh
- ✅ check-13: page alive
- ✅ check-13: 1080p p95 ≤ 16.8 ms (hard)
- ✅ check-13: 1440p p95 ≤ 16.8 ms
- ✅ check-13: errors · none
