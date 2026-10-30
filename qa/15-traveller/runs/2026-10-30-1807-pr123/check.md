# 15-traveller · experiment for #123 @70fa722

| gate | result | detail |
|---|---|---|
| QA 3: the tour is a Hamiltonian cycle | ✅ | settled@1080p true · settled@4k true · build@1080p true · build@4k true · ants@1080p true · ants@4k true · small-verify@1080p true · small-verify@4k true · big@1080p true · big@4k true · hot@1080p true · hot@4k true |
| QA 1: with heat 0 no move raises the length | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 0 · build@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 · hot@1080p 0 · hot@4k 0 |
| QA 2: a settled 2-opt tour has no crossings | ✅ | settled@1080p 0 · settled@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 |
| QA 2b: after a snap the tour is crossing-free within 4 bars | ✅ | settled@1080p true · settled@4k true · big@1080p true · big@4k true |
| heat 0: no uphill moves | ✅ | settled@1080p 0 · settled@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 |
| heat 1: uphill moves accepted (knob metric > 0) | ✅ | hot@1080p 0.022 · hot@4k 0.022 |
| QA 4: (n-1)!/2 = 181440 at 10, 60822550204416000 at 20 | ✅ | settled@1080p true · settled@4k true · build@1080p true · build@4k true · ants@1080p true · ants@4k true · small-verify@1080p true · small-verify@4k true · big@1080p true · big@4k true · hot@1080p true · hot@4k true |
| QA 5: an edge no ant used decays by exactly (1-rho) | ✅ | ants@1080p 0 · ants@4k 0 |
| QA 5: ant iterations ran (one per beat) | ✅ | ants@1080p 58 · ants@4k 58 |
| QA 6: Held-Karp = brute force (n 5-9, in the page) | ✅ | settled@1080p true · settled@4k true · build@1080p true · build@4k true · ants@1080p true · ants@4k true · small-verify@1080p true · small-verify@4k true · big@1080p true · big@4k true · hot@1080p true · hot@4k true |
| cities macro 0 = 8 (Held-Karp range) | ✅ | small-verify@1080p 8 · small-verify@4k 8 |
| fps.p05 ≥ 55 | ✅ | settled@1080p 59.52 · settled@4k 59.88 · build@1080p 59.88 · build@4k 59.88 · ants@1080p 59.52 · ants@4k 59.88 · small-verify@1080p 59.88 · small-verify@4k 59.88 · big@1080p 59.88 · big@4k 59.52 · hot@1080p 59.52 · hot@4k 59.52 |
| longFrames ≤ 0.5 | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 0 · build@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 · hot@1080p 0 · hot@4k 0 |
| errors ≤ 0 | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 0 · build@4k 0 · ants@1080p 0 · ants@4k 0 · small-verify@1080p 0 · small-verify@4k 0 · big@1080p 0 · big@4k 0 · hot@1080p 0 · hot@4k 0 |
| gpuBusy ≤ 10 | ✅ | settled@1080p 0 · settled@4k 0 · build@1080p 3 · build@4k 0 · ants@1080p 2 · ants@4k 0 · small-verify@1080p 2 · small-verify@4k 0 · big@1080p 4 · big@4k 0 · hot@1080p 3 · hot@4k 0 |
| thin line (VIZ research ruling on #123): worst frame <= 5 % clipped | ✅ | settled@1080p 0.392 · settled@4k 0.506 · build@1080p 0.391 · build@4k 0.514 · ants@1080p 0.383 · ants@4k 0.499 · small-verify@1080p 0.157 · small-verify@4k 0.213 · big@1080p 0.974 · big@4k 1.276 · hot@1080p 0.392 · hot@4k 0.513 |
| thin line (VIZ research ruling on #123): mean <= 3 % clipped | ✅ | settled@1080p 0.349 · settled@4k 0.468 · build@1080p 0.348 · build@4k 0.468 · ants@1080p 0.341 · ants@4k 0.454 · small-verify@1080p 0.151 · small-verify@4k 0.205 · big@1080p 0.855 · big@4k 1.093 · hot@1080p 0.349 · hot@4k 0.466 |
| PR | ℹ️ | #123 @70fa722 |
| GPU | ℹ️ | /dev/dri/renderD128 (ANGLE gl-egl) |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU time measured | ⚠️ | method: none (no WebGL2 canvas); 0 frames timed |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ⚠️ | none · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ✅ | __qa.forceDrop() at 20 s |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | extension not available |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 4.66 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.8 % at 1120,0 (t 4.7 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0078 (t 88.5 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.0381 at 1440,320 (t 27.02 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0124 at 1440,160 (t 27.02 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1120,0 at t 4.7 s · 121 frames over 2.00 s · window mean L 0.00–0.01, 0 swings ≥ 0.02 (0.0 Hz) · flashing share > 25 % on 0 frames, peak 1 % · mean L every 3rd frame: 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.00 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.00 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.01 0.00 0.01 |
| drops during the flash clip | ℹ️ | __qa.forceDrop(), __qa.forceDrop() |
| #88 gating for this page | ℹ️ | gated: new scene |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
