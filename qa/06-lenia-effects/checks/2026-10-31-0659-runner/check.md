# runner

| gate | result | detail |
|---|---|---|
| own check script for 06-lenia-effects | ℹ️ | none on main (qa/check-06.mjs or qa/runner/checks.json): shared gates only |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 1.32 · p95 1.38 · p99 1.39 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ⚠️ | 1024×1024 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 3.3 ms/frame · scene canvas 1024×1024 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 59 failing frames · worst 41.0 % at 1440,960 (t 34.08 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.1 % at 800,960 (t 76.43 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.5847 (t 46.58 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.6811 at 1600,0 (t 46.58 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 45 failing frames · max 0.4692 at 1600,0 (t 46.58 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 1 failing frames · max 7.7 % · longest run over 5 %: 4 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1440,960 at t 34.08 s · 121 frames over 2.00 s · window mean L 0.00–0.44, 2 swings ≥ 0.02 (0.5 Hz) · flashing share > 25 % on 30 frames, peak 41 % · mean L every 3rd frame: 0.23 0.21 0.20 0.20 0.19 0.19 0.19 0.18 0.18 0.18 0.44 0.35 0.27 0.21 0.19 0.17 0.16 0.15 0.14 0.12 0.10 0.07 0.05 0.04 0.02 0.02 0.01 0.01 0.01 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 18.18 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 2, 1, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
