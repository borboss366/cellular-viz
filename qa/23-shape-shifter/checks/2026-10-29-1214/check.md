# 23 Shape Shifter check · 2026-10-29-1214

Everything below is rebuilt from `__qa.sdf` with my own grid code.

| gate | result | detail |
|---|---|---|
| 1 genus constant except at the drop (my b0 + b2 − χ, n = 96, h = 0.0333) | ✅ | 62 moments; 0 wrong away from the drops · switches: 1→0 between bars 13.875 and 14, 0→1 between bars 30 and 30.125 · thinnest feature 0.022 vs h 0.0333 |
| 2 Gauss–Bonnet ∣∫K − 4π(1 − g)∣ ≤ 0.05·∫∣K∣ on resolved frames (minFeature ≥ 2h), never the wrong genus; n = 160, bumpAmp=0 | ⚠️ | bar 3 (g 1): mine 0.491·4π, page 0.050·4π, ∫∣K∣ 4.04·4π, want 0, minFeature/h 1.83 → unresolved · bar 9 (g 1): mine 0.079·4π, page 0.005·4π, ∫∣K∣ 4.91·4π, want 0, minFeature/h 3.50 → ok · bar 18 (g 0): mine 1.002·4π, page 0.994·4π, ∫∣K∣ 1.98·4π, want 1, minFeature/h 3.12 → ok · bar 24 (g 0): mine 0.999·4π, page 1.000·4π, ∫∣K∣ 1.00·4π, want 1, minFeature/h none thin → ok |
| 3 camera never inside (sdf at the eye, every 1/64 bar) | ✅ | min sdf 0.088 at bar 13.781 (fly) · 64 fly samples, 5 pushed out |
| 4 surgery event on the drop | ✅ | morph bar 8, fly bar 13, surgery bar 14, morph bar 16 |
| 5 sync from __qa.events (≤ 40 ms) | ✅ | kick 18.2 ms (n 72) · hat 18.1 ms (n 143) · snare 18.1 ms (n 36) · morph 19 ms (n 2) · fly 18.9 ms (n 1) · surgery 19.1 ms (n 1) |
| 60 fps 1080p/1440p/4K | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| family | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| 0 | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
| 1 | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
| auto | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ✅ | p50 8.6 · p95 10.71 · p99 12.62 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 3.98 · p95 6.18 · p99 10.16 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5396 frames in 90.0 s (60.0 fps, 0 skipped) · tap 11.26 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 135 failing frames · worst 57.2 % at 640,320 (t 17.05 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1386 (t 16.92 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.4175 at 0,0 (t 16.9 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 2 failing frames · max 0.2616 at 800,480 (t 18.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.1 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
