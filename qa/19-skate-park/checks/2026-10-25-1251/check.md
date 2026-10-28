# 19 Skate Park check · 2026-10-25-1251

| check | result | detail |
|---|---|---|
| torus knots on the torus, closed, winding (p, q), gcd = 1 | ✅ | (2,3): off-surface 1.6e-15, closure 3.0e-15, winds 2/3 · (3,5): off-surface 1.8e-15, closure 4.6e-15, winds 3/5 · (5,8): off-surface 2.0e-15, closure 7.5e-15, winds 5/8 |
| knot steps by section | ✅ | 0:2,3 → 1:3,5 → 2:5,8 → 3:2,3 |
| morph: Δ = −16(4a³+27b²) = 0 at b = 2, node (1,0); b 0→2 over the build-up | ✅ | a -3, Δ(2) 0, page Δ matches at 8 b values; b at drop 2 |
| morph live: every drop starts at b = 2, Δ = 0, merge event | ❌ | 3 drops: b 2.0024 Δ -4.2e+0, b 2.0023 Δ -4.0e+0, b 2.0000 Δ -7.7e-2; 3 merge events |
| tricks never overlap | ✅ | sections: 26 starts, min gap 12 bars · bars: 25 starts, min gap 16 bars · drops: 25 starts, min gap 16 bars |
| sync from __qa.events (≤ 40 ms) | ✅ | knot 23.7 ms (n 2) · kick 17.3 ms (n 80) · hat 17.4 ms (n 160) · snare 17.3 ms (n 40) · trick 19.1 ms (n 1) |
| page alive | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| track | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| torus | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 |
| morph | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 |
| free | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 |
