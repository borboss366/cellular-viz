# 13 Flow Lab check · 2026-10-27-1856

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.78 % (worst 1.54 %, 46 it) · fixed 40 1.13 % · 120 0.29 % · plume: 2.17 % (worst 3.11 %, 46 it) · fixed 40 2.35 % · 120 0.50 % · ink: 3.63 % (worst 7.21 %, 46 it) · fixed 40 7.65 % · 120 1.67 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 20.85 % (worst 36.44 %, 70 it): far 34.39 %, obstacle 2.72 %, edge 310.17 % · fixed 120: far 13.54 %, obstacle 0.98 %, edge 66.88 % · rocks: all 28.85 % (worst 36.45 %, 52 it): far 49.53 %, obstacle 6.72 %, edge 95.18 % · fixed 120: far 27.86 %, obstacle 2.82 %, edge 79.37 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.45 % in 21 s (-0.22 %/10 s, page log -0.30 %) · kh: -0.61 % in 21 s (-0.30 %/10 s, page log -0.64 %) · ink: -0.05 % in 21 s (-0.02 %/10 s, page log -0.24 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.60 %) · plume+conserve: -0.03 % in 21 s (-0.02 %/10 s, page log -0.00 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1994 (sim 0.1994), amp 150.44 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.246 Hz real (Fourier 1.245), St 0.1971 (sim 0.1971), amp 150.81 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.746 (Fourier 0.75), wake amp 154.24 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.49 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.48 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.6 ms (n 60) · hat 8.6 ms (n 119) · snare 8.6 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.5 | 0.827 |
| kh | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| plume | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| ink | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.1 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.4 | 1 |
| curl | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |
