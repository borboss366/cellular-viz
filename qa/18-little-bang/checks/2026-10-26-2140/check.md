# 18 Little Bang check · 2026-10-26-2140

| check | result | detail |
|---|---|---|
| tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 211 breaks, worst drift 0 |
| jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 17.5 ms (n 8) · jet 18.3 ms (n 16) · pair 18 ms (n 28) |
| page keeps animating | ✅ | |
| collide: < 2 % of pixels clipped at the brightest frame (#58) | ✅ | brightest frame at 12.22 s: mean lum 39.8 %, clipped 0.57 %, white 0.72 % · worst clipped of 112 frames 9.79 % · 1920×1080 |
| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ❌ | |
| errors | ✅ | none |

## Frame times (vsync)

| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |
|---|---|---|---|---|---|
| collide | 16.7 / 0 | 16.8 / 22 | 33.4 / 93 | 3840×2160 | 100000 |
| collide 1M | 266.6 / 71 | 316.6 / 60 | 216.7 / 56 | 3840×2160 | 1000000 |
| quench | 16.8 / 0 | 33.3 / 55 | 33.3 / 56 | 3840×2160 | 100000 |
| quench 1M | 250 / 67 | 300 / 57 | 283.4 / 58 | 3840×2160 | 1000000 |
| strings | — | 16.8 / 0 | — | — | 0 |
| auto | 16.7 / 0 | 33.3 / 57 | 33.4 / 60 | 3840×2160 | 100000 |
