# 18-little-bang · experiment for #75 @b0cfb63

| gate | result | detail |
|---|---|---|
| fps.p05 ≥ 55 @1080p | ✅ | beamline@1080p 59.88 · beamline-wires@1080p 59.88 · quench@1080p 59.88 · collide@1080p 59.88 |
| longFrames ≤ 0.5 | ✅ | beamline@1080p 0 · beamline@4k 0 · beamline-wires@1080p 0 · beamline-wires@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0 |
| errors ≤ 0 | ✅ | beamline@1080p 0 · beamline@4k 0 · beamline-wires@1080p 0 · beamline-wires@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0 |
| gpuBusy ≤ 10 | ✅ | beamline@1080p 0 · beamline@4k 1 · beamline-wires@1080p 2 · beamline-wires@4k 0 · quench@1080p 1 · quench@4k 1 · collide@1080p 3 · collide@4k 1 |
| clip ≤ 2 (collide, quench, beamline) | ✅ | beamline@1080p 0 · beamline@4k 0 · quench@1080p 0 · quench@4k 0 · collide@1080p 0 · collide@4k 0 |
| brightness, reported | ✅ | beamline@1080p 8.38 · beamline@4k 6.75 · beamline-wires@1080p 0.47 · beamline-wires@4k 0.39 · quench@1080p 12.23 · quench@4k 10.39 · collide@1080p 12.1 · collide@4k 10.22 |
| check-18: tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| check-18: with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| check-18: elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| check-18: fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| check-18: strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 203 breaks, worst drift 0 |
| check-18: jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| check-18: sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 9.3 ms (n 15) · jet 8.6 ms (n 29) · pulse 17.7 ms (n 28) · crossing 18.6 ms (n 7) · pulse-arrive 18.6 ms (n 7) |
| check-18: page keeps animating | ✅ |  |
| check-18: collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ✅ | worst frame 0.00 % clipped (any channel ≥ 254) of 138 frames · brightest frame (mean lum 29.4 %): clipped 0.00 %, white 0.00 % · 1920×1080 |
| check-18: beamline: camera on the beam axis (< 0.35 off, every frame) | ✅ | worst 7.11e-15 over 961 frames · my circle fit to the camera path: R 24.000 (spec 24) |
| check-18: beamline: bunches cross on the downbeat, camera halted just short of the IP | ✅ | 9 crossings, bar-to-bar error ≤ 0.00 ms, lag ≤ 9.4 ms · at downbeats: 0.89–0.91 from the IP, speed ≤ 0.94 (lap mean 75.4) |
| check-18: quench: Mach cone half-angle = asin(c_s/v) ± 3° (my fit to the drawn wake) | ✅ | 0.4: 35.26° (widens to 36.76°, 15/82 frames fit) · 0.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 1.4: 36° (widens to 36.76°, 10/60 frames fit) · 1.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 2.4: 35.99° (widens to 36.76°, 10/60 frames fit) · 2.12: 35.98° (widens to 36 |
| check-18: jets: each pair on a snare, ≤ 40 ms; escaping side narrow | ✅ | 16 pairs on steps 4/12 · lag ≤ 17.3 ms · φ spread 2.66° escaping vs 7.66° quenched (shader formula, q 0.75) |
| check-18: neon: wire brightness peaks ≤ 40 ms after each kick; its light ring arrives on the downbeat | ✅ | 35 kicks: frame-brightness peak median 12 ms (max 147) after the sound · pulse launch lag ≤ 10.1 ms · arrival vs crossing ≤ 0.00 ms |
| check-18: neon: mean hue changes ≥ 15° bar to bar on ≥ 90 % of bars | ✅ | 9 bars, steps 78.8, 49.2, 164, 32.4, 85.2, 169.4, 87.2, 151.5° (100 % ≥ 15°; wire pixels only (?qa=wires)) |
| check-18: neon: no frame-to-frame brightness jump > 25 % outside drops | ❌ | worst 54.3 % at bar 2.24 · 41 frames over 25 % (both frames floored at 0.5/255; wire pixels only) · whole picture worst 34.3 % (reported only) |
| check-18: neon: wires ≥ 0.2 tube radius from the camera | ✅ | camera ≤ 7.1e-15 off the axis (my measure) · nearest wire 0.991 tube radii (page's breath − wobble) |
| check-18: 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ✅ |  |
| check-18: errors | ✅ | none |
| PR | ℹ️ | #75 @b0cfb63 |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
