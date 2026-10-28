# 13 Flow Lab check · 2026-10-27-1944

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.94 % (worst 1.19 %, 46 it) · fixed 40 0.96 % · 120 0.31 % · plume: 2.29 % (worst 3.39 %, 46 it) · fixed 40 2.17 % · 120 0.63 % · ink: 5.46 % (worst 7.71 %, 46 it) · fixed 40 3.91 % · 120 1.14 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 21.06 % (worst 30.39 %, 70 it): far 39.27 %, obstacle 2.58 %, edge 227.47 % · fixed 120: far 20.68 %, obstacle 1.18 %, edge 194.91 % · rocks: all 67.66 % (worst 71.87 %, 46 it): far 30.42 %, obstacle 78.68 %, edge 60.72 % · fixed 120: far 7.62 %, obstacle 80.71 %, edge 9.04 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.30 % in 21 s (-0.15 %/10 s, page log -0.34 %) · kh: -0.59 % in 21 s (-0.28 %/10 s, page log -0.62 %) · ink: -0.11 % in 21 s (-0.05 %/10 s, page log -0.02 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.00 % in 21 s (-0.00 %/10 s, page log -0.03 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.32 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.05 · 150 BPM: 1.254 Hz real (Fourier 1.255), St 0.1984 (sim 0.1984), amp 151.36 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.748 (Fourier 0.75), wake amp 155.41 · 120 BPM: want 1.000, got 1.001 (Fourier 1), wake amp 156.76 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.36 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.6 ms (n 60) · hat 8.5 ms (n 119) · snare 8.5 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.8 | 0.827 |
| kh | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1.002 |
| plume | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| ink | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.1 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| curl | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.9 | 1 |
