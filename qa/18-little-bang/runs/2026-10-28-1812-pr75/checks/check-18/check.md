# 18 Little Bang check · 2026-10-28-1824

| check | result | detail |
|---|---|---|
| tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 203 breaks, worst drift 0 |
| jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 9.3 ms (n 15) · jet 8.6 ms (n 29) · pulse 17.7 ms (n 28) · crossing 18.6 ms (n 7) · pulse-arrive 18.6 ms (n 7) |
| page keeps animating | ✅ | |
| collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ✅ | worst frame 0.00 % clipped (any channel ≥ 254) of 138 frames · brightest frame (mean lum 29.4 %): clipped 0.00 %, white 0.00 % · 1920×1080 |
| beamline: camera on the beam axis (< 0.35 off, every frame) | ✅ | worst 7.11e-15 over 961 frames · my circle fit to the camera path: R 24.000 (spec 24) |
| beamline: bunches cross on the downbeat, camera halted just short of the IP | ✅ | 9 crossings, bar-to-bar error ≤ 0.00 ms, lag ≤ 9.4 ms · at downbeats: 0.89–0.91 from the IP, speed ≤ 0.94 (lap mean 75.4) |
| quench: Mach cone half-angle = asin(c_s/v) ± 3° (my fit to the drawn wake) | ✅ | 0.4: 35.26° (widens to 36.76°, 15/82 frames fit) · 0.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 1.4: 36° (widens to 36.76°, 10/60 frames fit) · 1.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 2.4: 35.99° (widens to 36.76°, 10/60 frames fit) · 2.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 3.4: 35.99° (widens to 36.76°, 10/60 frames fit) · 3.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 4.4: 35.99° (widens to 36.78°, 10/60 frames fit) · 4.12: 35.98° (widens to 36.77°, 10/60 frames fit) · 5.4: 35.99° (widens to 36.78°, 10/60 frames fit) · 5.12: 35.98° (widens to 36.76°, 10/60 frames fit) · 6.4: 35.99° (widens to 36.78°, 10/60 frames fit) · 6.12: 36° (widens to 36.76°, 10/60 frames fit) · 7.4: 35.99° (widens to 36.84°, 11/61 frames fit) · 7.12: –° (widens to –°, 0/24 frames fit) · want 35.26° |
| jets: each pair on a snare, ≤ 40 ms; escaping side narrow | ✅ | 16 pairs on steps 4/12 · lag ≤ 17.3 ms · φ spread 2.66° escaping vs 7.66° quenched (shader formula, q 0.75) |
| neon: wire brightness peaks ≤ 40 ms after each kick; its light ring arrives on the downbeat | ✅ | 35 kicks: frame-brightness peak median 12 ms (max 147) after the sound · pulse launch lag ≤ 10.1 ms · arrival vs crossing ≤ 0.00 ms |
| neon: mean hue changes ≥ 15° bar to bar on ≥ 90 % of bars | ✅ | 9 bars, steps 78.8, 49.2, 164, 32.4, 85.2, 169.4, 87.2, 151.5° (100 % ≥ 15°; wire pixels only (?qa=wires)) |
| neon: no frame-to-frame brightness jump > 25 % outside drops | ❌ | worst 54.3 % at bar 2.24 · 41 frames over 25 % (both frames floored at 0.5/255; wire pixels only) · whole picture worst 34.3 % (reported only) |
| neon: wires ≥ 0.2 tube radius from the camera | ✅ | camera ≤ 7.1e-15 off the axis (my measure) · nearest wire 0.991 tube radii (page's breath − wobble) |
| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ✅ | |
| errors | ✅ | none |

## Frame times (vsync)

| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |
|---|---|---|---|---|---|
| collide | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
| collide 1M | 150 / 128 | 216.6 / 90 | 200.1 / 83 | 3840×2160 | 1000000 |
| quench | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
| quench 1M | 150 / 121 | 200 / 97 | 216.7 / 75 | 3840×2160 | 1000000 |
| strings | — | 16.8 / 0 | — | — | 0 |
| auto | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 30000 |
