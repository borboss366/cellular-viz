# 25 Shape Shifter II check · 2026-10-30-1039

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 5 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: 1–2 holes per dive, each passed once (trefoil linking 2), as planned | ✅ | 10 dives, 0 off · genus-3 dives skip one hole (allowed) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 20.85 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 132°/s, max 211°/s · up p99 108°/s, max 303°/s · 21 frames > 180°/s<br>fwd peaks: 211° bar 43.308 (thread, phrase bar 3.31), 176° bar 11.317 (thread, phrase bar 3.32), 144° bar 59.35 (thread, phrase bar 3.35), 144° bar 36.842 (thread, phrase bar 4.84), 143° bar 91.35 (thread, phrase bar 3.35)<br>up peaks: 303° bar 12.575 (thread, phrase bar 4.57), 201° bar 84.942 (thread, phrase bar 4.94), 176° bar 11.317 (thread, phrase bar 3.32), 165° bar 76.7 (thread, phrase bar 4.7), 144° bar 59.35 (thread, phrase bar 3.35) |
| 4c no empty picture longer than ¼ s (25-ray test) | ✅ | 0 stretches |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 27.1 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 18.1 ms (n 60) · hat 18 ms (n 119) · snare 18.1 ms (n 30) · land 17.7 ms (n 5) · attach 17.3 ms (n 1) · thread -0.3 ms (n 1) |
| passes (?passes=1, report-only) | ℹ️ | solo: {"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1200","march":"7.42/13.04/18.89 n1200","blit":"0.12/0.13/0.14 n1200","worst":"20.0@10.80t 20.0@10.96t 20.0@10.93t"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"4.87/6.45/6.84 n1200","blit":"0.1/0.11/0.11 n1200","worst":"7.5@16.93s 7.4@16.75s 7.2@16.70s"},"0.25":{"vp":"0,0,640,360","cpu":"0.2/0.4/0.5 n1854","march":"1.66/2.32/2.62 n1853","blit":"0.09/0.1/0.1 n1853","worst":"2.9@26.84t 2.8@26.83t 2.8@26.83t"}},"on":true,"render":[640,360],"canvas":[2560,1440],"cpuMs":{"n":3600,"p50":0.2,"p95":0.4,"p99":0.5},"marchMs":{" · blend: {"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1200","march":"7.35/15.53/20.04 n1200","blit":"0.12/0.14/0.14 n1200","worst":"20.6@10.84t 20.6@10.86t 20.6@10.88t"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"4.89/6.44/6.85 n1200","blit":"0.11/0.12/0.12 n1200","worst":"7.2@16.93s 7.1@21.07t 7.0@16.80s"},"0.25":{"vp":"0,0,640,360","cpu":"0.2/0.3/0.4 n1853","march":"1.65/2.25/2.56 n1852","blit":"0.1/0.1/0.11 n1852","worst":"2.7@26.83t 2.7@34.76t 2.7@34.81t"}},"on":true,"render":[640,360],"canvas":[2560,1440],"cpuMs":{"n":3600,"p50":0.2,"p95":0.4,"p99":0.5},"marchMs":{ |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 |
| res=native | – | 16.8 / 0 | 16.7 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ❌ | p50 6.24 · p95 11.59 · p99 14.71 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ✅ | p50 4.79 · p95 6.76 · p99 7.67 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.8 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 493 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5383 frames in 90.0 s (59.8 fps, 0 skipped) · tap 11.04 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ❌ | 186 failing frames · worst 69.8 % at 1280,0 (t 81.3 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.1 % at 800,640 (t 45.5 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.112 (t 6.58 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.4949 at 800,320 (t 6.58 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.1855 at 0,960 (t 50.86 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.4 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: page from before #88 that has __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 3, 1, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
