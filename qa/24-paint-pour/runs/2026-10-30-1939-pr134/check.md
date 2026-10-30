# 24-paint-pour · experiment for #134 @e30025b

| gate | result | detail |
|---|---|---|
| truth 1: every op is area-preserving, max  det J - 1  < 1e-5 (float64) | ✅ | default@1080p true · default@4k true |
| truth 3: the shader's trace matches the float64 trace (max error < 1e-4, same drop away from boundaries) | ✅ | default@1080p true · default@4k true · flat@1080p true · flat@4k true · drop@1080p true · drop@4k true · build@1080p true · build@4k true · breakdown@1080p true · breakdown@4k true · bake@1080p true · bake@4k true · psych60s@1080p true · psych60s@4k true |
| truth 4: a stroke then the same stroke reversed is the identity (< 1e-6) | ✅ | default@1080p true · default@4k true |
| truth 5: the pour law r = sqrt(rate t / pi), within 0.5 % | ✅ | build@1080p "true" · build@4k "true" |
| truth 9: the op log replays from the seed and the beat clock alone | ❌ | fails on default@1080p, default@4k, flat@1080p, flat@4k, drop@1080p, drop@4k, breakdown@1080p, breakdown@4k, bake@1080p, bake@4k, psych60s@1080p, psych60s@4k · default@1080p "false" · default@4k "false" · flat@1080p "false" · flat@4k "false" · drop@1080p "false" · drop@4k "false" |
| truth 10: canada colours >= 3:1 against the ground, no big drop above L 0.75 | ✅ | default@1080p true · default@4k true |
| truth 8: every op goes live within 40 ms of its beat | ❌ | fails on build@4k, breakdown@4k, bake@4k, psych60s@4k · default@1080p 20.313 · default@4k 19.95 · flat@1080p 20.313 · flat@4k 10.562 · drop@1080p 10.562 · drop@4k 39.224 · build@1080p 10.562 · build@4k 99.406 · breakdown@1080p 15.705 · breakdown@4k 99.406 · bake@1080p 10.562 · ba |
| the shared clock is playing (Play pressed) | ✅ | default@1080p true · default@4k true · flat@1080p true · flat@4k true · drop@1080p true · drop@4k true · build@1080p true · build@4k true · breakdown@1080p true · breakdown@4k true · bake@1080p true · bake@4k true · psych60s@1080p true · psych60s@4k true |
| the drop at bar 16 fired | ✅ | drop@1080p 1 · drop@4k 1 |
| the build's pour started at bar 12 | ✅ | build@1080p 1 · build@4k 1 |
| no big drops in the breakdown (bars 8-11) | ✅ | default@1080p 0 · default@4k 0 · flat@1080p 0 · flat@4k 0 · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · breakdown@1080p 0 · breakdown@4k 0 · bake@1080p 0 · bake@4k 0 · psych60s@1080p 0 · psych60s@4k 0 |
| combs on the kick (groove) and feathers (breakdown) | ✅ | default@1080p 24 · default@4k 24 · breakdown@1080p 24 · breakdown@4k 24 |
| opsMax 40: at least one tiled bake in the window | ✅ | bake@1080p 2 · bake@4k 2 |
| #88 forceDrop hook | ✅ | default@1080p "function" · default@4k "function" · flat@1080p "function" · flat@4k "function" · drop@1080p "function" · drop@4k "function" · build@1080p "function" · build@4k "function" · breakdown@1080p "function" · breakdown@4k "function" · bake@1080p "function" · bake@4k "func |
| fps.p05 ≥ 55 | ✅ | default@1080p 59.52 · default@4k 59.52 · flat@1080p 59.88 · flat@4k 59.52 · drop@1080p 59.52 · drop@4k 59.52 · build@1080p 59.88 · build@4k 59.52 · breakdown@1080p 59.88 · breakdown@4k 59.52 · bake@1080p 59.88 · bake@4k 59.88 · psych60s@1080p 59.88 · psych60s@4k 59.52 |
| longFrames ≤ 0.5 | ❌ | fails on default@4k, drop@4k, psych60s@4k · default@1080p 0 · default@4k 2.56 · flat@1080p 0 · flat@4k 0.42 · drop@1080p 0 · drop@4k 0.56 · build@1080p 0 · build@4k 0 · breakdown@1080p 0 · breakdown@4k 0 · bake@1080p 0 · bake@4k 0 · psych60s@1080p 0 · psych60s@4k 2.01 |
| errors ≤ 0 | ✅ | default@1080p 0 · default@4k 0 · flat@1080p 0 · flat@4k 0 · drop@1080p 0 · drop@4k 0 · build@1080p 0 · build@4k 0 · breakdown@1080p 0 · breakdown@4k 0 · bake@1080p 0 · bake@4k 0 · psych60s@1080p 0 · psych60s@4k 0 |
| gpuBusy ≤ 10 | ✅ | default@1080p 0 · default@4k 1 · flat@1080p 4 · flat@4k 1 · drop@1080p 4 · drop@4k 1 · build@1080p 5 · build@4k 2 · breakdown@1080p 6 · breakdown@4k 1 · bake@1080p 4 · bake@4k 1 · psych60s@1080p 4 · psych60s@4k 1 |
| no white blobs: <= 1 % pixels clipped | ✅ | default@1080p 0.017 · default@4k 0.017 · flat@1080p 0 · flat@4k 0 · drop@1080p 0.008 · drop@4k 0.009 · build@1080p 0.014 · build@4k 0.015 · breakdown@1080p 0.01 · breakdown@4k 0.008 · bake@1080p 0.001 · bake@4k 0.001 · psych60s@1080p 0.014 · psych60s@4k 0.013 |
| PR | ℹ️ | #134 @e30025b |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ❌ | p50 6.05 · p95 10.18 · p99 11.65 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 8.02 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 24.8 % at 1280,640 (t 28.02 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.2522 (t 88.65 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.4547 at 800,320 (t 60.73 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.1726 at 960,640 (t 1.8 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1280,640 at t 28.02 s · 121 frames over 2.00 s · window mean L 0.09–0.26, 0 swings ≥ 0.02 (0.0 Hz) · flashing share > 25 % on 0 frames, peak 25 % · mean L every 3rd frame: 0.26 0.26 0.26 0.26 0.26 0.25 0.25 0.24 0.24 0.23 0.22 0.22 0.21 0.20 0.20 0.19 0.18 0.18 0.17 0.16 0.16 0.15 0.14 0.14 0.13 0.13 0.12 0.12 0.11 0.11 0.11 0.11 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.09 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
