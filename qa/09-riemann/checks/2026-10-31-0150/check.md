# 09 Riemann check · 2026-10-31-0150

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2)
- viewport 1920×1080, canvas 1920×1080
- overview window: x -36.6…34.6, y -2.0…38.0

## Winding of hue at the known points (want +1 zero, −1 pole)

| point | winding | raw |
|---|---|---|
| zero ½+14.134725i | ✅ 1 | 1/1/1/1 |
| zero ½+21.02204i | ✅ 1 | 1/1/1/1 |
| zero ½+25.010858i | ✅ 1 | 1/1/1/1 |
| zero ½+30.424876i | ✅ 1 | 1/1/1/1 |
| zero ½+32.935062i | ✅ 1 | 1/1/1/1 |
| trivial zero -2 | ✅ 1 | 1/1/1/1 |
| trivial zero -4 | ✅ 1 | 1/1/1/1 |
| trivial zero -6 | ✅ 1 | 1/1/1/1 |
| trivial zero -8 | ✅ 1 | 1/1/1/1 |
| trivial zero -10 | ✅ 1 | 1/1/1/1 |
| pole s=1 | ✅ -1 | -1/-1/-1/-1 |

## Scan of −3 ≤ Re s ≤ 4 (and the real axis to −12): every pinwheel found

| at | winding | cells | is |
|---|---|---|---|
| -10.25 + 0.00i | 1 | 2 | trivial -10 |
| -8.25 + 0.00i | 1 | 2 | trivial -8 |
| -6.25 + 0.00i | 1 | 2 | trivial -6 |
| 0.75 + 0.00i | -1 | 2 | pole s=1 |
| -4.00 + 0.25i | 1 | 2 | trivial -4 |
| -2.00 + 0.25i | 1 | 2 | trivial -2 |
| 0.50 + 14.25i | 1 | 2 | zero 14.134725 |
| 0.50 + 21.25i | 1 | 2 | zero 21.02204 |
| 0.25 + 25.00i | 1 | 2 | zero 25.010858 |
| 0.50 + 30.25i | 1 | 2 | zero 30.424876 |
| 0.50 + 32.75i | 1 | 2 | zero 32.935062 |

## Speed at 1920×1080, playing, 10 s

| view | fps | frame p50 | p99 | worst |
|---|---|---|---|---|
| travel | 60 | 16.7 ms | 16.8 ms | 16.8 ms |
| overview | 60 | 16.7 ms | 16.8 ms | 16.8 ms |

## Result

- ✅ zerosOnLine
- ✅ trivialAndPole
- ✅ noStray
- ✅ fps60
- ✅ noErrors

Errors: none


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 2.68 · p95 2.88 · p99 2.91 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 5.06 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 24.0 % at 640,0 (t 83.65 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 7 failing frames · max 0.6155 (t 0.58 s) |
| 10° window mean L ≤ 0.80 | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 23 failing frames · max 0.8126 at 1920,0 (t 64.66 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 2 failing frames · max 0.2543 at 1600,800 (t 24.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 640,0 at t 83.65 s · 121 frames over 2.00 s · window mean L 0.25–0.55, 7 swings ≥ 0.02 (1.8 Hz) · flashing share > 25 % on 0 frames, peak 24 % · mean L every 3rd frame: 0.37 0.36 0.35 0.35 0.35 0.36 0.37 0.38 0.39 0.46 0.46 0.45 0.45 0.45 0.44 0.44 0.44 0.44 0.43 0.54 0.49 0.46 0.44 0.41 0.40 0.38 0.37 0.36 0.35 0.43 0.40 0.36 0.34 0.32 0.30 0.29 0.28 0.27 0.25 0.34 0.29 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
