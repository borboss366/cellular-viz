# 13 Flow Lab check · 2026-10-25-1957

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.05 % (worst 1.61 %, 46 it) · fixed 40 0.90 % · 120 0.30 % · plume: 1.91 % (worst 3.19 %, 46 it) · fixed 40 2.68 % · 120 0.40 % · ink: 3.86 % (worst 5.73 %, 46 it) · fixed 40 3.19 % · 120 1.30 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 21.27 % (worst 36.44 %, 70 it): far 38.63 %, obstacle 2.83 %, edge 227.96 % · fixed 120: far 13.54 %, obstacle 0.99 %, edge 77.34 % · rocks: all 23.05 % (worst 27.79 %, 52 it): far 36.54 %, obstacle 5.45 %, edge 66.65 % · fixed 120: far 22.33 %, obstacle 2.83 %, edge 50.90 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.33 % in 21 s (-0.16 %/10 s, page log -0.27 %) · kh: -0.60 % in 21 s (-0.29 %/10 s, page log -0.61 %) · ink: -0.15 % in 21 s (-0.07 %/10 s, page log -0.20 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.01 % in 21 s (-0.00 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.755 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 150.88 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.246 Hz real (Fourier 1.245), St 0.1971 (sim 0.1971), amp 150.74 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.751 (Fourier 0.75), wake amp 156.17 · 120 BPM: want 1.000, got 1.001 (Fourier 1), wake amp 156.82 · 150 BPM: want 1.250, got 1.25 (Fourier 1.25), wake amp 156.35 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.6 ms (n 60) · hat 8.6 ms (n 119) · snare 8.7 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.6 | 0.827 |
| kh | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| plume | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1.002 |
| ink | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.2 | 1 |
| rocks | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.6 | 1 |
| curl | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.9 | 1.002 |
