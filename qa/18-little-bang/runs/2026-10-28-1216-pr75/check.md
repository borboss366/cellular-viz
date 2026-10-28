# 18-little-bang · experiment for #75 @9311bdb

| gate | result | detail |
|---|---|---|
| fps.p05 ≥ 55 @1080p | ✅ | beamline@1080p 59.88 · quench@1080p 59.88 · collide@1080p 59.88 |
| longFrames ≤ 0.5 | ✅ | beamline@1080p 0 · beamline@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0 |
| errors ≤ 0 | ✅ | beamline@1080p 0 · beamline@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0 |
| gpuBusy ≤ 10 | ✅ | beamline@1080p 0 · beamline@4k 1 · quench@1080p 1 · quench@4k 1 · collide@1080p 3 · collide@4k 1 |
| clip ≤ 2 (collide, quench) | ✅ | quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0 |
| brightness, reported | ✅ | beamline@1080p 8.13 · beamline@4k 7.12 · quench@1080p 12.09 · quench@4k 10.3 · collide@1080p 12.25 · collide@4k 10.21 |
| check-18: tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| check-18: with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| check-18: elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| check-18: fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| check-18: strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 200 breaks, worst drift 0 |
| check-18: jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| check-18: sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 8 ms (n 15) · jet 8 ms (n 29) · crossing 7.4 ms (n 7) |
| check-18: page keeps animating | ✅ |  |
| check-18: collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ✅ | worst frame 0.00 % clipped (any channel ≥ 254) of 137 frames · brightest frame (mean lum 24.2 %): clipped 0.00 %, white 0.00 % · 1920×1080 |
| check-18: 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ✅ |  |
| check-18: errors | ✅ | none |
| PR | ℹ️ | #75 @9311bdb |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
