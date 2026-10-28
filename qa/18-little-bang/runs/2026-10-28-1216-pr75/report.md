# 18-little-bang · #75 @9311bdb

18 beamline scene (camera on the beam axis of a ring collider, halts 0.9 before the IP on each downbeat as the bunches cross) and the quench Mach cone (half-angle asin(c_s/v) = 35.3 deg). 120 BPM, 8 bars a section.

17/17 gates pass · warm-up 4 s · 16 s per run · swipe run `qa/18-little-bang/runs/2026-10-28-1216-pr75-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | lum.mean | lum.min | lum.max | errors | gpuBusy | value.camS | value.wakes | value.dijets |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beamline@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 8.13 | 0.09 | 51.41 | 0 | 0 | -0.774752 | 0 | 36 |
| beamline@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 7.12 | 0.07 | 40.37 | 0 | 1 | 0.190743 | 0 | 36 |
| quench@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 12.09 | 3.89 | 23.05 | 0 | 1 | null | 36 | 36 |
| quench@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 10.3 | 3.62 | 27.67 | 0 | 1 | null | 36 | 36 |
| collide@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 12.25 | 3.7 | 33.43 | 0 | 3 | null | 0 | 36 |
| collide@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 10.21 | 3.16 | 21.06 | 0 | 1 | null | 0 | 36 |

- ✅ fps.p05 ≥ 55 @1080p · beamline@1080p 59.88 · quench@1080p 59.88 · collide@1080p 59.88
- ✅ longFrames ≤ 0.5 · beamline@1080p 0 · beamline@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0
- ✅ errors ≤ 0 · beamline@1080p 0 · beamline@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0
- ✅ gpuBusy ≤ 10 · beamline@1080p 0 · beamline@4k 1 · quench@1080p 1 · quench@4k 1 · collide@1080p 3 · collide@4k 1
- ✅ clip ≤ 2 (collide, quench) · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0
- ✅ brightness, reported · beamline@1080p 8.13 · beamline@4k 7.12 · quench@1080p 12.09 · quench@4k 10.3 · collide@1080p 12.25 · collide@4k 10.21
- ✅ check-18: tracks curl with r = pT/(0.3 B), B = 0.5 T · 200 charged tracks, worst 1.3e-13% (3-point circle fit)
- ✅ check-18: with dE/dx: local radius = r0 − k·s · 200 tracks, worst 0.000%
- ✅ check-18: elliptic flow ⟨cos 2φ⟩ = v2 > 0 · v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471)
- ✅ check-18: fireball: short axis grows faster; hadronizes at T_c · in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156)
- ✅ check-18: strings: quarks = 2 + 2·breaks, white groups, energy kept · 42 cascades, 200 breaks, worst drift 0
- ✅ check-18: jets: A_J = q/(2 − q) · q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000
- ✅ check-18: sync from __qa.events (≤ 40 ms after the sound) · collision 8 ms (n 15) · jet 8 ms (n 29) · crossing 7.4 ms (n 7)
- ✅ check-18: page keeps animating
- ✅ check-18: collide: < 2 % of pixels clipped in every frame of 16 s (#58) · worst frame 0.00 % clipped (any channel ≥ 254) of 137 frames · brightest frame (mean lum 24.2 %): clipped 0.00 %, white 0.00 % · 1920×1080
- ✅ check-18: 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms
- ✅ check-18: errors · none
