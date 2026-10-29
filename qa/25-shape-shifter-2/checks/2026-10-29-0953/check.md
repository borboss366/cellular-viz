# 25 Shape Shifter II check · 2026-10-29-0953

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 6 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: 1–2 holes per dive, each passed once (trefoil linking 2), as planned | ✅ | 10 dives, 0 off · genus-3 dives skip one hole (allowed) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 68.258 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 148°/s, max 295°/s · up p99 245°/s, max 7805°/s · 209 frames > 180°/s<br>fwd peaks: 295° bar 43.317 (thread, phrase bar 3.32), 249° bar 11.325 (thread, phrase bar 3.32), 247° bar 84.308 (thread, phrase bar 4.31), 207° bar 59.358 (thread, phrase bar 3.36), 207° bar 91.358 (thread, phrase bar 3.36)<br>up peaks: 7805° bar 11.342 (thread, phrase bar 3.34), 7605° bar 59.375 (thread, phrase bar 3.37), 7418° bar 91.375 (thread, phrase bar 3.38), 957° bar 12.642 (thread, phrase bar 4.64), 602° bar 60.717 (thread, phrase bar 4.72) |
| 4c no empty picture longer than ¼ s (25-ray test) | ✅ | 0 stretches |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 25.8 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 17.9 ms (n 60) · hat 17.8 ms (n 119) · snare 17.9 ms (n 30) · land 17.9 ms (n 5) · attach 16.9 ms (n 1) · thread -0.8 ms (n 1) |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 1920×1080 |
| res=native | – | 16.8 / 0 | 16.7 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 11.45 · p95 13.53 · p99 15.57 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 9.95 · p95 12.12 · p99 13.1 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ⚠️ | 1920×1080 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5398 frames in 90.0 s (60.0 fps, 0 skipped) · tap 14.09 ms/frame · scene canvas 1920×1080 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 776 failing frames · worst 91.1 % at 1760,0 (t 77.45 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 2.0 % at 1920,640 (t 64.08 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1862 (t 86.06 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5967 at 800,320 (t 6.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 35 failing frames · max 0.4354 at 640,480 (t 86.06 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.5 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 2, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
