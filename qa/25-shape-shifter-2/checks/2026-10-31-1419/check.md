# 25 Shape Shifter II check · 2026-10-31-1419

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
| 5 sync (≤ 40 ms) | ✅ | kick 17.9 ms (n 60) · hat 17.7 ms (n 119) · snare 17.4 ms (n 30) · land 17.6 ms (n 5) · attach 17 ms (n 1) · thread -0.2 ms (n 1) |
| passes (?passes=1, report-only) | ℹ️ | solo: {"diag":{"0.75":{"avg":"s13/34/96 w14 hit23 fb0 cap0 out73 full23 sh6.7","worst":"16.7@10.85t s20/40/96 w21 hit39 fb0 cap0 out61 full39 sh5.7 · 16.3@10.87t s20/39/96 w21 hit40 fb0 cap0 out60 full40 sh5.7 · 14.4@10.91t s19/35/91 w19 hit45 fb0 cap0 out55 full45 sh5.9"}},"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1159","march":"6.25/10.58/12.57 n1159","blit":"0.12/0.14/0.14 n1159","worst":"16.7@10.85t 16.3@10.87t 14.4@10.91t"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.6 n1200","march":"4.09/5.51/6.06 n1200","blit":"0.1/0.11/0.12 n1200","worst":"6.3@16.97s 6.3@16.78s 6.3@16.91s"}, · blend: {"diag":{"0.75":{"avg":"s13/34/96 w14 hit23 fb0 cap0 out74 full23 sh6.9","worst":"16.0@10.73t s21/45/96 w21 hit36 fb0 cap0 out64 full36 sh6.4 · 15.8@10.76t s21/43/96 w21 hit36 fb0 cap0 out64 full36 sh6.1 · 14.0@10.88t s21/40/96 w21 hit41 fb0 cap0 out59 full41 sh5.7"}},"sweep":{"0.75":{"vp":"0,0,1920,1080","cpu":"0.2/0.4/0.5 n1200","march":"6.2/10.29/12.08 n1200","blit":"0.12/0.13/0.14 n1200","worst":"16.0@10.73t 15.8@10.76t 14.0@10.88t"},"0.5":{"vp":"0,0,1280,720","cpu":"0.2/0.4/0.5 n1200","march":"4.08/5.5/6.02 n1200","blit":"0.1/0.11/0.12 n1200","worst":"6.5@16.93s 6.3@16.95s 6.2@16.79s"},"0 |
| 60 fps | ✅ | |
| page alive | ✅ | |
| errors | ✅ | none |

| render | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K |
|---|---|---|---|---|
| default | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 |
| res=native | – | 16.8 / 0 | 16.7 / 0 | 3840×2160 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 12 ms and p99 ≤ 14 ms (scaled, solo at soloScale 0.75) | ✅ | p50 5.22 · p95 9.87 · p99 13.91 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | soloScale 0.75 · blendScale 0.5 → scaled |
| scales at or above the floors (soloScale ≥ 0.75, blendScale ≥ 0.5) | ✅ | soloScale 0.75 · blendScale 0.5 |
| scaled solo: 0 rAF frames > 20 ms | ✅ | 0 of 3599 frames > 20 ms |
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms at blendScale 0.5 (pair number) | ✅ | p50 4.11 · p95 5.77 · p99 6.55 ms over 3600 frames · rAF > 20 ms: 0 of 3599 |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 493 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5397 frames in 90.0 s (60.0 fps, 0 skipped) · tap 9.61 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | report-only (user's ruling 30 Oct: no visible flash on this page) · 212 failing frames · worst 66.1 % at 1280,0 (t 81.3 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % at 160,800 (t 46.28 s) |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1132 (t 6.58 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.4933 at 800,320 (t 6.58 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.2112 at 960,160 (t 65.35 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.3 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1280,0 at t 81.3 s · 121 frames over 2.00 s · window mean L 0.06–0.28, 9 swings ≥ 0.02 (2.3 Hz) · flashing share > 25 % on 66 frames, peak 66 % · mean L every 3rd frame: 0.11 0.12 0.14 0.19 0.14 0.19 0.17 0.09 0.06 0.06 0.10 0.13 0.18 0.19 0.17 0.21 0.16 0.11 0.12 0.14 0.13 0.16 0.27 0.23 0.16 0.16 0.17 0.17 0.17 0.15 0.14 0.13 0.12 0.12 0.12 0.11 0.10 0.10 0.09 0.09 0.08 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1704 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 18.18 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
