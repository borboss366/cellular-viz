# Shared gates (#88) · 16-neon-lines.html · 2026-10-30-1419

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 1.73 · p95 2.88 · p99 2.95 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 4.48 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ❌ | 284 failing frames · worst 60.2 % at 800,160 (t 28.17 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1517 (t 27.25 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.4239 at 960,320 (t 27.25 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.2472 at 960,800 (t 58.73 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 800,160 at t 28.17 s · 121 frames over 2.00 s · window mean L 0.19–0.34, 6 swings ≥ 0.02 (1.5 Hz) · flashing share > 25 % on 70 frames, peak 60 % · mean L every 3rd frame: 0.26 0.31 0.34 0.33 0.31 0.29 0.28 0.28 0.28 0.27 0.26 0.25 0.23 0.21 0.21 0.21 0.23 0.25 0.27 0.28 0.27 0.25 0.23 0.21 0.20 0.19 0.19 0.20 0.23 0.25 0.25 0.25 0.25 0.24 0.23 0.22 0.20 0.20 0.21 0.23 0.22 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
