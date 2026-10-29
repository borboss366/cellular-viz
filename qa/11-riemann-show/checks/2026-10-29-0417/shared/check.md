# Shared gates (#88) · 11-riemann-show.html · 2026-10-29-0417

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at 1440p | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 0.48 · p95 11.99 · p99 15.09 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5373 frames in 90.0 s (59.7 fps, 0 skipped) · tap 9.22 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 1989 failing frames · worst 100.0 % at 1280,960 (t 61.98 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 1 failing frames · max 0.6072 (t 64.08 s) |
| 10° window mean L ≤ 0.80 | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 435 failing frames · max 0.9999 at 960,800 (t 64.1 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 318 failing frames · max 0.8309 at 960,960 (t 62.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 341 failing frames · max 34.6 % · longest run over 5 %: 52 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
