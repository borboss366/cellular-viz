# 13 Flow Lab check · 2026-10-31-1928

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.85 % (worst 1.00 %, 52 it) · fixed 40 1.02 % · 120 0.30 % · plume: 1.36 % (worst 2.72 %, 52 it) · fixed 40 2.39 % · 120 0.46 % · ink: 3.61 % (worst 6.88 %, 52 it) · fixed 40 4.58 % · 120 1.00 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 14.34 % (worst 27.84 %, 82 it): far 26.72 %, obstacle 1.93 %, edge 150.26 % · fixed 120: far 18.61 %, obstacle 1.09 %, edge 124.46 % · rocks: all 59.67 % (worst 62.34 %, 52 it): far 21.98 %, obstacle 71.74 %, edge 15.87 % · fixed 120: far 11.28 %, obstacle 68.99 %, edge 7.66 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.70 % in 21 s (-0.34 %/10 s, page log -0.69 %) · kh: -0.66 % in 21 s (-0.32 %/10 s, page log -0.69 %) · ink: -0.09 % in 21 s (-0.04 %/10 s, page log -0.18 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.00 % in 21 s (-0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2108 · 90 BPM: 0.761 Hz real (Fourier 0.76), St 0.2006 (sim 0.2006), amp 152.15 · 120 BPM: 1.007 Hz real (Fourier 1.005), St 0.199 (sim 0.199), amp 150.97 · 150 BPM: 1.252 Hz real (Fourier 1.255), St 0.198 (sim 0.198), amp 151.1 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.75 (Fourier 0.75), wake amp 155.52 · 120 BPM: want 1.000, got 1.005 (Fourier 1.005), wake amp 155.98 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.48 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.4 ms (n 60) · hat 8.4 ms (n 119) · snare 8.5 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 82 / 76 | 11.3 | 0.829 |
| kh | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.2 | 1 |
| plume | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11 | 1 |
| ink | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 52 | 10.1 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 40 | 10.8 | 1 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.6 | 1 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU time measured | ⚠️ | method: page uses the timer itself; 0 frames timed · page's own gpuMs 11.1 ms (EMA, not a gate) |
| perf class (#88 ray-march ruling) | ℹ️ | soloOnly (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| GPU clock during the measured windows (report-only) | ℹ️ | mean 2700 MHz of 2700 · ≥2500 MHz 100 % · 240 samples · power_dpm_force_performance_level high |
| GPU ms measured at a pinned clock (≥ 90 % of top) | ✅ | mean 2700 of 2700 MHz |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 13.64 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % at 0,480 (t 22.88 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0008 (t 8.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.0064 at 320,480 (t 40.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0034 at 320,480 (t 8.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| worst flash window trace ±1 s (report-only) | ℹ️ | 0,480 at t 22.88 s · 121 frames over 2.00 s · window mean L 0.00–0.00, 0 swings ≥ 0.02 (0.0 Hz) · flashing share > 25 % on 0 frames, peak 0 % · mean L every 3rd frame: 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 0.00 |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| beat match: every clock hit drawn in the first frame that reaches it (__qa.beatLog) | ✅ | lanes kick,snare,hat · 1262 clock hits since Play · missing 0 · twice 0 · early 0 · late 0 · lag p50 10.52 · max 20.3 ms · audio-in clock |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0 % (idle ≤ 10 % for 3 s; waited 3 s) |
| GPU: wait, tail, requeues (#144) | ℹ️ | waited 3 s before start, tail 1 ms, requeues 0 |
