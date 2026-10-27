# 13 Flow Lab check · 2026-10-27-1445

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.72 % (worst 1.17 %, 52 it) · fixed 40 1.04 % · 120 0.28 % · plume: 1.98 % (worst 3.05 %, 46 it) · fixed 40 1.81 % · 120 0.40 % · ink: 3.01 % (worst 6.59 %, 46 it) · fixed 40 4.92 % · 120 1.11 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 21.27 % (worst 36.44 %, 70 it): far 38.63 %, obstacle 2.83 %, edge 302.78 % · fixed 120: far 14.78 %, obstacle 0.76 %, edge 113.29 % · rocks: all 26.57 % (worst 30.96 %, 52 it): far 37.15 %, obstacle 6.47 %, edge 39.60 % · fixed 120: far 21.30 %, obstacle 2.31 %, edge 33.28 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.47 % in 21 s (-0.23 %/10 s, page log -0.43 %) · kh: -0.66 % in 21 s (-0.32 %/10 s, page log -0.70 %) · ink: -0.06 % in 21 s (-0.03 %/10 s, page log -0.27 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.61 %) · plume+conserve: 0.00 % in 21 s (0.00 %/10 s, page log -0.03 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2054 · 90 BPM: 0.757 Hz real (Fourier 0.755), St 0.1995 (sim 0.1995), amp 150.52 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1979 (sim 0.1979), amp 151.22 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.749 (Fourier 0.75), wake amp 155.33 · 120 BPM: want 1.000, got 1.002 (Fourier 1), wake amp 156.74 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.86 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 9.5 ms (n 60) · hat 9.1 ms (n 119) · snare 9.3 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.9 | 0.827 |
| kh | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| plume | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11 | 1 |
| ink | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.3 | 1 |
| rocks | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.3 | 1 |
| curl | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1.002 |
