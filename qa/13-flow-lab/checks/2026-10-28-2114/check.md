# 13 Flow Lab check · 2026-10-28-2114

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.92 % (worst 1.44 %, 46 it) · fixed 40 1.02 % · 120 0.33 % · plume: 1.85 % (worst 2.87 %, 46 it) · fixed 40 2.65 % · 120 0.52 % · ink: 3.28 % (worst 6.44 %, 46 it) · fixed 40 4.46 % · 120 2.14 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 28.12 % (worst 35.90 %, 70 it): far 54.93 %, obstacle 3.30 %, edge 495.20 % · fixed 120: far 20.68 %, obstacle 1.12 %, edge 194.91 % · rocks: all 58.79 % (worst 62.03 %, 46 it): far 22.27 %, obstacle 69.48 %, edge 7.97 % · fixed 120: far 8.01 %, obstacle 68.46 %, edge 7.83 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.41 % in 21 s (-0.20 %/10 s, page log -0.67 %) · kh: -0.62 % in 21 s (-0.30 %/10 s, page log -0.65 %) · ink: -0.22 % in 21 s (-0.11 %/10 s, page log -0.31 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.01 % in 21 s (-0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2273 · 90 BPM: 0.757 Hz real (Fourier 0.755), St 0.1995 (sim 0.1995), amp 150.52 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.05 · 150 BPM: 1.244 Hz real (Fourier 1.225), St 0.1968 (sim 0.1968), amp 137.9 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.75 (Fourier 0.75), wake amp 158 · 120 BPM: want 1.000, got 0.982 (Fourier 0.98), wake amp 149.19 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 138.54 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.5 ms (n 60) · hat 8.5 ms (n 119) · snare 8.5 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 25 / 32 | 10.4 | 0.827 |
| kh | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 20 / 16 | 12.6 | 1 |
| plume | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 20 / 16 | 11.8 | 1 |
| ink | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 36 / 20 | 13.5 | 1 |
| rocks | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 16 / 16 | 11.7 | 1 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 3.8 | 1.002 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU time measured | ⚠️ | method: page uses the timer itself; 0 frames timed · page's own gpuMs 10.5 ms (EMA, not a gate) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5387 frames in 90.0 s (59.9 fps, 0 skipped) · tap 15.1 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % at 0,480 (t 58.75 s) |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0008 (t 86.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.0068 at 320,480 (t 12.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0035 at 320,480 (t 12.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 0, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
