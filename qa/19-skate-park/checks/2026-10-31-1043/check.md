# 19 Skate Park check · 2026-10-31-1043

| check | result | detail |
|---|---|---|
| torus knots on the torus, closed, winding (p, q), gcd = 1 | ✅ | (2,3): off-surface 1.6e-15, closure 3.0e-15, winds 2/3 · (3,5): off-surface 1.8e-15, closure 4.6e-15, winds 3/5 · (5,8): off-surface 2.0e-15, closure 7.5e-15, winds 5/8 |
| knot steps by section | ✅ | 0:2,3 → 1:3,5 → 2:5,8 → 3:2,3 |
| morph: Δ = −16(4a³+27b²) = 0 at b = 2, node (1,0); b 0→2 over the build-up | ✅ | a -3, Δ(2) 0, page Δ matches at 8 b values; b at drop 2 |
| morph live: Δ crosses 0 on the drop's first frame (b ∈ [2, 2 + one frame)), merge event | ✅ | 3 drops: b 2.0024 Δ -4.2e+0, b 2.0023 Δ -4.0e+0, b 2.0000 Δ -7.7e-2; 3 merge events |
| tricks never overlap | ✅ | sections: 26 starts, min gap 12 bars · bars: 25 starts, min gap 16 bars · drops: 25 starts, min gap 16 bars |
| sync from __qa.events (≤ 40 ms) | ✅ | knot 24.6 ms (n 2) · kick 8.3 ms (n 80) · hat 8.5 ms (n 160) · snare 8.8 ms (n 40) · trick 7 ms (n 1) |
| page alive | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| track | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| torus | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 |
| morph | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
| free | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 0.36 · p95 0.43 · p99 0.47 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 3.36 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 1233 failing frames · worst 88.4 % at 0,0 (t 24.68 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.104 (t 23.22 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5292 at 1760,960 (t 23.18 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 21 failing frames · max 0.4761 at 1760,960 (t 23.18 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 3.8 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 0,0 at t 24.68 s · 121 frames over 2.00 s · window mean L 0.03–0.17, 3 swings ≥ 0.02 (0.8 Hz) · flashing share > 25 % on 87 frames, peak 88 % · mean L every 3rd frame: 0.04 0.06 0.08 0.11 0.11 0.12 0.13 0.14 0.17 0.14 0.13 0.12 0.11 0.11 0.11 0.10 0.10 0.10 0.12 0.09 0.05 0.04 0.04 0.04 0.03 0.03 0.03 0.04 0.05 0.05 0.05 0.06 0.09 0.10 0.10 0.11 0.11 0.11 0.11 0.10 0.07 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,hat · 1082 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 9.95 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 7, 3, 1, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
