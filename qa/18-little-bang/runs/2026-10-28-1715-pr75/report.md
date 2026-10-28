# 18-little-bang · #75 @3da9d48

18 beamline neon wires + bigger quench cone; beamline scene (camera on the beam axis of a ring collider, halts 0.9 before the IP on each downbeat as the bunches cross) and the quench Mach cone (half-angle asin(c_s/v) = 35.3 deg). 120 BPM, 8 bars a section.

20/21 gates pass · warm-up 4 s · 16 s per run · swipe run `qa/18-little-bang/runs/2026-10-28-1715-pr75-swipe`

| run | fps | fps.p05 | frameMs.p95 | frameMs.max | longFrames | clip | clip.mean | lum.mean | lum.min | lum.max | errors | gpuBusy | value.camS | value.wakes | value.dijets | value.wireClearance |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beamline@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 8.56 | 0.28 | 47.02 | 0 | 0 | 0.190743 | 0 | 36 | 0.995751 |
| beamline@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 7 | 0.24 | 39.53 | 0 | 1 | -0.886085 | 0 | 36 | 0.992751 |
| beamline-wires@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 0.49 | 0.2 | 0.83 | 0 | 1 | -0.892338 | 0 | 0 | 0.991947 |
| beamline-wires@4k | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 0.39 | 0.16 | 0.68 | 0 | 0 | -0.698083 | 0 | 0 | 0.994229 |
| quench@1080p | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 12.27 | 3.5 | 33.17 | 0 | 0 | null | 36 | 36 | null |
| quench@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 10.42 | 3.62 | 26.5 | 0 | 1 | null | 36 | 36 | null |
| collide@1080p | 60 | 59.52 | 16.8 | 16.8 | 0 | 0 | 0 | 12.11 | 3.66 | 21.7 | 0 | 3 | null | 0 | 36 | null |
| collide@4k | 60 | 59.88 | 16.7 | 16.8 | 0 | 0 | 0 | 10.2 | 3.15 | 20.97 | 0 | 1 | null | 0 | 36 | null |

- ✅ fps.p05 ≥ 55 @1080p · beamline@1080p 59.52 · beamline-wires@1080p 59.52 · quench@1080p 59.88 · collide@1080p 59.52
- ✅ longFrames ≤ 0.5 · beamline@1080p 0 · beamline@4k 0 · beamline-wires@1080p 0 · beamline-wires@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0
- ✅ errors ≤ 0 · beamline@1080p 0 · beamline@4k 0 · beamline-wires@1080p 0 · beamline-wires@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0
- ✅ gpuBusy ≤ 10 · beamline@1080p 0 · beamline@4k 1 · beamline-wires@1080p 1 · beamline-wires@4k 0 · quench@1080p 0 · quench@4k 1 · collide@1080p 3 · collide@4k 1
- ✅ clip ≤ 2 (collide, quench, beamline) · beamline@1080p 0 · beamline@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0
- ✅ brightness, reported · beamline@1080p 8.56 · beamline@4k 7 · beamline-wires@1080p 0.49 · beamline-wires@4k 0.39 · quench@1080p 12.27 · quench@4k 10.42 · collide@1080p 12.11 · collide@4k 10.2
- ✅ check-18: tracks curl with r = pT/(0.3 B), B = 0.5 T · 200 charged tracks, worst 1.3e-13% (3-point circle fit)
- ✅ check-18: with dE/dx: local radius = r0 − k·s · 200 tracks, worst 0.000%
- ✅ check-18: elliptic flow ⟨cos 2φ⟩ = v2 > 0 · v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471)
- ✅ check-18: fireball: short axis grows faster; hadronizes at T_c · in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156)
- ✅ check-18: strings: quarks = 2 + 2·breaks, white groups, energy kept · 42 cascades, 184 breaks, worst drift 0
- ✅ check-18: jets: A_J = q/(2 − q) · q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000
- ✅ check-18: sync from __qa.events (≤ 40 ms after the sound) · collision 7.7 ms (n 15) · jet 7.9 ms (n 29) · pulse 7.9 ms (n 28) · crossing 7.3 ms (n 7) · pulse-arrive 7.3 ms (n 7)
- ✅ check-18: page keeps animating
- ✅ check-18: collide: < 2 % of pixels clipped in every frame of 16 s (#58) · worst frame 0.00 % clipped (any channel ≥ 254) of 137 frames · brightest frame (mean lum 24.2 %): clipped 0.00 %, white 0.00 % · 1920×1080
- ✅ check-18: beamline: camera on the beam axis (< 0.35 off, every frame) · worst 7.11e-15 over 961 frames · my circle fit to the camera path: R 24.000 (spec 24)
- ✅ check-18: beamline: bunches cross on the downbeat, camera halted just short of the IP · 9 crossings, bar-to-bar error ≤ 0.00 ms, lag ≤ 9.2 ms · at downbeats: 0.89–0.91 from the IP, speed ≤ 0.94 (lap mean 75.4)
- ❌ check-18: quench: Mach cone half-angle = asin(c_s/v) ± 3° (my fit to the drawn wake) · · want –°
- ✅ check-18: jets: each pair on a snare, ≤ 40 ms; escaping side narrow · 16 pairs on steps 4/12 · lag ≤ 18.1 ms · φ spread 2.66° escaping vs 7.66° quenched (shader formula, q 0.75)
- ✅ check-18: 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms
- ✅ check-18: errors · none
