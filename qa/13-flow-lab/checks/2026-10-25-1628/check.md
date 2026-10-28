# 13 Flow Lab check · 2026-10-25-1628

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive) — reported only | ℹ️ | kh: 0.98 % (worst 1.37 %, 46 it) · fixed 40 1.58 % · 120 0.25 % · plume: 1.57 % (worst 2.21 %, 46 it) · fixed 40 1.32 % · 120 0.24 % · ink: 3.91 % (worst 7.70 %, 46 it) · fixed 40 5.29 % · 120 0.91 % · curl: 4.69 % (worst 5.52 %, 46 it) · fixed 40 5.42 % · 120 2.10 % |
| divergence left, vortex/rocks — split far / near obstacle / near open edge (reported only) | ℹ️ | vortex: all 14.20 % (worst 24.15 %, 64 it): far 24.80 %, obstacle 1.83 %, edge 277.20 % · fixed 120: far 17.90 %, obstacle 1.45 %, edge 100.44 % · rocks: all 15.02 % (worst 19.88 %, 52 it): far 22.62 %, obstacle 4.09 %, edge 20.98 % · fixed 120: far 16.17 %, obstacle 1.89 %, edge 30.21 % |
| dye kept in a closed box, raw (?conserve=0, sources and hit splats off), |drift| ≤ 5 % per 10 s — vortex/rocks are open (dye exits by design) | ❌ | plume: -7.46 % in 21 s (-3.60 %/10 s, page log -8.76 %) · kh: -5.66 % in 21 s (-2.74 %/10 s, page log -6.33 %) · ink: -2.05 % in 21 s (-0.99 %/10 s, page log -5.16 %) · curl: -15.48 % in 21 s (-7.47 %/10 s, page log -12.33 %) · plume+conserve: 0.40 % in 21 s (0.19 %/10 s, page log -0.04 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.1241 → 1.1009 · 90 BPM: 0.72 Hz real (Fourier 0.765), St 0.1766 (sim 0.1766), amp 122.5 · 120 BPM: 0.987 Hz real (Fourier 0.985), St 0.1815 (sim 0.1816), amp 121.11 · 150 BPM: 1.288 Hz real (Fourier 1.29), St 0.1896 (sim 0.1896), amp 120.38 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ❌ | 90 BPM: want 0.750, got 0.727 (Fourier 0.72), wake amp 124.55 · 120 BPM: want 1.000, got 0.947 (Fourier 0.94), wake amp 125.78 · 150 BPM: want 1.250, got 1.255 (Fourier 1.315), wake amp 126.81 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 8.5 ms (n 60) · hat 8.5 ms (n 119) · snare 8.5 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 64 / 52 | 11.6 | 0.89 |
| kh | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.2 | 1.002 |
| plume | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.3 | 1.002 |
| ink | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.2 | 1 |
| rocks | 16.7 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 11.2 | 1 |
| curl | 16.8 / 0 | 16.8 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 40 | 11.1 | 1 |

## Follow-up (same build) · script: qa/history/2026-10-25-1630-flow13-probe.sh
- Beat over 60 s (zero-crossing resolution ±1.7 % instead of ±4 % in 24 s): 120 BPM lock on 0.980 Hz (−2.0 %, passes), lock off 0.964 Hz. The −5.3 % in the 24 s run above is within that run's resolution.
- curl look raw drift −9.1 %/10 s at the adaptive 58 iterations and −13.8 %/10 s at fixed 120 (divergence 0.19 % → 0.07 %). More iterations make it worse, so it's not the leftover divergence.
