# Shared gates (#88) · 07-particle-lenia.html · 2026-10-31-0703

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 0.18 · p95 0.19 · p99 0.19 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ⚠️ | 1024×1024 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 1.76 ms/frame · scene canvas 1024×1024 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 40 failing frames · worst 28.0 % at 960,640 (t 53.85 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1578 (t 79.58 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5264 at 1120,640 (t 0.58 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 102 failing frames · max 0.3134 at 1120,640 (t 24.58 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 4.4 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 960,640 at t 53.85 s · 121 frames over 2.00 s · window mean L 0.13–0.49, 16 swings ≥ 0.02 (4.0 Hz) · flashing share > 25 % on 40 frames, peak 28 % · mean L every 3rd frame: 0.19 0.15 0.14 0.14 0.13 0.19 0.16 0.15 0.15 0.14 0.18 0.15 0.15 0.15 0.15 0.33 0.28 0.24 0.22 0.21 0.23 0.21 0.20 0.20 0.20 0.27 0.23 0.22 0.21 0.21 0.25 0.22 0.21 0.20 0.20 0.44 0.34 0.28 0.24 0.21 0.23 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 9.9 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
