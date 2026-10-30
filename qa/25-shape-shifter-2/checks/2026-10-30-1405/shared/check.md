# Shared gates (#88) · 25-shape-shifter-2.html · 2026-10-30-1405

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ❌ | p50 5.98 · p95 11.26 · p99 15.35 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ✅ | p50 4.62 · p95 6.55 · p99 7.6 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 493 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5381 frames in 90.0 s (59.8 fps, 0 skipped) · tap 10.77 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ❌ | 194 failing frames · worst 66.1 % at 1280,0 (t 81.3 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % at 160,800 (t 46.3 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1145 (t 6.57 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5054 at 800,320 (t 6.57 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.223 at 960,160 (t 65.36 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.4 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1280,0 at t 81.3 s · 121 frames over 2.00 s · window mean L 0.06–0.28, 9 swings ≥ 0.02 (2.3 Hz) · flashing share > 25 % on 67 frames, peak 66 % · mean L every 3rd frame: 0.11 0.12 0.14 0.19 0.14 0.19 0.17 0.09 0.06 0.06 0.10 0.13 0.18 0.19 0.17 0.21 0.16 0.11 0.12 0.14 0.13 0.16 0.27 0.23 0.16 0.16 0.17 0.17 0.17 0.15 0.14 0.13 0.12 0.12 0.12 0.11 0.10 0.10 0.09 0.09 0.08 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: page from before #88 that has __qa.forceDrop |
| page errors | ✅ | none |
