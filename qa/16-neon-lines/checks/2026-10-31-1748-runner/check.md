# runner

| gate | result | detail |
|---|---|---|
| own check script for 16-neon-lines | ℹ️ | none on main (qa/check-16.mjs or qa/runner/checks.json): shared gates only |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 1.63 · p95 2.63 · p99 2.71 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 4.17 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 12.1 % at 960,480 (t 72.93 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0877 (t 72.06 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.3193 at 960,480 (t 72.06 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.2192 at 960,480 (t 72.06 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 960,480 at t 72.93 s · 121 frames over 2.00 s · window mean L 0.06–0.32, 9 swings ≥ 0.02 (2.3 Hz) · flashing share > 25 % on 0 frames, peak 12 % · mean L every 3rd frame: 0.10 0.10 0.30 0.31 0.27 0.23 0.19 0.16 0.16 0.16 0.14 0.13 0.20 0.15 0.14 0.14 0.12 0.13 0.11 0.13 0.11 0.11 0.13 0.12 0.13 0.12 0.12 0.12 0.12 0.12 0.11 0.10 0.09 0.08 0.08 0.08 0.08 0.07 0.07 0.07 0.06 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick · 361 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 18.14 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0 % (idle ≤ 10 % for 3 s; waited 3 s) |
| GPU: wait, tail, requeues (#144) | ℹ️ | waited 3 s before start, tail 0 ms, requeues 0 |
