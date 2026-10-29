# 25 Shape Shifter II check · 2026-10-29-1445

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 5 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: 1–2 holes per dive, each passed once (trefoil linking 2), as planned | ✅ | 10 dives, 0 off · genus-3 dives skip one hole (allowed) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 19.683 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 148°/s, max 337°/s · up p99 248°/s, max 7805°/s · 210 frames > 180°/s<br>fwd peaks: 337° bar 84.308 (thread, phrase bar 4.31), 295° bar 43.317 (thread, phrase bar 3.32), 249° bar 11.325 (thread, phrase bar 3.32), 207° bar 59.358 (thread, phrase bar 3.36), 207° bar 91.358 (thread, phrase bar 3.36)<br>up peaks: 7805° bar 11.342 (thread, phrase bar 3.34), 7605° bar 59.375 (thread, phrase bar 3.37), 7418° bar 91.375 (thread, phrase bar 3.38), 957° bar 12.642 (thread, phrase bar 4.64), 602° bar 60.717 (thread, phrase bar 4.72) |
| 4c no empty picture longer than ¼ s (25-ray test) | ❌ | 1 stretches, longest 0.27 s at bar 11.125 (thread) |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 25.9 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 17.8 ms (n 60) · hat 17.7 ms (n 119) · snare 17.8 ms (n 30) · land 17.7 ms (n 5) · attach 17 ms (n 1) · thread -0.8 ms (n 1) |
| passes (?passes=1, report-only) | ℹ️ | solo: {"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1200","march":"11.43/13.44/19.09 n1200","blit":"0.14/0.17/0.18 n1200"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"11.3/12.12/12.67 n1200","blit":"0.16/0.18/0.18 n1200"},"0.25":{"vp":"0,0,640,360","cpu":"0.2/0.4/0.5 n1853","march":"3.7/4.91/5.31 n1852","blit":"0.16/0.17/0.17 n1852"}},"on":true,"render":[640,360],"canvas":[2560,1440],"cpuMs":{"n":3600,"p50":0.2,"p95":0.4,"p99":0.5},"marchMs":{"n":3600,"p50":5.07,"p95":12.11,"p99":14.55},"blitMs":{"n":3600,"p50":0.16,"p95":0.18,"p99":0.18}} · blend: {"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1200","march":"11.35/12.97/14.41 n1200","blit":"0.13/0.16/0.17 n1200"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"11.28/12.09/12.74 n1200","blit":"0.15/0.17/0.17 n1200"},"0.25":{"vp":"0,0,640,360","cpu":"0.2/0.4/0.5 n1853","march":"3.69/4.89/5.29 n1852","blit":"0.15/0.16/0.16 n1852"}},"on":true,"render":[640,360],"canvas":[2560,1440],"cpuMs":{"n":3600,"p50":0.2,"p95":0.4,"p99":0.5},"marchMs":{"n":3600,"p50":5.06,"p95":12.04,"p99":13.3},"blitMs":{"n":3600,"p50":0.15,"p95":0.16,"p99":0.17}} |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 |
| res=native | – | 16.8 / 0 | 16.8 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 11.49 · p95 13.64 · p99 15.78 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 10.13 · p95 12 · p99 12.57 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 1136 MHz of 2700 · <1000 MHz 57.2 % · 1000–1499 MHz 27 % · 1500–1999 MHz 5.9 % · 2000–2499 MHz 3.9 % · ≥2500 MHz 6.1 % · 493 samples · power_dpm_force_performance_level auto |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ⚠️ | level auto: ms rows measure the clock governor too (host not pinned yet) |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5397 frames in 90.0 s (60.0 fps, 0 skipped) · tap 14.19 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 297 failing frames · worst 97.3 % at 1920,320 (t 77.45 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 2.3 % at 1760,480 (t 64.15 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1435 (t 86.38 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5174 at 800,320 (t 6.37 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 2 failing frames · max 0.2603 at 1760,480 (t 76.68 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.4 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 5, 2, 1, 0, 0 % (idle ≤ 10 % for 5 s; waited 5 s) |
