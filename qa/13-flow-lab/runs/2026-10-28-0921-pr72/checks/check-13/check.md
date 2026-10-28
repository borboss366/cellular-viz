# 13 Flow Lab check · 2026-10-28-0942

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.93 % (worst 1.50 %, 46 it) · fixed 40 1.09 % · 120 0.33 % · plume: 2.41 % (worst 3.00 %, 46 it) · fixed 40 3.19 % · 120 0.45 % · ink: 3.09 % (worst 6.74 %, 46 it) · fixed 40 4.28 % · 120 1.60 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 31.56 % (worst 37.69 %, 70 it): far 54.50 %, obstacle 3.65 %, edge 375.40 % · fixed 120: far 21.37 %, obstacle 1.21 %, edge 194.91 % · rocks: all 54.92 % (worst 55.77 %, 46 it): far 20.52 %, obstacle 65.61 %, edge 10.26 % · fixed 120: far 10.56 %, obstacle 63.15 %, edge 32.44 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.32 % in 21 s (-0.15 %/10 s, page log -0.18 %) · kh: -0.67 % in 21 s (-0.33 %/10 s, page log -0.70 %) · ink: 0.14 % in 21 s (0.07 %/10 s, page log -0.02 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.00 % in 21 s (-0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.37 · 120 BPM: 1.005 Hz real (Fourier 1.005), St 0.1987 (sim 0.1987), amp 151.05 · 150 BPM: 1.251 Hz real (Fourier 1.25), St 0.1978 (sim 0.1979), amp 151.22 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.749 (Fourier 0.75), wake amp 155.84 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 154.81 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.43 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.6 ms (n 60) · hat 8.7 ms (n 119) · snare 8.6 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 11.3 | 0.829 |
| kh | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| plume | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.1 | 1.002 |
| ink | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.2 | 1.002 |
| rocks | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.4 | 1 |
| curl | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |
