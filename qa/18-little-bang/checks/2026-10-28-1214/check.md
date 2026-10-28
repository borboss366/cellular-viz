# 18 Little Bang check · 2026-10-28-1214

| check | result | detail |
|---|---|---|
| tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 181 breaks, worst drift 0 |
| jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 17.4 ms (n 15) · jet 17.6 ms (n 29) · crossing 18.4 ms (n 7) |
| page keeps animating | ✅ | |
| collide: < 2 % of pixels clipped in every frame of 16 s (#58) | ✅ | worst frame 0.00 % clipped (any channel ≥ 254) of 138 frames · brightest frame (mean lum 31.7 %): clipped 0.00 %, white 0.01 % · 1920×1080 |
| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ✅ | |
| errors | ✅ | none |

## Frame times (vsync)

| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |
|---|---|---|---|---|---|
| collide | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
| collide 1M | 149.9 / 127 | 216.6 / 98 | 216.7 / 77 | 3840×2160 | 1000000 |
| quench | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 30000 |
| quench 1M | 150 / 125 | 216.7 / 85 | 200 / 87 | 3840×2160 | 1000000 |
| strings | — | 16.7 / 0 | — | — | 0 |
| auto | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 30000 |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
