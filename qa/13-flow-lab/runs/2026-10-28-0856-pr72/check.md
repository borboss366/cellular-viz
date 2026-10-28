# 13-flow-lab · experiment for #72 @d6a5e02

| gate | result | detail |
|---|---|---|
| fps.p05 ≥ 55 | ✅ | rocks@1080p 59.88 · rocks@4k 59.88 · vortex@1080p 59.88 · vortex@4k 59.88 |
| longFrames ≤ 0.5 | ✅ | rocks@1080p 0 · rocks@4k 0 · vortex@1080p 0 · vortex@4k 0 |
| errors ≤ 0 | ✅ | rocks@1080p 0 · rocks@4k 0 · vortex@1080p 0 · vortex@4k 0 |
| gpuBusy ≤ 10 | ✅ | rocks@1080p 0 · rocks@4k 6 · vortex@1080p 6 · vortex@4k 6 |
| clip ≤ 2 (rocks) | ✅ | rocks@1080p 0.25 · rocks@4k 0.005 |
| brightness, reported (rocks vs base in the swipe) | ✅ | rocks@1080p 2.75 · rocks@4k 2.68 · vortex@1080p 0.54 · vortex@4k 0.53 |
| check-13: dye kept in a closed box, raw (?conserve=0, sources and hit splats off),  drift  ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.33 % in 21 s (-0.16 %/10 s, page log -0.30 %) · kh: -0.63 % in 21 s (-0.31 %/10 s, page log -0.66 %) · ink: -0.37 % in 21 s (-0.18 %/10 s, page log -0.47 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.59 %) · plume+conserve: -0.02 % in 21 s (-0.01 %/10 s, page lo |
| check-13: natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.35 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.255 Hz real (Fourier 1.255), St 0.1985 (sim 0.1985), amp 151.06 |
| check-13: art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.748 (Fourier 0.75), wake amp 155.13 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.61 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.29 |
| check-13: sync from __qa.events (≤ 40 ms) | ✅ | kick 8.8 ms (n 60) · hat 8.7 ms (n 119) · snare 8.9 ms (n 30) |
| check-13: 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| check-13: page alive | ✅ |  |
| check-13: 1080p p95 ≤ 16.8 ms (hard) | ✅ |  |
| check-13: 1440p p95 ≤ 16.8 ms | ✅ |  |
| check-13: errors | ✅ | none |
| PR | ℹ️ | #72 @d6a5e02 |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
