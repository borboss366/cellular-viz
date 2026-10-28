# 18 Little Bang check · 2026-10-26-1801

| check | result | detail |
|---|---|---|
| tracks curl with r = pT/(0.3 B), B = 0.5 T | ✅ | 200 charged tracks, worst 1.3e-13% (3-point circle fit) |
| with dE/dx: local radius = r0 − k·s | ✅ | 200 tracks, worst 0.000% |
| elliptic flow ⟨cos 2φ⟩ = v2 > 0 | ✅ | v2 0.0942, measured 0.0952 over 200k tracks (b 6.60 fm, ε 0.471) |
| fireball: short axis grows faster; hadronizes at T_c | ✅ | in 3.70→5.56 fm, out 6.17→7.48 fm; T 346→155.8 MeV (T_c 156) |
| strings: quarks = 2 + 2·breaks, white groups, energy kept | ✅ | 42 cascades, 202 breaks, worst drift 0 |
| jets: A_J = q/(2 − q) | ✅ | q 0: 0.0000, q 0.6: 0.4286, q 0.75: 0.6000 |
| sync from __qa.events (≤ 40 ms after the sound) | ✅ | collision 9.3 ms (n 8) · jet 8.3 ms (n 16) · pair 18.2 ms (n 28) |
| page keeps animating | ✅ | |
| 1440p: p95 ≤ 16.8 ms, ≤ 3 frames > 20 ms | ❌ | |
| errors | ✅ | none |

## Frame times (vsync)

| run | 1080p p95 / >20 ms | 1440p p95 / >20 ms | 4K p95 / >20 ms | canvas at 4K | tracks drawn |
|---|---|---|---|---|---|
| collide | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 100000 |
| collide 1M | 133.3 / 133 | 216.7 / 88 | 216.7 / 77 | 3840×2160 | 1000000 |
| quench | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 100000 |
| quench 1M | 150 / 110 | 200 / 103 | 216.6 / 63 | 3840×2160 | 1000000 |
| strings | — | 16.7 / 0 | — | — | 0 |
| auto | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 100000 |
