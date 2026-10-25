# 13 Flow Lab check · 2026-10-25-1604

| check | result | detail |
|---|---|---|
| divergence left, as shipped (adaptive): kh/plume/ink/curl ≤ 5 % worst sample | ❌ | kh: 32.40 % (worst 36.18 %, 16 it) · fixed 40 9.34 % · 120 2.65 % · plume: 13.27 % (worst 16.45 %, 46 it) · fixed 40 17.71 % · 120 3.03 % · ink: 12.18 % (worst 13.06 %, 52 it) · fixed 40 17.31 % · 120 5.20 % · curl: 25.43 % (worst 28.55 %, 40 it) · fixed 40 25.41 % · 120 10.77 % |
| divergence left, vortex/rocks ≤ 15 % (MVP) — split far / near obstacle / near open edge | ❌ | vortex: all 17.09 % (worst 18.47 %, 70 it): far 30.19 %, obstacle 3.76 %, edge 289.39 % · fixed 120: far 16.49 %, obstacle 1.76 %, edge 189.19 % · rocks: all 49.04 % (worst 51.07 %, 40 it): far 69.85 %, obstacle 9.44 %, edge 164.07 % · fixed 120: far 22.33 %, obstacle 2.28 %, edge 41.67 % |
| dye kept in a closed box, raw (?conserve=0), ≤ 5 % per 10 s | ❌ | plume: 15.54 % in 21 s (7.52 %/10 s, page log 15.22 %) · kh: -5.85 % in 21 s (-2.82 %/10 s, page log -6.68 %) · plume+conserve: 1.49 % in 21 s (0.72 %/10 s, page log -0.01 %) |
| natural St steady ±10 % across 90/120/150 BPM (?lock=0, real clock) | ✅ | calibrate(): fNat 1.3825 → 1.1241 · 90 BPM: 0.75 Hz real (Fourier 0.71), St 0.184 (sim 0.184), amp 121.35 · 120 BPM: 0.957 Hz real (Fourier 1.005), St 0.1761 (sim 0.1762), amp 116.35 · 150 BPM: 1.198 Hz real (Fourier 1.21), St 0.1763 (sim 0.1763), amp 119.9 |
| art mode (lock on): swirl on the beat, BPM/120 ±5 % | ✅ | 90 BPM: want 0.750, got 0.734 (Fourier 0.725), wake amp 126.62 · 120 BPM: want 1.000, got 0.989 (Fourier 0.98), wake amp 122.4 · 150 BPM: want 1.250, got 1.259 (Fourier 1.265), wake amp 121.52 |
| sync from __qa.events (≤ 40 ms) | ✅ | kick 9.4 ms (n 60) · hat 9.7 ms (n 119) · snare 9.3 ms (n 30) |
| 🎲 then morph finishes, no NaN | ✅ | vortex → kh (25 % at 4 s) → kh |
| page alive | ✅ | |
| 1080p p95 ≤ 16.8 ms (hard) | ✅ | |
| 1440p p95 ≤ 16.8 ms | ✅ | |
| errors | ✅ | none |

| recipe | 1080p p95 / >20 ms | 1440p | 4K | canvas at 4K | grid / dye at 4K | SOR iters 1080p / 4K | GPU ms 1080p | sim/real 1080p |
|---|---|---|---|---|---|---|---|---|
| vortex | 16.7 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 70 / 58 | 10.4 | 0.723 |
| kh | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 16 / 16 | 15.7 | 1 |
| plume | 16.8 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 46 / 46 | 10.7 | 1 |
| ink | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 52 / 46 | 10.7 | 1 |
| rocks | 16.7 / 0 | 16.7 / 0 | 16.8 / 0 | 3840×2160 | 455×256 / 1920×1080 | 32 / 32 | 11.9 | 1 |
| curl | 16.8 / 0 | 16.7 / 0 | 16.7 / 0 | 3840×2160 | 455×256 / 1920×1080 | 40 / 40 | 11.3 | 1 |

## Follow-up (same build, by hand)
- Divergence split: the "edge" ratio > 100 % only means the inflow edge had almost no divergence to begin with. In absolute terms (page split, rms/mean speed after projection) the three classes are level: vortex far 0.22 %, obstacle 0.58 %, edge 0.26 %; rocks far 0.94 %, obstacle 0.97 %, edge 0.83 %. Spread evenly, so this is the solver's limit, not an obstacle or exit bug.
- SOR iterations are expensive on this GPU (~0.17 ms per iteration per frame at 2 steps): kh fixed 16 it 8.3 ms GPU / 60 fps · 120 it 44 ms / 24 fps · 200 it 68 ms / 14.5 fps; rocks 120 it 34 ms / 33 fps; vortex 200 it 32 ms / 31 fps. The adaptive budget lands on 16–70 iterations, so ≤ 5 % on the open looks is out of reach at 60 fps without a cheaper solver.
- calibrate() at dtSim 1/60 gives fNat 1.1241, not the shipped 1.3825. As shipped (no fNat in the URL) the street runs ~20 % slow even with lock on: 0.603 / 0.779 / 1.029 Hz at 90 / 120 / 150 BPM. With ?fNat=1.1241: raw St 0.184 / 0.176 / 0.176 and lock 0.734 / 0.989 / 1.259 Hz (both pass).
