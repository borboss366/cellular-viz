# 23 Shape Shifter check · 2026-10-29-0315

Everything below is rebuilt from `__qa.sdf` with my own grid code.

| gate | result | detail |
|---|---|---|
| 1 genus constant except at the drop (my b0 + b2 − χ, n = 96, h = 0.0333) | ✅ | 62 moments; 0 wrong away from the drops · switches: 1→0 between bars 13.875 and 14, 0→1 between bars 30 and 30.125 · thinnest feature 0.022 vs h 0.0333 |
| 2 Gauss–Bonnet ∫K dA = 4π(1 − g), n = 160 (mine, ±5 %) | ❌ | bar 3 (g 1): mine 2.232·4π, page 0.235·4π, want 0 · bar 9 (g 1): mine 2.062·4π, page 0.214·4π, want 0 · bar 18 (g 0): mine 3.180·4π, page 1.514·4π, want 1 · bar 24 (g 0): mine 3.185·4π, page 1.386·4π, want 1 |
| 3 camera never inside (sdf at the eye, every 1/64 bar) | ✅ | min sdf 0.088 at bar 13.781 (fly) · 64 fly samples, 5 pushed out |
| 4 surgery event on the drop | ✅ | morph bar 8, fly bar 13, surgery bar 14, morph bar 16 |
| 5 sync from __qa.events (≤ 40 ms) | ✅ | kick 17.4 ms (n 72) · hat 17.4 ms (n 143) · snare 17.4 ms (n 36) · morph 18.3 ms (n 2) · fly 17.7 ms (n 1) · surgery 18.9 ms (n 1) |
| 60 fps 1080p/1440p/4K | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| family | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| 0 | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 1920×1080 |
| 1 | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| auto | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |


## shared gates (qa/check-shared.mjs)

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
| GPU busy before the run | ℹ️ | 2, 1, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
