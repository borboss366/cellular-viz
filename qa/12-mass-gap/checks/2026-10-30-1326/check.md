# 12 Mass Gap check · 2026-10-30-1326

| check | result | detail |
|---|---|---|
| gap: centre rings at ω ≈ m (κ = 0, sim t 200–600) | ✅ | m 0.35 → ω 0.3505 (0.13%), m 0.6 → ω 0.6024 (0.41%); 44/76 zero crossings |
| colours stay separate at κ = 0 | ✅ | green/blue max 0 / 0 after a pure red splat |
| no gap: front speed 1 cell per unit time | ✅ | arrivals at r 30…150: 26, 56, 86, 116, 146 → speed 1 |
| tube: E = σ·r, r grows, snaps at the drop | ✅ | r 0.38→2.02 fm, E/r 0.9…0.9 GeV/fm, r at drop ≤ 0.18 |
| glueballs = Morningstar–Peardon (Wikipedia), none below the gap | ✅ | 0++ 1730, 2++ 2400, 0−+ 2590; gap top 1730 |
| colour neutral: bright pixels whiter at the drop | ✅ | brightest 2 % saturation build-up 0.735 → drop 0.584 (their level 62 → 100 /255; samples 106/107, frames under 40/255 skipped) |
| page keeps animating | ✅ | field yes · tube yes · glueball yes · lava yes · auto yes |
| fps at 1920×1080 | ✅ | field 60 (worst 16.8 ms) · tube 60 (worst 16.8 ms) · glueball 60 (worst 16.8 ms) · lava 60 (worst 16.8 ms) · auto 60 (worst 16.8 ms) |
| page errors | ✅ | none; caught 0/0/0/0/0 |
| modules declare ISF-style inputs | ✅ | field: gap, coupling, impulse · tube: width, stretch · glueball: glow · lava: speed |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 0.92 · p95 2.36 · p99 2.54 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 3.69 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 14.1 % at 1440,480 (t 30.82 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % at 1280,0 (t 31.1 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0948 (t 33.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.3947 at 1440,800 (t 33.07 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.1784 at 1280,480 (t 81.58 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.1 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1440,480 at t 30.82 s · 121 frames over 2.00 s · window mean L 0.01–0.17, 15 swings ≥ 0.02 (3.8 Hz) · flashing share > 25 % on 0 frames, peak 14 % · mean L every 3rd frame: 0.15 0.14 0.12 0.11 0.11 0.13 0.14 0.12 0.11 0.11 0.14 0.13 0.11 0.11 0.11 0.17 0.16 0.15 0.13 0.12 0.15 0.14 0.12 0.11 0.01 0.08 0.04 0.02 0.01 0.01 0.07 0.04 0.03 0.02 0.02 0.12 0.09 0.07 0.06 0.05 0.09 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
