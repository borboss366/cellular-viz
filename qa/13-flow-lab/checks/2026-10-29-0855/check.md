# 13 Flow Lab check · 2026-10-29-0855

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.07 % (worst 1.59 %, 46 it) · fixed 40 0.95 % · 120 0.32 % · plume: 1.65 % (worst 2.43 %, 46 it) · fixed 40 2.46 % · 120 0.45 % · ink: 3.67 % (worst 8.65 %, 46 it) · fixed 40 4.46 % · 120 2.19 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 23.47 % (worst 31.88 %, 70 it): far 44.72 %, obstacle 2.87 %, edge 315.57 % · fixed 120: far 20.32 %, obstacle 1.12 %, edge 154.55 % · rocks: all 58.10 % (worst 59.79 %, 46 it): far 19.74 %, obstacle 69.04 %, edge 13.70 % · fixed 120: far 8.51 %, obstacle 68.26 %, edge 6.43 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.27 % in 21 s (-0.13 %/10 s, page log -0.04 %) · kh: -0.61 % in 21 s (-0.29 %/10 s, page log -0.63 %) · ink: -0.09 % in 21 s (-0.04 %/10 s, page log -0.29 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.59 %) · plume+conserve: 0.00 % in 21 s (0.00 %/10 s, page log 0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.35 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.08 · 150 BPM: 1.242 Hz real (Fourier 1.24), St 0.1964 (sim 0.1964), amp 150.55 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.749 (Fourier 0.75), wake amp 155.28 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.63 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.36 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.5 ms (n 60) · hat 8.5 ms (n 119) · snare 8.6 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 11.6 | 0.829 |
| kh | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| plume | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| ink | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.2 | 1 |
| rocks | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.4 | 1 |
| curl | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |


## shared gates (qa/check-shared.mjs)

- ANGLE (AMD, AMD Radeon Graphics (gfx1103_r1 LLVM 15.0.6 DRM 3.64 7.0.0-31-generic), OpenGL ES 3.2) · Chromium 156.0.8078.4
- 2560×1440, dpr 1, headless (rAF on Chromium's 60 Hz clock) · GPU: warm-up 120 s, measured 60 s · flash: 90 s with limiter=off

| gate | result | detail |
|---|---|---|
| GPU time measured | ⚠️ | method: page uses the timer itself; 0 frames timed · page's own gpuMs 11.5 ms (EMA, not a gate) |
| perf class (#88 ray-march ruling) | ℹ️ | soloOnly (no __qa.scales declared) |
| canvas 2560×1440 at dpr 1 | ✅ | 2560×1440 · dpr 1 |
| rAF interval (solo, headless 60 Hz clock) | ℹ️ | p50 16.7 · p95 16.7 · p99 16.8 ms · 0 of 3599 > 17.5 ms (0 %) · 60 fps |
| __qa.forceDrop() puts a drop inside the measured 60 s | ⚠️ | hook missing (page from before #88) |
| pair gate (50/50 with the heaviest scene) | ℹ️ | waits for the #85 host: two modules in one context |
| timer query bits | ℹ️ | TIMESTAMP 0 · TIME_ELAPSED 64 |
| flash capture | ✅ | 5401 frames in 90.0 s (60.0 fps, 0 skipped) · tap 13.83 ms/frame · scene canvas 2560×1440 → 640×360 linear · window 160×120 (640×480 at 1440p, fov 40°) · 91 windows |
| general flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| red flash: ≥ 4 flashes/s on ≤ 25 % of any 10° window | ✅ | 0 failing frames · worst 0.0 % |
| frame mean L ≤ 0.60 | ✅ | 0 failing frames · max 0.0008 (t 0.08 s) |
| 10° window mean L ≤ 0.80 | ✅ | 0 failing frames · max 0.0064 at 320,480 (t 30.08 s) |
| window mean rises ≤ 0.25 in 100 ms | ✅ | 0 failing frames · max 0.0034 at 320,480 (t 30.08 s) |
| L ≥ 0.9 on ≤ 5 % of the frame, or ≤ 3 frames in a row | ✅ | 0 failing frames · max 0.0 % · longest run over 5 %: 0 frames |
| drops during the flash clip | ℹ️ | no drop hook: the page ran its own show |
| #88 gating for this page | ℹ️ | report-only: page from before #88 without __qa.forceDrop |
| page errors | ✅ | none |
| GPU busy before the run | ℹ️ | 1, 0, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
