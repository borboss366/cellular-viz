# 25 Shape Shifter II check · 2026-10-31-2022

Genus, crossings, clearance and turn rate rebuilt from the page's SDF and camera with my own code.

| gate | result | detail |
|---|---|---|
| 1 every keyframe has its listed genus (my b0 + b2 − χ, n = 192) | ✅ | 35 keyframes, 0 wrong |
| 2 live genus = expected every ⅛ bar (n = 128, 96 bars; flagged moments re-counted at 192 and 256) | ✅ | 768 moments, 5 flagged at n = 128 but right on a finer grid, 0 wrong |
| 3 slalom: 1–2 holes per dive, each passed once (trefoil linking 2), as planned | ✅ | 10 dives, 0 off · genus-3 dives skip one hole (allowed) |
| 4a camera ≥ 0.05 from the surface, every frame | ✅ | min 0.080 at bar 20.85 (thread), 11519 frames |
| 4b view turn rate p99 ≤ 180°/s | ✅ | fwd p99 142°/s, max 274°/s · up p99 115°/s, max 240°/s · 64 frames > 180°/s<br>fwd peaks: 274° bar 43.325 (thread, phrase bar 3.32), 240° bar 11.325 (thread, phrase bar 3.32), 202° bar 59.358 (thread, phrase bar 3.36), 202° bar 91.358 (thread, phrase bar 3.36), 149° bar 20.992 (thread, phrase bar 4.99)<br>up peaks: 240° bar 11.325 (thread, phrase bar 3.32), 202° bar 59.358 (thread, phrase bar 3.36), 202° bar 91.358 (thread, phrase bar 3.36), 201° bar 84.958 (thread, phrase bar 4.96), 127° bar 43.317 (thread, phrase bar 3.32) |
| 4c no empty picture longer than ¼ s (25-ray test) | ✅ | 0 stretches |
| 4d framing: shape fills ≥ 25 % on average, ≥ 8 % in 90 % of frames | ✅ | mean 27.2 %, 10th percentile 12 % |
| 5 sync (≤ 40 ms) | ✅ | kick 18.1 ms (n 60) · hat 17.9 ms (n 119) · snare 18.2 ms (n 30) · land 17.4 ms (n 5) · attach 17.1 ms (n 1) · thread -1.2 ms (n 1) |
| passes (?passes=1, report-only) | ℹ️ | solo: {"diag":{"0.75":{"avg":"s13/34/96 w14 hit23 fb0 cap0 out73 full23 sh6.7","worst":"16.0@10.86t s20/40/96 w21 hit39 fb0 cap0 out61 full39 sh5.7 · 15.8@10.93t s18/34/89 w19 hit46 fb0 cap0 out54 full46 sh6.2 · 15.6@10.75t s20/41/96 w21 hit36 fb0 cap0 out63 full36 sh6.0"}},"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.6 n1161","march":"6.24/10.48/12.45 n1161","blit":"0.12/0.13/0.14 n1161","worst":"16.0@10.86t 15.8@10.93t 15.6@10.75t"},"0.5":{"vp":"0,0,1280,720","cpu":"0.3/0.5/0.6 n1200","march":"4.11/5.51/6.01 n1200","blit":"0.1/0.11/0.12 n1200","worst":"6.4@16.77s 6.3@16.92s 6.3@16.71s"}, · blend: {"diag":{"0.75":{"avg":"s13/34/96 w14 hit23 fb0 cap0 out74 full23 sh6.9","worst":"16.6@10.78t s21/45/96 w22 hit36 fb0 cap0 out64 full36 sh6.2 · 16.5@10.89t s20/38/95 w21 hit43 fb0 cap0 out57 full43 sh5.6 · 13.5@10.90t s19/35/94 w20 hit44 fb0 cap0 out56 full44 sh5.7"}},"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.6 n1200","march":"6.19/10.48/12.41 n1200","blit":"0.12/0.13/0.14 n1200","worst":"16.6@10.78t 16.5@10.89t 13.5@10.90t"},"0.5":{"vp":"0,0,1280,720","cpu":"0.3/0.5/0.7 n1200","march":"4.1/5.52/6 n1200","blit":"0.1/0.11/0.12 n1200","worst":"6.5@16.77s 6.5@16.93s 6.3@16.78s"},"0.2 |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 |
| res=native | – | 16.8 / 0 | 16.7 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ✅ | p50 5.24 · p95 9.93 · p99 13.93 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ✅ | p50 4.1 · p95 5.75 · p99 6.59 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 493 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5396 frames in 90.0 s (60.0 fps, 0 skipped) · tap 9.57 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | report-only (user's ruling 30 Oct: no visible flash on this page) · 201 failing frames · worst 66.0 % at 1280,0 (t 81.3 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % at 160,800 (t 46.28 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1147 (t 6.57 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.5055 at 800,320 (t 6.57 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.2112 at 960,160 (t 65.35 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.3 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1280,0 at t 81.3 s · 121 frames over 2.00 s · window mean L 0.06–0.28, 9 swings ≥ 0.02 (2.3 Hz) · flashing share > 25 % on 65 frames, peak 66 % · mean L every 3rd frame: 0.11 0.12 0.14 0.19 0.14 0.19 0.17 0.09 0.06 0.06 0.10 0.13 0.18 0.19 0.17 0.21 0.16 0.11 0.12 0.14 0.13 0.16 0.27 0.23 0.16 0.16 0.17 0.17 0.17 0.15 0.14 0.13 0.12 0.12 0.12 0.11 0.10 0.10 0.09 0.09 0.08 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1704 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 18.23 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0 % (idle ≤ 10 % for 3 s; waited 3 s) |
| GPU: wait, tail, requeues (#144) | ℹ️ | waited 3 s before start, tail 1 ms, requeues 0 |
