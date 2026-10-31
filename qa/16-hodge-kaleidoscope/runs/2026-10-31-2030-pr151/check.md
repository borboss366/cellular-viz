# 16-hodge-kaleidoscope · experiment for #151 @cf683dc

| gate | result | detail |
|---|---|---|
| QA 1: numbers equal the spec's table (all presets, curve g = 0–6) | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 2: h^{p,q} = h^{q,p} and h^{p,q} = h^{n−p,n−q} | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 3: row sums = Betti numbers | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 4: rendered row glow (linear, L_k = 1) ∝ Betti within 1 % | ✅ | auto@1080p 0 · auto@4k 0 · hold2@1080p 0 · hold2@4k 0 · fastest@1080p 0 · fastest@4k 0 · trigger-kick@1080p 0 · trigger-kick@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 · k3@1080p 0 · k3@4k 0 · quintic@ |
| QA 5: Euler characteristic 2−2g / 24 / −200 / +200 | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 6: beats between morph starts = hold at 8, 4, 2, 1, ½ bars, ±1 frame | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 6: changes on the grid (downbeats for holds ≥ 1 bar, beats below) | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 6 live: auto holds on the real clock | ✅ | auto@1080p 0 · auto@4k 0 · fastest@1080p 0 · fastest@4k 0 |
| QA 7: morphs were logged | ✅ | auto@1080p 28 · auto@4k 28 · fastest@1080p 31 · fastest@4k 32 · trigger-kick@1080p 20 · trigger-kick@4k 20 |
| QA 7: each morph ≤ 40 ms from its beat (from 1 s after the clock starts; maxMsAll reported) | ✅ | auto@1080p 3.672 · auto@4k 9.536 · fastest@1080p 10.724 · fastest@4k 17.113 · trigger-kick@1080p 9.836 · trigger-kick@4k 23.941 |
| QA 8: morph = min(1 bar, hold/2) | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 9: trigger() starts the morph on the next beat | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 10: 32 changes, no back-to-back repeat, no two curves adjacent, dimension changes | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| QA 11: truths 1–5 on every settled preset | ✅ | auto@1080p true · auto@4k true · hold2@1080p true · hold2@4k true · fastest@1080p true · fastest@4k true · trigger-kick@1080p true · trigger-kick@4k true · k3-flat@1080p true · k3-flat@4k true · quintic-flat@1080p true · quintic-flat@4k true · curve3-flat@1080p true · curve3-flat |
| fps.p05 ≥ 55 | ✅ | auto@1080p 59.52 · auto@4k 59.88 · hold2@1080p 59.88 · hold2@4k 59.52 · fastest@1080p 59.52 · fastest@4k 59.88 · trigger-kick@1080p 59.52 · trigger-kick@4k 59.52 · k3-flat@1080p 59.88 · k3-flat@4k 59.88 · quintic-flat@1080p 59.88 · quintic-flat@4k 59.88 · curve3-flat@1080p 59.88  |
| longFrames ≤ 0.5 | ✅ | auto@1080p 0 · auto@4k 0 · hold2@1080p 0 · hold2@4k 0 · fastest@1080p 0 · fastest@4k 0 · trigger-kick@1080p 0 · trigger-kick@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 · k3@1080p 0 · k3@4k 0 · quintic@ |
| errors ≤ 0 | ✅ | auto@1080p 0 · auto@4k 0 · hold2@1080p 0 · hold2@4k 0 · fastest@1080p 0 · fastest@4k 0 · trigger-kick@1080p 0 · trigger-kick@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 · k3@1080p 0 · k3@4k 0 · quintic@ |
| gpuBusy ≤ 10 | ✅ | auto@1080p 0 · auto@4k 0 · hold2@1080p 2 · hold2@4k 0 · fastest@1080p 2 · fastest@4k 0 · trigger-kick@1080p 2 · trigger-kick@4k 0 · k3-flat@1080p 2 · k3-flat@4k 0 · quintic-flat@1080p 1 · quintic-flat@4k 0 · curve3-flat@1080p 1 · curve3-flat@4k 0 · k3@1080p 1 · k3@4k 0 · quintic@ |
| no white blobs: ≤ 1 % pixels clipped | ✅ | auto@1080p 0 · auto@4k 0 · hold2@1080p 0 · hold2@4k 0 · fastest@1080p 0 · fastest@4k 0 · trigger-kick@1080p 0 · trigger-kick@4k 0 · k3-flat@1080p 0 · k3-flat@4k 0 · quintic-flat@1080p 0 · quintic-flat@4k 0 · curve3-flat@1080p 0 · curve3-flat@4k 0 · k3@1080p 0 · k3@4k 0 · quintic@ |
| PR | ℹ️ | #151 @cf683dc |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ✅ | p50 1.64 · p95 1.93 · p99 1.96 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 4.1 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 1.2 % at 0,960 (t 42.35 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.1199 (t 20.6 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.1809 at 1920,800 (t 21.13 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0236 at 640,160 (t 14.27 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 0,960 at t 42.35 s · 121 frames over 2.00 s · window mean L 0.09–0.12, 1 swings ≥ 0.02 (0.3 Hz) · flashing share > 25 % on 0 frames, peak 1 % · mean L every 3rd frame: 0.10 0.10 0.11 0.11 0.11 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.12 0.11 0.11 0.11 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 0.10 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 9.93 · max 20.3 ms · audio-in clock |
| clock booking under long frames (__qa.clockLate, #148, report-only) | ℹ️ | late 0 · max frame gap 22.4 ms · look-ahead 100 ms |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0 % (idle ≤ 10 % for 3 s; waited 3 s) |
| GPU: wait, tail, requeues (#144) | ℹ️ | waited 3 s before start, tail 1 ms, requeues 0 |
