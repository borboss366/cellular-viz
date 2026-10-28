# 13 Flow Lab check · 2026-10-28-0917

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.93 % (worst 1.46 %, 46 it) · fixed 40 1.22 % · 120 0.36 % · plume: 1.54 % (worst 2.90 %, 46 it) · fixed 40 2.65 % · 120 0.45 % · ink: 5.09 % (worst 6.99 %, 46 it) · fixed 40 4.87 % · 120 1.62 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 25.41 % (worst 31.85 %, 70 it): far 44.29 %, obstacle 2.92 %, edge 493.27 % · fixed 120: far 18.61 %, obstacle 1.09 %, edge 154.55 % · rocks: all 53.67 % (worst 58.54 %, 46 it): far 22.72 %, obstacle 64.04 %, edge 11.78 % · fixed 120: far 7.40 %, obstacle 71.00 %, edge 4.45 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ✅ | plume: -0.33 % in 21 s (-0.16 %/10 s, page log -0.30 %) · kh: -0.63 % in 21 s (-0.31 %/10 s, page log -0.66 %) · ink: -0.37 % in 21 s (-0.18 %/10 s, page log -0.47 %) · curl: -1.47 % in 21 s (-0.71 %/10 s, page log -1.59 %) · plume+conserve: -0.02 % in 21 s (-0.01 %/10 s, page log -0.02 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.2081 → 1.2135 · 90 BPM: 0.756 Hz real (Fourier 0.755), St 0.1992 (sim 0.1992), amp 151.35 · 120 BPM: 1.003 Hz real (Fourier 1), St 0.1982 (sim 0.1982), amp 150.57 · 150 BPM: 1.255 Hz real (Fourier 1.255), St 0.1985 (sim 0.1985), amp 151.06 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.748 (Fourier 0.75), wake amp 155.13 · 120 BPM: want 1.000, got 1 (Fourier 1), wake amp 156.61 · 150 BPM: want 1.250, got 1.249 (Fourier 1.25), wake amp 156.29 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.8 ms (n 60) · hat 8.7 ms (n 119) · snare 8.9 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 52 | 10.6 | 0.827 |
| kh | 16.8 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| plume | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| ink | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 10.3 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.4 | 1 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.8 | 1 |
