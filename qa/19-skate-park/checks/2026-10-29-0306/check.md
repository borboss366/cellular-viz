# 19 Skate Park check · 2026-10-29-0306

| check | result | detail |
|---|---|---|
| torus knots on the torus, closed, winding (p, q), gcd = 1 | ✅ | (2,3): off-surface 1.6e-15, closure 3.0e-15, winds 2/3 · (3,5): off-surface 1.8e-15, closure 4.6e-15, winds 3/5 · (5,8): off-surface 2.0e-15, closure 7.5e-15, winds 5/8 |
| knot steps by section | ✅ | 0:2,3 → 1:3,5 → 2:5,8 → 3:2,3 |
| morph: Δ = −16(4a³+27b²) = 0 at b = 2, node (1,0); b 0→2 over the build-up | ✅ | a -3, Δ(2) 0, page Δ matches at 8 b values; b at drop 2 |
| morph live: Δ crosses 0 on the drop's first frame (b ∈ [2, 2 + one frame)), merge event | ✅ | 3 drops: b 2.0024 Δ -4.2e+0, b 2.0023 Δ -4.0e+0, b 2.0000 Δ -7.7e-2; 3 merge events |
| tricks never overlap | ✅ | sections: 26 starts, min gap 12 bars · bars: 25 starts, min gap 16 bars · drops: 25 starts, min gap 16 bars |
| sync from __qa.events (≤ 40 ms) | ✅ | knot 16.8 ms (n 2) · kick 9 ms (n 80) · hat 8.9 ms (n 160) · snare 9.1 ms (n 40) · trick 19 ms (n 1) |
| page alive | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| track | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| torus | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |
| morph | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
| free | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at 1440p | ✅ | p50 0.44 · p95 0.77 · p99 0.95 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 4 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ❌ | 1719 failing frames · worst 89.3 % at 0,0 (t 24.6 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1219 (t 27.1 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5317 at 0,960 (t 28.78 s) |
| window mean rises ≤ 0.25 in 100 ms | ❌ | 30 failing frames · max 0.475 at 1760,960 (t 23.18 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 3.5 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: page from before #88 that has __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 9, 4, 1, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
