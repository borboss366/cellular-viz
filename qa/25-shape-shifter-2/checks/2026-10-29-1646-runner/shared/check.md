# Shared gates (#88) · 25-shape-shifter-2.html · 2026-10-29-1816

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 6.75 · p95 14.23 · p99 17.08 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ✅ | p50 4.18 · p95 6.08 · p99 6.88 ms over 3598 frames · rAF > 20 ms: 1 of 3597 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 494 samples · power_dpm_force_performance_level profile_peak |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ⚠️ | 3106 frames in 90.0 s (34.5 fps, 2095 skipped) · tap 18.41 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | not measured: analysed only 34.5 fps · 42 failing frames · worst 75.5 % at 1920,160 (t 77.43 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | not measured: analysed only 34.5 fps · 0 failing frames · worst 0.8 % at 1760,320 (t 64.05 s) |
| frame mean L ≤ 0.60 | ⚠️ | not measured: analysed only 34.5 fps · 0 failing frames · max 0.1436 (t 86.35 s) |
| 10° window mean L ≤ 0.80 | ⚠️ | not measured: analysed only 34.5 fps · 0 failing frames · max 0.5168 at 800,320 (t 6.32 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | not measured: analysed only 34.5 fps · 1 failing frames · max 0.2592 at 1600,480 (t 76.66 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ⚠️ | not measured: analysed only 34.5 fps · 0 failing frames · max 0.4 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
