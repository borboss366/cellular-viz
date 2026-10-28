# 18 Little Bang check · 2026-10-28-1249

| check | result | detail |
|---|---|---|
| tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 188 breaks, worst drift 0 |
| jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 7.5 ms (n 15) · jet 7.7 ms (n 29) · crossing 7 ms (n 7) |
| page keeps animating | ✅ | |
| collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ✅ | worst frame 0.00 % clipped (any channel ≥ 254) of 136 frames · brightest frame (mean lum 34.2 %): clipped 0.00 %, white 0.19 % · 1920×1080 |
| beamline: camera on the beam axis (< 0.35 off, every frame) | ✅ | worst 7.11e-15 over 961 frames · my circle fit to the camera path: R 24.000 (spec 24) |
| beamline: bunches cross on the downbeat, camera halted just short of the IP | ✅ | 9 crossings, bar-to-bar error ≤ 0.00 ms, lag ≤ 18.2 ms · at downbeats: 0.90–0.90 from the IP, speed ≤ 0.71 (lap mean 75.4) |
| quench: Mach cone half-angle = asin(c_s/v) ± 3° (my fit to the drawn wake) | ✅ | 0.4: 35.26° (widens to 52.43°, 75/76 frames fit) · 0.12: 35.26° (widens to 52.41°, 53/54 frames fit) · 1.4: 35.26° (widens to 52.2°, 53/54 frames fit) · 1.12: 35.26° (widens to 52.17°, 53/54 frames fit) · 2.4: 35.26° (widens to 51.99°, 53/54 frames fit) · 2.12: 35.26° (widens to 52.01°, 53/54 frames fit) · 3.4: 35.26° (widens to 52.39°, 53/54 frames fit) · 3.12: 34.62° (widens to 52.41°, 54/54 frames fit) · 4.4: 35.26° (widens to 52.3°, 53/54 frames fit) · 4.12: 35.26° (widens to 52.33°, 53/54 frames fit) · 5.4: 35.26° (widens to 51.96°, 53/54 frames fit) · 5.12: 35.26° (widens to 51.98°, 53/54 frames fit) · 6.4: 35.26° (widens to 49.61°, 53/54 frames fit) · 6.12: 35.26° (widens to 49.64°, 53/54 frames fit) · 7.4: 35.26° (widens to 49.4°, 53/54 frames fit) · 7.12: 35.26° (widens to 37.55°, 25/25 frames fit) · want 35.26° |
| jets: each pair on a snare, ≤ 40 ms; escaping side narrow | ✅ | 16 pairs on steps 4/12 · lag ≤ 9.7 ms · φ spread 2.66° escaping vs 7.66° quenched (shader formula, q 0.75) |
| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ✅ | |
| errors | ✅ | none |

## Frame times (vsync)

| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |
|---|---|---|---|---|---|
| collide | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 30000 |
| collide 1M | 133.4 / 126 | 216.6 / 99 | 216.6 / 62 | 3840×2160 | 1000000 |
| quench | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
| quench 1M | 150 / 124 | 216.7 / 90 | 216.7 / 72 | 3840×2160 | 1000000 |
| strings | — | 16.7 / 0 | — | — | 0 |
| auto | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
