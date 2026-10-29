# 10 BSD check · 2026-10-29-1009

Independent recomputation in Node (BigInt fractions, brute-force counts); the page's own flags are only compared, not trusted.

| check | result | detail |
|---|---|---|
| points exactly on y² = x³+17 | ✅ | 25 distinct points over 150 s, 302 hops, x up to 2439 digits, 0 off the curve |
| page's onCurve flags agree | ✅ | 0 disagreements |
| counts = brute force, first 50 primes | ✅ | 50/50 (primes 5…241) |
| Hasse \|a_p\| ≤ 2√p | ✅ | all 77 primes shown (up to 409) |
| y² = x³ − x over F₇₁ has 72 points | ✅ | page 72, page fn 72, ours 72 |
| integral points of x³+17 in [−2, 5234] | ✅ | page [-2, -1, 2, 4, 8, 43, 52, 5234], ours [-2, -1, 2, 4, 8, 43, 52, 5234] |
| fps at 1920×1080, pmax 5000 | ✅ | 59.8 fps, frame p50 16.7 ms, p99 16.8 ms, worst 50 ms (canvas 1920×1080) |
| page errors | ✅ | none |


## shared gates (qa/check-shared.mjs)

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
| timer query bits | ℹ️ | extension not available |
| flash capture | ✅ | 5371 frames in 90.0 s (59.7 fps, 0 skipped) · tap 9.87 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 9.4 % at 160,480 (t 6.23 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.2305 (t 0.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.2506 at 160,480 (t 84.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.2422 at 160,320 (t 0.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.1 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 10, 4, 2, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
