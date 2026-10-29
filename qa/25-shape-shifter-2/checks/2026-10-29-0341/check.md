# 25 Shape Shifter II check · 2026-10-29-0341

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
| 5 sync (≤ 40 ms) | ✅ | kick 8.3 ms (n 60) · hat 8.3 ms (n 119) · snare 8.1 ms (n 30) · land 8 ms (n 5) · attach 8.8 ms (n 1) · thread 7.9 ms (n 1) |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 1920×1080 |
| res=native | – | 16.7 / 0 | 16.8 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at 1440p | ❌ | p50 11.4 · p95 14.29 · p99 19.31 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| canvas 2560×1440 at dpr 1 | ⚠️ | 1920×1080 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5389 frames in 90.0 s (59.9 fps, 0 skipped) · tap 14.06 ms/frame · scene canvas 1920×1080 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ❌ | 446 failing frames · worst 65.1 % at 1920,0 (t 50.23 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 1.9 % at 1760,480 (t 53.01 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1588 (t 6.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.6481 at 1920,160 (t 81.23 s) |
| window mean rises ≤ 0.25 in 100 ms | ❌ | 32 failing frames · max 0.4758 at 1920,160 (t 81.23 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 2.3 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: page from before #88 that has __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 8, 3, 1, 0, 0 % (idle ≤ 10 % for 5 s; waited 5 s) |
