# 14 Round Point check · 2026-10-29-1835

Area, L, L²/4πA and crossings recomputed from `__qa.polygon` every frame.

| gate | result | detail |
|---|---|---|
| 1 area falls at 2π per unit τ (±3 %), kicks off; round on the section's last beat | ✅ | dA/dτ ÷ 2π: -0.9999 · A 1.698 → 3.3e-4 · round at bar 16 (section ends 16) |
| 1b same, kicks on (between kicks) | ✅ | 28 stretches, worst -0.9987 · 28 bumps |
| 2 L²/4πA never rises between kicks above 1 % of the start area, ends near 1 (kicks off) | ✅ | 1.3369 → 1.0007, largest rise 0 |
| 2b same, kicks on | ✅ | 1.3458 → 1.0007, largest rise between kicks 0 |
| 3 no self-crossings, every frame (my O(n²) test) | ✅ | kicks off 0 in 959 frames · kicks on 0 in 959 frames (page counted 0 / 0) · 67–240 vertices |
| 4 neck pinch on the drop → exactly 2 pieces, then round points | ✅ | 1→2 at bar 14.01 (drop 14, off by 0.01 bar) · after: 2 (still 2 on the section's last frame) · neck 0.0451 → 0.0233, largest rise 0.0003 (reported only) |
| 5 sync from __qa.events (≤ 40 ms) | ✅ | seed 17.9 ms (n 2) · kick 8.5 ms (n 72) · hat 8.5 ms (n 144) · snare 8.7 ms (n 36) · pinch 7.5 ms (n 1) |
| 6 no brightness jump > 25 % frame to frame at a scene change | ✅ | curve→pinch at bar 8.009, pinch→curve at bar 16.008 · worst at a change 14.6 % (7.73→9.05 at bar 16.509) · 0 frames over 25 % · elsewhere (kicks, reported only) worst 32.9 % at bar 9.009 |
| 60 fps 1080p/1440p/4K | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| scene | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| curve | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |
| pinch | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 0.43 · p95 0.65 · p99 0.66 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 1 of 3599 > 17.5 ms (0.03 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level profile_peak |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5393 frames in 90.0 s (59.9 fps, 0 skipped) · tap 1.9 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.4 % at 0,0 (t 79.56 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0027 (t 74.5 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.0236 at 160,0 (t 48.38 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0031 at 800,0 (t 62.6 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
