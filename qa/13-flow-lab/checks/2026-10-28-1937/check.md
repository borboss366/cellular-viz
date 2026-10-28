# 13 Flow Lab check · 2026-10-28-1937

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.16 % (worst 1.60 %, 46 it) · fixed 40 1.05 % · 120 0.33 % · plume: 1.85 % (worst 2.99 %, 46 it) · fixed 40 2.85 % · 120 0.46 % · ink: 3.36 % (worst 7.76 %, 46 it) · fixed 40 5.30 % · 120 1.72 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 23.47 % (worst 31.69 %, 70 it): far 44.72 %, obstacle 2.87 %, edge 489.19 % · fixed 120: far 17.84 %, obstacle 1.12 %, edge 183.89 % · rocks: all 54.02 % (worst 58.75 %, 46 it): far 19.24 %, obstacle 65.56 %, edge 10.79 % · fixed 120: far 18.06 %, obstacle 67.46 %, edge 25.07 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.38 % in 21 s (-0.18 %/10 s, page log -0.41 %) · kh: -0.64 % in 21 s (-0.31 %/10 s, page log -0.67 %) · ink: -0.17 % in 21 s (-0.08 %/10 s, page log -0.23 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: 0.00 % in 21 s (0.00 %/10 s, page log 0.00 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2054 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.34 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.06 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1978 (sim 0.1979), amp 151.22 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.749 (Fourier 0.75), wake amp 155.19 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.42 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.2 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 17.3 ms (n 60) · hat 17.6 ms (n 119) · snare 17.2 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 11.3 | 0.829 |
| kh | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| plume | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| ink | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.2 | 1.002 |
| rocks | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1.002 |
| curl | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1.002 |
| GPU busy before the run | ℹ️ | 2, 1, 0, 0, 0 % (idle ≤ 10 % for 5 s; waited 4 s) |
