# 13 Flow Lab check · 2026-10-28-1054

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.08 % (worst 1.34 %, 46 it) · fixed 40 0.94 % · 120 0.31 % · plume: 2.04 % (worst 3.25 %, 46 it) · fixed 40 1.84 % · 120 0.55 % · ink: 3.19 % (worst 8.74 %, 46 it) · fixed 40 4.47 % · 120 1.48 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 20.42 % (worst 29.09 %, 70 it): far 41.57 %, obstacle 2.03 %, edge 188.10 % · fixed 120: far 18.21 %, obstacle 1.12 %, edge 201.81 % · rocks: all 53.10 % (worst 54.45 %, 46 it): far 24.50 %, obstacle 62.17 %, edge 9.17 % · fixed 120: far 10.34 %, obstacle 63.79 %, edge 19.35 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.43 % in 21 s (-0.21 %/10 s, page log -0.44 %) · kh: -0.64 % in 21 s (-0.31 %/10 s, page log -0.66 %) · ink: -0.08 % in 21 s (-0.04 %/10 s, page log -0.18 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.00 % in 21 s (-0.00 %/10 s, page log -0.00 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.757 Hz real (Fourier 0.755), St 0.1995 (sim 0.1995), amp 150.5 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.05 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1978 (sim 0.1979), amp 151.22 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.745 (Fourier 0.745), wake amp 153.23 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.62 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.4 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.7 ms (n 60) · hat 8.8 ms (n 119) · snare 8.9 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.9 | 0.827 |
| kh | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| plume | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1.002 |
| ink | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.2 | 1 |
| rocks | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1.002 |
