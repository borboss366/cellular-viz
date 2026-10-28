# 13-flow-lab · #72 @7877b19

13 rocks (#58): obstacles with real shapes (rounded 3/5/7-gons, noise blobs), inflow 1.4x, vorticity 8, vermilion/cyan dye swapping every bar. vortex runs too, to show the disc obstacles and the Strouhal lock are unchanged.

15/15 gates pass · warm-up 6 s · 12 s per run · swipe run `qa/13-flow-lab/runs/2026-10-28-1034-pr72-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | lum.mean | lum.min | lum.max | errors | gpuBusy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| rocks@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0.121 | 0.001 | 8.5 | 7.6 | 10.76 | 0 | 0 |
| rocks@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0.005 | 0 | 8.45 | 7.56 | 10.43 | 0 | 5 |
| vortex@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0.003 | 0 | 0.57 | 0.4 | 1.27 | 0 | 6 |
| vortex@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0.003 | 0 | 0.53 | 0.4 | 1.27 | 0 | 5 |

- ✅ fps.p05 ≥ 55 · rocks@1080p 59.88 · rocks@4k 59.52 · vortex@1080p 59.52 · vortex@4k 59.88
- ✅ longFrames ≤ 0.5 · rocks@1080p 0 · rocks@4k 0 · vortex@1080p 0 · vortex@4k 0
- ✅ errors ≤ 0 · rocks@1080p 0 · rocks@4k 0 · vortex@1080p 0 · vortex@4k 0
- ✅ gpuBusy ≤ 10 · rocks@1080p 0 · rocks@4k 5 · vortex@1080p 6 · vortex@4k 5
- ✅ clip ≤ 2 (rocks) · rocks@1080p 0.121 · rocks@4k 0.005
- ✅ brightness, reported (rocks vs base in the swipe) · rocks@1080p 8.5 · rocks@4k 8.45 · vortex@1080p 0.57 · vortex@4k 0.53
- ✅ check-13: dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) · plume: -0.43 % in 21 s (-0.21 %/10 s, page log -0.44 %) · kh: -0.64 % in 21 s (-0.31 %/10 s, page log -0.66 %) · ink: -0.08 % in 21 s (-0.04 %/10 s, page log -0.18 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.00 % in 21 s (-0.00 %/10 s, page log -0.00 %)
- ✅ check-13: natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) · calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.757 Hz real (Fourier 0.755), St 0.1995 (sim 0.1995), amp 150.5 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.05 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1978 (sim 0.1979), amp 151.22
- ✅ check-13: art mode (lock on): swirl on the beat, BPM/120 ±5 % · 90 BPM: want 0.750, got 0.745 (Fourier 0.745), wake amp 153.23 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.62 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.4
- ✅ check-13: sync from __qa.events (≤ 40 ms) · kick 8.7 ms (n 60) · hat 8.8 ms (n 119) · snare 8.9 ms (n 30)
- ✅ check-13: 🎲 then morph finishes, no NaN · vortex → kh (25 % at 4 s) → kh
- ✅ check-13: page alive
- ✅ check-13: 1080p p95 ≤ 16.8 ms (hard)
- ✅ check-13: 1440p p95 ≤ 16.8 ms
- ✅ check-13: errors · none
