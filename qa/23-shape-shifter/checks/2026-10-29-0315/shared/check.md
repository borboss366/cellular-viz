# Shared gates (#88) · 23-shape-shifter.html · 2026-10-29-0315

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at 1440p | ❌ | p50 9.42 · p95 11.54 · p99 12.09 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| canvas 2560×1440 at dpr 1 | ⚠️ | 1920×1080 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5398 frames in 90.0 s (60.0 fps, 0 skipped) · tap 11.46 ms/frame · scene canvas 1920×1080 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ❌ | 223 failing frames · worst 64.0 % at 640,320 (t 17.05 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1384 (t 16.92 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.4176 at 0,0 (t 16.9 s) |
| window mean rises ≤ 0.25 in 100 ms | ❌ | 2 failing frames · max 0.2652 at 800,480 (t 18.07 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.1 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: page from before #88 that has __qa.forceDrop |
| page errors | ✅ | none |
