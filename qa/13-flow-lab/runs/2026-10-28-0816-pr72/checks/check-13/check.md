# 13 Flow Lab check · 2026-10-28-0837

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.01 % (worst 1.45 %, 46 it) · fixed 40 1.02 % · 120 0.28 % · plume: 2.48 % (worst 3.42 %, 46 it) · fixed 40 2.33 % · 120 0.46 % · ink: 3.10 % (worst 3.86 %, 46 it) · fixed 40 5.62 % · 120 1.49 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 25.45 % (worst 30.76 %, 70 it): far 45.19 %, obstacle 2.87 %, edge 537.82 % · fixed 120: far 20.32 %, obstacle 1.12 %, edge 154.55 % · rocks: all 59.33 % (worst 60.27 %, 46 it): far 24.62 %, obstacle 67.60 %, edge 27.72 % · fixed 120: far 8.94 %, obstacle 70.41 %, edge 8.14 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.34 % in 21 s (-0.16 %/10 s, page log -0.41 %) · kh: -0.65 % in 21 s (-0.31 %/10 s, page log -0.67 %) · ink: 0.00 % in 21 s (0.00 %/10 s, page log -0.02 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.58 %) · plume+conserve: -0.01 % in 21 s (-0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.39 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.08 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1979 (sim 0.1979), amp 151.2 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.749 (Fourier 0.75), wake amp 155.64 · 120 BPM: want 1.000, got 0.999 (Fourier 1), wake amp 156.15 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.73 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.5 ms (n 60) · hat 8.5 ms (n 119) · snare 8.6 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.6 | 0.827 |
| kh | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1.002 |
| plume | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| ink | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.3 | 1 |
| rocks | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.4 | 1 |
| curl | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |
