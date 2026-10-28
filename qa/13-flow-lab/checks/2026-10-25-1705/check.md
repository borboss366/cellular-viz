# 13 Flow Lab check · 2026-10-25-1705

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 1.20 % (worst 1.63 %, 46 it) · fixed 40 1.37 % · 120 0.32 % · plume: 1.18 % (worst 1.89 %, 46 it) · fixed 40 1.45 % · 120 0.25 % · ink: 4.24 % (worst 5.72 %, 46 it) · fixed 40 5.56 % · 120 1.42 % · curl: 0.00 % (worst 0.00 %, null it) · fixed 40 0.00 % · 120 0.00 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 13.79 % (worst 20.06 %, 64 it): far 25.01 %, obstacle 1.93 %, edge 342.45 % · fixed 120: far 17.19 %, obstacle 1.32 %, edge 94.57 % · rocks: all 26.28 % (worst 28.53 %, 52 it): far 35.09 %, obstacle 5.82 %, edge 76.31 % · fixed 120: far 18.45 %, obstacle 2.56 %, edge 51.57 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ❌ | plume: -1.50 % in 21 s (-0.73 %/10 s, page log -4.11 %) · kh: -5.17 % in 21 s (-2.50 %/10 s, page log -5.72 %) · ink: 3.60 % in 21 s (1.74 %/10 s, page log 2.59 %) · curl: -27.39 % in 21 s (-13.26 %/10 s, page log -23.05 %) · plume+conserve: 4.05 % in 21 s (1.96 %/10 s, page log -0.00 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.1241 → 1.1111 · 90 BPM: 0.743 Hz real (Fourier 0.79), St 0.1822 (sim 0.1822), amp 126.12 · 120 BPM: 0.987 Hz real (Fourier 0.985), St 0.1815 (sim 0.1816), amp 121.16 · 150 BPM: 1.288 Hz real (Fourier 1.29), St 0.1896 (sim 0.1896), amp 120.37 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.732 (Fourier 0.75), wake amp 126.28 · 120 BPM: want 1.000, got 1.007 (Fourier 1.045), wake amp 119.74 · 150 BPM: want 1.250, got 1.256 (Fourier 1.245), wake amp 132.18 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.3 ms (n 60) · hat 8.3 ms (n 119) · snare 8.4 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 64 / 52 | 11.7 | 0.892 |
| kh | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1 |
| plume | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1 |
| ink | 16.7 / 0 | 16.8 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.1 | 1 |
| rocks | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.2 | 1 |
| curl | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 0 / 0 | 2.7 | 1.002 |

## Follow-up: curl · script qa/history/2026-10-25-1716-curl-drift-probe.sh
- The curl field itself is now exact: my MAC divergence 2.4e-6 of the mean speed, wall-normal velocity 0.
- Raw dye drift still moves and changes sign with the flow: default −9.3 %/10 s · wind 45 +12.9 % · wind 22.5 +2.3 % · octaves 1 +10.5 % · noiseScale 1.1 −45.8 %. With a divergence-free, wall-tight field, that is the dye advection (one-step semi-Lagrangian, bilinear) not conserving mass in a fast, fine flow — not leftover divergence.
