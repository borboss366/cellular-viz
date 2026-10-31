# 11 Riemann show check · 2026-10-31-0953

Truth: LMFDB zeros (qa/data/lmfdb-zeta-zeros-1-40.txt) and a sieve here; the page's numbers are compared, not trusted.

| check | result | detail |
|---|---|---|
| zeros below 120 | ✅ | 38/38, worst error 4.8e-7, 0 extra |
| ribbon: |ζ| minima at the zeros | ✅ | 38 minima, missing 0, extra 0, largest |ζ| at a minimum 0.0358 |
| scope: Z crossings at the zeros | ✅ | 38 crossings, worst 1.6e-4, missing 0, extra 0 |
| primes: approxPi(x, all 38) vs π(x), x = 2.5…99.5 | ✅ | worst 0.436 (with 10 zeros: 0.61); steps 2…59 (17) |
| beat lock: camera on a zero at each downbeat | ✅ | 8 downbeats seen frame by frame: worst 1.4e-14 (tCam on the first frame after the downbeat, wound back by u·gap, vs LMFDB γ); every one of 961 frames vs the LMFDB warped clock: worst 1.4e-14; raw nearest frame 0.052 (one frame of camera travel); old ±0.015-bar window: worst 0.103 |
| no blank frames (screenshots, HUD hidden) | ✅ | ribbon 0/8 blank (lit ≥ 0.07, sd ≥ 15.4) · march 0/8 blank (lit ≥ 0.12, sd ≥ 25.5) · scope 0/8 blank (lit ≥ 0.08, sd ≥ 17.2) · primes 0/8 blank (lit ≥ 0.07, sd ≥ 16.2) · canyon 0/8 blank (lit ≥ 0.56, sd ≥ 51.2) · map 0/8 blank (lit ≥ 0.68, sd ≥ 51) · auto (1-bar sections) 0/24 blank (lit ≥ 0.07, sd ≥ 15.5) |
| auto switches through every scene | ✅ | order seen with bars=1: ribbon → march → scope → primes → canyon → map → ribbon → march → scope |
| page keeps animating (camera time moves) | ✅ | ribbon yes · march yes · scope yes · primes yes · canyon yes · map yes · auto yes |
| fps at 1920×1080 per scene | ✅ | ribbon 60 (worst 16.8 ms) · march 60 (worst 16.8 ms) · scope 60 (worst 16.8 ms) · primes 60 (worst 16.8 ms) · canyon 60 (worst 16.8 ms) · map 60 (worst 16.8 ms) · auto 60 (worst 16.8 ms) |
| page errors (thrown + caught in __qa.errors) | ✅ | thrown: none; caught: ribbon 0 · march 0 · scope 0 · primes 0 · canyon 0 · map 0 · auto 0 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU p95 ≤ 7 ms and p99 ≤ 9 ms (standard at 1440p) | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · p50 0.41 · p95 11.73 · p99 15.3 ms over 3599 frames · timer-elapsed (whole rAF callback) |
| perf class (#88 ray-march ruling) | ℹ️ | standard (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5376 frames in 90.0 s (59.7 fps, 0 skipped) · tap 7.48 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 1990 failing frames · worst 100.0 % at 1280,960 (t 61.93 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 1 failing frames · max 0.6073 (t 64.08 s) |
| 10° window mean L ≤ 0.80 | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 436 failing frames · max 0.9999 at 960,800 (t 64.1 s) |
| window mean rises ≤ 0.25 in 100 ms | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 321 failing frames · max 0.8309 at 960,960 (t 62.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ⚠️ | would fail; not gated (page from before #88, no __qa.forceDrop yet) · 340 failing frames · max 34.6 % · longest run over 5 %: 52 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 1280,960 at t 61.93 s · 121 frames over 2.00 s · window mean L 0.10–0.92, 23 swings ≥ 0.02 (5.8 Hz) · flashing share > 25 % on 121 frames, peak 100 % · mean L every 3rd frame: 0.24 0.12 0.23 0.49 0.48 0.46 0.47 0.38 0.33 0.44 0.42 0.17 0.17 0.41 0.37 0.47 0.45 0.23 0.19 0.31 0.26 0.12 0.22 0.80 0.89 0.92 0.88 0.71 0.52 0.40 0.31 0.33 0.60 0.57 0.63 0.47 0.25 0.28 0.28 0.18 0.20 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 10.04 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
