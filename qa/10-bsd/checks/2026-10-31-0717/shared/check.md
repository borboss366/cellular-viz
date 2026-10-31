# Shared gates (#88) · 10-bsd.html · 2026-10-31-0717

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU time measured | ⚠️ | method: none (no WebGL2 canvas); 0 frames timed |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ⚠️ | none · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 10 of 3589 > 17.5 ms (0.28 %) · 59.8 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | extension not available |
| flash capture | ✅ | 5370 frames in 90.0 s (59.7 fps, 0 skipped) · tap 8.66 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 9.4 % at 160,480 (t 30.23 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.2305 (t 0.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.2511 at 160,480 (t 6.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.2421 at 160,320 (t 0.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.1 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 160,480 at t 30.23 s · 119 frames over 2.00 s · window mean L 0.01–0.25, 1 swings ≥ 0.02 (0.3 Hz) · flashing share > 25 % on 0 frames, peak 9 % · mean L every 3rd frame: 0.02 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.25 0.20 0.15 0.11 0.08 0.06 0.04 0.03 0.02 0.01 0.02 0.02 0.02 0.02 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 9.2 · max 20.2 ms · audio-in clock |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
